import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Coverage } from "./test-runner/coverage";

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "dashboard.openview";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
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
      if (msg.command === 'getCoverage') {
        vscode.commands.executeCommand('vscode-run-tests.getCoverage');
      }
      if (msg.command === 'slowestTests') {
        vscode.commands.executeCommand('vscode-slowest-tests.slowestTests');
      }
    });

    vscode.commands.registerCommand('vscode-run-tests.updateResults', (results: { passed: number; failed: number }) => {
      console.log('Updating results:', results);
      this.updateResults(results);
    });

    vscode.commands.registerCommand('vscode-run-tests.updateCoverage', (coverage: Coverage) => {
      console.log('Updating coverage:', coverage);
      this.updateCoverage(coverage);
    });

    vscode.commands.registerCommand('vscode-slowest-tests.updateSlowestTests', (slowest) => {
      console.log('Updating slowest tests:', slowest);
      this.updateSlowestTests(slowest);
    });
  }

  private updateResults(results: { passed: number; failed: number }): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'updateResults', results });
    }
  }

  private updateCoverage(coverage: Coverage): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'updateCoverage', coverage });
    }
  }

  private updateSlowestTests(slowest: any): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'updateSlowestTests', slowest });
    }
  }
}
