import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { TestFunctionResult } from '../test-runner/results';


// Annotation Prompt for Optimising the tests that use the most memory in the test suite
const ANNOTATION_PROMPT = `
You are a test optimization assistant. Your task is to analyze the performance of a given list of tests cases with their total memory allocation, and suggest ways to optimize the tests.

It is important you do this for every test case provided. Recommend optimizations that reduce memory usage while maintaining correctness. Suggest removing or reducing the size of unecessary data structures. 

## Response Format:
- The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).
- Do no include any markdown syntax. 
- Must include a **test_name** field of the name of the most memory-intensive test.
- Include a **suggestion** field with clear and concise recommendations for optimization.
- Must include a **code_snippet** field for the optimized version of the test code that must be changed.
- Include a **bottleneck** field with an explanation of what is causing high memory usage.

## Guidelines:
- Ensure optimizations are actionable and focused on reducing memory usage.
- Keep suggestions clear and directly applicable.
- Maintain readability and maintainability in the optimized test case.

Here is an example of the expected response format:

{
  "test_name": test name,
  "suggestion": issue,
  "code_snippet": <corrected_code>,
  "bottleneck": issue
}, 
{
  "test_name": test name,
  "suggestion": issue,
  "code_snippet": <corrected_code>,
  "bottleneck": issue
}
`;


// Command for sending the memory data and prompt
export async function handleOptimiseMemoryCommand(textEditor: vscode.TextEditor, mostMemoryTests: TestFunctionResult[]) {
    const fileContent = textEditor.document.getText();
    var memoryTestsData = checkIfTestIsPresent(textEditor, mostMemoryTests);

    console.log("Memory Tests Data:", memoryTestsData);
    
    if (memoryTestsData.length > 0) {
        vscode.window.showInformationMessage("There are memory-intensive tests are present in the current file, running command...");
        try {
            const payload = {
                fileContent,  
                memoryTests: memoryTestsData
            };

            hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(payload), 1);
        } catch (error) {
            console.error("Error in handleOptimiseMemoryCommand:", error);
        }
    }
    else {
        vscode.window.showInformationMessage("None of the most memory-intensive tests are present in the current file.");
    }
}


// Checks if there is a memory intensive test present in the current file
function checkIfTestIsPresent(editor: vscode.TextEditor, tests: TestFunctionResult[]) {
    const documentText = editor.document.getText();
    var memoryData: string[] = [];

    for (const test of tests) {
        let testName = test.testName;

        if (testName) {
            testName = testName.replace(/\[.*\]$/, "");
            const funcMatch = testName.match(/([^:]+)$/);
            const functionName = funcMatch ? funcMatch[1] : null;

            if (functionName) {
                const safeFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const functionRegex = new RegExp(`def\\s+${safeFunctionName}\\s*\\(`); 

                const match = documentText.match(functionRegex);
                if (match) { // Test case is present in this file 
                    if (test.testName) {
                        memoryData.push(test.testName);
                    }
                }
            }
        }
    }
    return memoryData;
}