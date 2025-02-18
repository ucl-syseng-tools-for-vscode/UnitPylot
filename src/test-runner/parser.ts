
/* 
    * This file contains functions related to parsing the pytest output.
    * The TestRunner class still manages what tests are run.
*/

import { TestFunctionResult, TestResult } from "./results";

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
        const filePath = failureLines[0].split(':')[0];
        const lineNo = failureLines[0].split(':')[1];

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
    }

    // Merge the results
    // We know that |results| >= |failures| and |results| >= |times|
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
    return results;
}
