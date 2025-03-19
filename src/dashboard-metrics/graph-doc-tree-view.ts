import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Tree view provider for the Graph Doc tree view.
 */
export class GraphDocTreeViewProvider implements vscode.TreeDataProvider<GraphDocItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GraphDocItem | undefined | void> = new vscode.EventEmitter<GraphDocItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<GraphDocItem | undefined | void> = this._onDidChangeTreeData.event;

  getTreeItem(element: GraphDocItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GraphDocItem): Thenable<GraphDocItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      return Promise.resolve(this.getRootNodes());
    }
  }

  // Commands to show
  private getRootNodes(): GraphDocItem[] {
    return [
      new GraphDocItem('Pass/Fail Graph', 'test-history.showPassFailGraph', 'graph.svg'),
      new GraphDocItem('Coverage Graph', 'test-history.showCoverageGraph', 'graph.svg'),
      new GraphDocItem('Generate Report', 'extension.exportSnapshotReport', 'doc.svg')
    ];
  }
}

class GraphDocItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private commandId: string,
    iconFileName: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: commandId,
      title: label
    };
    const iconPath = path.join(__filename, '..', '..', '..', 'assets', iconFileName);
    this.iconPath = {
      light: vscode.Uri.file(iconPath),
      dark: vscode.Uri.file(iconPath)
    };
  }
}

/**
 * The activate function to set up the Graph Doc tree view.
 * 
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  const graphDocTreeViewProvider = new GraphDocTreeViewProvider();
  vscode.window.registerTreeDataProvider('graphDocTreeView', graphDocTreeViewProvider);
}