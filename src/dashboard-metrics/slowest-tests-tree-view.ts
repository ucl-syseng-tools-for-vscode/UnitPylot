import * as vscode from 'vscode';
import { runSlowestTests } from '../dashboard-metrics/slowest';

export class SlowestTestsProvider implements vscode.TreeDataProvider<SlowestTest> {
    private _onDidChangeTreeData: vscode.EventEmitter<SlowestTest | undefined | void> = new vscode.EventEmitter<SlowestTest | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SlowestTest | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SlowestTest): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SlowestTest): Thenable<SlowestTest[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No slowest tests in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            return Promise.resolve([]);
        } else {
            return this.getRootFiles();
        }
    }

    private async getRootFiles(): Promise<SlowestTest[]> {
        const slowestTests = await runSlowestTests();
        const slowestTestsOutput: SlowestTest[] = [];

        slowestTests.forEach(test => {
            const [testName, duration] = test.split(' - ');
            const filePath = testName.split('::')[0]; // Extract the file path
            slowestTestsOutput.push(
                new SlowestTest(
                    test,
                    filePath,
                    'test function',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'extension.openTestFile',
                        title: 'Open Test File',
                        arguments: [filePath]
                    }
                )
            );
        });

        return slowestTestsOutput;
    }
}

export class SlowestTest extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public file: string,
        private type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.type}`;
        this.description = this.type;
    }
}