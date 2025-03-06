import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Snapshot } from "./snapshot";
import { readJsonFile } from '../test-runner/helper-functions';
import { TestRunner } from '../test-runner/test-runner';

const workspaceFolders = vscode.workspace.workspaceFolders;
if (!workspaceFolders) {
    throw new Error('No workspace folder found');
}
const workspacePath = workspaceFolders[0].uri.fsPath;
const HISTORY_DIR = path.join(workspacePath, '.vscode');
const TEST_HISTORY_FILE = path.join(HISTORY_DIR, 'snapshots.json');

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
        const testResult = await this.testRunner.getAllResults();
        const coverage = await this.testRunner.getCoverage();
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