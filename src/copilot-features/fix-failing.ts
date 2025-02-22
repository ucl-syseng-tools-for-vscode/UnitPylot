import * as vscode from 'vscode';
import { getPythonPath } from '../dashboard-metrics/pytest';
import { exec } from 'child_process';
import * as hf from '../copilot-features/helper-func';


const ANNOTATION_PROMPT = `You are an expert Python debugger specializing in refactoring failing test cases. Your role is to analyze a block of Python test code and the provided debug console output, then return the corrected and refactored code in the corresponsing source file based on the failing test. Suggest changes to the function that is being tested, not the test case itself, unless its entirely necessary and the test case is itself wrong. You must to do the following:

- The response must be in the format of a single **JSON object**, starting with '{'.
- Include a "line" field to specify the line where the change begins (if applicable).
- Provide a "suggestion" field with a detailed explanation of the recommended change, including why it should be made.
- Include a "code_snippet" field that contains the corrected or refactored code, either fixing the test case or modifying the function under test.
- Add a "file" field that specifies which file, either the test or source, the code change applies to (the 'test' or 'main').

Here is an example of the expected response format:

{
  "line": 1,
  "suggestion": issue,
  "code_snippet": <corrected_code>
  "file": "main"
},
{
  "line": 5,
  "suggestion": issue,
  "code_snippet": <corrected_code>
  "file": "test"
}
`;

// Chat Functionality for Annotation
export async function handleFixFailingTestsCommand(textEditor: vscode.TextEditor) {
    const codeWithLineNumbers = await getVisibleCodeWithLineNumbers(textEditor);
    hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, codeWithLineNumbers, 3);
}


// Retrives code with line numbers
function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    function runPytest(): Promise<{ stdout: string }> {
        return new Promise(async (resolve, reject) => {

            const pythonPath = await getPythonPath();
            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (workspaceFolders) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest --tb=short || true"`; // The || true is to prevent the command from failing if there are failed tests
                console.log(command);

                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        vscode.window.showErrorMessage(`Pytest Error: ${stderr}`);
                        return reject(error);
                    }

                    resolve({ stdout });
                });
            } else {
                vscode.window.showErrorMessage('No workspace folder found');
                reject(new Error('No workspace folder found'));
            }
        });
    }
    return runPytest().then(result => result.stdout);
}