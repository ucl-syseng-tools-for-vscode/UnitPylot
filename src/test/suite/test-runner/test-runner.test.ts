import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { TestRunner } from '../../../test-runner/test-runner';
import { Settings } from '../../../settings/settings';
import { exampleCoverage, exampleTestResult } from '../../fixtures/example-objects';
import { assert } from 'console';


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

        // Mocking coverage and results
        sinon.stub(testRunner, 'results').value(exampleTestResult);
        sinon.stub(testRunner, 'coverage').value(exampleCoverage);
    });

    test('should initialize TestRunner instance', () => {
        expect(testRunner).to.be.an.instanceof(TestRunner);
    });

    test('should save state', async () => {
        await testRunner.saveState();
        // Just test if it does not throw an error
    });

    test('should return results', async () => {
        expect(await testRunner.getAllResults()).to.be.equal(exampleTestResult);
    });

    test('should get coverage data', async () => {
        const coverage = await testRunner.getCoverage();
        expect(coverage).to.be.equal(exampleCoverage);
    });

    test('should get slowest tests', async () => {
        const slowestTests = await testRunner.getSlowestTests(Settings.NUMBER_OF_SLOWEST_TESTS);
        assert(slowestTests.length === 4);
    });

    test('should get all test results', async () => {
        const allResults = await testRunner.getAllResults();
        expect(allResults).to.be.equal(exampleTestResult);
    });

    test('should get results summary', async () => {
        const summary = await testRunner.getResultsSummary();
        expect(summary).to.have.property('passed');
        expect(summary).to.have.property('failed');
        expect(summary).property('passed').to.be.equal(2);
        expect(summary).property('failed').to.be.equal(2);
    });

    test('should get results for a specific file', async () => {
        const fileResults = await testRunner.getResultsForFile('src/file1_test.py');
        expect(fileResults).to.be.an('object');
        assert(Object.keys(fileResults).length === 2);
    });

    test('should get all failing tests', async () => {
        const failingTests = await testRunner.getAllFailingTests();
        assert(failingTests.length === 2);
    });

    test('should get highest memory usage tests', async () => {
        const memoryTests = await testRunner.getHighestMemoryTests(Settings.NUMBER_OF_MEMORY_INTENSIVE_TESTS);
        assert(memoryTests.length === 4);
    });

});