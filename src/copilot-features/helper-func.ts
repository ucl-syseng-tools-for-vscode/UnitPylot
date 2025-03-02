import * as fs from 'fs';
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
    annotation: { line: number; suggestion: string; category: string, test_name?: string, code_snippet:string, file: string, bottleneck?: string },
    decorationMethod: number
) {
    const { line, suggestion, category, test_name, code_snippet, file, bottleneck} = annotation;

    if (decorationMethod === 0) { // based on line numbers
        applyDecorationLineNumbers(editor, line, suggestion, category!);
    } else if (decorationMethod === 1) { // based on function name
        applyDecorationFuncName(editor, test_name!, suggestion, code_snippet!, bottleneck!);
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

        hoverMessage.appendMarkdown(`**Suggestion:** ${suggestion}\n\n\`\`\`typescript\n${code_snippet}\n\`\`\`\n\n`);

        hoverMessage.appendMarkdown(
            `\n[✔ Accept](command:extension.acceptSuggestion?${encodeURIComponent(JSON.stringify({ line, code_snippet, decorationType }))})` +
            `\n[❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(JSON.stringify({ line, decorationType }))})`
        );

        editor.setDecorations(decorationType, [{ range, hoverMessage }]);
    } else if (decorationMethod === 3) { // for fix failing
        applyDecorationFixFailing(editor, line, suggestion, code_snippet, file);
    }
}

function displayAnnotation(editor: vscode.TextEditor, line: number, suggestion: string, category?: string) {
    console.log('suggestion', suggestion);
    console.log('category', category);
    var decorationType = vscode.window.createTextEditorDecorationType({});
    if (category){
        decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ` ${category.substring(0, 25) + '...'}`,
                color: 'grey',
            },
        });
    }
    else{
        decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ` ${suggestion.substring(0, 25) + '...'}`,
                color: 'grey',
            },
        });
    }
    

    const lineLength = editor.document.lineAt(line - 1).text.length;
    const range = new vscode.Range(
        new vscode.Position(line - 1, lineLength),
        new vscode.Position(line - 1, lineLength)
    );

    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.isTrusted = true;
    if (category) {
        hoverMessage.appendMarkdown(`### 🚀 Code Insight\n\n`);
        hoverMessage.appendMarkdown(`**Category**: \`${category}\`\n\n`);
        hoverMessage.appendMarkdown(`**Insight:**\n> ${suggestion}\n\n`);
    }
    else {
        hoverMessage.appendMarkdown(`${suggestion}`);

    }

    editor.setDecorations(decorationType, [{ range, hoverMessage }]);

    return decorationType; // Return to allow clearing later
}

function applyDecorationLineNumbers(editor: vscode.TextEditor, line: number, suggestion: string, category?: string) {
    displayAnnotation(editor, line, suggestion, category!);
}


function applyDecorationFuncName(editor: vscode.TextEditor, pathToFunctionName: string, suggestion: string, code_snippet: string, bottleneck?:string) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` ${suggestion.substring(0, 25) + '...'}`,
            color: 'grey',
        },
    });


    let functionName: string = '';
    const funcMatch = pathToFunctionName.match(/::([^:]+)$/);

    if (funcMatch) {
        functionName = funcMatch[1];  // Extracted function name
        console.log(functionName);  
    }

    const documentText = editor.document.getText();
    const functionRegex = new RegExp(`def\\s+${functionName}\\s*\\(`);
    const match = documentText.match(functionRegex);

    if (match) {
        const functionStart = match.index!;
        const startPos = editor.document.positionAt(functionStart + match[0].length);

        const line = startPos.line +1;
        const lineLength = editor.document.lineAt(startPos.line).text.length;

        const range = new vscode.Range(
            new vscode.Position(startPos.line, lineLength),
            new vscode.Position(startPos.line, lineLength)
        ); //CHECK??

        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;

        hoverMessage.appendMarkdown(`${suggestion}\n\n`);

    if (bottleneck) {
        hoverMessage.appendMarkdown(`Bottleneck: ${bottleneck}\n\n`);
    }

    hoverMessage.appendMarkdown(
        `\`\`\`typescript\n${code_snippet}\n\`\`\`\n\n`
    );

    hoverMessage.appendMarkdown(
        `\n[✔ Accept](command:extension.addSuggestiontoSameFile?${encodeURIComponent(
            JSON.stringify({ line, code_snippet, decorationType })
        )})` +
        `\n[❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(
            JSON.stringify({ line, decorationType })
        )})`
    );



      

        editor.setDecorations(decorationType, [{ range, hoverMessage }]);

    } else {
        vscode.window.showErrorMessage(`Function "${functionName}" not found.`);
    }
}

export async function addToTestFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;
    const currentFileName = path.basename(currentFilePath, '.py'); 

    // Find project root dynamically
    let projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(currentFilePath);

    let testsFolderPath = path.join(projectRoot, 'tests');

    // If 'tests' is not found in the assumed location, search for it
    if (!fs.existsSync(testsFolderPath)) {
        let parentDir = path.dirname(projectRoot);
        while (parentDir !== projectRoot && !fs.existsSync(path.join(parentDir, 'tests'))) {
            parentDir = path.dirname(parentDir);
        }
        if (fs.existsSync(path.join(parentDir, 'tests'))) {
            testsFolderPath = path.join(parentDir, 'tests');
        }
    }

    const testFilePreferred = path.join(testsFolderPath, `${currentFileName}_test.py`); 
    const testFileFallback = path.join(testsFolderPath, `test_${currentFileName}.py`); 

    let testFilePath = testFileFallback; // Default to test_<currentname>.py

    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(testFilePreferred));
        testFilePath = testFilePreferred;
    } catch {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(testFileFallback));
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

function applyDecorationFixFailing(
    editor: vscode.TextEditor,
    line: number,
    suggestion: string,
    code_snippet: string,
    file: string
) {
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
    hoverMessage.isTrusted = true;

    hoverMessage.appendMarkdown(`**Suggestion:** ${suggestion}\n\n\`\`\`typescript\n${code_snippet}\n\`\`\`\n\n`);

    const acceptCommand = file === "test" 
        ? "extension.addSuggestiontoSameFile" 
        : "extension.addSuggestiontoMainFile";

    hoverMessage.appendMarkdown(
        `\n[✔ Accept](command:${acceptCommand}?${encodeURIComponent(JSON.stringify({ line, code_snippet, decorationType }))})` +
        `\n[❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(JSON.stringify({ line, decorationType }))})`
    );

    editor.setDecorations(decorationType, [{ range, hoverMessage }]);
}

export async function addToSameFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;

    try {
        let existingText = "";
        try {
            const existingContent = await vscode.workspace.fs.readFile(currentFileUri);
            existingText = Buffer.from(existingContent).toString('utf8');
        } catch {
            // If the file doesn’t exist, it will be created
        }

        const updatedText = existingText.trim() + `\n\n# Applied suggestion:\n${cleanedText}\n`;
        await vscode.workspace.fs.writeFile(currentFileUri, Buffer.from(updatedText, 'utf8'));

        vscode.window.showInformationMessage(`Suggestion applied to ${path.basename(currentFilePath)} in tests/ successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to append suggestion: ${error}`);
    }
}

export async function addToMainFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;
    const currentFileName = path.basename(currentFilePath, '.py');

    // Determine the possible main file names by removing test prefixes/suffixes
    const possibleMainFileNames = [
        currentFileName.replace(/^test_/, '') + ".py",
        currentFileName.replace(/_test$/, '') + ".py"
    ];

    let mainFilePath: string | undefined;

    // Search the workspace for a matching main file
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            const searchPattern = new vscode.RelativePattern(folder, `**/{${possibleMainFileNames.join(',')}}`);
            const files = await vscode.workspace.findFiles(searchPattern, '**/tests/**', 1); // Ignore test folders

            if (files.length > 0) {
                mainFilePath = files[0].fsPath;
                break;
            }
        }
    }

    if (!mainFilePath) {
        vscode.window.showWarningMessage(`No existing main file found. Creating a new one: ${possibleMainFileNames[0]}`);
        mainFilePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(currentFilePath), possibleMainFileNames[0]);
    }

    const mainFileUri = vscode.Uri.file(mainFilePath);

    try {
        let existingText = "";
        
        try {
            const existingContent = await vscode.workspace.fs.readFile(mainFileUri);
            existingText = Buffer.from(existingContent).toString('utf8');
        } catch {
            // If the file doesn’t exist, it will be created
        }

        const updatedText = existingText.trim() + `\n\n# Applied suggestion:\n${cleanedText}\n`;
        await vscode.workspace.fs.writeFile(mainFileUri, Buffer.from(updatedText, 'utf8'));

        vscode.window.showInformationMessage(`Suggestion applied to ${path.basename(mainFilePath)} successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to append suggestion: ${error}`);
    }
}