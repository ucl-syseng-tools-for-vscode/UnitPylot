import * as vscode from 'vscode';

const ANNOTATION_PROMPT = `You are a code tutor who helps developers understand the interconnectedness of tests and code in a workspace. Your job is to:

1. Analyze the workspace to identify how changes to specific functions, classes, or modules might impact tests or other dependent code.
2. Provide insights on whether modifying a given function may require updating or refactoring related test cases.

You must do the following:
- The response must be in the format of a single **JSON object**, starting with '{'. 
- If modifying a function could break or require changes in tests, mention which tests would be affected and how they would be affected.
- Include the line number of the test function in the response.
Here is an example:

{ "line": 15, 
  "suggestion": "Modifying function process_data() might affect test_process_data_valid because it is testing the function's return value."
},
{ "line": 30, 
  "suggestion": "Refactoring get_user_profile() could impact module test_user_service.py and test cases related to user authentication."
}
`;

async function getWorkspaceContext(): Promise<string> {
    const files = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**', 10); 
    let context = '';

    for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        context += `File: ${file.fsPath}\n${doc.getText()}\n\n`;
    }

    return context;
}

// Chat Functionality for Annotation
export async function handleAnnotateCommand(textEditor: vscode.TextEditor) {
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
    const workspaceContext = await getWorkspaceContext();

    let [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
    });

    const messages = [
        vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
        vscode.LanguageModelChatMessage.User(`Workspace Context:\n${workspaceContext}`),
        vscode.LanguageModelChatMessage.User(`Current File:\n${codeWithLineNumbers}`),
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
        if (fragment.includes('},')) {
            accumulatedResponse += '}';
        }
        else{
            accumulatedResponse += fragment;
        }

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
    let currentLine = textEditor.visibleRanges[0].start.line;
    const endLine = textEditor.visibleRanges[0].end.line;

    let code = '';

    while (currentLine < endLine) {
        code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text} \n`;
        currentLine++;
    }
    return code;
}