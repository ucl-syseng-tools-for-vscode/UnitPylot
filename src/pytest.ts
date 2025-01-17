import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';

type FileCoverage = {
    filename: string;
    lines: {
        covered: [number];
        skipped: [number];
        missed: [number];
    };
    summary: {
        covered: number;
        skipped: number;
        missed: number;
        percentCovered: number;
        total: number;
    };
};

export type Coverage = {
    files: FileCoverage[];
    totals: {
        covered: number;
        skipped: number;
        missed: number;
        total: number;
        percentCovered: number;
        branches_covered?: number;
        branches_missed?: number;
        branches_total?: number;
    };
};

type FileCoverageRaw = {
    excluded_lines: [number];
    executed_lines: [number];
    missing_lines: [number];
    summary: {
        covered_lines: number;
        excluded_lines: number;
        missing_lines: number;
        percent_covered: number;
        num_statements: number;
    };
}

// Get the Python Extension API
async function getPythonPath(): Promise<string | undefined> {
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

// Runs pytest and returns the number of passed and failed tests
// TODO: Add support for non venv environments and other venvironments!!!

export function runPytest(): Promise<{ passed: number; failed: number }> {
    return new Promise(async (resolve, reject) => {
        console.log('Running Pytest...');
        const pythonPath = await getPythonPath();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log(pythonPath);
        if (workspaceFolders) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest --tb=short || true"`; // The || true is to prevent the command from failing if there are failed tests
            console.log(command);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Pytest Error: ${stderr}`);
                    return reject(error);
                }

                console.log(stdout.match(/(\d+) passed/g));
                console.log(stdout.match(/(\d+) failed/g));
                const passed = (stdout.match(/(\d+) passed/g) || []).reduce((sum, match) => sum + parseInt(match.split(' ')[0]), 0);
                const failed = (stdout.match(/(\d+) failed/g) || []).reduce((sum, match) => sum + parseInt(match.split(' ')[0]), 0);

                console.log(`Passed: ${passed}, Failed: ${failed}`);
                vscode.window.showInformationMessage(`Pytest Results: ${passed} Passed, ${failed} Failed`);
                resolve({ passed, failed });
            });
        } else {
            vscode.window.showErrorMessage('No workspace folder found');
            reject(new Error('No workspace folder found'));
        }
    });
}

export function runCoverageCheck(): Promise<{ coverage: Coverage }> {
    return new Promise(async (resolve, reject) => {
        console.log('Running Coverage Check...');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const pythonPath = await getPythonPath();

            const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest --cov --cov-report=json --cov-branch || true"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Coverage Error: ${stderr}`);
                    return reject(error);
                }

                const coverage = parseCoverage();
                console.log(coverage);
                vscode.window.showInformationMessage(`Coverage Results: ${coverage.files.length} files`);
                resolve({ coverage });
            });
        } else {
            vscode.window.showErrorMessage('No workspace folder found');
            reject(new Error('No workspace folder found'));
        }
    });
}

function readJsonFile(filePath: string): any {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
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

function parseCoverage(): Coverage {
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

    return coverage;
}
