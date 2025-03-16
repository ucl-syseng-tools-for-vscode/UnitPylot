import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';

// Annotation Prompt for generating pydoc suggestions tests in the currently open file

// Added suggestion field in order to reuse previous functions
const ANNOTATION_PROMPT = `
You are a Python documentation assistant. Your task is to analyse the Python code in the currently open file and generate detailed pydoc annotations for its functions and classes.

For each test case provided, based on its start line number:
1. Analyse the test case to understand its purpose, inputs, and expected behavior.
2. Generate a concise and accurate pydoc suggestion that describes what the test case does.

A pydoc-compliant docstring typically includes:
- **A brief description**: Summarize what the function or class does.
- **Parameters**: List the names, types, and descriptions of input parameters.
- **Returns**: Specify the type and description of the returned value.
- **Raises**: Document any exceptions the function might raise.

Include all this in the suggestion field.

Response Format:
- The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).
- Do not include any markdown syntax.

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": "This function calculates the sum of two numbers. It takes two arguments, a and b, and returns their sum."
}
`;

// Chat Functionality for Annotation
export async function handleGeneratePydocCommand(textEditor: vscode.TextEditor) {
    try {
        const fileContent = textEditor.document.getText();
        const funcLines = await groupFunctions(textEditor)

        const payload = {
            fileContent,  
            functions: funcLines
        };
        
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(payload), 0);
    } catch (error) {
        console.error("Error in handleGeneratePydocCommand:", error);
    }
}

function groupFunctions(textEditor: vscode.TextEditor) {
    const document = textEditor.document;
    const text = document.getText();
    const functionRegex = /def\s+test_\w+\s*\(.*\)\s*:/g;
    const functions: { startLine: number }[] = [];

    let match;
    while ((match = functionRegex.exec(text)) !== null) {
        const startLine = document.positionAt(match.index).line + 1;
        functions.push({ startLine });
    }

    return functions;
}



