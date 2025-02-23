import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { jsonStore, testRunner } from '../extension';
import { Coverage } from '../test-runner/coverage';

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

    private async getRootFiles(): Promise<FailingTest[]> {
        const failingTests = await testRunner.getAllFailingTests();
        const coverage = await testRunner.getCoverage();
        const uniqueFiles = new Set<string>();
        const failingTestsOutput: FailingTest[] = [];

        const coverageData: { [filePath: string]: { coverage: number } } = {};
        if (coverage) {
            for (const file of coverage.files) {
                coverageData[file.filename] = { coverage: file.summary.percentCovered };
            }
        }

        for (const test of failingTests) {
            if (test.filePath && !uniqueFiles.has(test.filePath)) {
                uniqueFiles.add(test.filePath);
                const fileCoverage = coverageData[test.filePath]?.coverage ?? NaN;
                failingTestsOutput.push(
                    new FailingTest(this.snipPath(test.filePath), test.filePath, 'file', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, false, undefined, fileCoverage)
                );
            }
        }
        return failingTestsOutput;
    }

    private async getFunctionsInFile(file: string): Promise<FailingTest[]> {
        const failingTests = await testRunner.getAllFailingTests();
        const failingTestsOutput: FailingTest[] = [];

        for (const test of failingTests) {
            if (test.filePath === file) {
                failingTestsOutput.push(
                    new FailingTest(
                        test.testName || 'Unknown Test',
                        file,
                        'test function',
                        vscode.TreeItemCollapsibleState.None,
                        test.failureLocation ? parseInt(test.failureLocation) : undefined,
                        test.time,
                        true
                    )
                );
            }
        }

        return failingTestsOutput;
    }

    private snipPath(p: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return p;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        return path.relative(workspacePath, p);
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
        public passes?: boolean,
        public coverage?: number
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.type}`;
        this.description = this.type;
        if (this.isFunction) {
            if (this.duration !== undefined) {
                this.description += ` (Duration: ${this.duration}s)`;
            }
        } else {
            if (this.coverage !== undefined) {
                this.description += ` (Coverage: ${this.coverage}%)`;
            } else {
                this.description += ` (Coverage: NaN%)`;
            }
        }
        this.command = {
            command: 'failingTestsProvider.openTestFile',
            title: 'Open Test File',
            arguments: [this.file, this.failureLocation]
        };
        console.log(`FailingTest created: ${label}, file: ${file}, line: ${this.failureLocation}, duration: ${this.duration}, coverage: ${this.coverage}`);
    }

    iconPath = {
        light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'fail.svg')),
        dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'fail.svg'))
    };
}