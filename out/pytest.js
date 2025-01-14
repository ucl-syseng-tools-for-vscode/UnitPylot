"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCoverageCheck = exports.runPytest = void 0;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const fs = require("fs");
// Get the Python Extension API
async function getPythonPath() {
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
function runPytest() {
    return new Promise(async (resolve, reject) => {
        console.log('Running Pytest...');
        const pythonPath = await getPythonPath();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log(pythonPath);
        if (workspaceFolders) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest --tb=short || true"`; // The || true is to prevent the command from failing if there are failed tests
            console.log(command);
            (0, child_process_1.exec)(command, (error, stdout, stderr) => {
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
        }
        else {
            vscode.window.showErrorMessage('No workspace folder found');
            reject(new Error('No workspace folder found'));
        }
    });
}
exports.runPytest = runPytest;
function runCoverageCheck() {
    return new Promise(async (resolve, reject) => {
        console.log('Running Coverage Check...');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const pythonPath = await getPythonPath();
            const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest --cov --cov-report=json || true"`;
            (0, child_process_1.exec)(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Coverage Error: ${stderr}`);
                    return reject(error);
                }
                const coverage = parseCoverage();
                console.log(coverage);
                vscode.window.showInformationMessage(`Coverage Results: ${coverage.files.length} files`);
                resolve({ coverage });
            });
        }
        else {
            vscode.window.showErrorMessage('No workspace folder found');
            reject(new Error('No workspace folder found'));
        }
    });
}
exports.runCoverageCheck = runCoverageCheck;
function readJsonFile(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    }
    catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
}
function mapFileCoverage(fileCoverage, workspacePath) {
    let files = [];
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
        });
        n++;
    }
    return files;
}
function parseCoverage() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const coveragePath = `${workspacePath}/coverage.json`;
    const coverageData = readJsonFile(coveragePath);
    const coverage = {
        files: mapFileCoverage(coverageData.files, workspacePath),
        totals: {
            covered: coverageData.totals.covered_lines,
            skipped: coverageData.totals.excluded_lines,
            missed: coverageData.totals.missing_lines,
            total: coverageData.totals.num_statements,
            percentCovered: coverageData.totals.percent_covered,
        },
    };
    return coverage;
}
//# sourceMappingURL=pytest.js.map