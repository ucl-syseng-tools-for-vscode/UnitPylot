import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';

const ANNOTATION_PROMPT = `
You are an expert coder who helps developers identify code smells in tests given a test file. Your job is to:

Response Format:
- The response must be in the format of a single **JSON object**, starting with '{'.
- Include a **line** field to specify the line where the suggestion begins (if applicable).
- Include a suggestion field that states if modifying a function could break or require changes in tests, mention which tests would be affected and how they would be affected.

1. For each function in the file, provide insights on whether modifying a given function may require updating or refactoring related test cases.
2. Identify how changes to specific functions, classes, or modules might impact tests or other dependent code.
3. Explain potential weaknesses in the test cases and suggest improvements to make them more robust.

Here is an example of the expected response format:

{ 
    "line": 15, 
    "suggestion": "Modifying function process_data() might affect test_process_data_valid because it is testing the function's return value and this can affect something else. Consider updating the test case like so to reflect the new behavior."
},
{ 
    "line": 19, 
    "suggestion": "Refactoring get_user_profile() could impact module test_user_service.py and test cases related to user authentication. You can make this more robust by removing its dependency on this case."
},
{ 
    "line": 30, 
    "suggestion": "Refactoring get_user_profile() could impact module test_user_service.py and test cases related to user authentication. You can make this more robust by removing its dependency on this case."
}
`;

// Chat Functionality for Annotation
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