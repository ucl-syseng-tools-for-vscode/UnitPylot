
/* 
    * This file contains functions related to parsing the pytest output.
    * The TestRunner class still manages what tests are run.
*/

import { TestFunctionResult, TestResult, MemoryAllocation } from "./results";

function parsePassAndFail(results: string[]): TestResult {
    // The first few lines include metadata about the test run
    // We assume each test result ends with ']'
    const resultsFiltered = results.filter((line) => line.endsWith(']'));
    const testResults: TestResult = {};

    for (const result of resultsFiltered) {
        const resultParts = result.split(' ');

        let index = 0;
        while (!resultParts[index].match(/^[A-Z]+$/)) {  // Checks for status by all caps
            index++;
        }

        const fullName = resultParts.slice(0, index).join(' ');
        const status = resultParts[index];
        const filePath = fullName.split('::')[0];
        const testName = fullName.split('::').slice(1).join('::');

        const testResultObj: TestFunctionResult = {
            passed: status === 'PASSED',
            time: NaN,
            errorMessage: status !== 'PASSED' && status !== 'FAILED' ? status : undefined,
            failureLocation: undefined,
            filePath: filePath,
            testName: testName
        };

        if (!testResults[filePath]) {
            testResults[filePath] = {};
        }
        testResults[filePath][testName] = testResultObj;
    }

    return testResults;
}

function parseFailures(results: string[]): TestResult {
    const failures = splitFailureOutput(results);
    const testResults: TestResult = {};

    for (const failure in failures) {
        const failureLines = failures[failure];
        const testName = failure.replace('.', '::');
        var filePath = failureLines[0].split(':')[0];
        var lineNo = failureLines[0].split(':')[1];

        // Use the last error trace as failure's filePath and lineNo
        for (let i = 1; i < failureLines.length - 2; i++) {
            const line = failureLines[i];
            if (line === '') {
                // Use the second line after the empty line as the failure location
                const failureLocation = failureLines[i + 2];
                filePath = failureLocation.split(':')[0];
                lineNo = failureLocation.split(':')[1];
            }  // Keep going until the last error trace
        }

        const testResultObj: TestFunctionResult = {
            passed: false,
            time: NaN,
            errorMessage: failureLines.join('\n'),
            failureLocation: lineNo,
            testName: testName,
            filePath: filePath
        };

        if (!testResults[filePath]) {
            testResults[filePath] = {};
        }
        testResults[filePath][testName] = testResultObj;
    }
    return testResults;
}

function parseTestTimes(results: string[]): TestResult {
    const testResults: TestResult = {};

    for (const result of results) {
        const resultParts = result.split(' ');
        const fullName = resultParts[resultParts.length - 1];
        const filePath = fullName.split('::')[0];
        const testName = fullName.split('::').slice(1).join('::');
        const time = parseFloat(resultParts[0].slice(0, -1));

        const testResultObj: TestFunctionResult = {
            passed: true,  // This will be discarded later
            time: time,
            errorMessage: undefined,
            failureLocation: undefined,
            filePath: filePath,
            testName: testName
        };

        if (!testResults[filePath]) {
            testResults[filePath] = {};
        }
        if (!testResults[filePath][testName]) {
            testResults[filePath][testName] = testResultObj;
        }
        else {
            testResults[filePath][testName].time += time;  // Add the time to the existing time
        }
    }

    return testResults;
}

function parseMemoryReport(results: string[]): TestResult {
    const testResults: TestResult = {};

    let currentSection: string[] = [];
    for (const line of results) {
        if (!(line.startsWith('Allocation') || line.startsWith('---'))) {  // Include last section as well
            // Do nothing
        } else {
            if (currentSection.length > 0) {
                // Parse the current section
                const fullTestName = currentSection[0].split(' ')[3];
                const filePath = fullTestName.split('::')[0];
                const testName = fullTestName.split('::').slice(1).join('::');

                // Parse the memory data
                const totalMemory = currentSection[2].split(' ').pop();  // String format i.e. x.xKiB
                const totalAllocationsStr = currentSection[3].split(' ').pop();
                const totalAllocations = totalAllocationsStr ? parseInt(totalAllocationsStr) : NaN;
                const histogram = currentSection[4].split(': ').pop();

                // Collect biggest allocating functions
                const biggestAllocations: MemoryAllocation = {};
                let i = 6;
                let currentAllocation = currentSection[i];
                while (currentAllocation !== '') {
                    const parts = currentAllocation.split(' ');
                    const functionName = parts[1];
                    const allocation = parts.pop();
                    if (allocation) {
                        biggestAllocations[functionName] = allocation;
                    }

                    i++;
                    currentAllocation = currentSection[i];
                }

                // Create the test result object
                const testResultObj: TestFunctionResult = {
                    passed: true,  // This will be discarded later
                    time: NaN,
                    filePath: filePath,
                    testName: testName,
                    totalMemory: totalMemory,
                    totalAllocations: totalAllocations,
                    histogram: histogram,
                    biggestAllocations: biggestAllocations
                };
                testResults[filePath] = testResults[filePath] || {};
                testResults[filePath][testName] = testResultObj;
                currentSection = [];
            }
        }
        // Add the line to the current section
        currentSection.push(line);
    }

    return testResults;
}

function splitTestOutput(output: string): { [key: string]: string[] } {
    const outputLines = output.split('\n');
    const sections: { [key: string]: string[] } = {};

    let currentSection: string[] = [];

    for (const line of outputLines) {
        if (line.startsWith('=')) {
            // Add previous section
            if (currentSection.length > 0) {
                const sectionName = currentSection[0].split(' ').slice(1, -1).join(' ');
                currentSection.shift();
                sections[sectionName] = currentSection;
                currentSection = [];
            }
        }
        currentSection.push(line);
    }
    // The last section contains the summary which is ignored

    return sections;
}

function splitFailureOutput(output: string[]): { [key: string]: string[] } {
    const failures: { [key: string]: string[] } = {};
    let currentFailure: string[] = [];

    for (const line of output) {
        if (line.startsWith('___') && line.endsWith('___')) {
            if (currentFailure.length > 0) {
                const failureName = currentFailure[0].split(' ')[1];
                currentFailure.shift();
                failures[failureName] = currentFailure;
                currentFailure = [];
            }
        }
        currentFailure.push(line);
    }
    // Add the last failure
    if (currentFailure.length > 0) {
        const failureName = currentFailure[0].split(' ')[1];
        currentFailure.shift();
        failures[failureName] = currentFailure;
        currentFailure = [];
    }

    return failures;
}

export function parsePytestOutput(output: string): TestResult {
    // Split the output into sections then parse each section
    const sections: { [key: string]: string[] } = splitTestOutput(output);
    let results: TestResult = {};
    let failures: TestResult = {};
    let times: TestResult = {};
    let memoryData: TestResult = {};

    for (const section in sections) {
        if ('test session starts' == section) {
            // Parse Pass / Fail data
            results = parsePassAndFail(sections[section]);
        }
        else if ('FAILURES' == section) {
            // Parse the failures
            failures = parseFailures(sections[section]);
        }
        else if (section.includes('slowest')) {
            // Parse the slowest tests
            times = parseTestTimes(sections[section]);
        }
        else if ('warnings summary' == section) {  // TODO: Implement this section maybe??
            // We don't really care about warnings
            continue;
        }
        else if ('MEMRAY REPORT' == section) {
            // Parse memory report
            memoryData = parseMemoryReport(sections[section]);
        }
    }

    // Merge the results
    // We know that |results| is a superset of |failures|, |times|, |memoryData|
    for (const filePath in failures) {
        for (const test in failures[filePath]) {
            results[filePath][test].errorMessage = failures[filePath][test].errorMessage;
            results[filePath][test].failureLocation = failures[filePath][test].failureLocation;
        }
    }
    for (const filePath in times) {
        for (const test in times[filePath]) {
            results[filePath][test].time = times[filePath][test].time;
        }
    }
    for (const filePath in memoryData) {
        for (const test in memoryData[filePath]) {
            results[filePath][test].totalMemory = memoryData[filePath][test].totalMemory;
            results[filePath][test].totalAllocations = memoryData[filePath][test].totalAllocations;
            results[filePath][test].histogram = memoryData[filePath][test].histogram;
            results[filePath][test].biggestAllocations = memoryData[filePath][test].biggestAllocations;
        }
    }
    return results;
}
