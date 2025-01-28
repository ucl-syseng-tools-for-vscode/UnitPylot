import * as vscode from 'vscode';
import * as path from 'path';
import * as hf from '../copilot-features/helper-func';
import { Coverage, readJsonFile } from '../dashboard-metrics/pytest';

const ANNOTATION_PROMPT = `
You are a code coverage analysis assistant. Your task is to examine the coverage data for a specific file that the user is working on. Based on the provided file coverage details, you will analyze the missing lines in the file and suggest appropriate test cases to ensure complete coverage.

Given all the missing lines, provide a suggestion for a test case that would cover these lines.:
For the identified file:

1. Review the missing_lines.
2. Suggest why these lines might not be executed (e.g., untested conditions, branches, or edge cases).

Response Format:
- The response must be in the format of a single **JSON object**, starting with '{'.
- Include a **line** field to specify the line where the change begins (if applicable).
- Provide a clear **suggestion** field with the corrected test code.

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": "Add a test case to cover the edge case where the input is an empty list."
}, 
{
  "line": 2,
  "suggestion": "Add a test case to cover the edge case where the input is a list with a single element."
}

Guidelines:
- Clarity: Be clear and concise in your explanation of the test case suggestion.
- Detail: Ensure the suggested test case is thorough enough for the user to understand the reasoning behind the suggestion.

`;

// Chat Functionality for Annotation
export async function handleFixCoverageCommand(textEditor: vscode.TextEditor) {
    const currentFile = textEditor.document.fileName; // Get the current file name
    const normalizedFile = normalizeFilePath(currentFile);
    const codeWithLineNumbers = await parseCoverage(normalizedFile);
    console.log("Filtered Coverage Data:", codeWithLineNumbers);
    hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers), 0);
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
