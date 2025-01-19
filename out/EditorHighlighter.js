"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.highlightCodeCoverage = void 0;
const vscode = require("vscode");
function highlightCodeCoverage(fileName, coverage) {
    if (!coverage.files) {
        return;
    }
    console.log(`Highlighting code coverage for ${fileName} using ${coverage.files.length} files`);
    // Get current file's coverage
    const fileCoverage = coverage.files.find((file) => file.filename.endsWith(fileName));
    // Highlight the code coverage
    const editor = vscode.window.activeTextEditor;
    // Define the decoration type (background color for this example)
    const decorationTypeMissed = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 200, 0, 0.3)', // Yellow highlight
        // borderRadius: '4px',
        // border: '1px solid rgba(255, 200, 0, 0.6)'
    });
    const decorationTypeCovered = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.3)', // Green highlight
        // borderRadius: '4px',
        // border: '1px solid rgba(0, 255, 0, 0.6)'
    });
    if (!fileCoverage || !editor) {
        return;
    }
    const missedLines = fileCoverage.lines.missed.map((line) => editor.document.lineAt(line - 1).range);
    const coveredLines = fileCoverage.lines.covered.map((line) => editor.document.lineAt(line - 1).range);
    // Apply decoration
    editor?.setDecorations(decorationTypeMissed, missedLines);
    // editor?.setDecorations(decorationTypeCovered, coveredLines);
}
exports.highlightCodeCoverage = highlightCodeCoverage;
//# sourceMappingURL=EditorHighlighter.js.map