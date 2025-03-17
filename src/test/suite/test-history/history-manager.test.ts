import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';

import { HistoryManager } from '../../../test-history/history-manager';
import { TestRunner } from '../../../test-runner/test-runner';
import { Snapshot } from '../../../test-history/snapshot';

suite('HistoryManager', function () {
    let sandbox: sinon.SinonSandbox;
    let testRunnerStub: sinon.SinonStubbedInstance<TestRunner>;
    const testFilePath = path.join(__dirname, 'snapshots.json');

    const mockTestResults = {
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

    const mockCoverage = {
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

    teardown(() => {
        sandbox.restore();
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    suite('getSnapshots', function () {
        test('should return an empty array if file does not exist', function () {
            sandbox = sinon.createSandbox();
            sandbox.stub(fs, 'existsSync').returns(false);
            sandbox.stub(fs, 'writeFileSync');

            const snapshots = HistoryManager.getSnapshots();
            expect(snapshots).to.be.an('array').that.is.empty;
        });

        test('should return the last N snapshots', function () {
            sandbox = sinon.createSandbox();
            const sampleSnapshots: Snapshot[] = [
                { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2024-01-01') },
                { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2024-02-01') },
                { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2024-03-01') },
            ];

            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(sampleSnapshots));

            const snapshots = HistoryManager.getSnapshots(2);
            expect(snapshots).to.have.lengthOf(2);
            expect(new Date(snapshots[0].time)).to.deep.equal(new Date('2024-02-01'));
            expect(new Date(snapshots[1].time)).to.deep.equal(new Date('2024-03-01'));
        });
    });

    suite('getSnapshotsByDate', function () {
        test('should return snapshots within the given date range', function () {
            sandbox = sinon.createSandbox();
            const sampleSnapshots: Snapshot[] = [
                { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2023-12-01') },
                { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2024-01-15') },
                { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2024-02-10') },
            ];

            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(sampleSnapshots));

            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-02-28');
            const snapshots = HistoryManager.getSnapshotsByDate(startDate, endDate);

            expect(snapshots).to.have.lengthOf(2);
        });
    });

    suite('clearHistory', function () {
        test('should delete the snapshot file if it exists', function () {
            sandbox = sinon.createSandbox();
            const unlinkStub = sandbox.stub(fs, 'unlinkSync');
            sandbox.stub(fs, 'existsSync').returns(true);

            HistoryManager.clearHistory();

            expect(unlinkStub.calledOnce).to.be.true;
        });

        test('should not throw an error if the file does not exist', function () {
            sandbox = sinon.createSandbox();
            const unlinkStub = sandbox.stub(fs, 'unlinkSync').throws(new Error('File not found'));
            sandbox.stub(fs, 'existsSync').returns(false);

            expect(() => HistoryManager.clearHistory()).to.not.throw();
        });
    });

    suite('saveSnapshot', function () {
        test('should add a new snapshot', async function () {
            const testRunnerStub = sandbox.createStubInstance(TestRunner);
            testRunnerStub.getAllResults.resolves(mockTestResults);
            testRunnerStub.getCoverage.resolves(mockCoverage);

            sandbox.stub(TestRunner, 'getInstance').returns(testRunnerStub);
            const addSnapshotStub = sandbox.stub(HistoryManager as any, 'addSnapshot');

            const mockContext = { workspaceState: {} } as any;
            HistoryManager.initialise(mockContext);

            await HistoryManager.saveSnapshot();
            expect(addSnapshotStub.calledOnce).to.be.true;
            const snapshotArg: Snapshot = addSnapshotStub.firstCall.args[0];

            expect(snapshotArg).to.have.property('testResult').that.deep.equals(mockTestResults);
            expect(snapshotArg).to.have.property('coverage').that.deep.equals(mockCoverage);
            expect(snapshotArg).to.have.property('time').that.is.an.instanceOf(Date);
        });
    });

    suite('getSnapshotFilePath', function () {
        test('should throw an error if no workspace folder is found', function () {
            sandbox = sinon.createSandbox();
            sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);
            expect(() => HistoryManager['getSnapshotFilePath']()).to.throw('No workspace folder found');
        });

        test('should return the correct file path', function () {
            sandbox = sinon.createSandbox();
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: vscode.Uri.file(__dirname) }]);

            const filePath = HistoryManager['getSnapshotFilePath']();
            expect(filePath).to.equal(testFilePath);
        });
    });
});
