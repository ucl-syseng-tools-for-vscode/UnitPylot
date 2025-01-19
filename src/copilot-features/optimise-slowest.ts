import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { runSlowestTests } from '../dashboard-metrics/slowest';

const ANNOTATION_PROMPT = `
You are a test optimization assistant. Your task is to analyze the performance of a given test suite and suggest ways to optimize the slowest tests.

Analyze Slow Tests:
For the provided test suite:

1. Review the slowest tests based on the execution time. The following are the slowest tests in the suite:
   - test_fizzbuzz_output: 0.02s
   - test_error_shown_for_negative: 0.00s

2. Identify potential bottlenecks and inefficient patterns within those tests (e.g., unnecessary setup, redundant operations, or overly complex assertions).

Response Format:
- The response must be in the format of a **JSON object**, starting with '{'.
- Do no include any markdown syntax 
- Include a **test_name** field to specify the name of the slowest test.
- Provide a **suggestion** field with a detailed recommendation on how to optimize the test.
- If applicable, include a **code_snippet** field with an optimized version of the test code.

Guidelines:
- Clarity: Be clear and concise in explaining why a test is slow and how to fix it.
- Detail: Ensure the suggested optimizations are actionable and directly address the issue, focusing on improving performance.
- Performance: Consider both the speed of execution and maintainability of the optimized test.

`;

// Chat Functionality for Annotation
export async function handleOptimiseSlowestTestsCommand(textEditor: vscode.TextEditor) {
    try {
        const codeWithLineNumbers = await getSlowestTests(textEditor);
        console.log("CODE2", codeWithLineNumbers); 
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers), false);
    } catch (error) {
        console.error("Error in handleOptimiseSlowestTestsCommand:", error);
    }
}

async function getSlowestTests(textEditor: vscode.TextEditor) {
    try {
        const slowestTimes = await runSlowestTests();  
        return slowestTimes;
    } catch (error) {
        console.error("Error in finding slowest tests:", error);
        throw error;  
    }
}

