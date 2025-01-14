// Import the VS Code API
import * as vscode from 'vscode';
import { runPytest, runCoverageCheck } from './pytest';
import { SidebarViewProvider } from './SidebarViewProvider';
import { highlightCodeCoverage } from './EditorHighlighter';

const jsonStore: Map<string, any> = new Map();

const ANNOTATION_PROMPT = `You are a code tutor who helps students learn how to write better tests for Python code. Your job is to evaluate a block of Python test code that the user gives you and then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion. Only make suggestions if it will significantly improve test efficiency, increase test coverage, or better handle edge cases. Be friendly with your suggestions and remember that these are students who need gentle guidance. Format each suggestion as a single JSON object. Here is an example of what your response should look like:

{ "line": 1, "suggestion": "Consider using pytest.raises to check that exceptions are thrown as expected. It helps ensure that your code handles edge cases properly." }{ "line": 12, "suggestion": "It might be helpful to use parameterized tests to cover multiple input scenarios in a single test function, improving coverage and readability." }
`;

// Chat functionality for annotation
async function handleAnnotateCommand(textEditor: vscode.TextEditor) {
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

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

        await parseChatResponse(chatResponse, textEditor);
    }
}

function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {
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

    const decoration = { range: range, hoverMessage: suggestion };

    vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);
}

async function parseChatResponse(
    chatResponse: vscode.LanguageModelChatResponse,
    textEditor: vscode.TextEditor
) {
    let accumulatedResponse = '';

    for await (const fragment of chatResponse.text) {
        accumulatedResponse += fragment;

        if (fragment.includes('}')) {
            try {
                const annotation = JSON.parse(accumulatedResponse);
                applyDecoration(textEditor, annotation.line, annotation.suggestion);
                accumulatedResponse = '';
            } catch {
                // Ignore parse errors
            }
        }
    }
}

function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    let currentLine = textEditor.visibleRanges[0].start.line;
    const endLine = textEditor.visibleRanges[0].end.line;

    let code = '';

    while (currentLine < endLine) {
        code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text} \n`;
        currentLine++;
    }
    return code;
}

// Activation method for the extension
export function activate(context: vscode.ExtensionContext) {
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


    const getCoverage = vscode.commands.registerCommand('vscode-run-tests.getCoverage', async () => {
        try {
            const { coverage } = await runCoverageCheck();
            jsonStore.set('coverage', coverage);
            handleFileOpen(vscode.window.activeTextEditor!);
            vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run coverage check.');
        }
    });

    context.subscriptions.push(getCoverage);

    // Register the annotate command
    const annotateCommand = vscode.commands.registerTextEditorCommand(
        'code-tutor.annotate',
        handleAnnotateCommand
    );
    context.subscriptions.push(annotateCommand);
}

export function handleFileOpen(editor: vscode.TextEditor) {
    const fileName = editor.document.fileName;
    if (fileName.endsWith('.py')) {
        highlightCodeCoverage(fileName, jsonStore.get('coverage') || '{}');
    }
}

export function deactivate() {}
