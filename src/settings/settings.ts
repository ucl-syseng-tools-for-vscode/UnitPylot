import * as vscode from 'vscode';

/**
 * Settings class to manage the extension settings
 */
export class Settings {

    private static config: vscode.WorkspaceConfiguration | null = null;

    private static getConfig(): vscode.WorkspaceConfiguration {
        if (!Settings.config) {
            Settings.config = vscode.workspace.getConfiguration('pytastic');
        }
        return Settings.config;
    }

    public static get NUMBER_OF_SLOWEST_TESTS(): number {
        const config = Settings.getConfig();
        return config.get<number>('numberOfSlowestTests') || 5;
    }

    public static get CODE_COVERAGE_HIGHLIGHTING(): boolean {
        const config = Settings.getConfig();
        return config.get<boolean>('codeCoverageHighlighting') || true;
    }

    public static get COPILOT_ENABLED(): boolean {
        const config = Settings.getConfig();
        return config.get<boolean>('copilotEnabled') || true;
    }

    public static get SNAPSHOT_INTERVAL(): number {
        const config = Settings.getConfig();
        return config.get<number>('snapshotInterval') || 10;
    }

    public static get RUN_NECESSARY_TESTS_ONLY(): boolean {
        const config = Settings.getConfig();
        return config.get<boolean>('runNecessaryTestsOnly') || true;
    }

    public static get NUMBER_OF_MEMORY_PROFILING_TESTS(): number {
        const config = Settings.getConfig();
        return config.get<number>('numberOfMemoryProfilingTests') || 5;
    }
}
