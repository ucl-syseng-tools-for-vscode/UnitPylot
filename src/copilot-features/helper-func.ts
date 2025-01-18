import * as vscode from 'vscode';

// Includes helper function to annotate chat response in-line

export async function chatFunctionality(textEditor: vscode.TextEditor, ANNOTATION_PROMPT: string, codeWithLineNumbers: string) {
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
        console.log("Response", chatResponse);
    }
}


// Parses chat response and applies decoration
async function parseChatResponse(
    chatResponse: vscode.LanguageModelChatResponse,
    textEditor: vscode.TextEditor
) {
    let accumulatedResponse = '';
    console.log("Response TEXT",chatResponse.text);

    for await (const fragment of chatResponse.text) {
        accumulatedResponse += fragment;
        

        if (fragment.includes('}')) {
            try {
                const annotation = JSON.parse(accumulatedResponse);
                console.log('Annotation:', annotation);
                applyDecoration(textEditor, annotation.line, annotation.suggestion);
                accumulatedResponse = '';
            } catch {
                // Ignore parse errors
            }
        }
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