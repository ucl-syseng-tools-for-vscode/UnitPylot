import * as vscode from 'vscode';
import * as path from 'path';
import { jsonStore, testRunner } from '../extension';
import { TestResult } from '../test-runner/results';
import { runSlowestTests } from '../dashboard-metrics/slowest';

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
        const slowestTests = await runSlowestTests();
        const failingTestsOutput: FailingTest[] = [];
        const fileMap: { [key: string]: FailingTest[] } = {};
        const fileIcons: { [key: string]: string[] } = {};

        for (const file in testResults) {
            if (file === ''){
                continue;
            }
            const collapsibleState = this.getCollapsibleState(file, testResults);
            const fileNode = new FailingTest(
                file,
                file,
                'file',
                collapsibleState,
            );
            failingTestsOutput.push(fileNode);
            fileMap[file] = [];
            fileIcons[file] = [];
        }

        for (const slowTest of slowestTests) {
            const [testName, duration] = slowTest.split(' - ');
            const filePath = testName.split('::')[0]; // Extract the file path
            const slowTestNode = new FailingTest(
                testName,
                filePath,
                'slow test',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                parseFloat(duration),
                true
            );
            if (fileMap[filePath]) {
                fileMap[filePath].push(slowTestNode);
                if (!fileIcons[filePath].includes('slowtest.svg')) {
                    fileIcons[filePath].push('slowtest.svg');
                }
            } else {
                failingTestsOutput.push(slowTestNode);
            }
        }

        for (const file in fileMap) {
            if (fileMap[file].length > 0) {
                const fileNode = failingTestsOutput.find(node => node.file === file);
                if (fileNode) {
                    const updatedFileNode = new FailingTest(
                        fileNode.label,
                        fileNode.file,
                        fileNode.type,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        fileNode.failureLocation,
                        fileNode.duration,
                        fileNode.isFunction,
                        fileNode.passes
                    );
                    const index = failingTestsOutput.indexOf(fileNode);
                    if (index !== -1) {
                        failingTestsOutput[index] = updatedFileNode;
                    }
                }
            }
        }

        for (const file in testResults) {
            if (file === '') {
                continue;
            }
            const testResultsForFile = testResults[file];
            for (const test in testResultsForFile) {
                const testResult = testResultsForFile[test];
                if (!testResult.passed) {
                    if (!fileIcons[file].includes('fail.svg')) {
                        fileIcons[file].push('fail.svg');
                    }
                }
            }
        }

        for (const fileNode of failingTestsOutput) {
            if (fileIcons[fileNode.file].includes('fail.svg') && fileIcons[fileNode.file].includes('slowtest.svg')) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'failslowtest.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'failslowtest.svg'))
                };
            } else if (fileIcons[fileNode.file].includes('fail.svg')) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'fail.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'fail.svg'))
                };
            } else if (fileIcons[fileNode.file].includes('slowtest.svg')) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'slowtest.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'slowtest.svg'))
                };
            } else {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'pass.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'pass.svg'))
                };
            }
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

        const slowestTests = await runSlowestTests();
        for (const slowTest of slowestTests) {
            const [testName, duration] = slowTest.split(' - ');
            const filePath = testName.split('::')[0]; // Extract the file path
            if (filePath === file) {
                failingTestsOutput.push(
                    new FailingTest(
                        testName,
                        filePath,
                        'slow test',
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        parseFloat(duration),
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
        public type: string,
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

        let iconFileName;
        if (this.type === 'slow test') {
            iconFileName = 'slowtest.svg';
        } else if (this.type === 'test function' && !this.passes) {
            iconFileName = 'fail.svg';
        } else {
            iconFileName = 'pass.svg';
        }

        this.iconPath = {
            light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', iconFileName)),
            dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', iconFileName))
        };
    }
}