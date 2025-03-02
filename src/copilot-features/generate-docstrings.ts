import * as vscode from 'vscode';
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

// Chat Functionality for Annotation
export async function handleGenerateDocCommand(textEditor: vscode.TextEditor) {
    try {
        const funcLines = await groupFunctions(textEditor)
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(funcLines), 0);
    } catch (error) {
        console.error("Error in handleGenerateDocCommand:", error);
    }
}


//CHECK +1 LOGIC IS OK 
// Extract the line numbers of each test case in the currently open file
function groupFunctions(textEditor: vscode.TextEditor) {
    const document = textEditor.document;
    const text = document.getText();
    const functionRegex = /def\s+test_\w+\s*\(.*\)\s*:/g;
    const assertRegex = /assert\s+/g;
    const functions: { startLine: number, endLine: number }[] = [];

    let match;
    while ((match = functionRegex.exec(text)) !== null) {
        const startLine = document.positionAt(match.index).line +1;
        let endLine = document.lineCount - 1;

        // Find the next assert statement after the start line
        assertRegex.lastIndex = match.index;
        let assertMatch;
        while ((assertMatch = assertRegex.exec(text)) !== null) {
            const assertLine = document.positionAt(assertMatch.index).line;
            if (assertLine > startLine) {
                endLine = assertLine+1;
                break;
            }
        }

        functions.push({ startLine, endLine });
    }

    return functions;
}



