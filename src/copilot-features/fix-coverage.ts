import * as vscode from 'vscode';
import { getPythonPath } from '../dashboard-metrics/pytest';
import { exec } from 'child_process';
import * as fs from 'fs';


const ANNOTATION_PROMPT = `
You are a Python debugger specializing in refactoring test cases based on coverage data provided. 

Instructions:
1. If the percentage covered for the file is 100, respond: "The coverage of the code is 100%."
2. If less than 100, refactor the test to cover the missing lines.
`;

// Chat Functionality for Annotation
export async function handleFixCoverageCommand(textEditor: vscode.TextEditor) {
    const codeWithLineNumbers = parseCoverage();
    console.log("This is the data", codeWithLineNumbers);

    let [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
    });

    const messages = [
        vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
        vscode.LanguageModelChatMessage.User(JSON.stringify(codeWithLineNumbers)),
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

// Applies decoration to the editor
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

// Parses chat response and applies decoration
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

type FileCoverage = {
    filename: string;
    lines: {
        covered: [number];
        skipped: [number];
        missed: [number];
    };
    summary: {
        covered: number;
        skipped: number;
        missed: number;
        percentCovered: number;
        total: number;
    };
};

export type Coverage = {
    files: FileCoverage[];
    totals: {
        covered: number;
        skipped: number;
        missed: number;
        total: number;
        percentCovered: number;
    };
};

type FileCoverageRaw = {
    excluded_lines: [number];
    executed_lines: [number];
    missing_lines: [number];
    summary: {
        covered_lines: number;
        excluded_lines: number;
        missing_lines: number;
        percent_covered: number;
        num_statements: number;
    };
}

export function runCoverageCheck(): Promise<{ coverage: Coverage }> {
    return new Promise(async (resolve, reject) => {
        console.log('Running Coverage Check...');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const pythonPath = await getPythonPath();

            const command = `bash -c "cd ${workspacePath} && ${pythonPath} -m pytest --cov --cov-report=json || true"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Coverage Error: ${stderr}`);
                    return reject(error);
                }

                const coverage = parseCoverage();
                console.log(coverage);
                vscode.window.showInformationMessage(`Coverage Results: ${coverage.files.length} files`);
                resolve({ coverage });
            });
        } else {
            vscode.window.showErrorMessage('No workspace folder found');
            reject(new Error('No workspace folder found'));
        }
    });
}

function readJsonFile(filePath: string): any {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
}

function mapFileCoverage(fileCoverage: [FileCoverageRaw], workspacePath: string): FileCoverage[] {
    let files: FileCoverage[] = [];
    let n = 0;
    for (let [key, file] of Object.entries(fileCoverage)) {
        files.push({
            filename: workspacePath + '/' + key,
            lines: {
                covered: file.executed_lines,
                skipped: file.excluded_lines,
                missed: file.missing_lines,
            },
            summary: {
                covered: file.summary.covered_lines,
                skipped: file.summary.excluded_lines,
                missed: file.summary.missing_lines,
                percentCovered: file.summary.percent_covered,
                total: file.summary.num_statements,
            },
        })
        n++;
    }
    return files;
}

export function parseCoverage(): Coverage {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const coveragePath = `${workspacePath}/coverage.json`;
    const coverageData = readJsonFile(coveragePath);
    const coverage: Coverage = {
        files: mapFileCoverage(coverageData.files, workspacePath),
        totals: {
            covered: coverageData.totals.covered_lines,
            skipped: coverageData.totals.excluded_lines,
            missed: coverageData.totals.missing_lines,
            total: coverageData.totals.num_statements,
            percentCovered: coverageData.totals.percent_covered,
        },
    };
    console.log(coverageData);

    return coverageData;
}
