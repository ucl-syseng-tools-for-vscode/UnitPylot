"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeOperationsProvider = void 0;
const vscode = require("vscode");
// Class to provide possible operations for selected code
class CodeOperationsProvider {
    async fetchCodeResponse(selectedCode, operation) {
        try {
            let response;
            if (operation === 0) {
                response = await fetch('http://127.0.0.1:5001/explain_test_case', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: selectedCode }),
                });
            }
            else if (operation === 1) {
                response = await fetch('http://127.0.0.1:5001/fix_test_case', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: selectedCode }),
                });
            }
            if (response) {
                const data = await response.json();
                return data.response || 'No response from the server.';
            }
            else {
                return 'Error: No response received.';
            }
        }
        catch (error) {
            console.error('Error fetching a response:', error);
            return 'Error: Could not fetch response.';
        }
    }
    provideCodeActions(document, range, context, token) {
        // check if user selection is empty
        if (range.isEmpty) {
            return;
        }
        // create a new code action for each operation 	
        const allOperations = [];
        for (const op of CodeOperationsProvider.operations) {
            const myOp = new vscode.CodeAction(op.title, op.kind);
            myOp.command = {
                command: `dashboard.${op.id}`,
                title: op.title,
                arguments: [op.id],
            };
            allOperations.push(myOp);
        }
        return allOperations;
    }
    // Method to handle operation once user selects it
    async handleOperation(operationId) {
        const editor = vscode.window.activeTextEditor;
        if (!editor ||
            editor.selection.isEmpty ||
            !['explain', 'fix'].includes(operationId)) {
            // CHANGE return if no active editor, no active selection, if unsupported actionId passed
            return;
        }
        // Retrieve user's selected text
        const text = editor.document.getText(editor.selection);
        let currRange = editor.selection; // current selection range
        try {
            const fillerText = '\n\nLoading...';
            editor
                .edit((editBuilder) => {
                editBuilder.insert(currRange.end, fillerText);
            })
                .then((success) => {
                if (success) {
                    // Select the filler text to replace it with the actual result
                    editor.selection = new vscode.Selection(editor.selection.end.line, 0, editor.selection.end.line, editor.selection.end.character);
                    currRange = editor.selection;
                }
            });
            let response = '';
            // Prompt LLM 
            switch (operationId) {
                case 'explain':
                    response = await this.fetchCodeResponse(text, 0);
                    break;
                case 'fix':
                    response = await this.fetchCodeResponse(text, 1);
                    break;
            }
            editor
                .edit((editBuilder) => {
                if (response) {
                    // replace the filler text with the actual result
                    // FIX how it displays for really long outputs 
                    editBuilder.replace(new vscode.Range(currRange.start, currRange.end), response.trim());
                }
            })
                .then((success) => {
                if (success) {
                    editor.selection = new vscode.Selection(currRange.start.line, currRange.start.character, currRange.end.line, editor.document.lineAt(currRange.end.line).text.length);
                    return;
                }
            });
        }
        catch (error) {
            console.error(error);
        }
        editor.edit((editBuilder) => {
            editor.selection = new vscode.Selection(currRange.start, currRange.end);
            editBuilder.replace(editor.selection, 'Failed to process this code...');
        });
    }
}
exports.CodeOperationsProvider = CodeOperationsProvider;
CodeOperationsProvider.operations = [
    {
        id: 'explain',
        title: 'Explain the test case',
        kind: vscode.CodeActionKind.QuickFix,
    },
    {
        id: 'fix',
        title: 'Fix the test case',
        kind: vscode.CodeActionKind.RefactorRewrite,
    },
];
//# sourceMappingURL=CodeOperations.js.map