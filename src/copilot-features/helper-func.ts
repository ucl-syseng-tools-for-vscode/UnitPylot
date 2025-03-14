import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

import { Llm } from '../llm/llm';
import { LlmMessage } from '../llm/llm-message';

// Utility to create a base decoration type
function createBaseDecorationType(suggestion: string): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` ${suggestion.substring(0, 25) + '...'}`,
            color: 'grey',
        },
    });
}

// Utility to get position at the end of a line
function getLineEndRange(editor: vscode.TextEditor, line: number): vscode.Range {
    const lineLength = editor.document.lineAt(line - 1).text.length;
    return new vscode.Range(
        new vscode.Position(line - 1, lineLength),
        new vscode.Position(line - 1, lineLength)
    );
}

// Shared file-read/append/write logic
async function appendSuggestionToFile(fileUri: vscode.Uri, cleanedText: string, successMessage: string, errorMessage: string) {
    try {
        let existingText = "";
        try {
            const existingContent = await vscode.workspace.fs.readFile(fileUri);
            existingText = Buffer.from(existingContent).toString('utf8');
        } catch {
            // If the file doesn’t exist, it will be created below
        }

        const updatedText = existingText.trim() + `\n\n# Applied suggestion:\n${cleanedText}\n`;
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(updatedText, 'utf8'));

        vscode.window.showInformationMessage(successMessage);
    } catch (error) {
        vscode.window.showErrorMessage(`${errorMessage} ${error}`);
    }
}

// The main chat entry point 
export async function chatFunctionality(textEditor: vscode.TextEditor, ANNOTATION_PROMPT: string, codeWithLineNumbers: string, decorationMethod: number) {
    const messages: LlmMessage[] = [
        { role: 'user', content: ANNOTATION_PROMPT },
        { role: 'user', content: codeWithLineNumbers }
    ];

    const chatResponse = await Llm.sendRequest(messages, true);
    if (chatResponse) {
        await parseChatResponse(chatResponse, textEditor, decorationMethod);
        console.log("Response", chatResponse);
    }
}

// Parse streaming response and apply decoration 
async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor, decorationMethod: number) {
    let accumulatedResponse = '';
    let parsedSuccessfully = false;

    for await (const fragment of chatResponse.text) {
        if (fragment.includes('},')) {
            accumulatedResponse += '}';
        } else {
            accumulatedResponse += fragment;
        }

        if (fragment.includes('}')) {
            try {
                const annotation = JSON.parse(accumulatedResponse);
                console.log('Annotation:', annotation);

                handleAnnotation(textEditor, annotation, decorationMethod);
                accumulatedResponse = '';
                parsedSuccessfully = true;
            } catch {
                // Try parsing as an array of annotations
                try {
                    const annotations = JSON.parse(`[${fragment}]`);
                    for (const annotation of annotations) {
                        console.log('Annotation:', annotation);
                        handleAnnotation(textEditor, annotation, decorationMethod);
                    }
                    parsedSuccessfully = true; 
                } catch {
                    console.warn('Parsing attempt failed for fragment:', fragment);
                }
            }
        }
    }

    if (!parsedSuccessfully) {
        console.error('Failed to parse annotation:', accumulatedResponse);
        vscode.window.showErrorMessage('Failed to parse LLM output. Please run the command again...');
    }
}

// Decide which decoration method to invoke 
function handleAnnotation(editor: vscode.TextEditor, 
    annotation: {line: number; suggestion: string; category: string; test_name?: string; code_snippet: string; file: string; bottleneck?: string}, decorationMethod: number) {
    const { line, suggestion, category, test_name, code_snippet, file, bottleneck } = annotation;

    switch (decorationMethod) {
        case 0: // based on line numbers
            applyDecorationLineNumbers(editor, line, suggestion, category);
            break;

        case 1: // based on function name
            applyDecorationFuncName(editor, test_name!, suggestion, code_snippet!, bottleneck!);
            break;

        case 2: // for get coverage
            applyDecorationCoverage(editor, line, suggestion, code_snippet);
            break;

        case 3: // for fix failing
            applyDecorationFixFailing(editor, line, suggestion, code_snippet, file);
            break;

        default:
            console.warn('Unknown decoration method:', decorationMethod);
            break;
    }
}

// Simple annotation display for line numbers
function applyDecorationLineNumbers(editor: vscode.TextEditor, line: number, suggestion: string, category?: string) {
    displayAnnotation(editor, line, suggestion, category!);
}

// Generic annotation display
function displayAnnotation(editor: vscode.TextEditor, line: number, suggestion: string, category?: string) {
    let decorationType: vscode.TextEditorDecorationType;
    if (category) {
        decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ` ${category.substring(0, 25) + '...'}`,
                color: 'grey',
            },
        });
    } else {
        decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ` ${suggestion.substring(0, 25) + '...'}`,
                color: 'grey',
            },
        });
    }

    const range = getLineEndRange(editor, line);
    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.isTrusted = true;

    if (category) {
        hoverMessage.appendMarkdown(`### 🚀 Code Insight\n\n`);
        hoverMessage.appendMarkdown(`**Category**: \`${category}\`\n\n`);
        hoverMessage.appendMarkdown(`**Insight:**\n> ${suggestion}\n\n`);
    } else {
        hoverMessage.appendMarkdown(`${suggestion}`);
    }

    editor.setDecorations(decorationType, [{ range, hoverMessage }]);
}

// Coverage-specific decoration
function applyDecorationCoverage(editor: vscode.TextEditor, line: number, suggestion: string, code_snippet: string
) {
    const decorationType = createBaseDecorationType(suggestion);
    const range = getLineEndRange(editor, line);

    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.isTrusted = true;
    hoverMessage.appendMarkdown(`**Suggestion:** ${suggestion}\n\n\`\`\`typescript\n${code_snippet}\n\`\`\`\n\n`);

    hoverMessage.appendMarkdown(
        `\n #### [✅ Accept](command:extension.acceptSuggestion?${encodeURIComponent(
            JSON.stringify({ line, code_snippet, decorationType })
        )})` +
        `\n #### [❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(
            JSON.stringify({ line, decorationType })
        )})`
    );

    editor.setDecorations(decorationType, [{ range, hoverMessage }]);
}

// Fix failing test decoration
function applyDecorationFixFailing(editor: vscode.TextEditor, line: number, suggestion: string, code_snippet: string, file: string) {
    const decorationType = createBaseDecorationType(suggestion);
    const range = getLineEndRange(editor, line);

    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.isTrusted = true;
    hoverMessage.appendMarkdown(`**Suggestion:** ${suggestion}\n\n\`\`\`typescript\n${code_snippet}\n\`\`\`\n\n`);

    const acceptCommand = file === "test"
        ? "extension.addSuggestiontoSameFile"
        : "extension.addSuggestiontoMainFile";

    hoverMessage.appendMarkdown(
        `\n #### [✅ Accept](command:${acceptCommand}?${encodeURIComponent(
            JSON.stringify({ line, code_snippet, decorationType })
        )})` +
        `\n #### [❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(
            JSON.stringify({ line, decorationType })
        )})`
    );

    editor.setDecorations(decorationType, [{ range, hoverMessage }]);
}

// Applies decoration based on a function name 
function applyDecorationFuncName(editor: vscode.TextEditor, pathToFunctionName: string, suggestion: string, code_snippet: string, bottleneck?: string) {
    const decorationType = createBaseDecorationType(suggestion);
    let functionName: string = '';

    // Check if `pathToFunctionName` contains "::" before extracting
    if (pathToFunctionName.includes("::")) {
        const funcMatch = pathToFunctionName.match(/::([^:]+)$/);
        if (funcMatch) {
            functionName = funcMatch[1];
        }
    } else {
        functionName = pathToFunctionName;
    }

    // Remove [something] suffix if present
    functionName = functionName.replace(/\[.*\]$/, "");

    const documentText = editor.document.getText();
    const functionRegex = new RegExp(`def\\s+${functionName}\\s*\\(`);
    const match = documentText.match(functionRegex);

    if (match) {
        const functionStart = match.index!;
        const startPos = editor.document.positionAt(functionStart + match[0].length);

        const line = startPos.line + 1;
        const lineLength = editor.document.lineAt(startPos.line).text.length;

        const range = new vscode.Range(
            new vscode.Position(startPos.line, lineLength),
            new vscode.Position(startPos.line, lineLength)
        );

        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;

        hoverMessage.appendMarkdown(`${suggestion}\n\n`);
        if (bottleneck) {
            hoverMessage.appendMarkdown(`Bottleneck: ${bottleneck}\n\n`);
        }

        hoverMessage.appendMarkdown(`\`\`\`typescript\n${code_snippet}\n\`\`\`\n\n`);

        hoverMessage.appendMarkdown(
            `\n #### [✅ Accept](command:extension.addSuggestiontoSameFile?${encodeURIComponent(
                JSON.stringify({ line, code_snippet, decorationType })
            )})` +
            `\n #### [❌ Reject](command:extension.rejectSuggestion?${encodeURIComponent(
                JSON.stringify({ line, decorationType })
            )})`
        );

        editor.setDecorations(decorationType, [{ range, hoverMessage }]);
    } else {
        vscode.window.showErrorMessage(`Function "${functionName}" not found.`);
    }
}

// Add suggestions to test file
export async function addToTestFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;
    const currentFileName = path.basename(currentFilePath, '.py');

    // Find project root dynamically
    let projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(currentFilePath);
    let testsFolderPath = path.join(projectRoot, 'tests');

    // If 'tests' is not found, search for it upwards
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
            vscode.window.showWarningMessage(
                `No existing test file found. Creating new: ${path.basename(testFileFallback)}`
            );
        }
    }

    const testFileUri = vscode.Uri.file(testFilePath);

    await appendSuggestionToFile(testFileUri, cleanedText,
        `Suggestion applied to ${path.basename(testFilePath)} in tests/ successfully!`,
        'Failed to append suggestion:'
    );
}

// Add suggestions to the same file
export async function addToSameFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;

    await appendSuggestionToFile(
        currentFileUri,
        cleanedText,
        `Suggestion applied to ${path.basename(currentFilePath)} successfully!`,
        'Failed to append suggestion:'
    );
}

// Add suggestions to the main file
export async function addToMainFile(editor: vscode.TextEditor, text: string) {
    const cleanedText = text.replace(/Here is the corrected code:\s*/i, '');
    const currentFileUri = editor.document.uri;
    const currentFilePath = currentFileUri.fsPath;
    const currentFileName = path.basename(currentFilePath, '.py');

    // Determine possible main file names
    const possibleMainFileNames = [
        currentFileName.replace(/^test_/, '') + ".py",
        currentFileName.replace(/_test$/, '') + ".py"
    ];

    let mainFilePath: string | undefined;

    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            const searchPattern = new vscode.RelativePattern(folder, `**/{${possibleMainFileNames.join(',')}}`);
            const files = await vscode.workspace.findFiles(searchPattern, '**/tests/**', 1);
            if (files.length > 0) {
                mainFilePath = files[0].fsPath;
                break;
            }
        }
    }

    if (!mainFilePath) {
        vscode.window.showWarningMessage(
            `No existing main file found. Creating a new one: ${possibleMainFileNames[0]}`
        );
        mainFilePath = path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(currentFilePath),
            possibleMainFileNames[0]
        );
    }

    const mainFileUri = vscode.Uri.file(mainFilePath);

    await appendSuggestionToFile(
        mainFileUri,
        cleanedText,
        `Suggestion applied to ${path.basename(mainFilePath)} successfully!`,
        'Failed to append suggestion:'
    );
}
