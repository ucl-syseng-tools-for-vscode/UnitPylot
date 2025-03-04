import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as hf from './helper-func';

// Annotation Prompt for generating docstring suggestions for tests in the currently open file

// Added suggestion field in order to reuse previous functions
const ANNOTATION_PROMPT = `
You are a Python test case documentation assistant. Your task is to analyse the Python code in the currently open file and generate detailed docstrings for test cases.

For each test case provided, based on its start and end line numbers:
1. Analyse the test case to understand its purpose, inputs, setup, and expected behavior.
2. Generate a concise and accurate docstring suggestion in the proper format for documenting test cases.

Response Format:
- The response must be in the format of a single **JSON object**, starting with '{'.
- Do not include any markdown syntax.
- Follow typical Python docstring conventions for test cases.

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": Test the addition function.\n\nThis test verifies that the addition function correctly computes the sum of two positive integers. It provides 3 and 5 as inputs and expects a result of 8.
}

Guidelines:
- Purpose: Clearly state what the test case is testing (e.g., a specific function or behavior).
- Inputs: Describe the key inputs or setup used in the test.
- Expected Outcome: Explain the expected result or behavior being validated.
- Format: Use PEP 257-style multi-line docstrings for clarity.
- Adherence: Ensure all test cases have clear, concise, and consistent documentation that follows Python's docstring conventions.
`;

export async function handleGenerateDocCommand(textEditor: vscode.TextEditor) {
    try {
        const currentFilePath = textEditor.document.fileName;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const normalizedFilePath = path.relative(workspacePath, currentFilePath);

        const testFileContent = textEditor.document.getText();

        const payload = {
            file: normalizedFilePath,
            content: testFileContent
        };

        console.log("Sending test file content with workspace context:", payload);

        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(payload), 0);
    } catch (error) {
        vscode.window.showErrorMessage(`Error generating docstrings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}