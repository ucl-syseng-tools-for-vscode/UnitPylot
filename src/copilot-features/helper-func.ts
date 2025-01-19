import * as vscode from 'vscode';

// Includes helper function to annotate chat response in-line

export async function chatFunctionality(textEditor: vscode.TextEditor, ANNOTATION_PROMPT: string, codeWithLineNumbers: string, decorationMethod: boolean) {
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

        await parseChatResponse(chatResponse, textEditor, decorationMethod);
        console.log("Response", chatResponse);
    }
}


// Parses chat response and applies decoration
async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor, decorationMethod: boolean) {
    let accumulatedResponse = '';
    console.log("Response TEXT",chatResponse.text);

    for await (const fragment of chatResponse.text) {
        accumulatedResponse += fragment;
        
        if (fragment.includes('}')) {
            try {
                const annotation = JSON.parse(accumulatedResponse);
                console.log('Annotation:', annotation);
                console.log('func name:', annotation.test_name);
            
                if (decorationMethod) {
                    applyDecorationLineNumbers(textEditor, annotation.line, annotation.suggestion);
                } else {
                    applyDecorationFuncName(textEditor, annotation.test_name, annotation.suggestion);
                }
                accumulatedResponse = '';
            } catch {
                // Ignore parse errors
            }
        }
    }
}


// Applies decoration to the editor based off line numbers
function applyDecorationLineNumbers(editor: vscode.TextEditor, line: number, suggestion: string) {
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


// Applies decoration to the editor based off function name
function applyDecorationFuncName(editor: vscode.TextEditor, functionName: string, suggestion: string) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` ${suggestion.substring(0, 25) + '...'}`,
            color: 'grey',
        },
    });

    const documentText = editor.document.getText();
    const functionRegex = new RegExp(`def\\s+${functionName}\\s*\\(`); // Pattern to match python function definition
    const match = documentText.match(functionRegex);

    if (match) {
        const functionStart = match.index!;
        const startPos = editor.document.positionAt(functionStart + match[0].length);
        const lineLength = editor.document.lineAt(startPos.line).text.length;
        
        const range = new vscode.Range(
            new vscode.Position(startPos.line, lineLength),
            new vscode.Position(startPos.line, lineLength)
        );

        const decoration = { range: range, hoverMessage: suggestion };
        vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);
    } else {
        vscode.window.showErrorMessage(`Function "${functionName}" not found.`);
    }
}