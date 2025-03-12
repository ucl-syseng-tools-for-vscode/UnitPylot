import * as vscode from 'vscode';

export class PytestCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const functionRegex = /^(\t| )*def (test_\w+)\(/; // Detects pytest functions
        const classRegex = /^(\t| )*class (Test\w+)\:/; // Detects classes

        const classOrFunctionRegex = new RegExp(`${classRegex.source}|${functionRegex.source}`, 'gm');

        const text = document.getText();
        let match;

        let currentClassName: string | null = null;

        // Match classes and functions
        while ((match = classOrFunctionRegex.exec(text)) !== null) {
            if (match[2]) {  // Class
                currentClassName = match[2]; // Capture the class name

                const line = document.positionAt(match.index).line;
                const range = new vscode.Range(line, 0, line, match[0].length);

                codeLenses.push(new vscode.CodeLens(range, {
                    title: "▶ Run Tests in Class",
                    command: "extension.runSpecificTest",
                    arguments: [currentClassName, document.uri] // Only class name, no function name
                }));
            }
            else if (match[4]) { // Function
                let functionName;
                if (!currentClassName || match[0].startsWith('def')) {
                    functionName = match[4];
                }
                else {
                    functionName = `${currentClassName}::${match[4]}`;
                }

                const line = document.positionAt(match.index).line;
                const range = new vscode.Range(line, 0, line, match[0].length);

                codeLenses.push(new vscode.CodeLens(range, {
                    title: "▶ Run Test",
                    command: "extension.runSpecificTest",
                    arguments: [functionName, document.uri] // Pass both class and function name
                }));
            }
        }

        return codeLenses;
    }
}
