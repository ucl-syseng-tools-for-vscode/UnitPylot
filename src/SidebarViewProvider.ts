import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Coverage } from "./test-runner/coverage";
import { TestRunner } from "./test-runner/test-runner";

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "dashboard.openview";

  private _view?: vscode.WebviewView;
  private testRunner: TestRunner;

  constructor(private readonly _extensionUri: vscode.Uri, workspace: vscode.Memento) {
    this.testRunner = TestRunner.getInstance(workspace);
  }

  public async update(): Promise<void> {
    if (this._view) {
      const { passed, failed } = await this.testRunner.getResultsSummary(true) || { passed: 0, failed: 0 };
      this.updateResults({ passed, failed });

      const defaultCoverage: Coverage = {
        files: [],
        totals: {
          covered: 0,
          skipped: 0,
          missed: 0,
          total: 0,
          percentCovered: 0,
          branches_covered: 0,
          branches_missed: 0,
          branches_total: 0
        }
      };

      const coverage = await this.testRunner.getCoverage(true) || defaultCoverage;
      vscode.commands.executeCommand('vscode-run-tests.updateCoverage', { coverage });  // For compatibility
    }
  }

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
      if (msg.command === 'vscode-run-tests.runTests') {
        vscode.commands.executeCommand('vscode-run-tests.runTests');
      }
      if (msg.command === 'vscode-run-tests.runAllTests') {
        vscode.commands.executeCommand('vscode-run-tests.runAllTests');
      }
      if (msg.command === 'getCoverage') {
        vscode.commands.executeCommand('vscode-run-tests.getCoverage');
      }
      if (msg.command === 'slowestTests') {
        vscode.commands.executeCommand('vscode-slowest-tests.slowestTests');
      }
      if (msg.command === 'getMemory') {
        vscode.commands.executeCommand('vscode-run-tests.getMemory');
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
}
