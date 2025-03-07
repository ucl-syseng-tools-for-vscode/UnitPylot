
/* 
    * This file contains functions related to parsing the pytest json output.
    * The TestRunner class still manages what tests are run.
*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import { readJsonFile } from "./helper-functions";
import { TestFunctionResult, TestResult, MemoryAllocation } from "./results";

export const PYTEST_OUTPUT_FILE = '.pytest_results.json';
export const PYTEST_MONITOR_OUTPUT_FILE = '.pytest_resource_usage.sqlite';

type PytestOutput = {
    tests: PytestTest[];
}

type PytestTest = {
    nodeid: string;
    lineno: number;
    outcome: string;
    setup: PytestOutcome;
    call: PytestOutcome;
    teardown: PytestOutcome;
}

type PytestOutcome = {
    duration: number;
    outcome: string;
    longrepr?: string;
}

type PytestResourceDbData = {
    ITEM: string;
    ITEM_FS_LOC: string;
    ITEM_VARIANT: string;
    CPU_USAGE: number;
    MEM_USAGE: number;
}

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
            if (currentSection.length > 4 && currentSection[0].startsWith('Allocation')) {
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

    console.log("memoryData1");

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
            console.log("memoryData", memoryData);

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
            // console.log("RESULTS", results[filePath][test].biggestAllocations);
        }
    }
    return results;
}

/**
 * Query the sqlite3 database for memory/cpu data.
 * DB is generated by the pytest-monitor package.
 * 
 * @param pytestResult 
 */

async function getResourceData(dbPath: string, pytestResult: TestResult): Promise<TestResult> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                reject(err);
                return;
            }
            console.log('Connected to SQLite database.');
        });

        // Get most recent test data
        const stmt = `
            SELECT ITEM_FS_LOC, ITEM, ITEM_VARIANT, CPU_USAGE, MEM_USAGE
            FROM TEST_METRICS
            WHERE SESSION_H == (
                SELECT SESSION_H FROM TEST_SESSIONS
                ORDER BY RUN_DATE DESC LIMIT 1
            );
        `;

        db.all(stmt, [], (err, rows: PytestResourceDbData[]) => {
            if (err) {
                console.error('Error running query:', err.message);
                reject(err);
                return;
            }

            rows.forEach((row) => {
                const filePath = row.ITEM_FS_LOC;
                const testName = row.ITEM_VARIANT;
                const cpuUsage = row.CPU_USAGE;
                const memUsage = row.MEM_USAGE;

                // Only save the data if the test is in the pytestResult
                if (!pytestResult[filePath]) {
                    return;
                }

                // We need to loop through every test in the file because the test class name is not included in the db
                for (const test in pytestResult[filePath]) {
                    if (test.includes(testName) && !pytestResult[filePath][test].totalMemory) {
                        pytestResult[filePath][test].cpuUsage = cpuUsage;
                        pytestResult[filePath][test].totalMemory = memUsage;
                        break;
                    }
                }
            });

            // Close the database and resolve the promise
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    reject(err);
                    return;
                }
                console.log('Closed the database connection.');
                resolve(pytestResult);
            });
        });
    });
}


/**
 * Get the pytest results from the output files.
 * 
 * @returns TestResult
 */
export async function getPytestResult(): Promise<TestResult> {
    // Get cwd
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Read the pytest output file
    const jsonFilePath = path.join(workspacePath, PYTEST_OUTPUT_FILE);
    const pytestOutput = readJsonFile(jsonFilePath) as PytestOutput;

    // Parse the output
    let pytestResult: TestResult = {};

    for (const test of pytestOutput.tests) {
        const fullName = test.nodeid;
        const filePath = fullName.split('::')[0];
        const testName = fullName.split('::').slice(1).join('::');

        const testResultObj: TestFunctionResult = {
            passed: test.outcome === 'passed',
            time: test.call.duration,
            errorMessage: test.call.longrepr,
            failureLocation: test.lineno.toString(),
            filePath: filePath,
            testName: testName
        };

        if (!pytestResult[filePath]) {
            pytestResult[filePath] = {};
        }
        pytestResult[filePath][testName] = testResultObj;
    }

    // Parse the resource db
    const dbPath = path.join(workspacePath, PYTEST_MONITOR_OUTPUT_FILE);
    pytestResult = await getResourceData(dbPath, pytestResult);

    // Delete the pytest output files
    try {
        fs.unlinkSync(jsonFilePath);
    }
    catch (err) {
        console.error(err);
    }
    try {
        fs.unlinkSync(dbPath);
    }
    catch (err) {
        console.error(err);
    }

    return pytestResult;
}