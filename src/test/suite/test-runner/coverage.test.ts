import { expect } from 'chai';
import { mergeCoverage, Coverage } from '../../../test-runner/coverage';

suite('Coverage Tests', () => {
    const exampleCoverage1: Coverage = {
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
                    percentCovered: 50,
                    total: 6
                }
            }
        ],
        totals: {
            covered: 3,
            skipped: 1,
            missed: 2,
            total: 6,
            percentCovered: 50,
            branches_covered: 2,
            branches_missed: 2,
            branches_total: 4
        }
    };

    const exampleCoverage2: Coverage = {
        files: [
            {
                filename: 'src/file1.ts',
                lines: {
                    covered: [3, 4, 5],
                    skipped: [6],
                    missed: [7, 8],
                    branches_covered: [[2, 1], [3, 0]],
                    branches_missed: [[4, 1], [5, 0]]
                },
                summary: {
                    covered: 3,
                    skipped: 1,
                    missed: 2,
                    branches_covered: 2,
                    branches_missed: 2,
                    percentCovered: 50,
                    total: 6
                }
            }
        ],
        totals: {
            covered: 3,
            skipped: 1,
            missed: 2,
            total: 6,
            percentCovered: 50,
            branches_covered: 2,
            branches_missed: 2,
            branches_total: 4
        }
    };

    test('should merge coverage reports', () => {
        const mergedCoverage = mergeCoverage(exampleCoverage1, exampleCoverage2);
        expect(mergedCoverage.files).to.have.lengthOf(1);
        expect(mergedCoverage.files[0].lines.covered).to.have.members([1, 2, 3, 4, 5]);
        expect(mergedCoverage.files[0].lines.skipped).to.be.empty;
        expect(mergedCoverage.files[0].lines.missed).to.be.empty;
        expect(mergedCoverage.files[0].lines.branches_covered).to.deep.include.members([[1, 0], [2, 1], [3, 0]]);
        expect(mergedCoverage.files[0].lines.branches_missed).to.deep.include.members([[4, 1]]);
    });
});