# ✨ TestPylot ✨

**TestPylot** is a Copilot-enabled Visual Studio Code (VS Code) extension designed to enhance the unit testing experience for Python developers wokring for Brownfield Codebases. Developers can use our extension on an existing codebase to get immediate insights into their testing suite. 

It offers a range of features to streamline unit testing, enhance code coverage, and optimise test performance. The interactive dashboard visualises key test metrics and intelligent suggestions are provided to improve test quality.

## Features 🌟

### 📊 Test Performance & Coverage Insights 

* **Granular Test Metrics Breakdown**: displays the structure of the project's test suite within a **tree view** highlighting,
  * passing/failing test cases,
  * _n_ slowest tests,
  * _n_ most memory intensive tests.
* **Line and Branch Coverage Display**: provides functionality that highlights untested areas of code within the editor, providing real-time feedback.
* **Test History Tracker**: tracks test performance with interactive graphs of pass/fail rates and coverage trends.
* **Exportable Logs**: saves test results and coverage trends into _json_ or _markdown_ formats.

### 🔁 Automated Test Optimisation & Debugging 
TestPylot offers **AI assitance** that provides suggestions to improve the following metrics, allowing them to be **accepted directly into corresponding files**:
* **Fix Failing Tests**: detects failure points and suggests fixes to improve test reliability.
* **Improve Coverage**: detects untested code such as edge cases or missed branches and suggests additional test cases.
* **Optimise Slowest Tests**: detects the _n_ slowest tests and suggests explanations and improved test cases with faster execution time.
* **Optimise Memory-intensive Tests**: detects the _n_ most memory intensive tests and suggests tests which use lesser memory.

### 🤖 AI-Powered Enhancements 
* **Code Insights**: highlights vulnerabilities and suggests improvements in test cases to detect bottlenecks and prevent regressions.
* **Pydoc Generation**: generates documentation for test cases to enhance readability and maintainability.
* **AAA Chat Participant**: provides guidance on how to follow the best testing practices by adhering to the AAA design pattern. 

### ⚙️ Smart Execution and Customisation 
* **Customise _n_**: allows user to chose the number of slowest and memory intensive tests to display dynamically.
* **Continuous Background Testing**: runs necessary tests automatically when changes are detected.
* **Refreshing Suite History**: allows user to customise whether to **periodically save snapshots** or **track changes based on file changes**.
* **Selective Test Execution**: allows running only relevant tests based on recent changes to shorten feedback loops.

## Installation 📥 

### Prerequisites
- Access to Copilot: To use any GitHub Copilot extension in Visual Studio Code, you need either an active Copilot subscription (such as Copilot Pro, Copilot Enterprise, or Copilot Business) 
- Visual Studio Code should be installed
- Copilot in Visual Studio Code: Follow this if not yet set-up: http://code.visualstudio.com/docs/copilot/setup

### Overview

1. Make sure you have the GitHub Copilot activated in VS Code Follow the link above if you need assisstance. 
2. Add our extension by searching for "TestPylot" in the VS Code Extension Marketplace
3. Download an example codebase as below to try out our extension!

### 🔬 For Testing: Clone the example-codebases Repository
```sh
git clone https://github.com/ucl-syseng-tools-for-vscode/example-codebases.git
```

### From the Marketplace
1. Open VS Code.
2. Search for **TestPylot** in the VS Code Marketplace.
3. Click Install to add the extension.

### 🛠 Build From Source
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

### 🚀 Launch the Extension
To begin using TestPylot, follow these steps:
1. Press `F5` _OR_ open the **Command Palette (Shift + Command + P)** and run **Debug: Start Debugging**.
2. Open one of the projects within the **example-codebases** folder.
3. Run the `make.sh` file to create a virtual environment (venv) to run the project within _OR_ ensure that you have the necessary dependencies installed by running: `pip install pytest pytest-cov pytest-json-report pytest-monitor`.

## Usage Instructions 📖
### 🖥️ Dashboard View
- Locate and open the **🔧** icon on the left-side VSCode navigation bar.
- Access the granular test suite view from the **dashboard view** under the **Tests Overview** collapsable view.
- Access the test history graphs to analyse the pass/fail rates and coverage trends over time from the **dashboard view** under the **Graphs & Docs** collapsable view.

### ⏯️ Running Tests
- Open a Python file with tests.
- Use the CodeLens links above each test function to run or debug particular tests.
- _OR_ click the run tests / run all tests button within the **dashboard view**.

### 📈 Viewing Test Coverage
- Enable code coverage highlighting in the settings.
- Run your tests to see the coverage data directly in the editor.

### ✅ Commands for Optimising Tests
- Locate the **Code Insights** button on the top right next to the run button to generate code insights. 
- Right click and navigate to the **TestPylot Commands** to find:
  - the fix coverage command when in a src file.
  - the fix failing, optimise slowest, optimise memory, and generate pydoc commands when the current editor is in a test file.

## Settings Configuration ⚙️ 
Navigate to the TestPylot **settings page** by clicking the ⚙️ icon on the top right of the expandable **dashboard view**.
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

### 🔄 Custom LLM Support
TestPylot supports custom language models (LLMs) through an OpenAI-style API. This allows you to integrate your own LLMs for test writing and optimisation.
To configure a custom LLM, set the following options in the VSCode settings:
- `test-pylot.customLLM Endpoint`: The endpoint URL for your custom LLM API (e.g., `http://xxxxxx/v1/chat/completions`).
- `test-pylot.customLLM Model`: The model name to use with your custom LLM.
- `test-pylot.customLLM APIKey`: The API key for authenticating with your custom LLM.
- `test-pylot.customLLM MaxTokens`: The maximum number of tokens to use for each request to your custom LLM.

## List of Commands 🗂
Below are all the TestPylot commands also accessible through the command palette:
- `TestPylot: Test Insights`
- `TestPylot: Fix Failing Tests`
- `TestPylot: Fix Coverage`
- `TestPylot: Show test pass-fail history graph`
- `TestPylot: Show coverage history graph`
- `TestPylot: Optimise Memory Usage of Tests`
- `TestPylot: Optimise Slowest Tests`
- `TestPylot: Generate Pydoc`
