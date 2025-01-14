// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { runPytest, runCoverageCheck } from './pytest';
import { SidebarViewProvider } from './SidebarViewProvider';
import { highlightCodeCoverage } from './EditorHighlighter';

const jsonStore: Map<string, any> = new Map();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

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
			const { passed, failed } = await runPytest();
			vscode.commands.executeCommand('vscode-run-tests.updateResults', { passed, failed });
		} catch (error) {
			vscode.window.showErrorMessage('Failed to run pytest.');
		}
	});

	context.subscriptions.push(runTests);

	const provider = new SidebarViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SidebarViewProvider.viewType,
			provider
		)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("dashboard.menu.view", () => {
			const message = " Exit button of extension was clicked !";
			vscode.window.showInformationMessage(message);
		})
	);

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
			const { coverage } = await runCoverageCheck();
			jsonStore.set('coverage', coverage);
			handleFileOpen(vscode.window.activeTextEditor!);
			// Show coverage in the sidebar
			vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });
		} catch (error) {
			vscode.window.showErrorMessage('Failed to run coverage check.');
		}
	});

	context.subscriptions.push(getCoverage);
}

export function handleFileOpen(editor: vscode.TextEditor) {
	const fileName = editor.document.fileName;
	if (fileName.endsWith('.py')) {
		highlightCodeCoverage(fileName, jsonStore.get('coverage') || '{}');
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }
