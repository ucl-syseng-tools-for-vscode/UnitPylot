export type TestResults = {
    [key: string]: TestFileResults  // File path : TestFileResults
}

export type TestFileResults = {
    [key: string]: TestFunctionResults  // Test function : TestFunctionResults
}

export type TestFunctionResults = {
    passed: boolean;
    time: number;
    errorMessage?: string;
    failureLocation?: string;
    filePath?: string;
    testName?: string;
}