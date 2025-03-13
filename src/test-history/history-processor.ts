import { TestResult } from '../test-runner/results';
import { HistoryManager } from './history-manager';

/**
 * Process the history data to get relevant information.
 */
export class HistoryProcessor {
    /**
     * Get the history of passed and failed tests.
     * 
     * @param num The number of snapshots to get
     * @returns The history of passed and failed tests
     */
    public static getPassFailHistory(num?: number): { date: Date, pass: number, fail: number }[] {
        // Get the history of passed and failed tests
        const snapshots = HistoryManager.getSnapshots(num);
        const passFailHistory: { date: Date, pass: number, fail: number }[] = [];
        snapshots.forEach(snapshot => {
            if (!snapshot.testResult) {
                return;
            }
            const pass = this.getPassCount(snapshot.testResult);
            const fail = this.getFailCount(snapshot.testResult);
            passFailHistory.push({ date: snapshot.time, pass, fail });
        });
        return passFailHistory;
    }

    // Get the number of passed tests
    private static getPassCount(testResult: TestResult): number {
        // Get the number of passed tests
        let pass = 0;
        for (const file in testResult) {
            for (const test in testResult[file]) {
                if (testResult[file][test].passed) {
                    pass++;
                }
            }
        }
        return pass;
    }

    // Get the number of failed tests
    private static getFailCount(testResult: TestResult): number {
        // Get the number of failed tests
        let fail = 0;
        for (const file in testResult) {
            for (const test in testResult[file]) {
                if (!testResult[file][test].passed) {
                    fail++;
                }
            }
        }
        return fail;
    }
}