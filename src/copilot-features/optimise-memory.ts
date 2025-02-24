import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { TestFunctionResult } from '../test-runner/results';


// Annotation Prompt for Optimising the tests that use the most memory in the test suite
const ANNOTATION_PROMPT = `
You are a test optimization assistant. Your task is to analyze the performance of a given test suite and suggest ways to optimize the tests that use the most memory.

Analyse the most memory intensive Tests:
For the provided test suite:

1. Review the most memory intensive tests based on the amount of memory allocated.

2. Identify potential bottlenecks and inefficient patterns within those tests (e.g., unnecessary setup, redundant operations, or overly complex assertions).

Response Format:
- The response must be in the format of a **JSON object**, starting with '{'.
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
export async function handleOptimiseMemoryCommand(textEditor: vscode.TextEditor, mostMemoryTests: TestFunctionResult[]) {

    try {
        console.log("mostMemoryTests:", mostMemoryTests);
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(mostMemoryTests), 1);
    } catch (error) {
        console.error("Error in handleOptimiseMemoryCommand:", error);
    }
}

