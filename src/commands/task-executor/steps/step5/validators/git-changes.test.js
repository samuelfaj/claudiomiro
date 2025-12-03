const {
    verifyChanges,
    getGitModifiedFiles,
    normalizePath,
} = require('./git-changes');

// Mock dependencies
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

jest.mock('util', () => ({
    promisify: jest.fn((fn) => fn),
}));

jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
}));

describe('verify-changes', () => {
    describe('normalizePath', () => {
        test('should remove leading ./', () => {
            expect(normalizePath('./src/file.js')).toBe('src/file.js');
        });

        test('should convert backslashes to forward slashes', () => {
            expect(normalizePath('src\\file.js')).toBe('src/file.js');
        });

        test('should trim whitespace', () => {
            expect(normalizePath('  src/file.js  ')).toBe('src/file.js');
        });

        test('should handle already normalized paths', () => {
            expect(normalizePath('src/file.js')).toBe('src/file.js');
        });
    });

    describe('getGitModifiedFiles', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should return combined staged and unstaged files', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: 'src/file1.js\nsrc/file2.js\n', stderr: '' };
                } else {
                    return { stdout: 'src/file3.js\n', stderr: '' };
                }
            });

            const files = await getGitModifiedFiles('/project');

            expect(files).toEqual([
                'src/file1.js',
                'src/file2.js',
                'src/file3.js',
            ]);
        });

        test('should deduplicate files appearing in both staged and unstaged', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: 'src/file1.js\nsrc/file2.js\n', stderr: '' };
                } else {
                    return { stdout: 'src/file2.js\nsrc/file3.js\n', stderr: '' };
                }
            });

            const files = await getGitModifiedFiles('/project');

            expect(files).toEqual([
                'src/file1.js',
                'src/file2.js',
                'src/file3.js',
            ]);
        });

        test('should handle empty git output', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (_cmd, _opts) => {
                return { stdout: '', stderr: '' };
            });

            const files = await getGitModifiedFiles('/project');

            expect(files).toEqual([]);
        });

        test('should handle git command errors gracefully', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (_cmd, _opts) => {
                throw new Error('Not a git repository');
            });

            const files = await getGitModifiedFiles('/project');

            expect(files).toEqual([]);
        });
    });

    describe('verifyChanges', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should return valid=true when git changes match artifacts', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: 'src/file1.js\n', stderr: '' };
                } else {
                    return { stdout: 'src/file2.js\n', stderr: '' };
                }
            });

            const execution = {
                artifacts: [
                    { type: 'modified', path: 'src/file1.js', verified: true },
                    { type: 'modified', path: 'src/file2.js', verified: true },
                ],
            };

            const result = await verifyChanges(execution, '/project');

            expect(result.valid).toBe(true);
            expect(result.undeclared).toEqual([]);
            expect(result.missing).toEqual([]);
        });

        test('should detect undeclared changes (git has files not in artifacts)', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: 'src/file1.js\nsrc/file2.js\n', stderr: '' };
                } else {
                    return { stdout: '', stderr: '' };
                }
            });

            const execution = {
                artifacts: [
                    { type: 'modified', path: 'src/file1.js', verified: true },
                    // file2.js is missing from artifacts
                ],
            };

            const result = await verifyChanges(execution, '/project');

            expect(result.valid).toBe(false);
            expect(result.undeclared).toEqual(['src/file2.js']);
            expect(result.missing).toEqual([]);
        });

        test('should detect missing changes (artifacts has files not in git)', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: 'src/file1.js\n', stderr: '' };
                } else {
                    return { stdout: '', stderr: '' };
                }
            });

            const execution = {
                artifacts: [
                    { type: 'modified', path: 'src/file1.js', verified: true },
                    { type: 'modified', path: 'src/file2.js', verified: true },
                    // file2.js is not actually modified in git
                ],
            };

            const result = await verifyChanges(execution, '/project');

            expect(result.valid).toBe(false);
            expect(result.undeclared).toEqual([]);
            expect(result.missing).toEqual(['src/file2.js']);
        });

        test('should handle empty artifacts array', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (_cmd, _opts) => {
                return { stdout: '', stderr: '' };
            });

            const execution = {
                artifacts: [],
            };

            const result = await verifyChanges(execution, '/project');

            expect(result.valid).toBe(true);
            expect(result.actualChanges).toEqual([]);
            expect(result.declaredChanges).toEqual([]);
        });

        test('should ignore deleted artifacts in comparison', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: 'src/file1.js\n', stderr: '' };
                } else {
                    return { stdout: '', stderr: '' };
                }
            });

            const execution = {
                artifacts: [
                    { type: 'modified', path: 'src/file1.js', verified: true },
                    { type: 'deleted', path: 'src/old.js', verified: true },
                ],
            };

            const result = await verifyChanges(execution, '/project');

            expect(result.valid).toBe(true);
            expect(result.declaredChanges).toEqual(['src/file1.js']);
        });

        test('should normalize paths for comparison', async () => {
            const { exec } = require('child_process');

            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('--cached')) {
                    return { stdout: './src/file1.js\n', stderr: '' };
                } else {
                    return { stdout: '', stderr: '' };
                }
            });

            const execution = {
                artifacts: [
                    { type: 'modified', path: 'src/file1.js', verified: true },
                ],
            };

            const result = await verifyChanges(execution, '/project');

            expect(result.valid).toBe(true);
        });
    });
});
