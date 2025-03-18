import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { ReportGenerator } from '../../../test-history/report-generator';
import { HistoryProcessor } from '../../../test-history/history-processor';
import { HistoryManager } from '../../../test-history/history-manager';
import { TestResult } from '../../../test-runner/results';
import { Coverage } from '../../../test-runner/coverage';
import { Snapshot } from '../../../test-history/snapshot';

suite('ReportGenerator Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockTestResults: TestResult;
    let mockCoverage: Coverage;
    let mockSnapshots: Snapshot[];
    let passFailHistory: { date: Date, pass: number, fail: number }[];

    suiteSetup(() => {
        sandbox = sinon.createSandbox();
    });

    suiteTeardown(() => {
        sandbox.restore();
    });

    function resetSandbox() {
        sandbox.restore();
        sandbox = sinon.createSandbox();
    }

    function mockTestResultsData() {
        mockTestResults = {
            'src/file1.test.ts': {
                'testFunction1': {
                    passed: true,
                    time: 0.2,
                    lineNo: '10',
                    filePath: 'src/file1.test.ts',
                    testName: 'testFunction1',
                    errorMessage: undefined
                }
            }
        };

        mockCoverage = {
            files: [
                {
                    filename: 'src/file1.ts',
                    lines: {
                        covered: [1, 2, 3],
                        skipped: [4],
                        missed: [5, 6],
                        branches_covered: [[1, 0], [2, 1]],
                        branches_missed: [[3, 0], [4, 1]]
                    },
                    summary: {
                        covered: 3,
                        skipped: 1,
                        missed: 2,
                        branches_covered: 2,
                        branches_missed: 2,
                        percentCovered: 60,
                        total: 6
                    }
                }
            ],
            totals: {
                covered: 3,
                skipped: 1,
                missed: 2,
                total: 6,
                percentCovered: 60,
                branches_covered: 2,
                branches_missed: 2,
                branches_total: 4
            }
        };

        mockSnapshots = [{
            coverage: mockCoverage,
            testResult: mockTestResults,
            time: new Date()
        }];

        passFailHistory = [
            { date: new Date(), pass: 10, fail: 2 }
        ];

        sandbox.stub(HistoryProcessor, 'getPassFailHistory').returns(passFailHistory);
        sandbox.stub(HistoryManager, 'getSnapshots').returns(mockSnapshots);
    }

    setup(() => {
        resetSandbox();
    });

    test('should show warning message if no snapshot history is available', async () => {
        sandbox.stub(HistoryProcessor, 'getPassFailHistory').returns([]);
        const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');

        await ReportGenerator.generateSnapshotReport();

        expect(showWarningMessageStub.calledOnce).to.be.true;
        expect(showWarningMessageStub.calledWith('No snapshot history available to generate a report.')).to.be.true;
        resetSandbox();
    });

    test('should save report as JSON', async () => {
        mockTestResultsData();
        const showSaveDialogStub = sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file('report.json'));
        const writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
        const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');

        await ReportGenerator.generateSnapshotReport();

        expect(showSaveDialogStub.calledOnce).to.be.true;
        expect(writeFileSyncStub.calledOnce).to.be.true;
        expect(showInformationMessageStub.calledOnce).to.be.true;
        resetSandbox();
    });

    test('should save report as Markdown', async () => {
        mockTestResultsData();
        const showSaveDialogStub = sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file('report.md'));
        const writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
        const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');

        await ReportGenerator.generateSnapshotReport();

        expect(showSaveDialogStub.calledOnce).to.be.true;
        expect(writeFileSyncStub.calledOnce).to.be.true;
        expect(showInformationMessageStub.calledOnce).to.be.true;
        resetSandbox();
    });

    test('should show error message for unsupported file format', async () => {
        mockTestResultsData();
        const showSaveDialogStub = sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file('report.txt'));
        const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

        await ReportGenerator.generateSnapshotReport();

        expect(showSaveDialogStub.calledOnce).to.be.true;
        expect(showErrorMessageStub.calledOnce).to.be.true;
        expect(showErrorMessageStub.calledWith('Unsupported file format selected.')).to.be.true;
        resetSandbox();
    });

    test('should show error message if saving report fails', async () => {
        mockTestResultsData();
        const showSaveDialogStub = sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file('report.json'));
        const writeFileSyncStub = sandbox.stub(fs, 'writeFileSync').throws(new Error('Failed to save file'));
        const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

        await ReportGenerator.generateSnapshotReport();

        expect(showSaveDialogStub.calledOnce).to.be.true;
        expect(writeFileSyncStub.calledOnce).to.be.true;
        expect(showErrorMessageStub.calledOnce).to.be.true;
        expect(showErrorMessageStub.calledWith('Error saving report: Failed to save file')).to.be.true;
        resetSandbox();
    });
});