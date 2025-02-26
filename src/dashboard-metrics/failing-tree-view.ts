import * as vscode from 'vscode';
import * as path from 'path';
import { jsonStore, testRunner } from '../extension';
import { TestResult } from '../test-runner/results';

// make a combined tree view with memory and duration

export class FailingTestsProvider implements vscode.TreeDataProvider<FailingTest> {
    private _onDidChangeTreeData: vscode.EventEmitter<FailingTest | undefined | void> = new vscode.EventEmitter<FailingTest | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FailingTest | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FailingTest): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FailingTest): Thenable<FailingTest[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No failing tests in empty workspace');
            return Promise.resolve([]);
        }
    
        if (element) {
            if (element.isFunction) {
                vscode.commands.executeCommand('failingTestsProvider.openTestFile', element.file, element.failureLocation);
                return Promise.resolve([]);
            } else {
                return Promise.resolve(
                    this.getFunctionsInFile(
                        element.file
                    )
                );
            }
        } else {
            return Promise.resolve(this.getRootFiles());
        }
    }

    private getCollapsibleState(file: string, testResults: TestResult): vscode.TreeItemCollapsibleState {
        for (const test in testResults[file]) {
            const testResult = testResults[file][test];
            if (!testResult.passed) {
                return vscode.TreeItemCollapsibleState.Collapsed;
            }
        }
        return vscode.TreeItemCollapsibleState.None;
    }

    private async getRootFiles(): Promise<FailingTest[]> {
        const testResults = await testRunner.getAllResults();
        const failingTestsOutput: FailingTest[] = [];

        for (const file in testResults) {
            failingTestsOutput.push(
                new FailingTest(
                    file,
                    file,
                    'file',
                    this.getCollapsibleState(file, testResults),
                )
            )
        }

        return failingTestsOutput;
    }

    private async getFunctionsInFile(file: string): Promise<FailingTest[]> {
        const failingTests = await testRunner.getResultsForFile(file);
        const failingTestsOutput: FailingTest[] = [];

        for (const [test, result] of Object.entries(failingTests)) {
            if (!result.passed) {
                failingTestsOutput.push(
                    new FailingTest(
                        result.testName || 'Unknown Test',
                        file,
                        'test function',
                        vscode.TreeItemCollapsibleState.None,
                        result.failureLocation ? parseInt(result.failureLocation) : undefined,
                        result.time,
                        true
                    )
                );
            }
        }

        return failingTestsOutput;
    }
}

export class FailingTest extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public file: string,
        private type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public failureLocation?: number,
        public duration?: number,
        public isFunction?: boolean,
        public passes?: boolean
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.type}`;
        this.description = this.type;
        if (this.isFunction) {
            if (this.duration !== undefined) {
                this.description += ` (Duration: ${this.duration}s)`;
            }
        } 

        this.command = {
            command: 'failingTestsProvider.openTestFile',
            title: 'Open Test File',
            arguments: [this.file, this.failureLocation]
        };
        console.log(`FailingTest created: ${label}, file: ${file}, line: ${this.failureLocation}, duration: ${this.duration}`);

        if (!this.isFunction) {
            const iconFileName = this.collapsibleState === vscode.TreeItemCollapsibleState.None ? 'pass.svg' : 'fail.svg';
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', iconFileName)),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', iconFileName))
            };
        }
    }
}