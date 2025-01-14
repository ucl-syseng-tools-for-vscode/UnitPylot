"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.handleFileOpen = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
const vscode = require("vscode");
const pytest_1 = require("./pytest");
const SidebarViewProvider_1 = require("./SidebarViewProvider");
const EditorHighlighter_1 = require("./EditorHighlighter");
const jsonStore = new Map();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            handleFileOpen(editor);
        }
    });
    // Handle already open file when extension activates
    if (vscode.window.activeTextEditor) {
        handleFileOpen(vscode.window.activeTextEditor);
    }
    const disposable = vscode.commands.registerCommand('test.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from test!');
    });
    context.subscriptions.push(disposable);
    console.log('Congratulations, your extension "basic" is now active!');
    // Register the "runTests" command
    const runTests = vscode.commands.registerCommand('vscode-run-tests.runTests', async () => {
        try {
            const { passed, failed } = await (0, pytest_1.runPytest)();
            vscode.commands.executeCommand('vscode-run-tests.updateResults', { passed, failed });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });
    context.subscriptions.push(runTests);
    const provider = new SidebarViewProvider_1.SidebarViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SidebarViewProvider_1.SidebarViewProvider.viewType, provider));
    context.subscriptions.push(vscode.commands.registerCommand("dashboard.menu.view", () => {
        const message = " Exit button of extension was clicked !";
        vscode.window.showInformationMessage(message);
    }));
    // Command has been defined in the package.json file
    // Provide the implementation of the command with registerCommand
    // CommandId parameter must match the command field in package.json
    let openWebView = vscode.commands.registerCommand('dashboard.openview', () => {
        // Display a message box to the user
        vscode.window.showInformationMessage('Command " Sidebar View [dashboard.openview] " called.');
    });
    context.subscriptions.push(openWebView);
    // Code coverage command
    const getCoverage = vscode.commands.registerCommand('vscode-run-tests.getCoverage', async () => {
        try {
            const { coverage } = await (0, pytest_1.runCoverageCheck)();
            jsonStore.set('coverage', coverage);
            handleFileOpen(vscode.window.activeTextEditor);
            // Show coverage in the sidebar
            vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to run coverage check.');
        }
    });
    context.subscriptions.push(getCoverage);
}
exports.activate = activate;
function handleFileOpen(editor) {
    const fileName = editor.document.fileName;
    if (fileName.endsWith('.py')) {
        (0, EditorHighlighter_1.highlightCodeCoverage)(fileName, jsonStore.get('coverage') || '{}');
    }
}
exports.handleFileOpen = handleFileOpen;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map