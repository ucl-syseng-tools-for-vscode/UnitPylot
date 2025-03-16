import { Coverage } from '../../test-runner/coverage';
import { TestResult } from '../../test-runner/results';

/**
 * Example coverage object
 */
export const exampleCoverage: Coverage = {
    files: [
        {
            filename: 'src/file1.py',
            lines: {
                covered: [1, 2, 3, 4, 5],
                skipped: [6, 7],
                missed: [8, 9],
                branches_covered: [[1, 0], [2, 1]],
                branches_missed: [[3, 0], [4, 1]]
            },
            summary: {
                covered: 5,
                skipped: 2,
                missed: 2,
                branches_covered: 2,
                branches_missed: 2,
                percentCovered: 50,
                total: 9
            }
        },
        {
            filename: 'src/file2.py',
            lines: {
                covered: [10, 11, 12],
                skipped: [13],
                missed: [14, 15],
                branches_covered: [[5, 0], [6, 1]],
                branches_missed: [[7, 0], [8, 1]]
            },
            summary: {
                covered: 3,
                skipped: 1,
                missed: 2,
                branches_covered: 2,
                branches_missed: 2,
                percentCovered: 37.5,
                total: 6
            }
        }
    ],
    totals: {
        covered: 8,
        skipped: 3,
        missed: 4,
        total: 15,
        percentCovered: 53.33,
        branches_covered: 4,
        branches_missed: 4,
        branches_total: 8
    }
};


/**
 * Example test results object
 */
export const exampleTestResult: TestResult = {
    'src/file1_test.py': {
        'test_function1': {
            passed: true,
            time: 0.123,
            lineNo: '10',
            filePath: 'src/file1_test.py',
            testName: 'test_function1',
            totalMemory: 1024,
            cpuUsage: 5
        },
        'test_function2': {
            passed: false,
            time: 0.456,
            errorMessage: 'Expected true but got false',
            lineNo: '20',
            filePath: 'src/file1_test.py',
            testName: 'test_function2',
            totalMemory: 2048,
            cpuUsage: 10
        }
    },
    'src/file2_test.py': {
        'test_function3': {
            passed: true,
            time: 0.789,
            lineNo: '15',
            filePath: 'src/file2_test.py',
            testName: 'test_function3',
            totalMemory: 512,
            cpuUsage: 3
        },
        'test_function4': {
            passed: false,
            time: 1.234,
            errorMessage: 'Timeout error',
            lineNo: '25',
            filePath: 'src/file2_test.py',
            testName: 'test_function4',
            totalMemory: 4096,
            cpuUsage: 15
        }
    }
};