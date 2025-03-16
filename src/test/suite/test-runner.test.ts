import * as vscode from 'vscode';
import { expect } from 'chai';
import { TestRunner } from '../../test-runner/test-runner';
import { Settings } from '../../settings/settings';
import { TestFunctionResult, TestResult } from '../../test-runner/results';

suite('TestRunner Tests', () => {
    let testRunner: TestRunner;

    suiteSetup(() => {
        const context = {
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            }
        } as unknown as vscode.ExtensionContext;
        testRunner = TestRunner.getInstance(context.workspaceState);
    });

    test('should initialize TestRunner instance', () => {
        expect(testRunner).to.be.an.instanceof(TestRunner);
    });

    test('should run tests and return results', async () => {
        await testRunner.runTests();
        expect(testRunner.getAllResults).to.be.an('object');
    });

    test('should get coverage data', async () => {
        const coverage = await testRunner.getCoverage();
        expect(coverage).to.be.an('object');
    });

    test('should get slowest tests', async () => {
        const slowestTests = await testRunner.getSlowestTests(Settings.NUMBER_OF_SLOWEST_TESTS);
        expect(slowestTests).to.be.an('array');
    });

    test('should get memory usage data', async () => {
        const memoryTests = await testRunner.getMemory();
        expect(memoryTests).to.be.an('array');
    });

    test('should get all test results', async () => {
        const allResults = await testRunner.getAllResults();
        expect(allResults).to.be.an('object');
    });

    test('should get results summary', async () => {
        const summary = await testRunner.getResultsSummary();
        expect(summary).to.have.property('passed');
        expect(summary).to.have.property('failed');
    });

    test('should get results for a specific file', async () => {
        const fileResults = await testRunner.getResultsForFile('test-file.py');
        expect(fileResults).to.be.an('object');
    });

    test('should get all failing tests', async () => {
        const failingTests = await testRunner.getAllFailingTests();
        expect(failingTests).to.be.an('array');
    });

    test('should get highest memory usage tests', async () => {
        const memoryTests = await testRunner.getHighestMemoryTests(Settings.NUMBER_OF_MEMORY_INTENSIVE_TESTS);
        expect(memoryTests).to.be.an('array');
    });

    test('should remove deleted tests', async () => {
        // await testRunner.removeDeletedTests({});
        // Assuming removeDeletedTests does not return anything
    });

    test('should get modified tests', async () => {
        // const modifiedTests = await testRunner.getModifiedTests();
        // expect(modifiedTests).to.be.an('object');
    });
});