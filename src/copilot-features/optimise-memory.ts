import * as vscode from 'vscode';
import * as hf from '../copilot-features/helper-func';
import { TestFunctionResult } from '../test-runner/results';


// Annotation Prompt for Optimising the tests that use the most memory in the test suite
const ANNOTATION_PROMPT: string = `
You are a test optimization assistant. Your task is to analyze the performance of a given test suite and suggest ways to optimize the tests that use the most memory.

## Analysis Scope:
For the provided test suite, which includes test code, and the total memory allocations and size from a memray report:

1. Identify the most memory-intensive test cases based on total memory allocated.
2. Detect potential inefficiencies such as:
   - Unnecessary data structures or excessive object creation.
   - Inefficient loops or redundant computations.
   - Large fixtures or setups that can be minimized.
   - Repeated expensive operations that could be optimized.
3. Recommend optimizations that reduce memory usage while maintaining correctness.

## Response Format:
The response must be in the format of a single **JSON object**, starting directly with '{' and must not include any code fences (e.g., \\\`\\\`\\\`json or \\\`\\\`\\\`).


### Required Fields:
- **"test_name"**: Name of the most memory-intensive test.
- **"suggestion"**: Clear and concise recommendations for optimization.
- **"code_snippet"**: Optimized version of the test code
- **"bottleneck"**: Explanation of what is causing high memory usage.

## Guidelines:
- Ensure optimizations are actionable and focused on reducing memory usage.
- Keep suggestions clear and directly applicable.
- Maintain readability and maintainability in the optimized test case.


Here is an example of the expected response format:

{
  "test_name": 1,
  "suggestion": issue,
  "code_snippet": <corrected_code>
  "bottleneck": issue
}
`;


// Chat Functionality for Annotation
export async function handleOptimiseMemoryCommand(textEditor: vscode.TextEditor, mostMemoryTests: TestFunctionResult[]) {

    try {
        var codeWithLineNumbers: string[] = [];
        for (const test of mostMemoryTests) {
            codeWithLineNumbers.push(test.filePath + "::" + test.testName + " " + test.time + "s");
        }
        console.log("mostMemoryTests:", mostMemoryTests);
        hf.chatFunctionality(textEditor, ANNOTATION_PROMPT, JSON.stringify(codeWithLineNumbers), 1);
    } catch (error) {
        console.error("Error in handleOptimiseMemoryCommand:", error);
    }
}

