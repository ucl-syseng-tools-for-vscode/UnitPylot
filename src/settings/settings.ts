import * as vscode from 'vscode';

/**
 * Settings class to manage the extension settings
 */

export class Settings {
    public static NUMBER_OF_SLOWEST_TESTS = 5;
    public static CODE_COVERAGE_HIGHLIGHTING = true;
    public static COPILOT_ENABLED = true;
    public static SNAPSHOT_INTERVAL = 10;
    public static RUN_NECESSARY_TESTS_ONLY = true;

    /**
     * Initialise the settings from the config file
     */
    public static initialise() {
        // Load settings from the config file
        const config = vscode.workspace.getConfiguration('pytestSettings');
        Settings.NUMBER_OF_SLOWEST_TESTS = config.get('numberOfSlowestTests') || Settings.NUMBER_OF_SLOWEST_TESTS;
        Settings.CODE_COVERAGE_HIGHLIGHTING = config.get('codeCoverageHighlighting') || Settings.CODE_COVERAGE_HIGHLIGHTING;
        Settings.COPILOT_ENABLED = config.get('copilotEnabled') || Settings.COPILOT_ENABLED;
        Settings.SNAPSHOT_INTERVAL = config.get('snapshotInterval') || Settings.SNAPSHOT_INTERVAL;
        Settings.RUN_NECESSARY_TESTS_ONLY = config.get('runNecessaryTestsOnly') || Settings.RUN_NECESSARY_TESTS_ONLY;
    }

    /**
     * Update the settings in the config file
     */
    public static updateSettings() {
        const config: { [key: string]: number | boolean } = {
            numberOfSlowestTests: Settings.NUMBER_OF_SLOWEST_TESTS,
            codeCoverageHighlighting: Settings.CODE_COVERAGE_HIGHLIGHTING,
            copilotEnabled: Settings.COPILOT_ENABLED,
            snapshotInterval: Settings.SNAPSHOT_INTERVAL,
            runNecessaryTestsOnly: Settings.RUN_NECESSARY_TESTS_ONLY
        }
        for (const key in config) {
            vscode.workspace.getConfiguration('pytestSettings').update(key, config[key as keyof typeof config], vscode.ConfigurationTarget.Workspace);
        }
    }
}