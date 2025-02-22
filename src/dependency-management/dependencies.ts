import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getPythonPath } from '../test-runner/helper-functions';
import { exec } from 'child_process';

function getTestDirectory() {
    // Get the test directory from the configuration
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const workspacePath = workspaceFolders[0].uri.fsPath;
        return `${workspacePath}/tests`;
    }
}

function listFiles(directory: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, { withFileTypes: true }, (err, files) => {
            if (err) {
                return reject(err);
            }
            const fileList = files
                .filter((file) => file.isFile()) // Only include files
                .map((file) => path.join(directory, file.name));
            resolve(fileList);
        });
    });
}

async function getTestFiles() {
    const testDirectory = getTestDirectory();
    if (testDirectory) {
        const files = await listFiles(testDirectory);
        return files;
    }
    return [];
}


async function getTestDependenciesForFile(file: string) {
    const pythonPath = await getPythonPath();
    const scriptPath = path.join(__dirname, '..', 'scripts', 'python-parser.py');

    if (pythonPath) {
        const command = `${pythonPath} ${scriptPath} ${file}`;

        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Dependency Error: ${stderr}`);
                    reject(error);  // Reject the promise if there's an error
                    return;
                }

                try {
                    const dependencies = JSON.parse(stdout);
                    resolve(dependencies);  // Resolve the promise with the dependencies
                } catch (e) {
                    vscode.window.showErrorMessage(`Error parsing dependencies: ${e}`);
                    reject(e);  // Reject if there's an error in parsing
                }
            });
        });
    } else {
        return Promise.reject(new Error("Python path is not available"));  // Reject if there's no python path
    }
}

export async function getTestDependencies() {
    const testFiles = await getTestFiles();
    var dependencies: { [key: string]: any } = {};

    for (const file of testFiles) {
        dependencies[file] = await getTestDependenciesForFile(file);
    }

    vscode.window.showInformationMessage('Test dependencies have been retrieved.');
    return dependencies;
}