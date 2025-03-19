import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as sqlite3 from 'sqlite3';
import { getPytestResult } from '../../../test-runner/parser';
import { TestResult } from '../../../test-runner/results';

suite('Parser Tests', () => {
    let sandbox: sinon.SinonSandbox;

    suiteSetup(() => {
        sandbox = sinon.createSandbox();
    });

    suiteTeardown(() => {
        sandbox.restore();
    });

    test('should get pytest result', async () => {
        const workspaceFolders = [{ uri: { fsPath: 'workspace' } }];
        const pytestOutput = {
            tests: [
                {
                    nodeid: 'src/file1.test.ts::testFunction1',
                    lineno: 10,
                    outcome: 'passed',
                    setup: { duration: 0.1, outcome: 'passed' },
                    call: { duration: 0.2, outcome: 'passed' },
                    teardown: { duration: 0.1, outcome: 'passed' }
                }
            ]
        };
        const pytestResult: TestResult = {
            'src/file1.test.ts': {
                'testFunction1': {
                    passed: true,
                    time: 0.2,
                    lineNo: '10',
                    filePath: 'src/file1.test.ts',
                    testName: 'testFunction1',
                    errorMessage: undefined
                }
            }
        };

        sandbox.stub(vscode.workspace, 'workspaceFolders').value(workspaceFolders);
        sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(pytestOutput));
        sandbox.stub(fs, 'unlinkSync').returns(undefined);
        sandbox.stub(sqlite3, 'Database').returns({
            all: (stmt: string, params: any[], callback: (err: Error | null, rows: any[]) => void) => {
                callback(null, []);
            },
            close: (callback: (err: Error | null) => void) => {
                callback(null);
            }
        } as any);

        const result = await getPytestResult();
        expect(result).to.deep.equal(pytestResult);
    });
});