import * as vscode from 'vscode';
import * as path from 'path';

import { SidebarViewProvider } from './SidebarViewProvider';
import { highlightCodeCoverage } from './dashboard-metrics/EditorHighlighter';
import { handleAnnotateCommand } from './copilot-features/annotations';
import { handleFixFailingTestsCommand } from './copilot-features/fix-failing';
import { handleFixCoverageCommand } from './copilot-features/fix-coverage';
import { handleOptimiseSlowestTestsCommand } from './copilot-features/optimise-slowest';
import { getWebviewContent } from './test-history/test-history-graph';
import { getCoverageWebviewContent } from './test-history/coverage-history-graph';

import { FailingTestsProvider } from './dashboard-metrics/failing-tree-view';
import { TestRunner } from './test-runner/test-runner';

import { handleGeneratePydocCommand } from './copilot-features/generate-pydoc';
import { addToTestFile, addToSameFile, addToMainFile } from './copilot-features/helper-func';
import { handleOptimiseMemoryCommand } from './copilot-features/optimise-memory';
import { FailingTest } from './dashboard-metrics/failing-tree-view';
import { PytestCodeLensProvider } from './editor-features/pytest-code-lens';

import { HistoryManager } from './test-history/history-manager';
import { HistoryProcessor } from './test-history/history-processor';
import { fetchPrompt } from './copilot-features/chat';
import { ReportGenerator } from './test-history/report-generator';

import { Settings } from './settings/settings';

import { GraphDocTreeViewProvider } from './dashboard-metrics/graph-doc-tree-view';


// Activation Method for the Extension
export function activate(context: vscode.ExtensionContext) {
    // Use this TestRunner instance
    const testRunner = TestRunner.getInstance(context.workspaceState);

    // Initialise HistoryManager
    HistoryManager.initialise(context);

    // Handle file open event
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            handleFileOpen(editor, testRunner);
        }
    });

    if (vscode.window.activeTextEditor) {
        handleFileOpen(vscode.window.activeTextEditor, testRunner);
    }

    // Register the chat participant
    vscode.chat.createChatParticipant("unitpylot-chat", async (request, context, response, token) => {
        const userQuery = request.prompt;
        const chatModels = await vscode.lm.selectChatModels({ family: 'gpt-4' });
        const messages = await fetchPrompt(userQuery);
        const chatRequest = await chatModels[0].sendRequest(messages, {}, token);
        for await (const fragment of chatRequest.text) {
            response.markdown(fragment);
        }
    });

    // Register the runTests command
    const runTests = vscode.commands.registerCommand('unitpylot.vscode-run-tests.runTests', async () => {
        try {
            const { passed, failed } = await testRunner.getResultsSummary();
            vscode.commands.executeCommand('unitpylot.vscode-run-tests.updateResults', { passed, failed });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });
    context.subscriptions.push(runTests);

    // Register the runAllTests command
    const runAllTests = vscode.commands.registerCommand('unitpylot.vscode-run-tests.runAllTests', async () => {
        try {
            const results = await testRunner.runTests();
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest. Error: ' + error);
        }
    });
    context.subscriptions.push(runAllTests);


    // Register the getCoverage command
    const getCoverage = vscode.commands.registerCommand('unitpylot.vscode-run-tests.getCoverage', async () => {
        try {
            const coverage = await testRunner.getCoverage(true);
            handleFileOpen(vscode.window.activeTextEditor!, testRunner);
            vscode.commands.executeCommand('unitpylot.vscode-run-tests.updateCoverage', { coverage });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run coverage check.');
        }
    });
    context.subscriptions.push(getCoverage);

    // Register the slowestTests command
    const slowestTests = vscode.commands.registerCommand('unitpylot.vscode-slowest-tests.slowestTests', async () => {
        try {
            const slowest = await testRunner.getSlowestTests(Settings.NUMBER_OF_SLOWEST_TESTS);
            vscode.commands.executeCommand('unitpylot.vscode-slowest-tests.updateSlowestTests', { slowest });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run pytest.');
        }
    });
    context.subscriptions.push(slowestTests);


    // Register the annotate command
    const annotateCommand = vscode.commands.registerTextEditorCommand(
        'unitpylot.code-tutor.annotate',
        handleAnnotateCommand
    );
    context.subscriptions.push(annotateCommand);

    // Register the fix failing tests command
    const fixFailingTestsCommand = vscode.commands.registerTextEditorCommand(
        'unitpylot.fix-failing-tests.fixFailingTests',
        async (editor, edit, ...args) => handleFixFailingTestsCommand(editor, await testRunner.getAllFailingTests(true))

    );
    context.subscriptions.push(fixFailingTestsCommand);

    // Register the show pass/fail graph command
    let passFailPanel: vscode.WebviewPanel | undefined;
    const showGraphCommand = vscode.commands.registerCommand('unitpylot.test-history.showPassFailGraph', async () => {
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

    // Register the show coverage graph command
    let coveragePanel: vscode.WebviewPanel | undefined;
    const showCoverageGraphCommand = vscode.commands.registerCommand(
        'unitpylot.test-history.showCoverageGraph', async () => {
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
        'unitpylot.fix-coverage.fixCoverage',
        handleFixCoverageCommand
    );
    context.subscriptions.push(fixCoverageCommand);

    // Register the export snapshot report command (markdown file)
    let exportSnapshotReport = vscode.commands.registerCommand('unitpylot.exportSnapshotReport', () => {
        ReportGenerator.generateSnapshotReport();
    });
    context.subscriptions.push(exportSnapshotReport);

    // Register the optimise slowest tests command
    const optimiseSlowestTestsCommand = vscode.commands.registerTextEditorCommand(
        'unitpylot.optimise-slowest.optimiseSlowest',
        async (editor, edit, ...args) => handleOptimiseSlowestTestsCommand(editor, await testRunner.getSlowestTests(Settings.NUMBER_OF_SLOWEST_TESTS, true))
    );
    context.subscriptions.push(optimiseSlowestTestsCommand);

    // Register the optimise memory usage of tests command
    const optimiseMemoryCommand = vscode.commands.registerTextEditorCommand(
        'unitpylot.optimise-memory.optimiseMemory',
        async (editor, edit, ...args) => handleOptimiseMemoryCommand(editor, await testRunner.getHighestMemoryTests(Settings.NUMBER_OF_MEMORY_INTENSIVE_TESTS, true))
    );
    context.subscriptions.push(optimiseMemoryCommand);

    // Register the generate Pydoc command
    const generatePydocCommand = vscode.commands.registerTextEditorCommand(
        'unitpylot.generate-pydoc.generatePydoc',
        handleGeneratePydocCommand
    );
    context.subscriptions.push(generatePydocCommand);

    // Register the in-line accept and reject commands
    context.subscriptions.push(
        vscode.commands.registerCommand('unitpylot.acceptSuggestion', (args) => {
            const { line, code_snippet, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                addToTestFile(editor, code_snippet);
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );

    // Register the in-line accept and reject commands
    context.subscriptions.push(
        vscode.commands.registerCommand('unitpylot.rejectSuggestion', (args) => {
            const { line, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );

    // Register the in-line suggestions commands
    context.subscriptions.push(
        vscode.commands.registerCommand('unitpylot.addSuggestiontoSameFile', (args) => {
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
        vscode.commands.registerCommand('unitpylot.addSuggestiontoMainFile', (args) => {
            const { line, code_snippet, decorationType } = args;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                addToMainFile(editor, code_snippet);
                editor.setDecorations(decorationType, []);
                decorationType.dispose(); // Remove the annotation
            }
        })
    );

    // Update dashboard on save
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!Settings.RUN_TESTS_ON_SAVE || document.fileName.endsWith('settings.json')) {
            return;
        }

        // Call functions to update dashboard
        vscode.commands.executeCommand('unitpylot.updateSidebar');
    });

    // Register the webview view provider (pass/fail results + coverage)
    const webviewProvider = new SidebarViewProvider(context.extensionUri, context.workspaceState);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, webviewProvider)
    );

    // Register the settings page command
    context.subscriptions.push(
        vscode.commands.registerCommand('unitpylot.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'unit-pylot');
        })
    );

    // Register the failing test tree view
    const failingTestsProvider = new FailingTestsProvider(context.extensionUri.fsPath, context.workspaceState);
    const failingTreeView = vscode.window.createTreeView('unitpylot.failingtreeview', {
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
    vscode.commands.registerCommand('unitpylot.failingTestsProvider.showInfo', () => {
        vscode.window.showInformationMessage('This tree view displays failing tests, slow tests, and memory-intensive tests. Red Cross icon: Indicates a failing test. Stopwatch icon: Indicates a slow test. RAM icon: Indicates a memory-intensive test. Green Tick icon: Indicates a passing test file.');
    });

    // Register the refresh command
    vscode.commands.registerCommand('unitpylot.failingtests.refreshView', () => failingTestsProvider.refresh());

    // Register the open test file command
    vscode.commands.registerCommand('failingTestsProvider.openTestFile', (file: string, lineNumber: number) => {
        console.log(`Opening file: ${file} at line: ${lineNumber}`);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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

    // Register the tree view for accessible commands
    const graphDocTreeViewProvider = new GraphDocTreeViewProvider();
    vscode.window.registerTreeDataProvider('unitpylot.graphdoctreeview', graphDocTreeViewProvider);

    vscode.commands.registerCommand('unitpylot.graphsDocsProvider.showInfo', () => {
        vscode.window.showInformationMessage('This tree view displays buttons to view graphs and documentation related to the tests.');
    });

    // Register the run tests in file command
    vscode.commands.registerCommand('unitpylot.runTestsInFile', (file: vscode.Uri) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder found.");
            return;
        }

        const relativePath = path.relative(workspaceFolder, file.fsPath);

        // Check file is a test file
        const fileName = path.basename(relativePath);
        if (!fileName.match(/(test_.*\.py$)|(.*_test.py$)/)) {
            vscode.window.showErrorMessage("Not a test file.");
            return;
        }

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
        vscode.commands.registerCommand('unitpylot.runSpecificTest', (testName: string, file: vscode.Uri) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceFolder) {
                vscode.window.showErrorMessage("No workspace folder found.");
                return;
            }

            const relativePath = path.relative(workspaceFolder, file.fsPath);
            vscode.window.showInformationMessage(`Running: ${testName}`);
            // Only the filePath and testName are required by TestRunner
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

    // Register the update sidebar command
    context.subscriptions.push(
        vscode.commands.registerCommand('unitpylot.updateSidebar', () => {
            // Update the web view
            webviewProvider.update();
            // Update the tree view
            failingTestsProvider.refresh();
        })
    );

    // Add functions to run periodically
    startIntervalTask(context);

}

function startIntervalTask(context: vscode.ExtensionContext) {
    const SNAPSHOT_INTERVAL = Settings.SNAPSHOT_INTERVAL * 60 * 1000; // minutes to milliseconds
    const TEST_INTERVAL = Settings.RUN_TESTS_INTERVAL * 60 * 1000;

    function saveSnapshot() {
        if (Settings.SAVE_SNAPSHOT_PERIODICALLY) {
            console.log('Saving snapshot...');
            HistoryManager.saveSnapshot();  // No tests are run here
        }
    }

    function runTests() {
        if (Settings.RUN_TESTS_IN_BACKGROUND) {
            console.log('Running background tests...');
            TestRunner.getInstance(context.workspaceState).getAllResults(); // Invokes the test runner to run tests
        }
    }

    // Run immediately and schedule repeats
    saveSnapshot();
    const snapshotInterval = setInterval(saveSnapshot, SNAPSHOT_INTERVAL);
    const testInterval = setInterval(runTests, TEST_INTERVAL);

    // Stop the intervals when the extension is deactivated
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(snapshotInterval)));
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(testInterval)));
}

// Handles file open event
export async function handleFileOpen(editor: vscode.TextEditor, testRunner: TestRunner) {
    const fileName = editor.document.fileName;
    if (Settings.CODE_COVERAGE_HIGHLIGHTING && fileName.endsWith('.py')) {
        highlightCodeCoverage(fileName, await testRunner.getCoverage(true));
    }
}

// Deactivation Method for the Extension
export function deactivate() { }
