import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as helperFunctions from '../../../test-runner/helper-functions';
import { exec } from 'child_process';
import { getPythonPath, readJsonFile, parseCoverage, getTestsForFunctions, getTestsForFunction } from '../../../test-runner/helper-functions';

suite('Helper Functions Tests', () => {
    let sandbox: sinon.SinonSandbox;

    suiteSetup(() => {
        sandbox = sinon.createSandbox();
    });

    suiteTeardown(() => {
        sandbox.restore();
    });

    function resetSandBox() {
        sandbox.restore();
        sandbox = sinon.createSandbox();
    }

    test('should get Python path', async () => {
        const extension = {
            activate: async () => ({
                settings: {
                    getExecutionDetails: () => ({
                        execCommand: ['python']
                    })
                }
            })
        };
        sandbox.stub(vscode.extensions, 'getExtension').returns(extension as any);

        const pythonPath = await getPythonPath();
        expect(pythonPath).to.equal('python');
        resetSandBox();
    });

    test('should read JSON file', () => {
        const filePath = 'test.json';
        const jsonData = { key: 'value' };
        sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(jsonData));

        const result = readJsonFile(filePath);
        expect(result).to.deep.equal(jsonData);
        resetSandBox();
    });

    test('should parse coverage', () => {
        const workspaceFolders = [{ uri: vscode.Uri.file('workspace') }];
        const coverageData = {
            files: {
                'file1.ts': {
                    executed_lines: [1, 2, 3],
                    excluded_lines: [4],
                    missing_lines: [5, 6],
                    executed_branches: [[1, 0], [2, 1]],
                    missing_branches: [[3, 0], [4, 1]],
                    summary: {
                        covered_lines: 3,
                        excluded_lines: 1,
                        missing_lines: 2,
                        branches_covered: 2,
                        branches_missed: 2,
                        percent_covered: 50,
                        num_statements: 6
                    }
                }
            },
            totals: {
                covered_lines: 3,
                excluded_lines: 1,
                missing_lines: 2,
                num_statements: 6,
                percent_covered: 50,
                covered_branches: 2,
                missing_branches: 2,
                num_branches: 4
            }
        };
        sandbox.reset();
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(workspaceFolders);
        sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(coverageData));

        const coverage = parseCoverage();
        expect(coverage.files).to.have.lengthOf(1);
        expect(coverage.totals.covered).to.equal(3);
        resetSandBox();
    });

    test('should get tests for a specific function', () => {
        const functionTests = {
            'function1': ['test1', 'test2'],
            'function2': ['test3']
        };

        const tests = getTestsForFunction('function1', functionTests);
        expect(tests).to.include.members(['test1', 'test2']);
    });
});