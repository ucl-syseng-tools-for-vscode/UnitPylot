import * as vscode from 'vscode';
import { exec } from 'child_process';
import { convertToBits, getPythonPath, getTestsForFunction, getTestsForFunctions, parseCoverage } from './helper-functions';
import { TestResult, TestFileResult, TestFunctionResult } from './results';
import { Coverage, FileCoverage, mergeCoverage } from './coverage';
import { Hash, FileHash, FunctionHash, getWorkspaceHash, getModifiedFiles } from './file-hash';
import { getPytestResult, parsePytestOutput, PYTEST_MONITOR_OUTPUT_FILE, PYTEST_OUTPUT_FILE } from './parser';
import { fail } from 'assert';
import { promisify } from 'util';
import { Settings } from '../settings/settings';

const execPromise = promisify(exec);

type TestRunnerState = {
    results: TestResult;
    coverage: Coverage;
    hash: Hash;
}

/*
    * Class to hold test results and coverage data for the whole project.
    * Only one instance of this class should exist at any given time.
*/

export class TestRunner {
    private static instance: TestRunner;
    private results: TestResult | undefined;
    private coverage: Coverage | undefined;
    private readonly stateKey: string = 'testResultsState';
    private hash: Hash = {};
    private notifications: boolean = true;

    private constructor(private workspaceState: vscode.Memento) {
        this.loadState();
    }

    public static getInstance(workspaceState: vscode.Memento): TestRunner {
        if (!TestRunner.instance) {
            TestRunner.instance = new TestRunner(workspaceState);
        }
        return TestRunner.instance;
    }

    private loadState(): void {
        const state = this.workspaceState.get(this.stateKey);
        const typedState = state as TestRunnerState;
        if (typedState) {
            this.results = typedState.results;
            this.coverage = typedState.coverage;
            this.hash = typedState.hash;
        } else {
            this.results = undefined; // Initialize with default values
            this.coverage = undefined; // Initialize with default values
        }
    }

    public saveState(): void {
        const state = {
            results: this.results,
            coverage: this.coverage,
            hash: this.hash
        };
        this.workspaceState.update(this.stateKey, state);
    }

    public setNotifications(value: boolean): void {
        this.notifications = value;
    }

    public resetState(): void {
        this.results = undefined;
        this.coverage = undefined;
        this.hash = {};
        this.saveState();
    }

    // Get n slowest tests (default n = 5)
    public async getSlowestTests(n: number = 5): Promise<TestFunctionResult[]> {
        await this.runNeccecaryTests();

        const slowestTests: TestFunctionResult[] = [];
        if (this.results) {
            for (const filePath in this.results) {
                for (const test in this.results[filePath]) {
                    slowestTests.push(this.results[filePath][test]);
                }
            }
        }
        slowestTests.sort((a, b) => (b.time || 0) - (a.time || 0));
        return slowestTests.slice(0, n);
    }

    // Get coverage data
    public async getCoverage(): Promise<Coverage | undefined> {
        await this.runNeccecaryTests();
        return this.coverage;
    }


    // Get memory of tests biggestAllocations
    public async getMemory(): Promise<TestFunctionResult[]> {
        await this.runNeccecaryTests();

        const memoryTests: TestFunctionResult[] = [];
        console.log("RESULTS", this.results);
        if (this.results) {
            for (const filePath in this.results) {
                for (const test in this.results[filePath]) {
                    memoryTests.push(this.results[filePath][test]);
                }
            }
        }
        console.log("MEMORY", memoryTests);
        return memoryTests
    }

    // Get all test results
    public async getAllResults(): Promise<TestResult | undefined> {
        await this.runNeccecaryTests();
        return this.results;
    }

    // Get overall pass / fail results
    public async getResultsSummary(): Promise<{ passed: number, failed: number }> {
        await this.runNeccecaryTests();
        console.log("PASRESULTS", this.results);

        let passed = 0;
        let failed = 0;
        if (this.results) {
            for (const filePath in this.results) {
                for (const test in this.results[filePath]) {
                    if (this.results[filePath][test].passed) {
                        passed++;
                    } else {
                        failed++;
                    }
                }
            }
        }
        return { passed, failed };
    }

    // Get pass / fail results for a specific file
    public async getResultsForFile(filePath: string): Promise<TestFileResult> {
        await this.runNeccecaryTests();

        if (this.results) {
            return this.results[filePath];
        }
        return {};
    }

    // Get failing tests with their line numbers
    public async getAllFailingTests(): Promise<TestFunctionResult[]> {
        await this.runNeccecaryTests();

        const failingTests: TestFunctionResult[] = [];
        if (this.results) {
            for (const filePath in this.results) {
                for (const test in this.results[filePath]) {
                    if (!this.results[filePath][test].passed) {
                        failingTests.push(this.results[filePath][test]);
                    }
                }
            }
        }
        return failingTests;
    }

    // Get n highest memory usage tests
    public async getHighestMemoryTests(n: number = 5): Promise<TestFunctionResult[]> {
        await this.runNeccecaryTests();
        const tests: TestFunctionResult[] = [];
        if (this.results) {
            for (const filePath in this.results) {
                for (const test in this.results[filePath]) {
                    if (!this.results[filePath][test].totalMemory) {
                        continue;
                    }
                    tests.push(this.results[filePath][test]);
                }
            }
        }
        tests.sort((a, b) => (b.totalMemory || 0) - (a.totalMemory || 0));

        return tests.slice(0, n);
    }

    // Remove deleted test results for deleted tests
    private removeDeletedTests(deletedFiles: Hash): void {
        // Remove deleted tests
        for (const [filePath, file] of Object.entries(deletedFiles)) {
            if (!file.isTestFile) {
                continue;  // Skip non-test files
            }
            if (this.results && this.results[filePath]) {
                // The test name in file.functions does not include the test suffix
                // Make dict of test name to test name in results
                const normalisedTestNames: { [key: string]: string[] } = {};
                for (const testName in this.results[filePath]) {
                    const normalisedName = testName.split('[')[0];
                    if (!normalisedTestNames[normalisedName]) {
                        normalisedTestNames[normalisedName] = [];
                    }
                    normalisedTestNames[normalisedName].push(testName);
                }

                for (const test in file.functions) {
                    // Delete the test from the results
                    if (normalisedTestNames[test]) {
                        for (const testName of normalisedTestNames[test]) {
                            delete this.results[filePath][testName];
                        }
                    }
                }
            }
        }
    }

    // Get modified tests and remove deleted tests
    private async getModifiedTests(): Promise<Set<TestFunctionResult>> {
        const newHash = await getWorkspaceHash();
        const diff = await getModifiedFiles(this.hash, newHash);
        const testsForFunctions = await getTestsForFunctions();
        const modifiedTests: Set<TestFunctionResult> = new Set();

        // Remove deleted tests
        this.removeDeletedTests(diff.deleted);

        // Add new/modified tests
        for (const [filePath, file] of Object.entries(diff.added)) {
            if (file.isTestFile) {
                for (const functionName in file.functions) {
                    modifiedTests.add(
                        {
                            filePath: filePath,
                            testName: functionName,
                            passed: false,
                            errorMessage: '',
                            time: NaN,
                        }
                    )
                }
            } else { // Modified non-test file so add relevant tests
                for (const functionName in file.functions) {
                    for (const testName of getTestsForFunction(functionName, testsForFunctions)) {
                        modifiedTests.add(
                            {
                                filePath: testName.split('::')[0],
                                testName: testName.split('::').slice(1).join('::'),
                                passed: false,
                                errorMessage: '',
                                time: NaN,
                            }
                        )
                    }

                }

            }
        }
        this.hash = newHash;
        return modifiedTests;
    }

    // Run necessary tests
    private async runNeccecaryTests(): Promise<void> {
        if (!Settings.RUN_NECESSARY_TESTS_ONLY || !this.results || !this.coverage || !this.hash) {
            this.notifications ? vscode.window.showInformationMessage('Running all tests...') : null;
            await this.runTests();
            return;
        }

        const testsToRun: Set<TestFunctionResult> = await this.getModifiedTests();
        let testsToRunUnique: TestFunctionResult[] = Array.from(testsToRun); // Convert to list

        // Pytest only runs functions that start with test_
        // OR methods that start with test_ in classes that start with Test
        // We filter out the tests that don't match this pattern
        testsToRunUnique = testsToRunUnique.filter(test =>
            test.testName?.startsWith('test_')
            || (test.testName?.startsWith('Test')
                && test.testName?.split('::')[1]?.startsWith('test_'))
        );

        // Ouput the tests that need to be run as notifications
        if (testsToRunUnique.length === 0) {
            this.notifications ? vscode.window.showInformationMessage('No test diffs found...') : null;
        } else {
            const testsInFiles: { [key: string]: string[] } = {};

            for (const test of testsToRunUnique) {
                if (test.filePath === undefined || test.testName === undefined) {
                    continue;
                }
                if (!testsInFiles[test.filePath]) {
                    testsInFiles[test.filePath] = [];
                }
                testsInFiles[test.filePath].push(test.testName);
            }

            // Remove duplicates
            for (const [filePath, tests] of Object.entries(testsInFiles)) {
                testsInFiles[filePath] = [...new Set(tests)];
            }

            for (const [filePath, tests] of Object.entries(testsInFiles)) {
                this.notifications ? vscode.window.showInformationMessage(`Running tests in ${filePath}: ${tests.join(', ')}`) : null;
            }
        }

        await this.runTests(testsToRunUnique);
    }

    // Get coverage data
    private updateCoverage(rewrite: boolean): void {
        // Process coverage data
        const newCoverage = parseCoverage();  // Implemented in helper-functions.ts
        if (!this.coverage) {
            this.coverage = newCoverage;
            return;
        }
        if (rewrite) {
            this.coverage = newCoverage;
        } else {
            // Merge the new and old coverage data
            this.coverage = mergeCoverage(this.coverage, newCoverage);  // Implemented in coverage.ts
        }
    }

    // Parse test results
    private async updateTestResults(rewrite: boolean): Promise<void> {
        const newResults: TestResult = await getPytestResult();  // Implemented in parser.ts
        // If all tests are to be rewritten, overwrite the results
        if (rewrite) {
            this.results = newResults;
            return;
        }
        // Otherwise, update the results
        if (!this.results) {
            this.results = newResults;
            return;
        }
        for (const filePath in newResults) {
            if (!this.results[filePath]) {
                this.results[filePath] = newResults[filePath];
                continue;
            }
            for (const test in newResults[filePath]) {
                this.results[filePath][test] = newResults[filePath][test];
            }
        }
    }

    /*
        * Run tests
        * Only run tests that have changes since the last run
        * OR run tests that correspond to code that has changed since the last run
    */

    public async runTests(testsToRun?: TestFunctionResult[]): Promise<void> {
        if (testsToRun && testsToRun.length === 0) {  // No tests to run
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        const pythonPath = await getPythonPath();
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const testsToRunString = testsToRun ? testsToRun.map(test => test.testName ? `${test.filePath}::${test.testName}` : `${test.filePath}`).join(' ') : '';
        const command =
            `${pythonPath} -m pytest -vv --durations=${Settings.NUMBER_OF_SLOWEST_TESTS} --maxfail=0 --cov --cov-report=json --cov-branch --json-report --json-report-file=${PYTEST_OUTPUT_FILE} --db ${PYTEST_MONITOR_OUTPUT_FILE} --tb=short ${testsToRunString}|| true`;

        // The || true is to prevent the command from failing if there are failed tests
        // For specific tests, append FOLDER/FILE_NAME::TEST_NAME
        // Example: tests/fizzbuzz_test.py::test_error_shown_for_negative

        try {
            const { stdout, stderr } = await execPromise(command, { cwd: workspacePath });
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
            // Process the output
            await this.updateTestResults(testsToRun ? false : true);  // Rewrite if no tests specified
            this.updateCoverage(testsToRun ? false : true);
            this.saveState();

        } catch (error) {
            if (error instanceof Error) {
                console.error(`Error executing command: ${error.message}`);
            } else {
                console.error('Error executing command:', error);
            }
        }


        // Save hash manually if all tests were run
        if (!testsToRun) {
            this.hash = await getWorkspaceHash();
            this.saveState();
        }
    }
}