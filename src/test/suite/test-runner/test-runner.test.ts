import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { TestRunner } from '../../../test-runner/test-runner';
import { exampleCoverage, exampleTestResult } from '../../fixtures/example-objects';
import { assert } from 'console';


suite('TestRunner Tests', () => {
    let testRunner: TestRunner;
    let context: vscode.ExtensionContext;

    suiteSetup(() => {
        context = {
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            }
        } as unknown as vscode.ExtensionContext;
        testRunner = TestRunner.getInstance(context.workspaceState);

        resetStubs();
    });

    function resetStubs() {
        sinon.restore();

        // Mocking coverage and results
        sinon.stub(testRunner, 'results').value(exampleTestResult);
        sinon.stub(testRunner, 'coverage').value(exampleCoverage);
        sinon.stub(testRunner, 'runTests').resolves();
    }

    test('should initialize TestRunner instance', () => {
        expect(testRunner).to.be.an.instanceof(TestRunner);
    });

    test('should save state', async () => {
        await testRunner.saveState();
        // Just test if it does not throw an error
    });

    test('should get coverage data', async () => {
        const coverage = await testRunner.getCoverage();
        expect(coverage).to.be.equal(exampleCoverage);
    });

    test('should not run tests for getCoverage', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getCoverage(true);
        assert(spy.notCalled);
        resetStubs();
    });

    test('should get slowest tests', async () => {
        const slowestTests = await testRunner.getSlowestTests(5);
        assert(slowestTests.length === 4);
    });

    test('should not run tests for getSlowestTests', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getSlowestTests(5, true);
        assert(spy.notCalled);
        resetStubs();
    });

    test('should get all test results', async () => {
        const allResults = await testRunner.getAllResults();
        expect(allResults).to.be.equal(exampleTestResult);
    });

    test('should not run tests for getAllResults', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getAllResults(true);
        assert(spy.notCalled);
        resetStubs();
    });

    test('should get results summary', async () => {
        const summary = await testRunner.getResultsSummary();
        expect(summary).to.have.property('passed');
        expect(summary).to.have.property('failed');
        expect(summary).property('passed').to.be.equal(2);
        expect(summary).property('failed').to.be.equal(2);
    });

    test('should not run tests for getResultsSummary', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getResultsSummary(true);
        assert(spy.notCalled);
        resetStubs();
    });

    test('should get results for a specific file', async () => {
        const fileResults = await testRunner.getResultsForFile('src/file1_test.py');
        expect(fileResults).to.be.an('object');
        assert(Object.keys(fileResults).length === 2);
    });

    test('should not run tests for getResultsForFile', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getResultsForFile('src/file1_test.py', true);
        assert(spy.notCalled);
        resetStubs();
    });

    test('should get all failing tests', async () => {
        const failingTests = await testRunner.getAllFailingTests();
        assert(failingTests.length === 2);
    });

    test('should not run tests for getAllFailingTests', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getAllFailingTests(true);
        assert(spy.notCalled);
        resetStubs();
    });

    test('should get highest memory usage tests', async () => {
        const memoryTests = await testRunner.getHighestMemoryTests(5);
        assert(memoryTests.length === 4);
    });

    test('should not run tests for getHighestMemoryTests', async () => {
        const spy = sinon.spy((testRunner as any), 'runNecessaryTests');
        await testRunner.getHighestMemoryTests(5, true);
        assert(spy.notCalled);
        resetStubs();
    });

});