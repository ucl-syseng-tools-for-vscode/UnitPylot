import * as vscode from 'vscode';
import { SidebarViewProvider } from './SidebarViewProvider';
import { highlightCodeCoverage } from './dashboard-metrics/EditorHighlighter';
import { handleAnnotateCommand } from './copilot-features/annotations';
import { handleFixFailingTestsCommand } from './copilot-features/fix-failing';
import { handleFixCoverageCommand } from './copilot-features/fix-coverage';
import { runSlowestTests } from './dashboard-metrics/slowest';
import { handleOptimiseSlowestTestsCommand } from './copilot-features/optimise-slowest';
import { getWebviewContent } from './test-history/test-history-graph';
import { getCoverageWebviewContent } from './test-history/coverage-history-graph';

import { getTestDependencies } from './dependency-management/dependencies';
import { DependenciesProvider } from './dependency-management/tree-view-provider';
import { FailingTestsProvider } from './dashboard-metrics/failing-tree-view';
import { get } from 'http';
import * as path from 'path';
import { TestRunner } from './test-runner/test-runner';

import { handleGeneratePydocCommand } from './copilot-features/generate-pydoc';
import { addToTestFile, addToSameFile, addToMainFile } from './copilot-features/helper-func';
import { handleOptimiseMemoryCommand } from './copilot-features/optimise-memory';
import { FailingTest } from './dashboard-metrics/failing-tree-view';
import { PytestCodeLensProvider } from './editor-features/pytest-code-lens';

import { HistoryManager } from './test-history/history-manager';
import { HistoryProcessor } from './test-history/history-processor';

import { Settings } from './settings/settings';
import { LlmMessage } from './llm/llm-message';
import { Llm } from './llm/llm';

export const jsonStore: Map<string, any> = new Map();
export var testRunner: TestRunner;

// Activation Method for the Extension
export function activate(context: vscode.ExtensionContext) {
    // Use this TestRunner instance
    const testRunner = TestRunner.getInstance(context.workspaceState);
    // Initialise HistoryManager
    HistoryManager.initialise(context);

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

        const messages: LlmMessage[] = [
            {
                role: 'user',
                content: `Given this Python code and its tests:\n\n${contextContent}\n\nHelp improve testing practices for the following query:\n\n${userQuery}`
            }
        ]
        const chatRequest = await Llm.sendRequest(messages);

        for await (const token of chatRequest.text) {
            response.markdown(token);
        }
    });

    // Register the runTests command
    const runTests = vscode.commands.registerCommand('vscode-run-tests.runTests', async () => {
        try {
            const { passed, failed } = await testRunner.getResultsSummary();
            vscode.commands.executeCommand('vscode-run-tests.updateResults', { passed, failed });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });

    context.subscriptions.push(runTests);


    // Register the getCoverage command
    const getCoverage = vscode.commands.registerCommand('vscode-run-tests.getCoverage', async () => {
        try {
            const coverage = await testRunner.getCoverage();
            jsonStore.set('coverage', coverage);
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

    // Register the getMemory command 
    const getMemory = vscode.commands.registerCommand('vscode-run-tests.getMemory', async () => {
        try {

            const memory = await testRunner.getMemory();
            // vscode.commands.executeCommand('vscode-run-tests.updateMemory', { memory });

        } catch (error) {
            vscode.window.showErrorMessage('Failed to run memory check.');
        }
    });

    context.subscriptions.push(getMemory);


    // Register the annotate command
    const annotateCommand = vscode.commands.registerTextEditorCommand(
        'code-tutor.annotate',
        handleAnnotateCommand
    );
    context.subscriptions.push(annotateCommand);

    // Register the fix failing tests command
    const fixFailingTestsCommand = vscode.commands.registerTextEditorCommand(
        'fix-failing-tests.fixFailingTests',
        async (editor, edit, ...args) => handleFixFailingTestsCommand(editor, await testRunner.getAllFailingTests())

    );
    context.subscriptions.push(fixFailingTestsCommand);

    let passFailPanel: vscode.WebviewPanel | undefined;
    const showGraphCommand = vscode.commands.registerCommand('test-history.showPassFailGraph', async () => {
        HistoryManager.saveSnapshot();
        const snapshots = HistoryManager.getSnapshots();
        const graphData = HistoryProcessor.getPassFailHistory();

        if (passFailPanel) {
            passFailPanel.webview.html = getWebviewContent(graphData);
            passFailPanel.reveal(vscode.ViewColumn.One, true);
        } else {
            // Create a new panel if one doesn't exist
            passFailPanel = vscode.window.createWebviewPanel(
                'testHistoryGraph',
                'Test Pass/Fail History',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            passFailPanel.webview.html = getWebviewContent(graphData);

            passFailPanel.onDidDispose(() => {
                passFailPanel = undefined;
            });
        }
    });

    context.subscriptions.push(showGraphCommand);

    let coveragePanel: vscode.WebviewPanel | undefined;
    const showCoverageGraphCommand = vscode.commands.registerCommand(
        'test-history.showCoverageGraph', async () => {
            await HistoryManager.saveSnapshot();
            const snapshots = HistoryManager.getSnapshots();

            const graphData = snapshots.map(snapshot => ({
                date: snapshot.time,
                covered: snapshot.coverage ? snapshot.coverage.totals.covered : 0,
                missed: snapshot.coverage ? snapshot.coverage.totals.missed : 0,
                branchesCovered: snapshot.coverage?.totals.branches_covered ?? 0
            }));

            if (coveragePanel) {
                coveragePanel.webview.html = getCoverageWebviewContent(graphData);
                coveragePanel.reveal(vscode.ViewColumn.One, true);
            } else {
                coveragePanel = vscode.window.createWebviewPanel(
                    'coverageGraph',
                    'Coverage History',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );

                coveragePanel.webview.html = getCoverageWebviewContent(graphData);

                coveragePanel.onDidDispose(() => {
                    coveragePanel = undefined;
                });
            }
        });

    context.subscriptions.push(showCoverageGraphCommand);

    // Register the fix coverage command
    const fixCoverageCommand = vscode.commands.registerTextEditorCommand(
        'fix-coverage.fixCoverage',
        handleFixCoverageCommand
    );
    context.subscriptions.push(fixCoverageCommand);

    // Register the optimise slowest tests command
    const optimiseSlowestTestsCommand = vscode.commands.registerTextEditorCommand(
        'optimise-slowest.optimiseSlowest',
        async (editor, edit, ...args) => handleOptimiseSlowestTestsCommand(editor, await testRunner.getSlowestTests(5))
    );
    context.subscriptions.push(optimiseSlowestTestsCommand);



    // Register the optimise memory usage of tests command
    const optimiseMemoryCommand = vscode.commands.registerTextEditorCommand(
        'optimise-memory.optimiseMemory',
        async (editor, edit, ...args) => handleOptimiseMemoryCommand(editor, await testRunner.getMemory())
    );
    context.subscriptions.push(optimiseMemoryCommand);


    // Register the getDependencies command
    context.subscriptions.push(vscode.commands.registerCommand(
        'dependencies.getDependencies', async () => {
            const dependencies = await getTestDependencies();
            jsonStore.set('dependencies', dependencies);
        }
    ));

    // Register the generate Pydoc command
    const generatePydocCommand = vscode.commands.registerTextEditorCommand(
        'generate-pydoc.generatePydoc',
        handleGeneratePydocCommand
    );
    context.subscriptions.push(generatePydocCommand);

    // Register the in-line accept and reject commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.acceptSuggestion', (args) => {
            const { line, code_snippet, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                addToTestFile(editor, code_snippet);
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.rejectSuggestion', (args) => {
            const { line, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.addSuggestiontoSameFile', (args) => {
            const { line, code_snippet, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                addToSameFile(editor, code_snippet);
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.addSuggestiontoMainFile', (args) => {
            const { line, code_snippet, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                addToMainFile(editor, code_snippet);
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );


    const provider = new SidebarViewProvider(context.extensionUri);

    // Update dashboard on save
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!Settings.RUN_TESTS_ON_SAVE || document.fileName.endsWith('settings.json')) {
            return;
        }

        // Call functions to update dashboard
        testRunner.setNotifications(true);
        const { passed, failed } = await testRunner.getResultsSummary();
        vscode.commands.executeCommand('vscode-run-tests.updateResults', { passed, failed });

        testRunner.setNotifications(false);
        const coverage = await testRunner.getCoverage();
        if (coverage) {
            jsonStore.set('coverage', coverage);
            vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });
        }
        const slowest = await testRunner.getSlowestTests(5);
        vscode.commands.executeCommand('vscode-slowest-tests.updateSlowestTests', { slowest });

        HistoryManager.saveSnapshot();
        vscode.commands.executeCommand('test-history.showPassFailGraph');
        vscode.commands.executeCommand('test-history.showCoverageGraph');

        testRunner.setNotifications(true);
    });

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

    // Register the settings page command
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'PyTastic');
        })
    );

}

function startIntervalTask(context: vscode.ExtensionContext) {
    const INTERVAL = Settings.SNAPSHOT_INTERVAL * 60 * 1000; // minutes to milliseconds

    function myFunction() {
        if (!Settings.RUN_TESTS_IN_BACKGROUND) {
            return;
        }
        console.log('Running scheduled task...');
        console.log('Saving snapshot...');
        HistoryManager.saveSnapshot();
    }

    // Run immediately and schedule repeats
    myFunction();
    const interval = setInterval(myFunction, INTERVAL);

    // Stop the interval when the extension is deactivated
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(interval)));
    // Register the failing test tree view
    const failingTestsProvider = new FailingTestsProvider(context.extensionUri.fsPath);
    const failingTreeView = vscode.window.createTreeView('dashboard.failingtreeview', {
        treeDataProvider: failingTestsProvider
    });
    failingTreeView.onDidChangeSelection((e) => {
        if (e.selection.length > 0) {
            const selectedItem = e.selection[0] as FailingTest;

            if (selectedItem.collapsibleState === vscode.TreeItemCollapsibleState.None) {
                vscode.commands.executeCommand('failingTestsProvider.openTestFile', selectedItem.file, selectedItem.failureLocation)
            }
        }
    });

    // Register the refresh command
    vscode.commands.registerCommand('failingtests.refreshView', () => failingTestsProvider.refresh());

    // Register the open test file command
    vscode.commands.registerCommand('failingTestsProvider.openTestFile', (file: string, lineNumber: number) => {
        console.log(`Opening file: ${file} at line: ${lineNumber}`);
        const workspaceRoot = vscode.workspace.rootPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }

        const filePath = path.join(workspaceRoot, file);
        const fileUri = vscode.Uri.file(filePath);
        const options: vscode.TextDocumentShowOptions = {};

        if (!isNaN(lineNumber) && lineNumber !== undefined) {
            options.selection = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, 0));
        }

        vscode.workspace.openTextDocument(fileUri).then(doc => {
            vscode.window.showTextDocument(doc, options).then(editor => {
                console.log(`File opened: ${file} at line: ${lineNumber}`);
            }, err => {
                console.error(`Failed to show text document: ${err}`);
            });
        }, err => {
            console.error(`Failed to open text document: ${err}`);
        });
    });

    // Register the run tests in file command
    vscode.commands.registerCommand('extension.runTestsInFile', (file: vscode.Uri) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder found.");
            return;
        }

        const relativePath = path.relative(workspaceFolder, file.fsPath);
        console.log(`Running tests in file: ${file}`);
        vscode.window.showInformationMessage(`Running tests in file: ${relativePath}`);
        testRunner.runTests(
            [{
                filePath: relativePath,
                passed: false,
                time: NaN,
            }]
        );
    });

    // Register code lens provider
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file', language: 'python' }, new PytestCodeLensProvider())
    );

    // Register the run specific test command
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.runSpecificTest', (testName: string, file: vscode.Uri) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceFolder) {
                vscode.window.showErrorMessage("No workspace folder found.");
                return;
            }

            const relativePath = path.relative(workspaceFolder, file.fsPath);
            vscode.window.showInformationMessage(`Running: ${testName}`);
            testRunner.runTests(
                [{
                    filePath: relativePath,
                    passed: false,
                    time: NaN,
                    testName: testName
                }]
            )
        })
    );
}

// Handles file open event
export async function handleFileOpen(editor: vscode.TextEditor, testRunner: TestRunner) {
    const fileName = editor.document.fileName;
    if (Settings.CODE_COVERAGE_HIGHLIGHTING && fileName.endsWith('.py')) {
        highlightCodeCoverage(fileName, jsonStore.get('coverage'));
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
