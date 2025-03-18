import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Snapshot } from "./snapshot";
import { readJsonFile } from '../test-runner/helper-functions';
import { TestRunner } from '../test-runner/test-runner';

const TEST_HISTORY_FILE = 'snapshots.json';

/**
 * HistoryManager
 * Manages snapshots of test results and coverage data.
 * Used to store and retrieve historical data for analysis.
 * The data is not processed here!
 */

export class HistoryManager {
    private static testRunner: TestRunner;

    /**
     * Initialise the HistoryManager
     * 
     * @param context The extension context
     */
    public static initialise(context: vscode.ExtensionContext) {
        this.testRunner = TestRunner.getInstance(context.workspaceState);
    }

    /**
     * Get the last n snapshots or all snapshots
     * 
     * @param numberOfSnapshots The number of snapshots to return
     * @returns The last n snapshots or all snapshots
     */
    public static getSnapshots(numberOfSnapshots?: number): Snapshot[] {
        const testHistoryFile = this.getSnapshotFilePath();
        if (!fs.existsSync(testHistoryFile)) {
            fs.writeFileSync(testHistoryFile, JSON.stringify([]));
        }
        // Read the json file and return the last n snapshots or all snapshots
        const snapshots: Snapshot[] = readJsonFile(testHistoryFile) || [];
        if (numberOfSnapshots) {
            return snapshots.slice(-numberOfSnapshots);
        }
        return snapshots;
    }

    /**
     * Get snapshots between two dates
     * 
     * @param startDate The start date
     * @param endDate The end date
     * @returns Snapshots between the start and end date
     * @throws Error if no workspace folder is found
     */
    public static getSnapshotsByDate(startDate: Date, endDate: Date): Snapshot[] {
        // Get snapshots between the start and end date
        const snapshots: Snapshot[] = this.getSnapshots();
        return snapshots.filter(snapshot => {
            const snapshotDate = new Date(snapshot.time); // Convert time to Date object
            return snapshotDate >= startDate && snapshotDate <= endDate;
        });
    }

    /**
     * Clear the snapshot history
     */
    public static clearHistory() {
        // Clear all snapshots
        try {
            fs.unlinkSync(this.getSnapshotFilePath());
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Save the current test results and coverage data as a snapshot
     */
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

    /**
     * Add a snapshot to the snapshot history
     * 
     * @param snapshot The snapshot to add
     */
    private static addSnapshot(snapshot: Snapshot) {
        const testHistoryFile = this.getSnapshotFilePath();

        // Append the snapshot to the json file
        const snapshots: Snapshot[] = this.getSnapshots();
        snapshots.push(snapshot);

        // Create a new directory if it doesn't exist
        if (!fs.existsSync(testHistoryFile)) {
            fs.mkdirSync(testHistoryFile);
        }

        try {
            fs.writeFileSync(testHistoryFile, JSON.stringify(snapshots, null, 4));
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Get the path to the snapshot history file
     * 
     * @returns The path to the snapshot history file
     * @throws Error if no workspace folder is
     */
    private static getSnapshotFilePath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const filePath = path.join(workspacePath, TEST_HISTORY_FILE);

        return filePath;
    }
}
