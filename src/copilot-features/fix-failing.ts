import * as vscode from 'vscode';
import { getPythonPath } from '../dashboard-metrics/pytest';
import { exec } from 'child_process';


const ANNOTATION_PROMPT = `You are a debugger who helps developers fix their failing Python tests. Your job is to refactor a block of Python test code, given the debug console output. Only make suggestions for the failing test cases. Format each suggestion as a single JSON object. Here is an example of what your response should look like:

{ "line": 1, "suggestion": "Here is the corrected test case: " }
`;

// Chat Functionality for Annotation
export async function handleAnnotateCommand(textEditor: vscode.TextEditor) {
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

    let [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
    });

    const messages = [
        vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
        vscode.LanguageModelChatMessage.User(codeWithLineNumbers),
    ];

    if (model) {
        const chatResponse = await model.sendRequest(
            messages,
            {},
            new vscode.CancellationTokenSource().token
        );

        await parseChatResponse(chatResponse, textEditor);
    }
}

// Applies decoration to the editor
function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` ${suggestion.substring(0, 25) + '...'}`,
            color: 'grey',
        },
    });

    const lineLength = editor.document.lineAt(line - 1).text.length;
    const range = new vscode.Range(
        new vscode.Position(line - 1, lineLength),
        new vscode.Position(line - 1, lineLength)
    );

    const decoration = { range: range, hoverMessage: suggestion };

    vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);
}

// Parses chat response and applies decoration
async function parseChatResponse(
    chatResponse: vscode.LanguageModelChatResponse,
    textEditor: vscode.TextEditor
) {
    let accumulatedResponse = '';

    for await (const fragment of chatResponse.text) {
        accumulatedResponse += fragment;

        if (fragment.includes('}')) {
            try {
                const annotation = JSON.parse(accumulatedResponse);
                applyDecoration(textEditor, annotation.line, annotation.suggestion);
                accumulatedResponse = '';
            } catch {
                // Ignore parse errors
            }
        }
    }
}

// Retrives code with line numbers
function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    function runPytest(): Promise<{ stdout: string }> {
        return new Promise(async (resolve, reject) => {

            console.log('Running Pytest...');
            const pythonPath = await getPythonPath();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            console.log(pythonPath);
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
    runPytest();

}