import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as hf from '../copilot-features/helper-func';
import { readJsonFile } from '../test-runner/helper-functions';

const ANNOTATION_PROMPT = `
You are a code coverage analysis assistant. Based on the provided file coverage details and code, you will analyze the missing lines in the file and suggest test cases to ensure complete coverage in the code where appropriate.

For the identified file:
1. Review the missing_lines.
2. You must suggest code that covers untested conditions, branches, or edge cases.

Response Format:
- The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).
- Include a **line** field to specify the line where the change begins (if applicable).
- Please provide a **suggestion** field detailing the issue related to the coverage.
- Must include a **code_snippet** field with the corrected test code.
- Add a comma after each suggestion to separate multiple suggestions.

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

// Command for sending the coverage data and prompt
export async function handleFixCoverageCommand(textEditor: vscode.TextEditor) {
    try {
        const currentFile = textEditor.document.fileName;
        const fileContent = textEditor.document.getText();
        const coverageData = await parseCoverage(currentFile);
        const testFileContents = getTestFileContent(currentFile);

        const payload = {
            fileContent,
            testFileContents,
            coverage: coverageData
        };
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(payload), 2);
    } catch (error) {
        vscode.window.showErrorMessage(`Error handling coverage: ${(error instanceof Error) ? error.message : 'Unknown error'}`);
    }
}

// Get coverage data for the current file
export function parseCoverage(currentFile: string): { filename: string; missingLines: number[] } | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const relativeFilePath = path.relative(workspacePath, currentFile);
    const coveragePath = path.join(workspacePath, 'coverage.json');

    try {
        const coverageData = readJsonFile(coveragePath);
        const fileCoverage = coverageData.files?.[relativeFilePath];
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

function getTestFileContent(currentFilePath: string): string {
    const testFilePath = findCorrespondingTestFile(currentFilePath);
    return testFilePath && fs.existsSync(testFilePath) 
        ? fs.readFileSync(testFilePath, 'utf-8') 
        : "";
}

function findCorrespondingTestFile(currentFilePath: string): string | null {
    if (!currentFilePath.endsWith('.py')) return null;
    
    const fileName = path.basename(currentFilePath, '.py');
    const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(currentFilePath);
    const testsFolder = findTestsFolder(projectRoot);
    
    if (!testsFolder) return null;
    const testFilePreferred = path.join(testsFolder, `${fileName}_test.py`);
    const testFileFallback = path.join(testsFolder, `test_${fileName}.py`);

    return fs.existsSync(testFilePreferred) ? testFilePreferred : fs.existsSync(testFileFallback) ? testFileFallback : null;
}

function findTestsFolder(startPath: string): string | null {
    let currentPath = startPath;
    while (currentPath !== path.dirname(currentPath)) {
        const potentialTestFolder = path.join(currentPath, 'tests');
        if (fs.existsSync(potentialTestFolder)) return potentialTestFolder;
        currentPath = path.dirname(currentPath);
    }
    return null;
}