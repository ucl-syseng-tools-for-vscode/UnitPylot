import * as vscode from 'vscode';
import { exec } from 'child_process';
import {getPythonPath} from './pytest';

// Runs pytest and returns the 5 slowest tests (passing and failing) 
export function runSlowestTests(): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
        console.log('Running Pytest...');
        const pythonPath = await getPythonPath();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log(pythonPath);

        if (workspaceFolders) {
            const workspacePath = workspaceFolders[0].uri.fsPath; 
            const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest -vv --durations=5 --maxfail=0 || true"`; // maxfail = 0 means pytest continues running even if some tests fail, -vv for tests <0.005s
            console.log(command);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Pytest Error: ${stderr}`);
                    return reject(error);
                }

                console.log(stdout);
                const slowestTests = parseSlowestTests(stdout);
                if (!slowestTests) {
                    throw new Error('No slow tests found');
                }
                console.log(`Slowest Tests: ${slowestTests}`);
                vscode.window.showInformationMessage(`Pytest Results: ${slowestTests} slowest tests`);
                return resolve(slowestTests);
            });
        } else {
            vscode.window.showErrorMessage('No workspace folder found');
            reject(new Error('No workspace folder found'));
        }
    });
}

// Helper function to parse the 5 slowest tests from the output
function parseSlowestTests(output: string): string[] {
    const durationPattern = /^(\d+\.\d+)s\s+call\s+(.+)$/m; // pattern to extract call lines only
    const slowestTests: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
        const match = line.match(durationPattern);
        if (match) {
            const duration = match[1].trim();
            const testName = match[2].trim();
            slowestTests.push(`${testName} - ${duration}s`);
        }
    }

    return slowestTests;
}