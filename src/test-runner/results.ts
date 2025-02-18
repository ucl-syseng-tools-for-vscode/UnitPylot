export type TestResult = {
    [key: string]: TestFileResult  // File path : TestFileResults
}

export type TestFileResult = {
    [key: string]: TestFunctionResult  // Test function : TestFunctionResults
}

export type TestFunctionResult = {
    passed: boolean;
    time: number;
    errorMessage?: string;
    failureLocation?: string;
    filePath?: string;
    testName?: string;
}