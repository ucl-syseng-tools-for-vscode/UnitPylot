import * as vscode from 'vscode';
import * as path from 'path';
import { jsonStore, testRunner } from '../extension';
import { TestResult, TestFunctionResult } from '../test-runner/results';

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
        const slowestTests = await testRunner.getSlowestTests();
        const highestMemoryTests = await testRunner.getHighestMemoryTests();
        const failingTestsOutput: FailingTest[] = [];
        const fileMap: { [key: string]: FailingTest[] } = {};
        const fileIcons: { [key: string]: Set<string> } = {};

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
            fileIcons[file] = new Set();
        }

        for (const slowTest of slowestTests) {
            const testName = slowTest.testName;
            const filePath = slowTest.filePath;
            const duration = slowTest.time;
            const slowTestNode = new FailingTest(
                testName?.split('::').pop() || testName || 'Unknown Test',
                filePath || "Unknown File",
                'slow test',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                duration,
                true
            );
            if (filePath && fileMap[filePath]) {
                fileMap[filePath].push(slowTestNode);
                fileIcons[filePath].add('slowtest.svg');
            } else {
                failingTestsOutput.push(slowTestNode);
            }
        }

        for (const memoryTest of highestMemoryTests) {
            const testName = memoryTest.testName;
            const filePath = memoryTest.filePath;
            const memoryUsage = memoryTest.totalMemory;
            const memoryTestNode = new FailingTest(
                (testName?.split('::').pop() || "Unknown Test"),
                filePath || "Unknown File",
                'memory test',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                undefined,
                true,
                memoryUsage ? parseFloat(memoryUsage) : undefined
            );
            if (filePath && fileMap[filePath]) {
                fileMap[filePath].push(memoryTestNode);
                fileIcons[filePath].add('memory.svg');
            } else {
                failingTestsOutput.push(memoryTestNode);
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
                        fileNode.memoryUsage,
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
                    fileIcons[file].add('fail.svg');
                }
            }
        }

        for (const fileNode of failingTestsOutput) {
            const icons = fileIcons[fileNode.file];
            if (icons.size > 1) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'mixedtest.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'mixedtest.svg'))
                };
            } else if (icons.has('fail.svg')) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'fail.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'fail.svg'))
                };
            } else if (icons.has('slowtest.svg')) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'slowtest.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'slowtest.svg'))
                };
            } else if (icons.has('memory.svg')) {
                fileNode.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'memory.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'assets', 'memory.svg'))
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
                        result.testName ? result.testName.split('::').pop()! : 'Unknown Test',
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

        const slowestTests = await testRunner.getSlowestTests();
        for (const slowTest of slowestTests) {
            const testName = slowTest.testName;
            const filePath = slowTest.filePath;
            const duration = slowTest.time;
            if (filePath === file) {
                failingTestsOutput.push(
                    new FailingTest(
                        testName ? testName.split('::').pop() || testName : 'Unknown Test',
                        filePath,
                        'slow test',
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        duration,
                        true
                    )
                );
            }
        }

        const highestMemoryTests = await testRunner.getHighestMemoryTests();
        for (const memoryTest of highestMemoryTests) {
            const testName = memoryTest.testName;
            const filePath = memoryTest.filePath;
            const memoryUsage = memoryTest.totalMemory;
            if (filePath === file) {
                failingTestsOutput.push(
                    new FailingTest(
                        testName ? testName.split('::').pop()! : 'Unknown Test',
                        filePath,
                        'memory test',
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        undefined,
                        true,
                        memoryUsage ? parseFloat(memoryUsage) : undefined
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
        public memoryUsage?: number,
        public passes?: boolean
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.type}`;
        this.description = this.type;
        if (this.isFunction) {
            if (this.duration !== undefined) {
                this.description += ` (Duration: ${this.duration}s)`;
            }
            if (this.memoryUsage !== undefined) {
                this.description += ` (Memory: ${this.memoryUsage}MB)`;
            }
        } 

        this.command = {
            command: 'failingTestsProvider.openTestFile',
            title: 'Open Test File',
            arguments: [this.file, this.failureLocation]
        };
        console.log(`FailingTest created: ${label}, file: ${file}, line: ${this.failureLocation}, duration: ${this.duration}, memory: ${this.memoryUsage}`);

        let iconFileName;
        if (this.type === 'slow test') {
            iconFileName = 'slowtest.svg';
        } else if (this.type === 'memory test') {
            iconFileName = 'memory.svg';
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