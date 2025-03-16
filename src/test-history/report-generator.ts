import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Snapshot } from "./snapshot";
import { HistoryProcessor } from './history-processor';
import { HistoryManager } from './history-manager';

/**
 * ReportGenerator
 * Generates a report from the test history data.
 */
export class ReportGenerator {
    /**
     * Generate a snapshot report and save it as a JSON or Markdown file.
     * 
     * @returns None
     */
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
                    coverage: snapshots[index]?.coverage?.totals?.percentCovered
                        ? snapshots[index].coverage?.totals.percentCovered.toFixed(2) + "%"
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

    // Generate a markdown report from the snapshot data
    private static generateMarkdownReport(
        passFailHistory: { date: Date; pass: number; fail: number }[],
        snapshots: Snapshot[]
    ): string {
        let previousCoverage: number | null = null;
        let previousPassRate: number | null = null;
    
        const formattedData = passFailHistory.map((entry, index) => {
            const totalTests = entry.pass + entry.fail;
            const currentPassRate = totalTests > 0 ? (entry.pass / totalTests) * 100 : null;
            const currentCoverage = snapshots[index]?.coverage?.totals?.percentCovered
                ? parseFloat(snapshots[index].coverage?.totals.percentCovered.toFixed(2))
                : null;
            
            let coverageChange = "";
            if (previousCoverage !== null && currentCoverage !== null) {
                if (currentCoverage > previousCoverage) {
                    coverageChange = "📈 (⬆️)";
                } else if (currentCoverage < previousCoverage) {
                    coverageChange = "📉 (⬇️)";
                }
            }
            previousCoverage = currentCoverage;
    
            let passRateChange = "";
            if (previousPassRate !== null && currentPassRate !== null) {
                if (currentPassRate < previousPassRate) {
                    passRateChange = "🚩 (⬇️)"; // Red flag for pass rate decline
                }
            }
            previousPassRate = currentPassRate;
    
            return {
                date: entry.date instanceof Date ? entry.date.toISOString() : new Date(entry.date).toISOString(),
                pass: entry.pass,
                fail: entry.fail,
                passRate: currentPassRate !== null ? `${currentPassRate.toFixed(2)}% ${passRateChange}` : "N/A",
                coverage: currentCoverage !== null ? `${currentCoverage.toFixed(2)}% ${coverageChange}` : "N/A"
            };
        });
    
        // Markdown Header
        let markdown = `# 🎯 Test & Coverage Report\n\n`;
        markdown += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
        markdown += `---\n\n`;
        markdown += `## Key\n\n`;
        markdown += `- **✅ Pass** - Number of passing tests\n`;
        markdown += `- **❌ Fail** - Number of failing tests\n`;
        markdown += `- **📊 Coverage %** - Percentage of code covered\n`;
        markdown += `- **📈 Increase in Coverage**\n`;
        markdown += `- **📉 Decrease in Coverage**\n`;
        markdown += `- **🚩 Decline in Pass Rate**\n\n`;
        markdown += `---\n\n`;
        
        markdown += `## Test & Coverage Results\n\n`;
    
        markdown += `| Date (UTC) | ✅ Pass | ❌ Fail | 🏆 Pass Rate % | 📊 Coverage % |\n`;
        markdown += `|------------|---------|---------|---------------|---------------|\n`;
    
        formattedData.forEach(entry => {
            markdown += `| ${entry.date} | ${entry.pass} | ${entry.fail} | ${entry.passRate} | ${entry.coverage} |\n`;
        });
    
        return markdown;
    }             
}