import * as vscode from 'vscode';

async function getPythonFiles(): Promise<string[]> {
    const pythonFiles: string[] = [];
    // find Python files while excluding files in venv or other virtual environment folders
    const uris = await vscode.workspace.findFiles('**/*.py', '**/venv/**');
    for (const uri of uris) {
        const content = (await vscode.workspace.fs.readFile(uri)).toString();
        pythonFiles.push(`File: ${uri.fsPath}\n${content}`);
    }
    return pythonFiles;
}

// Context - python files and tests 
async function fetchContext() {
    const pythonFiles = await getPythonFiles();
    return pythonFiles.join('\n\n');
}

export async function fetchPrompt(userQuery: string): Promise<vscode.LanguageModelChatMessage[]> {
    const contextContent = await fetchContext(); 
    return [
        vscode.LanguageModelChatMessage.User(
            `Given this Python code and its tests:\n\n${contextContent}\n\nHelp improve testing practices for the following query ensuring you always use the AAA (Arrange, Act, Assert) pattern:\n\n${userQuery}`
        )
    ];
}



