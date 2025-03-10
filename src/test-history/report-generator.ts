import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Snapshot } from "./snapshot";
import { HistoryProcessor } from './history-processor';
import { HistoryManager } from './history-manager';

export class ReportGenerator {
    public static async generateSnapshotReport() {
        const passFailHistory = HistoryProcessor.getPassFailHistory();
        const snapshots = HistoryManager.getSnapshots();

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
                const fullData = passFailHistory.map((entry, index) => ({
                    ...entry,
                    coverage: snapshots[index]?.coverage?.totals?.percentCovered !== undefined
                        ? snapshots[index].coverage.totals.percentCovered.toFixed(2) + "%"
                        : "N/A",
                    linesCovered: snapshots[index]?.coverage?.totals?.covered ?? "N/A",
                    linesMissed: snapshots[index]?.coverage?.totals?.missed ?? "N/A",
                    branchesCovered: snapshots[index]?.coverage?.totals?.branches_covered ?? "N/A",
                    branchesMissed: snapshots[index]?.coverage?.totals?.branches_missed ?? "N/A"
                }));
                fs.writeFileSync(filePath, JSON.stringify(fullData, null, 4), "utf8");
                vscode.window.showInformationMessage(`Snapshot report saved as JSON: ${filePath}`);
            } else if (fileExtension === ".md") {
                const markdownContent = ReportGenerator.generateMarkdownReport(passFailHistory, snapshots);
                fs.writeFileSync(filePath, markdownContent, "utf8");
                vscode.window.showInformationMessage(`Snapshot report saved as Markdown: ${filePath}`);
            } else {
                vscode.window.showErrorMessage("Unsupported file format selected.");
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error saving report: ${(error as Error).message}`);
        }
    }

    private static generateMarkdownReport(
        passFailHistory: { date: Date; pass: number; fail: number }[],
        snapshots: Snapshot[]
    ): string {
        // Extract coverage data properly
        const formattedData = passFailHistory.map((entry, index) => ({
            date: entry.date instanceof Date ? entry.date.toISOString() : new Date(entry.date).toISOString(),
            pass: entry.pass,
            fail: entry.fail,
            coverage: snapshots[index]?.coverage?.totals?.percentCovered !== undefined
                ? snapshots[index].coverage.totals.percentCovered.toFixed(2) + "%"
                : "N/A",
            linesCovered: snapshots[index]?.coverage?.totals?.covered ?? "N/A",
            linesMissed: snapshots[index]?.coverage?.totals?.missed ?? "N/A",
            branchesCovered: snapshots[index]?.coverage?.totals?.branches_covered ?? "N/A",
            branchesMissed: snapshots[index]?.coverage?.totals?.branches_missed ?? "N/A"
        }));

        // Convert coverage values to numbers for averaging
        const validCoverages = formattedData
            .map(entry => parseFloat(entry.coverage))
            .filter(value => !isNaN(value));

        const averageCoverage = validCoverages.length > 0
            ? (validCoverages.reduce((sum, value) => sum + value, 0) / validCoverages.length).toFixed(2) + "%"
            : "N/A";

        // Get column widths for proper alignment
        const columnWidths = {
            date: Math.max(...formattedData.map(entry => entry.date.length), "Date (UTC)".length),
            pass: Math.max(...formattedData.map(entry => entry.pass.toString().length), "✅ Pass".length),
            fail: Math.max(...formattedData.map(entry => entry.fail.toString().length), "❌ Fail".length),
            coverage: Math.max(...formattedData.map(entry => entry.coverage.toString().length), "📊 Coverage %".length),
            linesCovered: Math.max(...formattedData.map(entry => entry.linesCovered.toString().length), "✔️ Lines Covered".length),
            linesMissed: Math.max(...formattedData.map(entry => entry.linesMissed.toString().length), "❌ Lines Missed".length),
            branchesCovered: Math.max(...formattedData.map(entry => entry.branchesCovered.toString().length), "🌿 Branches Covered".length),
            branchesMissed: Math.max(...formattedData.map(entry => entry.branchesMissed.toString().length), "⚠️ Branches Missed".length),
        };

        // Function to pad text for alignment
        const pad = (text: string, width: number) => text.padEnd(width, " ");

        // Table Header
        let table = `| ${pad("Date (UTC)", columnWidths.date)} | ${pad("✅ Pass", columnWidths.pass)} | ${pad("❌ Fail", columnWidths.fail)} | ${pad("📊 Coverage %", columnWidths.coverage)} | ${pad("✔️ Lines Covered", columnWidths.linesCovered)} | ${pad("❌ Lines Missed", columnWidths.linesMissed)} | ${pad("🌿 Branches Covered", columnWidths.branchesCovered)} | ${pad("⚠️ Branches Missed", columnWidths.branchesMissed)} |\n`;
        table += `|-${"-".repeat(columnWidths.date)}-|-${"-".repeat(columnWidths.pass)}-|-${"-".repeat(columnWidths.fail)}-|-${"-".repeat(columnWidths.coverage)}-|-${"-".repeat(columnWidths.linesCovered)}-|-${"-".repeat(columnWidths.linesMissed)}-|-${"-".repeat(columnWidths.branchesCovered)}-|-${"-".repeat(columnWidths.branchesMissed)}-|\n`;

        // Table Rows
        table += formattedData.map(entry =>
            `| ${pad(entry.date, columnWidths.date)} | ${pad(entry.pass.toString(), columnWidths.pass)} | ${pad(entry.fail.toString(), columnWidths.fail)} | ${pad(entry.coverage.toString(), columnWidths.coverage)} | ${pad(entry.linesCovered.toString(), columnWidths.linesCovered)} | ${pad(entry.linesMissed.toString(), columnWidths.linesMissed)} | ${pad(entry.branchesCovered.toString(), columnWidths.branchesCovered)} | ${pad(entry.branchesMissed.toString(), columnWidths.branchesMissed)} |`
        ).join("\n");

        return `# 🎯 Test & Coverage Report

** Generated on:** ${new Date().toLocaleString()}

---

## Summary
- **📌 Total Snapshots:** ${formattedData.length}
- **✅ Total Passed Tests:** ${formattedData.reduce((sum, entry) => sum + entry.pass, 0)}
- **❌ Total Failed Tests:** ${formattedData.reduce((sum, entry) => sum + entry.fail, 0)}
- **📈 Pass Rate:** ${(formattedData.reduce((sum, entry) => sum + entry.pass, 0) /
                (formattedData.reduce((sum, entry) => sum + entry.pass, 0) +
                    formattedData.reduce((sum, entry) => sum + entry.fail, 0)) * 100).toFixed(2)}%
- **📊 Average Coverage:** ${averageCoverage}

---

## Test & Coverage Results by Date

${table}

`;
    }
}