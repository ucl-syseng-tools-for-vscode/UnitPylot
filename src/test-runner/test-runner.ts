import * as vscode from 'vscode';
import { exec } from 'child_process';
import { getPythonPath, parseCoverage } from './helper-functions';
import { TestResults, TestFileResults, TestFunctionResults } from './results';
import { Coverage } from './coverage';

type TestRunnerState = {
    results: TestResults;
    coverage: Coverage;
}

/*
    * Class to hold test results and coverage data for the whole project.
    * Only one instance of this class should exist at any given time.
*/

export class TestRunner {
    private static instance: TestRunner;
    private results: TestResults | undefined;
    private coverage: Coverage | undefined;
    private readonly stateKey: string = 'testResultsState';

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
        } else {
            this.results = undefined; // Initialize with default values
            this.coverage = undefined; // Initialize with default values
        }
    }

    public saveState(): void {
        const state = {
            results: this.results,
            coverage: this.coverage
        };
        this.workspaceState.update(this.stateKey, state);
    }

    // Example method to update results
    public updateResults(newResults: any): void {
        this.results = newResults;
        this.saveState();
    }

    // Example method to update coverage
    public updateCoverage(newCoverage: any): void {
        this.coverage = newCoverage;
        this.saveState();
    }

    // Get n slowest tests (default n = 5)
    public getSlowestTests(n: number = 5): TestFunctionResults[] {
        this.runNeccecaryTests();

        const slowestTests: TestFunctionResults[] = [];
        if (this.results) {
            for (const filePath in this.results) {
                for (const test in this.results[filePath]) {
                    slowestTests.push(this.results[filePath][test]);
                }
            }
        }
        slowestTests.sort((a, b) => (a.time || 0) - (b.time || 0));
        return slowestTests.slice(0, n);
    }

    // Get coverage data
    public getCoverage(): Coverage | undefined {
        this.runNeccecaryTests();
        if (!this.coverage) {
            return undefined
        }
        return this.coverage;
    }

    // Get overall pass / fail results
    public getResultsSummary(): { passed: number, failed: number } {
        this.runNeccecaryTests();

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
    public getResultsForFile(filePath: string): TestFileResults {
        this.runNeccecaryTests();

        if (this.results) {
            return this.results[filePath];
        }
        return {};
    }

    // Get failing tests with their line numbers
    public getAllFailingTests(): TestFunctionResults[] {
        this.runNeccecaryTests();

        const failingTests: TestFunctionResults[] = [];
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

    // Parse test times
    private parseTestTimes(output: string): void {
        var reachedDurations = false;

        for (const line of output.split('\n')) {
            if (reachedDurations) {
                if (!line.includes('::')) {
                    break;
                }

                const parts = line.split(' ');
                const time = parseFloat(parts[0].slice(0, -1));
                const filePathAndTest = parts[parts.length - 1];
                const filePath = filePathAndTest.split('::')[0];
                const test = filePathAndTest.split('::')[1];

                // Save to existing test results
                if (this.results) {
                    this.results[filePath][test].time = time;
                }
            }
            else {
                const parts = line.split(' ');
                if (parts.length == 5 && parts[3] == 'durations') {
                    reachedDurations = true;
                }
            }
        }
    }


    // Parse failure data
    private parseFailureData(output: string): void {

        var reachedFailures = false;
        var errorMessage = [];

        for (const line of output.split('\n')) {
            if (reachedFailures) {
                if (line.includes('___') || line === '') {

                    if (errorMessage.length === 0) {
                        continue;
                    }

                    const filePath = errorMessage[0].split(':')[0];
                    const lineNum = errorMessage[0].split(':')[1];
                    const testParts = errorMessage[0].split(' ');
                    const test = testParts[testParts.length - 1];

                    // Save to existing test results
                    const message = errorMessage.join('\n');
                    if (this.results) {
                        this.results[filePath][test].errorMessage = message;
                        this.results[filePath][test].failureLocation = `${filePath}:${lineNum}`;
                    }

                    if (line === '') {
                        break;
                    }

                    errorMessage = [];
                }
                // Parse the failure data
                else {
                    errorMessage.push(line);
                }
            }
            else if (line.includes('FAILURES')) {
                reachedFailures = true;
            }
        }
    }


    // Parse basic test results
    private parseTestResults(output: string): TestResults {
        const results: TestResults = {};
        // Parse the output and populate the results object
        var prevFilePath = '';
        for (const line of output.split('\n')) {
            if (line.slice(-1) == ']') {  // Line is a result
                const parts = line.split(' ');
                const filePathAndTest = parts[0];
                const testResult = parts[1];

                const filePath = filePathAndTest.split('::')[0];
                const test = filePathAndTest.split('::')[1];

                if (filePath != prevFilePath) {
                    results[filePath] = {};
                }

                const testResultObj: TestFunctionResults = {
                    passed: testResult === 'PASSED',
                    time: NaN,
                    errorMessage: undefined,
                    failureLocation: undefined,
                    filePath: filePath,
                    testName: test
                };

                results[filePath][test] = testResultObj;

                prevFilePath = filePath;
            }
        }
        return results;
    }

    // Run necessary tests
    private runNeccecaryTests(): void {  // TODO: Implement this method
        // Maybe pass files+tests to run?
        this.runTests();
    }

    /*
        * Run tests
        * Only run tests that have changes since the last run
        * OR run tests that correspond to code that has changed since the last run
    */

    public async runTests(): Promise<void> {  // TODO: Currently runs all tests. Implement the logic to run only relevant tests.
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        const pythonPath = await getPythonPath();
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const command =
            `${pythonPath} -m pytest -vv --durations=5 --maxfail=0 --cov --cov-report=json --cov-branch --tb=short || true`;
        // The || true is to prevent the command from failing if there are failed tests
        // For specific tests, append FOLDER/FILE_NAME::TEST_NAME
        // Example: tests/fizzbuzz_test.py::test_error_shown_for_negative

        exec(command, { cwd: workspacePath }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
            // Process the output
            this.results = this.parseTestResults(stdout);
            this.parseFailureData(stdout);
            this.parseTestTimes(stdout);

            // Process coverage data
            this.coverage = parseCoverage();  // Implemented in helper-functions.ts

            this.saveState();
        });
    }
}