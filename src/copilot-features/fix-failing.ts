import * as vscode from 'vscode';
import { TestFunctionResult } from '../test-runner/results';
import * as hf from '../copilot-features/helper-func';



const ANNOTATION_PROMPT = `
You are an expert Python debugger specializing in refactoring failing test cases. Given the failing test cases, return the corrected and refactored code in the corresponsing source file or test file based on the failing test. 

Response Format:
- The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).
- Must include a "line" field to specify the line where the change begins (if applicable).
- Provide a "suggestion" field with a detailed explanation of the recommended change, including why it should be made.
- Include a "code_snippet" field that contains the corrected or refactored code, either fixing the test case or modifying the function under test.
- Add a "file" field that specifies which file, either the test or source, the code change applies to (the 'test' or 'main').
- Add a comma after each suggestion to separate multiple suggestions.


Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": issue,
  "code_snippet": <corrected_code>,
  "file": test
}, 
{
  "line": 2,
  "suggestion": issue,
  "code_snippet": <corrected_code>,
  "file": main
}
`;


// Command for sending the failing test data and prompt
export async function handleFixFailingTestsCommand(textEditor: vscode.TextEditor, failingTests: TestFunctionResult[]) {
  console.log("Failing Tests:", failingTests);
  hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(failingTests), 3);
}