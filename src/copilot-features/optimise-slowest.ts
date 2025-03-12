import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { TestFunctionResult } from '../test-runner/results';


// Annotation Prompt for Optimising the slowest tests in the test suite
const ANNOTATION_PROMPT = `
You are a test optimization assistant. Your task is to analyze the performance of a given test suite and suggest ways to optimize the slowest tests.

Analyse Slow Tests:
For the provided test suite:

1. Review the slowest tests based on the execution time.

2. Identify potential bottlenecks and inefficient patterns within those tests (e.g., unnecessary setup, redundant operations, or overly complex assertions).

Response Format:
- The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).
- Do no include any markdown syntax 
- Must include a **test_name** field to specify the name of the slowest test.
- Please provide a **suggestion** field with a detailed recommendation on how to optimize the test along with .
- Must include a **code_snippet** field with an optimized version of the test code.

Guidelines:
- Clarity: Be clear and concise in explaining why a test is slow and how to fix it.
- Detail: Ensure the suggested optimizations are actionable and directly address the issue, focusing on improving performance.
- Performance: Consider both the speed of execution and maintainability of the optimized test.

`;

// Chat Functionality for Annotation
export async function handleOptimiseSlowestTestsCommand(textEditor: vscode.TextEditor, slowestTests: TestFunctionResult[]) {
    if (checkIfTestIsPresent(textEditor, slowestTests)==1) {
        vscode.window.showInformationMessage("Slowest test is present in the current file.");
        try {
            var codeWithLineNumbers: string[] = [];
            for (const test of slowestTests) {
                codeWithLineNumbers.push(test.filePath + "::" + test.testName + " " + test.time + "s");
            }

            console.log("CODE2", codeWithLineNumbers);
            hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers), 1);

        } catch (error) {
            console.error("Error in handleOptimiseSlowestTestsCommand:", error);
        }
    }
    else {
        vscode.window.showInformationMessage("Slowest test is not present in the current file.");
    }
}



// Checking if at least one of the slowest tests is present in the current file (return 1 if present, 0 if not present)
function checkIfTestIsPresent(editor: vscode.TextEditor, slowestTests: TestFunctionResult[]) {
    const documentText = editor.document.getText();

    for (const slowestTest of slowestTests) {
        const functionRegex = new RegExp(`def\\s+${slowestTest}\\s*\\(`); 
        const match = documentText.match(functionRegex);
        if (match) { // Test case is present in this File 
            return 1;
        } 
    }
    return 0;
}
