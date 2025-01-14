"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarViewProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class SidebarViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'chart.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        webviewView.webview.html = htmlContent;
        webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.command === 'runTests') {
                vscode.commands.executeCommand('vscode-run-tests.runTests');
            }
        });
        vscode.commands.registerCommand('vscode-run-tests.updateResults', (results) => {
            console.log('Updating results:', results);
            this.updateResults(results);
        });
        vscode.commands.registerCommand('vscode-run-tests.updateCoverage', (coverage) => {
            console.log('Updating coverage:', coverage);
            this.updateCoverage(coverage);
        });
    }
    updateResults(results) {
        if (this._view) {
            this._view.webview.postMessage({ command: 'updateResults', results });
        }
    }
    updateCoverage(coverage) {
        if (this._view) {
            this._view.webview.postMessage({ command: 'updateCoverage', coverage });
        }
    }
}
exports.SidebarViewProvider = SidebarViewProvider;
SidebarViewProvider.viewType = "dashboard.openview";
//# sourceMappingURL=SidebarViewProvider.js.map