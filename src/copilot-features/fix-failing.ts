import * as vscode from 'vscode';
import { TestFunctionResult } from '../test-runner/results';
import * as hf from '../copilot-features/helper-func';


const ANNOTATION_PROMPT = `You are an expert Python debugger specializing in refactoring failing test cases. 
Your role is to analyze a block of Python test code given the filepath, the testName and the passed status, then return the corrected and refactored test code.

- The response must be in the format of a single **JSON object**, starting with '{'.
- Include a "line" field to specify the line where the change begins (if applicable).
- Provide a clear "suggestion" field with the corrected test code.

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": "Here is the corrected test case: <corrected_code>"
}
`;

// Chat Functionality for annotations
export async function handleFixFailingTestsCommand(textEditor: vscode.TextEditor, failingTests: TestFunctionResult[]) {
  hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(failingTests), true);

}
