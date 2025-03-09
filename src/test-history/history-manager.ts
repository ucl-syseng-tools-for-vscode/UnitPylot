import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Snapshot } from "./snapshot";
import { readJsonFile } from '../test-runner/helper-functions';
import { TestRunner } from '../test-runner/test-runner';
import { HistoryProcessor } from './history-processor';

const workspaceFolders = vscode.workspace.workspaceFolders;
if (!workspaceFolders) {
    throw new Error('No workspace folder found');
}
const workspacePath = workspaceFolders[0].uri.fsPath;
const TEST_HISTORY_FILE = path.join(workspacePath, 'snapshots.json');

/**
 * HistoryManager
 * Manages snapshots of test results and coverage data.
 * Used to store and retrieve historical data for analysis.
 * The data is not processed here!
 */

export class HistoryManager {
    private static testRunner: TestRunner;

    public static initialise(context: vscode.ExtensionContext) {
        this.testRunner = TestRunner.getInstance(context.workspaceState);
    }

    public static getSnapshots(numberOfSnapshots?: number): Snapshot[] {
        if (!fs.existsSync(TEST_HISTORY_FILE)) {
            fs.writeFileSync(TEST_HISTORY_FILE, JSON.stringify([]));
        }
        // Read the json file and return the last n snapshots or all snapshots
        const snapshots: Snapshot[] = readJsonFile(TEST_HISTORY_FILE) || [];
        if (numberOfSnapshots) {
            return snapshots.slice(-numberOfSnapshots);
        }
        return snapshots;
    }

    public static getSnapshotsByDate(startDate: Date, endDate: Date): Snapshot[] {
        // Get snapshots between the start and end date
        const snapshots: Snapshot[] = this.getSnapshots();
        return snapshots.filter(snapshot => {
            return snapshot.time >= startDate && snapshot.time <= endDate;
        });
    }

    public static clearHistory() {
        // Clear all snapshots
        try {
            fs.unlinkSync(TEST_HISTORY_FILE);
        } catch (error) {
            console.error(error);
        }
    }

    public static async saveSnapshot() {
        // Save the current test results and coverage data as a snapshot
        const testResult = await this.testRunner.getAllResults(true);
        const coverage = await this.testRunner.getCoverage(true);
        const time = new Date();

        const snapshot: Snapshot = {
            testResult,
            coverage,
            time
        };

        this.addSnapshot(snapshot);
    }

    private static addSnapshot(snapshot: Snapshot) {
        // Append the snapshot to the json file
        const snapshots: Snapshot[] = this.getSnapshots();
        snapshots.push(snapshot);

        // Create a new directory if it doesn't exist
        if (!fs.existsSync(TEST_HISTORY_FILE)) {
            fs.mkdirSync(TEST_HISTORY_FILE);
        }

        try {
            fs.writeFileSync(TEST_HISTORY_FILE, JSON.stringify(snapshots, null, 4));
        } catch (error) {
            console.error(error);
        }
    }
}

export class ReportGenerator {
    public static async generateSnapshotReport() {
        const passFailHistory = HistoryProcessor.getPassFailHistory();
        if (passFailHistory.length === 0) {
            vscode.window.showWarningMessage("No snapshot history available to generate a report.");
            return;
        }

        const options: vscode.SaveDialogOptions = {
            saveLabel: "Save Report",
            filters: { 
                "JSON Files": ["json"],
                "Markdown Files": ["md"]
            }
        };

        const uri = await vscode.window.showSaveDialog(options);
        if (!uri) return;

        const filePath = uri.fsPath;
        const fileExtension = path.extname(filePath);

        try {
            if (fileExtension === ".json") {
                fs.writeFileSync(filePath, JSON.stringify(passFailHistory, null, 4), "utf8");
                vscode.window.showInformationMessage(`Snapshot report saved as JSON: ${filePath}`);
            } else if (fileExtension === ".md") {
                const markdownContent = ReportGenerator.generateMarkdownReport(passFailHistory);
                fs.writeFileSync(filePath, markdownContent, "utf8");
                vscode.window.showInformationMessage(`Snapshot report saved as Markdown: ${filePath}`);
            } else {
                vscode.window.showErrorMessage("Unsupported file format selected.");
            }
        } catch (error) {
            const errorMessage = (error as Error).message;
            vscode.window.showErrorMessage(`Error saving report: ${errorMessage}`);
        }
    }

    private static generateMarkdownReport(passFailHistory: { date: string | Date; pass: number; fail: number }[]): string {
        // Ensure all dates are converted to ISO strings
        const formattedData = passFailHistory.map(entry => ({
            date: (entry.date instanceof Date ? entry.date : new Date(entry.date)).toISOString(),
            pass: entry.pass,
            fail: entry.fail
        }));
    
        // Get column widths for proper alignment
        const columnWidths = {
            date: Math.max(...formattedData.map(entry => entry.date.length), 12),
            pass: Math.max(...formattedData.map(entry => entry.pass.toString().length), 4),
            fail: Math.max(...formattedData.map(entry => entry.fail.toString().length), 4),
        };
    
        // Function to pad text for alignment
        const pad = (text: string, width: number) => text.padEnd(width, " ");
    
        // Table Header
        let table = `| ${pad("Date (UTC)", columnWidths.date)} | ${pad("✅ Pass", columnWidths.pass)} | ${pad("❌ Fail", columnWidths.fail)} |\n`;
        table += `|-${"-".repeat(columnWidths.date)}-|-${"-".repeat(columnWidths.pass)}-|-${"-".repeat(columnWidths.fail)}-|\n`;
    
        // Table Rows
        table += formattedData.map(entry =>
            `| ${pad(entry.date, columnWidths.date)} | ${pad(entry.pass.toString(), columnWidths.pass)} | ${pad(entry.fail.toString(), columnWidths.fail)} |`
        ).join("\n");
    
        return `# Test Snapshot Report
    
    **Generated on:** ${new Date().toLocaleString()}
    
    ---
    
    ## Summary
    - **Total Snapshots:** ${formattedData.length}
    - **Total Passed Tests:** ${formattedData.reduce((sum, entry) => sum + entry.pass, 0)}
    - **Total Failed Tests:** ${formattedData.reduce((sum, entry) => sum + entry.fail, 0)}
    - **Pass Rate:** ${(formattedData.reduce((sum, entry) => sum + entry.pass, 0) / 
                         (formattedData.reduce((sum, entry) => sum + entry.pass, 0) + 
                          formattedData.reduce((sum, entry) => sum + entry.fail, 0)) * 100).toFixed(2)}%
    
    ---
    
    ## Test Results by Date
    
    ${table}
    `;
    }    
}
