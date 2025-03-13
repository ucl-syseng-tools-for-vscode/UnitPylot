import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { TestFunctionResult } from '../test-runner/results';


// Annotation Prompt for Optimising the slowest tests in the test suite
const ANNOTATION_PROMPT = `
You are a test optimization assistant. Your task is to analyze the performance of a given test suite and suggest ways to optimize the slowest tests.

Analyse Slow Tests:
For the provided test suite:

1. Review the tests based on their execution time.

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

Here is an example of the expected response format:

{
  "test_name": test name,
  "suggestion": issue,
  "code_snippet": <corrected_code>
}, 
{
  "test_name": test name,
  "suggestion": issue,
  "code_snippet": <corrected_code>
}
`;

// Chat Functionality for Annotation
export async function handleOptimiseSlowestTestsCommand(textEditor: vscode.TextEditor, slowestTests: TestFunctionResult[]) {
    const visibleCodeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
    var slowestTestsData = checkIfTestIsPresent(textEditor, slowestTests);

    if  (slowestTestsData.length > 0) {
        vscode.window.showInformationMessage("Slowest tests are present in the current file.");
        try {
            const combinedContext = {
                visible_code: visibleCodeWithLineNumbers,
                slowest_tests: slowestTestsData
            };

            hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(combinedContext), 1);

        } catch (error) {
            console.error("Error in handleOptimiseSlowestTestsCommand:", error);
        }
    }
    else {
        vscode.window.showInformationMessage("None of the slowest tests are present in the current file.");
    }
}

// Checking if at least one of the tests is present in the current file (return 1 if present, 0 if not present)
function checkIfTestIsPresent(editor: vscode.TextEditor, tests: TestFunctionResult[]) {
    const documentText = editor.document.getText();
    var slowestTestsData: string[] = [];

    for (const test of tests) {
        let testName = test.testName;

        if (testName) {
            // Extracts everything after the last '::'
            testName = testName.replace(/\[.*\]$/, "");
            console.log("UNPARAMETRIZED TEST NAME: ", testName);

            const funcMatch = testName.match(/([^:]+)$/);
            const functionName = funcMatch ? funcMatch[1] : null;

            if (functionName) {
                const safeFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const functionRegex = new RegExp(`def\\s+${safeFunctionName}\\s*\\(`); 

                const match = documentText.match(functionRegex);
                if (match) { // Test case is present in this file 
                    slowestTestsData.push(test.filePath + "::" + test.testName + " " + test.time + "s");
                }
            }
        }
    }
    return slowestTestsData;
}

function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    let currentLine = textEditor.visibleRanges[0].start.line;
    const endLine = textEditor.visibleRanges[0].end.line;

    let code = '';

    while (currentLine <= endLine) {
        code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text}\n`;
        currentLine++;
    }
    return code;
}