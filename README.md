# TestPylot

TestPylot is a Visual Studio Code (VSCode) extension designed to enhance the experience of using pytest for testing Python code. It provides various features to streamline the testing process, improve code coverage, and optimise test performance.

## Features

- **CodeLens for Pytest**: Easily run and debug individual tests directly from the editor.
- **Test Coverage Visualisation**: Highlight code coverage within the editor to identify untested code.
- **Tests Tree View**: View and navigate test issues in a dedicated tree view.
- **Test History**: Track the history of test results, including pass/fail rates and coverage over time.
- **Memory and Performance Optimisation**: Identify and optimise the slowest and most memory-intensive tests.
- **Custom LLM Integration**: Use GitHub Copilot or other custom language models to assist with test writing and optimisation.

## Installation

1. Install Visual Studio Code.
2. Install the TestPylot extension from the VSCode marketplace or by downloading it from the repository.

### Build from source
To build TestPylot from source, follow these steps:

1. Clone the repository:
  ```sh
  git clone https://github.com/ucl-syseng-tools-for-vscode/MVP.git
  cd MVP
  ```

2. Install the dependencies:
  ```sh
  npm install
  ```

3. Compile the extension:
  ```sh
  npm run compile
  ```

4. Open the project in Visual Studio Code:
  ```sh
  code .
  ```

5. Launch the extension:
  - Press `F5` to open a new VSCode window with the extension loaded.

## Prerequisites
This extension works with `pytest` and needs some extra dependencies which include:
- `pytest` of course
- `pytest-cov` for code coverage
- `pytest-json-report` to help us parse the pytest results
- `pytest-monitor` for resource usage

Install these into your Python project by running:
```sh
pip install pytest pytest-cov pytest-json-report pytest-monitor
```

## Usage

### Running Tests

- Open a Python file with tests.
- Use the CodeLens links above each test function to run or debug the test.

### Viewing Test Coverage

- Enable code coverage highlighting in the settings.
- Run your tests to see the coverage data directly in the editor.

### Optimising Tests

- Right click to use the commands provided by the extension to find optimise the slowest and most memory-intensive tests as well as fix failing ones.

### Test History

- Access the test history graphs to analyse the pass/fail rates and coverage trends over time.

## Configuration

TestPylot provides several configuration options to customise its behavior. These can be accessed through the VSCode settings:

- `test-pylot.runNecessaryTestsOnly`: Run only necessary tests instead of all tests.
- `test-pylot.copilotEnabled`: Enable GitHub Copilot integration.
- `test-pylot.codeCoverageHighlighting`: Enable code coverage highlighting.
- `test-pylot.numberOfSlowestTests`: Number of slowest tests to display.
- `test-pylot.snapshotInterval`: Snapshot interval in minutes.
- `test-pylot.runTestsOnSave`: Run tests on any file save.
- `test-pylot.runTestsInBackground`: Periodically run tests in the background.
- `test-pylot.saveSnapshotOnTestRun`: Save snapshots when tests are run.
- `test-pylot.saveSnapshotPeriodically`: Periodically save snapshots in the background.
- `test-pylot.customLLM Endpoint`: Custom LLM endpoint to use if GitHub Copilot is not enabled.
- `test-pylot.customLLM Model`: Custom LLM model to use if GitHub Copilot is not enabled.
- `test-pylot.customLLM APIKey`: Custom LLM key to use if GitHub Copilot is not enabled.
- `test-pylot.customLLM MaxTokens`: Custom LLM max tokens to use if GitHub Copilot is not enabled.

### Custom LLM Support
TestPylot supports custom language models (LLMs) through an OpenAI-style API. This allows you to integrate your own LLMs for test writing and optimisation.

To configure a custom LLM, set the following options in the VSCode settings:

- `test-pylot.customLLM Endpoint`: The endpoint URL for your custom LLM API (e.g., `http://xxxxxx/v1/chat/completions`).
- `test-pylot.customLLM Model`: The model name to use with your custom LLM.
- `test-pylot.customLLM APIKey`: The API key for authenticating with your custom LLM.
- `test-pylot.customLLM MaxTokens`: The maximum number of tokens to use for each request to your custom LLM.

## Commands

TestPylot provides several commands accessible through the command palette:

- `TestPylot: Test Insights`
- `TestPylot: Fix Failing Tests`
- `TestPylot: Fix Coverage`
- `TestPylot: Show test pass-fail history graph`
- `TestPylot: Show coverage history graph`
- `TestPylot: Optimise Memory Usage of Tests`
- `TestPylot: Optimise Slowest Tests`
- `TestPylot: Generate Pydoc`
