import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { getPythonPath, getTestsForFunction, getTestsForFunctions, parseCoverage } from './helper-functions';
import { TestResult, TestFileResult, TestFunctionResult } from './results';
import { Coverage, mergeCoverage } from './coverage';
import { Hash, getWorkspaceHash, getModifiedFiles } from './file-hash';
import { getPytestResult, PYTEST_MONITOR_OUTPUT_FILE, PYTEST_OUTPUT_FILE } from './parser';
import { Settings } from '../settings/settings';
import { HistoryManager } from '../test-history/history-manager';

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
    private readonly stateKey: string = 'testResultsState';
    private testProcess: any = null; // Store the process reference

    public results: TestResult | undefined;  // These have to be public for mocking in tests
    public coverage: Coverage | undefined;
    public hash: Hash = {};

    private constructor(private workspaceState: vscode.Memento) {
        this.loadState();
    }

    /**
     * Get the singleton instance of the TestRunner
     * 
     * @param workspaceState The workspace state to store/get the test results
     * @returns The singleton instance of the TestRunner
     */
    public static getInstance(workspaceState: vscode.Memento): TestRunner {
        if (!TestRunner.instance) {
            TestRunner.instance = new TestRunner(workspaceState);
        }
        return TestRunner.instance;
    }

    // Load the test results and coverage data from the workspace state
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

    /**
     * Save the state of the TestRunner
     */
    public saveState(): void {
        const state = {
            results: this.results,
            coverage: this.coverage,
            hash: this.hash
        };
        this.workspaceState.update(this.stateKey, state);
    }

    /**
     * Reset the state of the TestRunner
     */
    public resetState(): void {
        this.results = undefined;
        this.coverage = undefined;
        this.hash = {};
        this.saveState();
    }


    /**
     * Get the slowest tests
     * 
     * @param n The number of slowest tests to return, defaults to 5
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to an array of the slowest tests
     */
    public async getSlowestTests(n: number = 5, doNotRunTests?: boolean): Promise<TestFunctionResult[]> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }

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

    /**
     * Get the coverage data
     * 
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to the coverage data
     */
    public async getCoverage(doNotRunTests?: boolean): Promise<Coverage | undefined> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }
        return this.coverage;
    }

    /**
     * Get all test results
     * 
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to the test results
     */
    public async getAllResults(doNotRunTests?: boolean): Promise<TestResult | undefined> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }
        return this.results;
    }

    /**
     * Get the summary of the test results
     * 
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to the number of passed and failed tests
     */
    public async getResultsSummary(doNotRunTests?: boolean): Promise<{ passed: number, failed: number }> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }
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

    /**
     * Get the test results for a specific file
     * 
     * @param filePath The relative path to the file
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to the test results for the file
     */
    public async getResultsForFile(filePath: string, doNotRunTests?: boolean): Promise<TestFileResult> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }

        if (this.results) {
            return this.results[filePath];
        }
        return {};
    }

    /**
     * Get a list of all failing tests
     * 
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to the test results for the failing tests
     */
    public async getAllFailingTests(doNotRunTests?: boolean): Promise<TestFunctionResult[]> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }

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

    /**
     * Get the tests that use the most memory (in MB)
     * 
     * @param n The number of tests to return, defaults to 5
     * @param doNotRunTests Whether to run tests or not
     * @returns A promise that resolves to an array of the tests with the highest memory usage
     */
    public async getHighestMemoryTests(n: number = 5, doNotRunTests?: boolean): Promise<TestFunctionResult[]> {
        if (!doNotRunTests) {
            await this.runNecessaryTests();
        }
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
    private async runNecessaryTests(): Promise<void> {
        if (!Settings.RUN_NECESSARY_TESTS_ONLY || !this.results || !this.coverage || !this.hash) {
            vscode.window.showInformationMessage('Running all tests...');
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
            vscode.window.showInformationMessage('No test diffs found...');
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
                vscode.window.showInformationMessage(`Running tests in ${filePath}: ${tests.join(', ')}`);
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

    /**
     * Run specified tests or all tests if none are specified
     * 
     * @param testsToRun The tests to run
     * @returns None
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

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Test Runner",
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: "Running..." });

            return new Promise<void>((resolve, reject) => {
                this.testProcess = spawn(command, { cwd: workspacePath, shell: true });

                // Handle stdout (real-time output)
                var percentage = '';
                this.testProcess.stdout.on('data', (data: Buffer) => {
                    console.log(`stdout: ${data}`);
                    if (data.toString().endsWith('%]')) {
                        percentage = data.toString().trim().slice(-6);
                    }

                    progress.report({ message: `Running... ${percentage}\n${data.toString().trim()}` });
                });

                // Handle stderr (errors)
                this.testProcess.stderr.on('data', (data: Buffer) => {
                    console.error(`stderr: ${data}`);
                    vscode.window.showErrorMessage(`Test run error: ${data.toString().trim()}`);
                });

                // Handle process exit
                this.testProcess.on('exit', async (code: number | null) => {
                    this.testProcess = null;
                    if (code === 0) {
                        progress.report({ message: "Tests completed successfully!" });

                        // Process the output
                        await this.updateTestResults(testsToRun ? false : true);  // Rewrite if no tests specified
                        this.updateCoverage(testsToRun ? false : true);
                        this.saveState();

                        // Save hash manually if all tests were run
                        if (!testsToRun) {
                            this.hash = await getWorkspaceHash();
                            this.saveState();
                        }

                        // Update the sidebar
                        vscode.commands.executeCommand('testpylot.updateSidebar');

                        // Finally save snapshot if enabled
                        if (Settings.SAVE_SNAPSHOT_ON_TEST_RUN) {
                            HistoryManager.saveSnapshot();
                        }

                    } else {
                        vscode.window.showErrorMessage(`Tests failed with exit code ${code}`);
                    }
                    resolve();
                });

                // Handle process error
                this.testProcess.on('error', (error: Error) => {
                    console.error(`Process error: ${error.message}`);
                    vscode.window.showErrorMessage(`Test run failed: ${error.message}`);
                    reject(error);
                });

                // Handle cancellation
                token.onCancellationRequested(() => {
                    if (this.testProcess) {
                        this.testProcess.kill(); // Kill the test process
                        vscode.window.showWarningMessage("Test run cancelled.");
                        resolve(); // Resolve to prevent hanging
                    }
                });
            });
        });
    }
}
