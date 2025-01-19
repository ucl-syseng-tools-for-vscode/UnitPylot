"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.handleFileOpen = exports.activate = void 0;
// Import the VS Code API
const vscode = require("vscode");
const pytest_1 = require("./dashboard-metrics/pytest");
const SidebarViewProvider_1 = require("./SidebarViewProvider");
const EditorHighlighter_1 = require("./dashboard-metrics/EditorHighlighter");
const annotations_1 = require("./copilot-features/annotations");
const fix_failing_1 = require("./copilot-features/fix-failing");
const fix_coverage_1 = require("./copilot-features/fix-coverage");
const slowest_1 = require("./dashboard-metrics/slowest");
const optimise_slowest_1 = require("./copilot-features/optimise-slowest");
const dependencies_1 = require("./dependency-management/dependencies");
const jsonStore = new Map();
// Activation Method for the Extension
function activate(context) {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            handleFileOpen(editor);
        }
    });
    if (vscode.window.activeTextEditor) {
        handleFileOpen(vscode.window.activeTextEditor);
    }
    const disposable = vscode.commands.registerCommand('test.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from test!');
    });
    context.subscriptions.push(disposable);
    vscode.chat.createChatParticipant("vscode-testing-chat", async (request, context, response, token) => {
        const userQuery = request.prompt;
        // Context - python files and tests 
        const pythonFiles = await getPythonFiles();
        const contextContent = pythonFiles.join('\n\n');
        const chatModels = await vscode.lm.selectChatModels({ family: 'gpt-4' });
        const messages = [
            vscode.LanguageModelChatMessage.User(`Given this Python code and its tests:\n\n${contextContent}\n\nHelp improve testing practices for the following query:\n\n${userQuery}`)
        ];
        const chatRequest = await chatModels[0].sendRequest(messages, undefined, token);
        for await (const token of chatRequest.text) {
            response.markdown(token);
        }
    });
    // Register the runTests command
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
    // Register the getCoverage command
    const getCoverage = vscode.commands.registerCommand('vscode-run-tests.getCoverage', async () => {
        try {
            const { coverage } = await (0, pytest_1.runCoverageCheck)();
            jsonStore.set('coverage', coverage);
            handleFileOpen(vscode.window.activeTextEditor);
            vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to run coverage check.');
        }
    });
    context.subscriptions.push(getCoverage);
    // Register the slowestTests command
    const slowestTests = vscode.commands.registerCommand('vscode-slowest-tests.slowestTests', async () => {
        try {
            (0, slowest_1.runSlowestTests)();
            // const { slowest } = await runSlowestTests();
            // vscode.commands.executeCommand('vscode-slowest-tests.updateSlowestTests', { slowest });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });
    context.subscriptions.push(slowestTests);
    // Register the annotate command
    const annotateCommand = vscode.commands.registerTextEditorCommand('code-tutor.annotate', annotations_1.handleAnnotateCommand);
    context.subscriptions.push(annotateCommand);
    // Register the fix failing tests command
    const fixFailingTestsCommand = vscode.commands.registerTextEditorCommand('fix-failing-tests.fixFailingTests', fix_failing_1.handleFixFailingTestsCommand);
    context.subscriptions.push(fixFailingTestsCommand);
    // Register the fix coverage command
    const fixCoverageCommand = vscode.commands.registerTextEditorCommand('fix-coverage.fixCoverage', fix_coverage_1.handleFixCoverageCommand);
    context.subscriptions.push(fixCoverageCommand);
    // Register the optimise slowest tests command
    const optimiseSlowestTestsCommand = vscode.commands.registerTextEditorCommand('optimise-slowest.optimiseSlowest', optimise_slowest_1.handleOptimiseSlowestTestsCommand);
    context.subscriptions.push(optimiseSlowestTestsCommand);
    // Register the getDependencies command
    context.subscriptions.push(vscode.commands.registerCommand('dependencies.getDependencies', dependencies_1.getTestDependencies));
    const provider = new SidebarViewProvider_1.SidebarViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SidebarViewProvider_1.SidebarViewProvider.viewType, provider));
    context.subscriptions.push(vscode.commands.registerCommand('dashboard.menu.view', () => {
        vscode.window.showInformationMessage('Exit button of extension was clicked!');
    }));
    const openWebView = vscode.commands.registerCommand('dashboard.openview', () => {
        vscode.window.showInformationMessage('Command " Sidebar View [dashboard.openview] " called.');
    });
    context.subscriptions.push(openWebView);
}
exports.activate = activate;
// Handles file open event
function handleFileOpen(editor) {
    const fileName = editor.document.fileName;
    if (fileName.endsWith('.py')) {
        (0, EditorHighlighter_1.highlightCodeCoverage)(fileName, jsonStore.get('coverage') || '{}');
    }
}
exports.handleFileOpen = handleFileOpen;
async function getPythonFiles() {
    const pythonFiles = [];
    // find Python files while excluding files in venv or other virtual environment folders
    const uris = await vscode.workspace.findFiles('**/*.py', '**/venv/**');
    for (const uri of uris) {
        const content = (await vscode.workspace.fs.readFile(uri)).toString();
        pythonFiles.push(`File: ${uri.fsPath}\n${content}`);
    }
    return pythonFiles;
}
// Deactivation Method for the Extension
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map