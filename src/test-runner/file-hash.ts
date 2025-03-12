import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { getPythonPath, getTestsForFunctions } from './helper-functions';
import { exec } from 'child_process';
import { TestFunctionResult } from './results';
import { get } from 'http';

export type Hash = {
    [key: string]: FileHash
}

export type FileHash = {
    hash: string;
    isTestFile: boolean;
    functions: {
        [key: string]: FunctionHash;
    };
}

export type FunctionHash = {
    hash: string;
}

export type FilesDiff = {
    added: Hash;
    deleted: Hash;
}

async function getFunctionsInFile(filePath: string): Promise<{ [key: string]: string }> {  // Returns {functionName: functionBody}
    const pythonPath = await getPythonPath();
    const scriptPath = path.join(__dirname, 'function-splitter.py');

    if (pythonPath) {
        const command = `${pythonPath} ${scriptPath} ${filePath}`;
        return new Promise((resolve, reject) => {
            try {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Function Error: ${stderr}`);
                        reject(error);
                        return;
                    }

                    try {
                        const functions = JSON.parse(stdout);
                        resolve(functions);
                    } catch (e) {
                        console.error(`Error parsing functions: ${e}`);
                        reject(e);
                    }
                });
            } catch (e) {
                console.error(`Error executing command: ${e}`);
                reject(e);
            }
        });
    }
    else {
        vscode.window.showErrorMessage('Python path not found');
        return {};
    }
}

async function hashFile(filePath: string): Promise<FileHash> {
    const fileData = fs.readFileSync(filePath, 'utf-8');
    const fileHash = crypto.createHash('sha256').update(fileData).digest('hex');
    const functions: { [key: string]: FunctionHash } = {};

    const functionBodies = await getFunctionsInFile(filePath);
    for (const [key, value] of Object.entries(functionBodies)) {
        functions[key] = { hash: crypto.createHash('sha256').update(value).digest('hex') };
    }

    const filePathParts = filePath.split(path.sep);
    const fileName = filePathParts[filePathParts.length - 1];

    return {
        hash: fileHash,
        isTestFile: fileName.startsWith('test_') || fileName.endsWith('_test.py'),
        functions: functions
    };
}

async function hashDirectory(directoryPath: string): Promise<Hash> {
    const hash: Hash = {};
    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const relativeFilePath = path.relative(directoryPath, filePath);
        if (fs.lstatSync(filePath).isDirectory()) {
            // Ignore virtual environment folders
            if (file === 'venv' || file === '.venv') {
                continue;
            }
            const subDirectoryHash = await hashDirectory(filePath);
            for (const [key, value] of Object.entries(subDirectoryHash)) {
                hash[path.join(relativeFilePath, key)] = value;
            }
        } else {
            if (!file.endsWith('.py')) {
                continue;
            }
            try {
                const fileHash = await hashFile(filePath);
                hash[relativeFilePath] = fileHash;
            } catch (e) {
                console.error(`Error hashing file: ${e}`);
            }
        }
    }
    return hash;
}

export async function getWorkspaceHash() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const hash = await hashDirectory(workspacePath);
    return hash;
}

/**
 * Get the hash difference between two hashes
 * @param {Hash} oldHash - The old hash of the workspace
 * @param {Hash} newHash - The new hash of the workspace
 * @returns {Hash} - The difference between the two hashes 
*/

function getHashDiff(oldHash: Hash, newHash: Hash): Hash {
    const diff: Hash = {};

    for (const [file, fileHash] of Object.entries(newHash)) {
        if (oldHash[file] === undefined) {  // New file
            diff[file] = fileHash;
        } else {
            if (oldHash[file].hash !== fileHash.hash) {  // File has been modified but we only want changed functions
                const newFunctions = fileHash.functions;
                const oldFunctions = oldHash[file].functions;
                for (const [functionName, functionHash] of Object.entries(newFunctions)) {
                    if (oldFunctions[functionName] === undefined || oldFunctions[functionName].hash !== functionHash.hash) {
                        if (diff[file] === undefined) {
                            diff[file] = {
                                hash: fileHash.hash,
                                isTestFile: fileHash.isTestFile,
                                functions: {}
                            };
                        }
                        if (diff[file].functions === undefined) {
                            diff[file].functions = {};
                        }
                        diff[file].functions[functionName] = functionHash;
                    }
                }
            }
        }
    }

    return diff;
}

/**
 * Get modified files in the workspace
 * @param {Hash} oldHash - The old hash of the workspace
 * @returns {Promise<FilesDiff>} - A promise that resolves to a dictionary of test results that have been added or removed.
 */

export function getModifiedFiles(oldHash: Hash, newHash: Hash): FilesDiff {  // TODO: Write more comments for this outrageous method
    const testsChanged: FilesDiff = {
        added: getHashDiff(oldHash, newHash),
        deleted: {}
    };
    // Reverse the order of the arguments to get the deleted files + modified files
    const deletedFiles = getHashDiff(newHash, oldHash);
    // Only keep the files and functions that do not appear in the added files
    for (const [file, fileHash] of Object.entries(deletedFiles)) {
        if (!testsChanged.added[file]) {
            testsChanged.deleted[file] = fileHash;
        } else {
            for (const [functionName, functionHash] of Object.entries(fileHash.functions)) {
                if (!testsChanged.added[file].functions[functionName]) {
                    if (!testsChanged.deleted[file]) {
                        testsChanged.deleted[file] = fileHash;
                    }
                    if (!testsChanged.deleted[file].functions) {
                        testsChanged.deleted[file].functions = {};
                    }
                    testsChanged.deleted[file].functions[functionName] = functionHash;
                }
            }
        }
    }

    return testsChanged;
}
