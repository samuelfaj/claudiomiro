jest.mock('child_process');

const { execSync } = require('child_process');
const { findGitRoot, detectGitConfiguration } = require('./git-detector');

describe('git-detector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findGitRoot', () => {
        test('should return git root for valid directory', () => {
            execSync.mockReturnValue('/path/to/repo\n');

            const result = findGitRoot('/path/to/repo/src');

            expect(result).toBe('/path/to/repo');
            expect(execSync).toHaveBeenCalledWith(
                'git rev-parse --show-toplevel',
                expect.objectContaining({
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }),
            );
        });

        test('should return null for non-git directory', () => {
            execSync.mockImplementation(() => {
                throw new Error('fatal: not a git repository');
            });

            const result = findGitRoot('/not/a/git/repo');

            expect(result).toBeNull();
        });

        test('should trim whitespace from git root path', () => {
            execSync.mockReturnValue('  /path/to/repo  \n');

            const result = findGitRoot('/path/to/repo/src');

            expect(result).toBe('/path/to/repo');
        });

        test('should resolve relative paths before calling git', () => {
            execSync.mockReturnValue('/absolute/path\n');

            findGitRoot('./relative/path');

            expect(execSync).toHaveBeenCalledWith(
                'git rev-parse --show-toplevel',
                expect.objectContaining({
                    cwd: expect.stringMatching(/^\/.*relative\/path$/),
                }),
            );
        });
    });

    describe('detectGitConfiguration', () => {
        test('should return monorepo mode when same git root', () => {
            execSync.mockReturnValue('/monorepo\n');

            const result = detectGitConfiguration('/monorepo/backend', '/monorepo/frontend');

            expect(result).toEqual({
                mode: 'monorepo',
                gitRoots: ['/monorepo'],
            });
        });

        test('should return separate mode when different git roots', () => {
            execSync
                .mockReturnValueOnce('/backend-repo\n')
                .mockReturnValueOnce('/frontend-repo\n');

            const result = detectGitConfiguration('/backend-repo/src', '/frontend-repo/src');

            expect(result).toEqual({
                mode: 'separate',
                gitRoots: ['/backend-repo', '/frontend-repo'],
            });
        });

        test('should throw error when backend is not in git repo', () => {
            execSync
                .mockImplementationOnce(() => {
                    throw new Error('fatal: not a git repository');
                })
                .mockReturnValueOnce('/frontend-repo\n');

            expect(() => {
                detectGitConfiguration('/not-git/backend', '/frontend-repo/src');
            }).toThrow('Both paths must be inside git repositories');
        });

        test('should throw error when frontend is not in git repo', () => {
            execSync
                .mockReturnValueOnce('/backend-repo\n')
                .mockImplementationOnce(() => {
                    throw new Error('fatal: not a git repository');
                });

            expect(() => {
                detectGitConfiguration('/backend-repo/src', '/not-git/frontend');
            }).toThrow('Both paths must be inside git repositories');
        });

        test('should throw error when both paths are not in git repos', () => {
            execSync.mockImplementation(() => {
                throw new Error('fatal: not a git repository');
            });

            expect(() => {
                detectGitConfiguration('/not-git/backend', '/not-git/frontend');
            }).toThrow('Both paths must be inside git repositories');
        });
    });
});
