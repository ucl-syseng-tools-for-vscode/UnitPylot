import * as vscode from 'vscode';
import * as path from 'path';

// Includes helper function to annotate chat response in-line
export async function chatFunctionality(textEditor: vscode.TextEditor, ANNOTATION_PROMPT: string, codeWithLineNumbers: string, decorationMethod: number) {
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
async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor, decorationMethod: number) {
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
                console.log("AR", accumulatedResponse);
                const annotation = JSON.parse(accumulatedResponse);
                console.log('Annotation:', annotation);
            
                // added a function to display the annotations according to the command
                handleAnnotation(textEditor, annotation, decorationMethod);
                accumulatedResponse = '';
            } catch {
                // Ignore parse errors
            }
        }
    }
}

function handleAnnotation(
    editor: vscode.TextEditor,
    annotation: { line: number; suggestion: string; test_name?: string },
    decorationMethod: number
) {
    const { line, suggestion, test_name } = annotation;

    if (decorationMethod === 0) { // based on line numbers
        applyDecorationLineNumbers(editor, line, suggestion);
    } else if (decorationMethod === 1) { // based on function name
        applyDecorationFuncName(editor, test_name!, suggestion);
    } else if (decorationMethod === 2) { // for get coverage
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

        // Create hover message with Accept/Reject buttons
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true; // Allows button-like links
        hoverMessage.appendMarkdown(`**Suggestion:** ${suggestion}\n\n`);
        hoverMessage.appendMarkdown(
            `[✔ Accept](command:extension.acceptSuggestion?${encodeURIComponent(JSON.stringify({ line, suggestion, decorationType }))})  ` +
            `[❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(JSON.stringify({ line, decorationType }))})`
        );

        editor.setDecorations(decorationType, [{ range, hoverMessage }]);
    }
}

function displayAnnotation(editor: vscode.TextEditor, line: number, suggestion: string) {
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
    editor.setDecorations(decorationType, [decoration]);

    return decorationType; // Return to allow clearing later
}

function applyDecorationLineNumbers(editor: vscode.TextEditor, line: number, suggestion: string) {
    displayAnnotation(editor, line, suggestion);
}

function applyDecorationFuncName(editor: vscode.TextEditor, functionName: string, suggestion: string) {
    const documentText = editor.document.getText();
    const functionRegex = new RegExp(`def\\s+${functionName}\\s*\\(`);
    const match = documentText.match(functionRegex);

    if (match) {
        const functionStart = match.index!;
        const startPos = editor.document.positionAt(functionStart + match[0].length);
        const lineLength = editor.document.lineAt(startPos.line).text.length;

        const range = new vscode.Range(
            new vscode.Position(startPos.line, lineLength),
            new vscode.Position(startPos.line, lineLength)
        );

        const decorationType = vscode.window.createTextEditorDecorationType({
            after: { contentText: ` ${suggestion.substring(0, 25) + '...'}`, color: 'grey' },
        });

        editor.setDecorations(decorationType, [{ range, hoverMessage: suggestion }]);
    } else {
        vscode.window.showErrorMessage(`Function "${functionName}" not found.`);
    }
}

export async function addToTestFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;
    const currentFileName = path.basename(currentFilePath, '.py'); 

    // Find project root
    let projectRoot = path.dirname(currentFilePath);
    while (!path.basename(projectRoot).includes('src') && path.dirname(projectRoot) !== projectRoot) {
        projectRoot = path.dirname(projectRoot);
    }

    // Locate the 'tests/' folder
    const projectParentDir = path.dirname(projectRoot);
    const testsFolderPath = path.join(projectParentDir, 'tests');

    const testFilePreferred = path.join(testsFolderPath, `${currentFileName}_test.py`); 
    const testFileFallback = path.join(testsFolderPath, `test_${currentFileName}.py`); 

    let testFilePath = testFileFallback; // Default to test_<currentname>.py

    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(testFilePreferred)); // Check for <currentname>_test.py
        testFilePath = testFilePreferred;
    } catch {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(testFileFallback)); // Check for test_<currentname>.py
            testFilePath = testFileFallback;
        } catch {
            vscode.window.showWarningMessage(`No existing test file found. Creating new: ${path.basename(testFileFallback)}`);
        }
    }

    const testFileUri = vscode.Uri.file(testFilePath);

    try {
        let existingText = "";

        try {
            const existingContent = await vscode.workspace.fs.readFile(testFileUri);
            existingText = Buffer.from(existingContent).toString('utf8');
        } catch {
            // If the file doesn’t exist, it will be created
        }
        const updatedText = existingText.trim() + `\n\n# Applied suggestion:\n${cleanedText}\n`;
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(updatedText, 'utf8'));

        vscode.window.showInformationMessage(`Suggestion applied to ${path.basename(testFilePath)} in tests/ successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to append suggestion: ${error}`);
    }
}