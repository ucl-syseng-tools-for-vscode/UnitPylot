import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { jsonStore } from '../extension';

export class DependenciesProvider implements vscode.TreeDataProvider<Dependency> {
    private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | void> = new vscode.EventEmitter<Dependency | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Dependency): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Dependency): Thenable<Dependency[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            if (element.isFunction) {
                return Promise.resolve(
                    this.getTestDependencies(
                        element.file,
                        element.label
                    )
                );
            } else {
                return Promise.resolve(
                    this.getFunctionsInFile(
                        element.file
                    )
                );
            }
        } else {
            return Promise.resolve(this.getRootFiles(this.workspaceRoot));
        }
    }

    private getRootFiles(file: string): Dependency[] {
        const dependencies = jsonStore.get('dependencies');
        const dependenciesOutput: Dependency[] = [];

        for (const [key, value] of Object.entries(dependencies)) {

            dependenciesOutput.push(
                new Dependency(this.snipPath(key), key, 'file', vscode.TreeItemCollapsibleState.Collapsed)
            );

        }
        return dependenciesOutput;
    }

    private getFunctionsInFile(file: string): Dependency[] {
        const dependencies = jsonStore.get('dependencies');
        const fileDependencies = dependencies[file];
        const dependenciesOutput: Dependency[] = [];

        for (const [key, value] of Object.entries(fileDependencies)) {
            dependenciesOutput.push(
                new Dependency(key, file, 'test function', vscode.TreeItemCollapsibleState.Collapsed, true)
            );
        }

        return dependenciesOutput;
    }

    private getTestDependencies(file: string, functionName: string): Dependency[] {
        const dependencies = jsonStore.get('dependencies');
        const fileDependencies = dependencies[file];
        const functionDependencies = fileDependencies[functionName];
        const dependenciesOutput: Dependency[] = [];

        // Value will be an array of dependencies (strings)
        for (const [key, value] of Object.entries(functionDependencies) as [string, string[]][]) {
            for (const dependencyName of value) {
                const typeName = key.slice(0, -1);
                dependenciesOutput.push(
                    new Dependency(dependencyName, file, typeName, vscode.TreeItemCollapsibleState.None)
                );
            }
        }

        return dependenciesOutput;
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

class Dependency extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public file: string,
        private type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public isFunction?: boolean,
        public passes?: boolean
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.type}`;
        this.description = this.type;
    }

    iconPath = {
        light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg')),
        dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg'))
    };
}
