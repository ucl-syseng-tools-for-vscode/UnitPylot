import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { Coverage, FileCoverage, FileCoverageRaw } from './coverage';

// Get the Python Extension API
export async function getPythonPath(): Promise<string | undefined> {
    const extension = vscode.extensions.getExtension('ms-python.python');
    if (extension) {
        const pythonAPI = await extension.activate();
        const interpreter = pythonAPI.settings.getExecutionDetails().execCommand;
        if (interpreter) {
            return interpreter.join(' '); // Returns full path to the interpreter
        }
    }
    return undefined;
}

export function readJsonFile(filePath: string): any {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
}

export function convertToBits(input: string): number {
    // Define unit multipliers in bits
    const unitMultipliers: { [key: string]: number } = {
        "kb": 1000 * 8,
        "kB": 1000 * 8,
        "KiB": 1024 * 8,
        "mb": 1000 * 1000 * 8,
        "MB": 1000 * 1000 * 8,
        "MiB": 1024 * 1024 * 8,
        "gb": 1000 * 1000 * 1000 * 8,
        "GB": 1000 * 1000 * 1000 * 8,
        "GiB": 1024 * 1024 * 1024 * 8
    };

    // Regular expression to extract number and unit
    const regex = /^(\d+(\.\d+)?)\s*([kKmMgG][iI]?[bB])$/;
    const match = input.match(regex);

    if (!match) {
        throw new Error("Invalid input format. Expected format: '<number> <unit>' e.g., '10 MB'");
    }

    const value = parseFloat(match[1]); // Numeric value
    const unit = match[3]; // Unit part

    if (!(unit in unitMultipliers)) {
        throw new Error("Unsupported unit. Use kB, KiB, kb, MB, MiB, mb, GB, GiB, or gb.");
    }

    return value * unitMultipliers[unit];
}

function mapFileCoverage(fileCoverage: [FileCoverageRaw], workspacePath: string): FileCoverage[] {
    let files: FileCoverage[] = [];
    let n = 0;
    for (let [key, file] of Object.entries(fileCoverage)) {

        files.push({
            filename: workspacePath + '/' + key,
            lines: {
                covered: file.executed_lines,
                skipped: file.excluded_lines,
                missed: file.missing_lines,
            },
            summary: {
                covered: file.summary.covered_lines,
                skipped: file.summary.excluded_lines,
                missed: file.summary.missing_lines,
                percentCovered: file.summary.percent_covered,
                total: file.summary.num_statements,
            },
        })
        n++;
    }
    return files;
}

export function parseCoverage(): Coverage {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const coveragePath = `${workspacePath}/coverage.json`;
    const coverageData = readJsonFile(coveragePath);
    const coverage: Coverage = {
        files: mapFileCoverage(coverageData.files, workspacePath),
        totals: {
            covered: coverageData.totals.covered_lines,
            skipped: coverageData.totals.excluded_lines,
            missed: coverageData.totals.missing_lines,
            total: coverageData.totals.num_statements,
            percentCovered: coverageData.totals.percent_covered,
            branches_covered: coverageData.totals.covered_branches,
            branches_missed: coverageData.totals.missing_branches,
            branches_total: coverageData.totals.num_branches,
        },
    };
    console.log(coverageData);

    return coverage;
}

async function getTestsForFunctionsInTestFile(testFilePath: string): Promise<{ [key: string]: string[] }> {
    const pythonPath = await getPythonPath();
    const scriptPath = path.join(__dirname, 'test-extractor.py');

    if (pythonPath) {
        const command = `${pythonPath} ${scriptPath} ${testFilePath}`;
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Function Error: ${stderr}`);
                    console.log(error);
                    reject(error);
                    return;
                }

                try {
                    const functions = JSON.parse(stdout);
                    resolve(functions);
                } catch (e) {
                    vscode.window.showErrorMessage(`Error parsing functions: ${e}`);
                    reject(e);
                }
            });
        });
    }
    else {
        vscode.window.showErrorMessage('Python path not found');
        return {};
    }
}

// Returns a dictionary of {function name: [test name]}
export async function getTestsForFunctions(): Promise<{ [key: string]: string[] }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;

    const functionTests: { [key: string]: string[] } = {};

    async function walkDir(dir: string, callback: (filePath: string) => Promise<void>) {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);
            if (stat.isDirectory()) {
                if (file !== '.venv' && file !== 'venv') {
                    await walkDir(filePath, callback);
                }
            } else {
                await callback(filePath);
            }
        }
    }

    await walkDir(workspacePath, async (filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.match(/(test_.*\.py$)|(.*_test.py$)/)) {
            console.log(`Found test file: ${filePath}`);
            const tests = await getTestsForFunctionsInTestFile(filePath);
            for (const [func, testList] of Object.entries(tests)) {
                if (!functionTests[func]) {
                    functionTests[func] = [];
                }
                const relativeFilePath = path.relative(workspacePath, filePath);
                functionTests[func].push(...testList.map(test => `${relativeFilePath}::${test}`));
            }
        }
    });

    // Remove multiple occurrences of the same test
    for (const [func, testList] of Object.entries(functionTests)) {
        functionTests[func] = [...new Set(testList)];
    }

    return functionTests;
}


export function getTestsForFunction(functionName: string, functionTests: { [key: string]: string[] }): string[] {
    // The function tests may not contain the full function name
    const functionNameNormal = functionName.split('::')[0];
    const testsForFullName = functionTests[functionName] || [];
    const testsForNormalName = functionTests[functionNameNormal] || [];

    return [...testsForFullName, ...testsForNormalName];
}