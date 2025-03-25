import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';

const ANNOTATION_PROMPT = `
You are an expert coder who helps developers identify vulnerabilities in test cases given a test file. 

Response Format:
- The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).
- Include a **line** field to specify the line where the suggestion begins (if applicable).
- Include a category field that specifies the type of suggestion (Test Impact, Dependency Impact, Test Quality).
- Include a suggestion field that states if modifying a function could break or require changes in tests, mention which tests would be affected and how they would be affected.
- Add a comma after each suggestion to separate multiple suggestions.


Categories: 
1. Test impact: For each function in the file, provide insights on whether modifying a given function may require updating or refactoring related test cases.
2. Dependency Impact: Identify how changes to specific functions, classes, or modules might impact tests or other dependent code.
3. Test Quality: Explain potential weaknesses in the test cases and suggest improvements to make them more robust.

Here is an example of the expected response format:

{ 
    "line": 15, 
    "category": "Test Impact",
    "suggestion": vulnerability. 
},
{ 
    "line": 19, 
    "category": "Dependency Impact",
    "suggestion": vulnerability. 
}
`;

/**
 * Handles the annotate command
 * 
 * @param textEditor The active text editor
 */
export async function handleAnnotateCommand(textEditor: vscode.TextEditor) {
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
    hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers), 0);
}

// Retrives code with line numbers
function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    let currentLine = textEditor.visibleRanges[0].start.line;
    const endLine = textEditor.visibleRanges[0].end.line;

    let code = '';

    while (currentLine < endLine) {
        code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text} \n`;
        currentLine++;
    }
    return code;
}