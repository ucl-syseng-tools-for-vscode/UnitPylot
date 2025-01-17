import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { Coverage, readJsonFile } from '../dashboard-metrics/pytest';

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
    hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers));
}


export function parseCoverage(): Coverage {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const coveragePath = `${workspacePath}/coverage.json`;
    const coverageData = readJsonFile(coveragePath);
    console.log(coverageData);

    return coverageData;
}
