import { TestResult } from '../test-runner/results';
import { HistoryManager } from './history-manager';

export class HistoryProcessor {
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