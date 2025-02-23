import { TestResult } from '../test-runner/results';
import { Coverage } from '../test-runner/coverage';

export type Snapshot = {
    testResult: TestResult | undefined
    coverage: Coverage | undefined
    time: Date
}