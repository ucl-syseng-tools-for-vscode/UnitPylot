import { expect } from 'chai';
import * as sinon from 'sinon';
import { HistoryProcessor } from '../../../test-history/history-processor';
import { HistoryManager } from '../../../test-history/history-manager';
import { TestResult } from '../../../test-runner/results';

suite('HistoryProcessor Tests', () => {
    let sandbox: sinon.SinonSandbox;

    const mockTestResults: TestResult = {
        'file1.ts': {
            'test1': { passed: true, time: 0.1 },
            'test2': { passed: false, time: 0.2 }
        },
        'file2.ts': {
            'test3': { passed: true, time: 0.3 },
            'test4': { passed: false, time: 0.4 }
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

    const mockSnapshots = [
        { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2023-01-01') },
        { testResult: mockTestResults, coverage: mockCoverage, time: new Date('2023-02-01') }
    ];

    suiteSetup(() => {
        sandbox = sinon.createSandbox();
    });

    suiteTeardown(() => {
        sandbox.restore();
    });

    test('should get pass/fail history', () => {
        sandbox.stub(HistoryManager, 'getSnapshots').returns(mockSnapshots);

        const passFailHistory = HistoryProcessor.getPassFailHistory();
        expect(passFailHistory).to.have.lengthOf(2);
        expect(passFailHistory[0]).to.deep.include({ date: new Date('2023-01-01'), pass: 2, fail: 2 });
        expect(passFailHistory[1]).to.deep.include({ date: new Date('2023-02-01'), pass: 2, fail: 2 });
    });

    test('should get pass count', () => {
        const passCount = HistoryProcessor['getPassCount'](mockTestResults);
        expect(passCount).to.equal(2);
    });

    test('should get fail count', () => {
        const failCount = HistoryProcessor['getFailCount'](mockTestResults);
        expect(failCount).to.equal(2);
    });
});