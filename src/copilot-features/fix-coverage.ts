import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as hf from '../copilot-features/helper-func';
import { readJsonFile } from '../test-runner/helper-functions';

const ANNOTATION_PROMPT = `
You are a code coverage analysis assistant. Your task is to examine the coverage data for a specific file that the user is working on. Based on the provided file coverage details and code, you will analyze the missing lines in the file and suggest test cases to ensure complete coverage in the code where appropriate.

Given all the missing lines, provide a test case that would cover these lines.:
For the identified file:

1. Review the missing_lines.
2. You must suggest code that covers untested conditions, branches, or edge cases.

Response Format:
- The response must be in the format of a single **JSON object**, starting with '{'.
- Include a **line** field to specify the line where the change begins (if applicable).
- Please provide a **suggestion** field with the issue related to the coverage
- Must include a **code_snippet** field with the corrected test code.

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": issue,
  "code_snippet": <corrected_code>
}, 
{
  "line": 2,
  "suggestion": issue,
  "code_snippet": <corrected_code>
}
`;


export async function handleFixCoverageCommand(textEditor: vscode.TextEditor) {
    try {
        const currentFile = textEditor.document.fileName; // Get current file path
        const normalizedFile = normalizeFilePath(currentFile);

        const coverageData = await parseCoverage(normalizedFile);

        const visibleCode = getVisibleCodeWithLineNumbers(textEditor);

        const testFilePath = await findCorrespondingTestFile(currentFile); 
        let testFileContents = '';
        if (testFilePath) {
            testFileContents = fs.readFileSync(testFilePath, 'utf-8');
        }

        const payload = {
            file: normalizedFile,
            coverage: coverageData,
            visibleCode: visibleCode,
            testFilePath: testFilePath || "No test file found",
            testFileContents: testFileContents || "No test file contents available",
        };

        console.log("Coverage Data with Test File Context:", payload);

        // Send the combined context to the chat functionality
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(payload), 2);
    } catch (error) {
        vscode.window.showErrorMessage(`Error handling coverage: ${(error instanceof Error) ? error.message : 'Unknown error'}`);
    }
}

// Normalize file path relative to the workspace folder
function normalizeFilePath(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    return path.relative(workspacePath, filePath);
}

// Get visible code from the editor with line numbers
function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    const visibleRanges = textEditor.visibleRanges;
    if (visibleRanges.length === 0) return '';

    let currentLine = visibleRanges[0].start.line;
    const endLine = visibleRanges[0].end.line;

    let code = '';

    while (currentLine <= endLine) {
        code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text}\n`;
        currentLine++;
    }
    return code;
}

// Parse the coverage JSON file and extract missing lines for the given file
export function parseCoverage(currentFile: string): { filename: string; missingLines: number[] } | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const coveragePath = path.join(workspacePath, 'coverage.json');

    try {
        const coverageData = readJsonFile(coveragePath);
        console.log("Full Coverage Data:", coverageData);

        const fileCoverage = coverageData.files?.[currentFile];
        if (fileCoverage) {
            return {
                filename: currentFile,
                missingLines: fileCoverage.missing_lines || [],
            };
        }

        console.warn(`No coverage data found for file: ${currentFile}`);
        return null;
    } catch (error) {
        console.error("Error reading coverage.json:", error);
        return null;
    }
}

async function findCorrespondingTestFile(currentFilePath: string): Promise<string | null> {
    if (!currentFilePath.endsWith('.py')) {
        return null; // Only search for Python test files
    }

    const currentFileName = path.basename(currentFilePath, '.py');

    let projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(currentFilePath);
    let testsFolderPath = path.join(projectRoot, 'tests');

    // If 'tests/' folder is not found, search for it in parent directories
    if (!fs.existsSync(testsFolderPath)) {
        let parentDir = path.dirname(projectRoot);
        while (parentDir !== projectRoot && !fs.existsSync(path.join(parentDir, 'tests'))) {
            parentDir = path.dirname(parentDir);
        }
        if (fs.existsSync(path.join(parentDir, 'tests'))) {
            testsFolderPath = path.join(parentDir, 'tests');
        } else {
            return null; 
        }
    }

    // Possible test file names
    const testFilePreferred = path.join(testsFolderPath, `${currentFileName}_test.py`);
    const testFileFallback = path.join(testsFolderPath, `test_${currentFileName}.py`);

    if (fs.existsSync(testFilePreferred)) {
        return testFilePreferred;
    }
    if (fs.existsSync(testFileFallback)) {
        return testFileFallback;
    }

    return null; 
}