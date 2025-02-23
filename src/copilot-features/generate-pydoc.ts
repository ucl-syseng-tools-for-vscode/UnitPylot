import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';

// Annotation Prompt for generating pydoc suggestions tests in the currently open file

// Added suggestion field in order to reuse previous functions
const ANNOTATION_PROMPT = `
You are a Python documentation assistant. Your task is to analyse the Python code in the currently open file and generate detailed pydoc annotations for its functions and classes.

For each test case provided, based on its start and end line numbers:
1. Analyse the test case to understand its purpose, inputs, and expected behavior.
2. Generate a concise and accurate pydoc suggestion that describes what the test case does.

A pydoc-compliant docstring typically includes:
- **A brief description**: Summarize what the function or class does.
- **Parameters**: List the names, types, and descriptions of input parameters.
- **Returns**: Specify the type and description of the returned value.
- **Raises**: Document any exceptions the function might raise.

Include all this in the suggestion field.


Response Format:
- The response must be in the format of a single **JSON object**, starting with '{'.
- Do not include any markdown syntax.

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": "This function calculates the sum of two numbers. It takes two arguments, a and b, and returns their sum."
}


Guidelines:
- Clarity: Write pydoc strings that are easy to understand for other developers.
- Completeness: Ensure every function and class has a corresponding annotation that fully documents its behavior.
- Adherence: Follow Python's docstring conventions for readability and consistency.
`;

// Chat Functionality for Annotation
export async function handleGeneratePydocCommand(textEditor: vscode.TextEditor) {
    try {
        const funcLines = await groupFunctions(textEditor)
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(funcLines), 0);
    } catch (error) {
        console.error("Error in handleGeneratePydocCommand:", error);
    }
}


//CHECK +1 LOGIC IS OK 
// Extract a line numbers of each test case in the currently open file
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



