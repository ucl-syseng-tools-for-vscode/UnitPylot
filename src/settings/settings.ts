import * as vscode from 'vscode';

/**
 * Settings class to manage the extension settings
 */
export class Settings {
    private static getConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('test-pylot');
    }

    public static get NUMBER_OF_SLOWEST_TESTS(): number {
        const config = Settings.getConfig();
        return config.get<number>('numberOfSlowestTests') || 5;
    }

    public static get NUMBER_OF_MEMORY_INTENSIVE_TESTS(): number {
        const config = Settings.getConfig();
        return config.get<number>('numberOfMemoryIntensiveTests') || 5;
    }

    public static get CODE_COVERAGE_HIGHLIGHTING(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('codeCoverageHighlighting');
        return setting !== undefined ? setting : true;
    }

    public static get COPILOT_ENABLED(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('copilotEnabled');
        return setting !== undefined ? setting : true;
    }

    public static get SNAPSHOT_INTERVAL(): number {
        const config = Settings.getConfig();
        return config.get<number>('snapshotInterval') || 10;
    }

    public static get RUN_NECESSARY_TESTS_ONLY(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('runNecessaryTestsOnly');
        return setting !== undefined ? setting : true;
    }

    public static get RUN_TESTS_ON_SAVE(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('runTestsOnSave');
        return setting !== undefined ? setting : true;
    }

    public static get RUN_TESTS_IN_BACKGROUND(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('runTestsInBackground');
        return setting !== undefined ? setting : true;
    }

    public static get SAVE_SNAPSHOT_ON_TEST_RUN(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('saveSnapshotOnTestRun');
        return setting !== undefined ? setting : true;
    }

    public static get SAVE_SNAPSHOT_PERIODICALLY(): boolean {
        const config = Settings.getConfig();
        const setting = config.get<boolean>('saveSnapshotPeriodically');
        return setting !== undefined ? setting : false;
    }

    public static get RUN_TESTS_INTERVAL(): number {
        const config = Settings.getConfig();
        return config.get<number>('runTestsInterval') || 10;
    }

    public static get CUSTOM_LLM_ENDPOINT(): string {
        const config = Settings.getConfig();
        const setting = config.get<string>('customLLM Endpoint') || '';
        return setting !== undefined ? setting : '';
    }

    public static get CUSTOM_LLM_MODEL(): string {
        const config = Settings.getConfig();
        const setting = config.get<string>('customLLM Model') || '';
        return setting !== undefined ? setting : '';
    }

    public static get CUSTOM_LLM_API_KEY(): string {
        const config = Settings.getConfig();
        const setting = config.get<string>('customLLM API Key') || '';
        return setting !== undefined ? setting : '';
    }

    public static get CUSTOM_LLM_MAX_TOKENS(): number {
        const config = Settings.getConfig();
        return config.get<number>('customLLM MaxTokens') || 500;
    }
}
