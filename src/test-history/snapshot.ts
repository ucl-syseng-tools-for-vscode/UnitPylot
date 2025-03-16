import { TestResult } from '../test-runner/results';
import { Coverage } from '../test-runner/coverage';

/**
 * Snapshot
 * Represents a snapshot of test results and coverage data.
 */
export type Snapshot = {
    testResult: TestResult | undefined
    coverage: Coverage | undefined
    time: Date
}