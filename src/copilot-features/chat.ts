import * as vscode from 'vscode';

async function getCurrentPythonFile(): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'python') {
        const uri = editor.document.uri;
        const content = editor.document.getText();
        return `File: ${uri.fsPath}\n${content}`;
    }
    return 'No Python file is currently open.';
}

// Context - python files and tests 
async function fetchContext(): Promise<string> {
    const pythonFile = await getCurrentPythonFile();
    return pythonFile;
}

export async function fetchPrompt(userQuery: string): Promise<vscode.LanguageModelChatMessage[]> {
    const contextContent = await fetchContext(); 
    return [
        vscode.LanguageModelChatMessage.User(
            `Given this Python code and its tests:\n\n${contextContent}\n\nHelp improve testing practices for the following query ensuring you always use the AAA (Arrange, Act, Assert) pattern:\n\n${userQuery}`
        )
    ];
}