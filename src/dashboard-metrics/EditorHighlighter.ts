import * as vscode from 'vscode';
import { Coverage } from '../test-runner/coverage';

// Define the decoration type (background color for this example)
const decorationTypeMissed = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 200, 0, 0.3)',  // Yellow highlight
});

/**
 * Highlight the code coverage for the given file.
 * 
 * @param fileName The name of the file to highlight
 * @param coverage The coverage data to use for highlighting
 * @returns None
 */
export function highlightCodeCoverage(fileName: string, coverage: Coverage | undefined): void {
    if (!coverage || !coverage.files) {
        return;
    }
    if (!coverage.files) {
        return;
    }
    console.log(`Highlighting code coverage for ${fileName} using ${coverage.files.length} files`);

    // Get current file's coverage
    const fileCoverage = coverage.files.find((file) => file.filename.endsWith(fileName));

    // Highlight the code coverage
    const editor = vscode.window.activeTextEditor;

    if (!fileCoverage || !editor) {
        return;
    }

    const missedLines: vscode.Range[] = fileCoverage.lines.missed.map((line) => editor.document.lineAt(line - 1).range);

    // Apply decorations
    editor?.setDecorations(decorationTypeMissed, missedLines);
}