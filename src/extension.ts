// Import the VS Code API
import * as vscode from 'vscode';
import { SidebarViewProvider } from './SidebarViewProvider';
import { highlightCodeCoverage } from './dashboard-metrics/EditorHighlighter';
import { handleAnnotateCommand } from './copilot-features/annotations';
import { handleFixFailingTestsCommand } from './copilot-features/fix-failing';
import { handleFixCoverageCommand } from './copilot-features/fix-coverage';
import { runSlowestTests } from './dashboard-metrics/slowest';
import { handleOptimiseSlowestTestsCommand } from './copilot-features/optimise-slowest';
import { getTestDependencies } from './dependency-management/dependencies';
import { DependenciesProvider } from './dependency-management/tree-view-provider';
import { get } from 'http';
import { TestRunner } from './test-runner/test-runner';

export const jsonStore: Map<string, any> = new Map();

// Activation Method for the Extension
export function activate(context: vscode.ExtensionContext) {

    // Use this TestRunner instance
    const testRunner = TestRunner.getInstance(context.workspaceState);
    testRunner.runTests();  // TODO: REMOVE THIS LINE !!!

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            handleFileOpen(editor, testRunner);
        }
    });

    if (vscode.window.activeTextEditor) {
        handleFileOpen(vscode.window.activeTextEditor, testRunner);
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
            vscode.LanguageModelChatMessage.User(
                `Given this Python code and its tests:\n\n${contextContent}\n\nHelp improve testing practices for the following query:\n\n${userQuery}`
            )
        ];
        const chatRequest = await chatModels[0].sendRequest(messages, undefined, token);

        for await (const token of chatRequest.text) {
            response.markdown(token);
        }
    });

    // Register the runTests command
    const runTests = vscode.commands.registerCommand('vscode-run-tests.runTests', async () => {
        try {
            const { passed, failed } = testRunner.getResultsSummary();
            vscode.commands.executeCommand('vscode-run-tests.updateResults', { passed, failed });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });

    context.subscriptions.push(runTests);


    // Register the getCoverage command
    const getCoverage = vscode.commands.registerCommand('vscode-run-tests.getCoverage', async () => {
        try {
            const coverage = testRunner.getCoverage();
            handleFileOpen(vscode.window.activeTextEditor!, testRunner);
            vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run coverage check.');
        }
    });

    context.subscriptions.push(getCoverage);


    // Register the slowestTests command
    const slowestTests = vscode.commands.registerCommand('vscode-slowest-tests.slowestTests', async () => {
        try {
            // runSlowestTests();
            const slowest = await testRunner.getSlowestTests(5);
            vscode.commands.executeCommand('vscode-slowest-tests.updateSlowestTests', { slowest });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });
    context.subscriptions.push(slowestTests);

    // Register the annotate command
    const annotateCommand = vscode.commands.registerTextEditorCommand(
        'code-tutor.annotate',
        handleAnnotateCommand
    );
    context.subscriptions.push(annotateCommand);

    // Register the fix failing tests command
    const fixFailingTestsCommand = vscode.commands.registerTextEditorCommand(
        'fix-failing-tests.fixFailingTests',
        handleFixFailingTestsCommand
    );
    context.subscriptions.push(fixFailingTestsCommand);

    // Register the fix coverage command
    const fixCoverageCommand = vscode.commands.registerTextEditorCommand(
        'fix-coverage.fixCoverage',
        handleFixCoverageCommand
    );
    context.subscriptions.push(fixCoverageCommand);

    // Register the optimise slowest tests command
    const optimiseSlowestTestsCommand = vscode.commands.registerTextEditorCommand(
        'optimise-slowest.optimiseSlowest',
        (editor, edit, ...args) => handleOptimiseSlowestTestsCommand(editor, testRunner.getSlowestTests(5))
    );
    context.subscriptions.push(optimiseSlowestTestsCommand);

    // Register the getDependencies command
    context.subscriptions.push(vscode.commands.registerCommand(
        'dependencies.getDependencies', async () => {
            const dependencies = await getTestDependencies();
            jsonStore.set('dependencies', dependencies);
        }
    ));

    const provider = new SidebarViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dashboard.menu.view', () => {
            vscode.window.showInformationMessage('Exit button of extension was clicked!');
        })
    );

    const openWebView = vscode.commands.registerCommand('dashboard.openview', () => {
        vscode.window.showInformationMessage(
            'Command " Sidebar View [dashboard.openview] " called.'
        );
    });

    context.subscriptions.push(openWebView);

    // Register the dependency tree view
    const dependenciesProvider = new DependenciesProvider(context.extensionUri.fsPath);
    vscode.window.createTreeView('dashboard.treeview', {
        treeDataProvider: dependenciesProvider
    });

    // Register the refresh command
    vscode.commands.registerCommand('dependencies.refreshView', () => dependenciesProvider.refresh());
}

// Handles file open event
export function handleFileOpen(editor: vscode.TextEditor, testRunner: TestRunner) {
    const fileName = editor.document.fileName;
    if (fileName.endsWith('.py')) {
        highlightCodeCoverage(fileName, testRunner.getCoverage());
    }
}

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

// Deactivation Method for the Extension
export function deactivate() { }
