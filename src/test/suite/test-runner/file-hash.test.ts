import { expect } from 'chai';
import { getModifiedFiles, getWorkspaceHash, Hash, FilesDiff } from '../../../test-runner/file-hash';
import { assert } from 'console';

suite('FileHash Tests', () => {
    const oldHash: Hash = {
        'src/file1.ts': {
            hash: 'oldhash1',
            isTestFile: true,
            functions: {
                'function1': { hash: 'oldhash1' },
                'function2': { hash: 'oldhash2' }
            }
        },
        'src/file2.ts': {
            hash: 'oldhash2',
            isTestFile: false,
            functions: {
                'function3': { hash: 'oldhash3' }
            }
        }
    };

    const newHash: Hash = {
        'src/file1.ts': {
            hash: 'newhash1',
            isTestFile: true,
            functions: {
                'function1': { hash: 'newhash1' },
                'function2': { hash: 'oldhash2' },
                'function4': { hash: 'newhash4' }
            }
        },
        'src/file3.ts': {
            hash: 'newhash3',
            isTestFile: true,
            functions: {
                'function5': { hash: 'newhash5' }
            }
        }
    };

    test('should get modified files', () => {
        const modifiedFiles: FilesDiff = getModifiedFiles(oldHash, newHash);
        expect(modifiedFiles.added).to.have.property('src/file1.ts');
        expect(modifiedFiles.added['src/file1.ts'].functions).to.have.property('function1');
        expect(modifiedFiles.added['src/file1.ts'].functions).to.have.property('function4');
        expect(modifiedFiles.added).to.have.property('src/file3.ts');
        expect(modifiedFiles.deleted).to.have.property('src/file2.ts');
    });

    test('should get workspace hash', async () => {
        const workspaceHash = await getWorkspaceHash();
        assert(Object.keys(workspaceHash).length > 0);
    });
});