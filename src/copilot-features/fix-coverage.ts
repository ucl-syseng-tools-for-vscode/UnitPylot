import * as vscode from 'vscode';
import * as path from 'path';
import * as hf from '../copilot-features/helper-func';
import { Coverage, readJsonFile } from '../dashboard-metrics/pytest';

const ANNOTATION_PROMPT = `
You are a code coverage analysis assistant. Your task is to examine the coverage data for a specific file that the user is working on. Based on the provided file coverage details, you will analyze the missing lines in the file and suggest appropriate test cases to ensure complete coverage.

Analyze Missing Lines:
For the identified file:

Review missing_lines.
Suggest why these lines might not be executed (e.g., untested conditions, branches, or edge cases).
`;

// Chat Functionality for Annotation
export async function handleFixCoverageCommand(textEditor: vscode.TextEditor) {
    const currentFile = textEditor.document.fileName; // Get the current file name
    const normalizedFile = normalizeFilePath(currentFile);
    const codeWithLineNumbers = parseCoverage(normalizedFile);
    console.log("Filtered Coverage Data:", codeWithLineNumbers);
    hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers));
}

function normalizeFilePath(filePath: string): string {
    // Normalize the file path relative to the workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    return path.relative(workspacePath, filePath); // Get relative path from workspace
}

export function parseCoverage(currentFile: string): { filename: string; missingLines: number[] } | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const coveragePath = `${workspacePath}/coverage.json`;
    const coverageData = readJsonFile(coveragePath);
    console.log("Full Coverage Data:", coverageData);

    // Find the specific file's coverage details
    const fileCoverage = coverageData.files[currentFile];
    if (fileCoverage) {
        return {
            filename: currentFile,
            missingLines: fileCoverage.missing_lines || [],
        };
    }

    // Return null if no coverage data is found for the file
    return null;
}
