jest.mock('fs');

const fs = require('fs');
const {
    SMART_DEFAULTS,
    shouldIncludeFile,
    parseGitignore,
    getFilteredFiles,
} = require('./file-filter');

describe('file-filter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('SMART_DEFAULTS', () => {
        test('should be an array', () => {
            expect(Array.isArray(SMART_DEFAULTS)).toBe(true);
        });

        test('should contain directory patterns', () => {
            expect(SMART_DEFAULTS).toContain('node_modules/');
            expect(SMART_DEFAULTS).toContain('.git/');
            expect(SMART_DEFAULTS).toContain('dist/');
            expect(SMART_DEFAULTS).toContain('build/');
            expect(SMART_DEFAULTS).toContain('coverage/');
            expect(SMART_DEFAULTS).toContain('.nyc_output/');
            expect(SMART_DEFAULTS).toContain('.idea/');
            expect(SMART_DEFAULTS).toContain('.vscode/');
        });

        test('should contain glob patterns', () => {
            expect(SMART_DEFAULTS).toContain('.env*');
            expect(SMART_DEFAULTS).toContain('*.log');
        });

        test('should contain exact match patterns', () => {
            expect(SMART_DEFAULTS).toContain('.DS_Store');
            expect(SMART_DEFAULTS).toContain('package-lock.json');
            expect(SMART_DEFAULTS).toContain('yarn.lock');
            expect(SMART_DEFAULTS).toContain('pnpm-lock.yaml');
        });
    });

    describe('shouldIncludeFile', () => {
        describe('with smart defaults', () => {
            test('should return true for regular source files', () => {
                expect(shouldIncludeFile('src/index.js')).toBe(true);
                expect(shouldIncludeFile('lib/utils.js')).toBe(true);
                expect(shouldIncludeFile('README.md')).toBe(true);
            });

            test('should return false for node_modules directory', () => {
                expect(shouldIncludeFile('node_modules/pkg/index.js')).toBe(
                    false,
                );
                expect(shouldIncludeFile('node_modules/lodash/package.json')).toBe(
                    false,
                );
            });

            test('should return false for .git directory', () => {
                expect(shouldIncludeFile('.git/config')).toBe(false);
                expect(shouldIncludeFile('.git/HEAD')).toBe(false);
            });

            test('should return false for dist/build directories', () => {
                expect(shouldIncludeFile('dist/bundle.js')).toBe(false);
                expect(shouldIncludeFile('build/output.js')).toBe(false);
            });

            test('should return false for .env* files (glob prefix)', () => {
                expect(shouldIncludeFile('.env')).toBe(false);
                expect(shouldIncludeFile('.env.local')).toBe(false);
                expect(shouldIncludeFile('.envrc')).toBe(false);
                expect(shouldIncludeFile('src/.env.production')).toBe(false);
            });

            test('should return false for *.log files (glob suffix)', () => {
                expect(shouldIncludeFile('debug.log')).toBe(false);
                expect(shouldIncludeFile('error.log')).toBe(false);
                expect(shouldIncludeFile('logs/app.log')).toBe(false);
            });

            test('should return false for .DS_Store (exact match)', () => {
                expect(shouldIncludeFile('.DS_Store')).toBe(false);
                expect(shouldIncludeFile('folder/.DS_Store')).toBe(false);
            });

            test('should return false for coverage directories', () => {
                expect(shouldIncludeFile('coverage/lcov.info')).toBe(false);
                expect(shouldIncludeFile('.nyc_output/data.json')).toBe(false);
            });

            test('should return false for lock files', () => {
                expect(shouldIncludeFile('package-lock.json')).toBe(false);
                expect(shouldIncludeFile('yarn.lock')).toBe(false);
                expect(shouldIncludeFile('pnpm-lock.yaml')).toBe(false);
            });

            test('should return false for IDE directories', () => {
                expect(shouldIncludeFile('.idea/workspace.xml')).toBe(false);
                expect(shouldIncludeFile('.vscode/settings.json')).toBe(false);
            });
        });

        describe('with gitignore rules', () => {
            test('should return false for gitignore pattern *.secret', () => {
                const gitignoreRules = ['*.secret'];
                expect(
                    shouldIncludeFile('config.secret', gitignoreRules),
                ).toBe(false);
                expect(
                    shouldIncludeFile('api.secret', gitignoreRules),
                ).toBe(false);
            });

            test('should return false for gitignore directory pattern temp/', () => {
                const gitignoreRules = ['temp/'];
                expect(shouldIncludeFile('temp/file.txt', gitignoreRules)).toBe(
                    false,
                );
                expect(shouldIncludeFile('temp/nested/data.json', gitignoreRules)).toBe(
                    false,
                );
            });

            test('should return true when file does not match gitignore rules', () => {
                const gitignoreRules = ['*.secret', 'temp/'];
                expect(
                    shouldIncludeFile('src/config.js', gitignoreRules),
                ).toBe(true);
            });
        });

        describe('with combined filtering', () => {
            test('should apply both smart defaults and gitignore rules', () => {
                const gitignoreRules = ['*.secret'];

                // Excluded by smart defaults
                expect(
                    shouldIncludeFile('node_modules/pkg/index.js', gitignoreRules),
                ).toBe(false);

                // Excluded by gitignore
                expect(
                    shouldIncludeFile('config.secret', gitignoreRules),
                ).toBe(false);

                // Included (passes both)
                expect(
                    shouldIncludeFile('src/index.js', gitignoreRules),
                ).toBe(true);
            });
        });

        describe('path normalization', () => {
            test('should normalize Windows paths (backslash to forward slash)', () => {
                expect(shouldIncludeFile('node_modules\\pkg\\index.js')).toBe(
                    false,
                );
                expect(shouldIncludeFile('src\\utils\\helper.js')).toBe(true);
            });
        });
    });

    describe('parseGitignore', () => {
        test('should return array of patterns from .gitignore content', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('*.log\ntemp/\n.cache');

            const result = parseGitignore('/project/.gitignore');

            expect(result).toEqual(['*.log', 'temp/', '.cache']);
        });

        test('should filter out comments (lines starting with #)', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(
                '# This is a comment\n*.log\n# Another comment\ntemp/',
            );

            const result = parseGitignore('/project/.gitignore');

            expect(result).toEqual(['*.log', 'temp/']);
        });

        test('should filter out empty lines', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('*.log\n\n\ntemp/\n');

            const result = parseGitignore('/project/.gitignore');

            expect(result).toEqual(['*.log', 'temp/']);
        });

        test('should trim whitespace from patterns', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('  *.log  \n  temp/  ');

            const result = parseGitignore('/project/.gitignore');

            expect(result).toEqual(['*.log', 'temp/']);
        });

        test('should return empty array when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = parseGitignore('/project/.gitignore');

            expect(result).toEqual([]);
            expect(fs.readFileSync).not.toHaveBeenCalled();
        });

        test('should return empty array on read error (permission denied)', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('EACCES: permission denied');
            });

            const result = parseGitignore('/project/.gitignore');

            expect(result).toEqual([]);
        });
    });

    describe('getFilteredFiles', () => {
        test('should return array of file paths for valid directory', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockImplementation((p) => ({
                isDirectory: () =>
                    p === '/project' || p === '/project/src',
            }));
            fs.readdirSync.mockImplementation((p) => {
                if (p === '/project') return ['src', 'README.md'];
                if (p === '/project/src') return ['index.js', 'utils.js'];
                return [];
            });

            const result = getFilteredFiles('/project');

            expect(result).toContain('README.md');
            expect(result).toContain('src/index.js');
            expect(result).toContain('src/utils.js');
        });

        test('should apply smart defaults to filter files', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockImplementation((p) => ({
                isDirectory: () =>
                    p === '/project' || p === '/project/node_modules',
            }));
            fs.readdirSync.mockImplementation((p) => {
                if (p === '/project')
                    return ['src', 'node_modules', '.DS_Store'];
                if (p === '/project/node_modules') return ['lodash'];
                return [];
            });

            const result = getFilteredFiles('/project');

            // node_modules and .DS_Store should be filtered out
            expect(result).not.toContain('.DS_Store');
            expect(
                result.some((f) => f.includes('node_modules')),
            ).toBe(false);
        });

        test('should apply gitignore rules if .gitignore exists', () => {
            fs.existsSync.mockImplementation((_p) => true);
            fs.readFileSync.mockReturnValue('*.secret');
            fs.statSync.mockImplementation((_p) => ({
                isDirectory: () => _p === '/project',
            }));
            fs.readdirSync.mockReturnValue([
                'index.js',
                'config.secret',
                '.gitignore',
            ]);

            const result = getFilteredFiles('/project');

            expect(result).toContain('index.js');
            expect(result).not.toContain('config.secret');
        });

        test('should return empty array for empty directory', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readdirSync.mockReturnValue([]);

            const result = getFilteredFiles('/empty-dir');

            expect(result).toEqual([]);
        });

        test('should return empty array for non-existent directory', () => {
            fs.existsSync.mockReturnValue(false);

            const result = getFilteredFiles('/non-existent');

            expect(result).toEqual([]);
        });

        test('should handle nested directories recursively', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockImplementation((p) => ({
                isDirectory: () =>
                    p === '/project' ||
                    p === '/project/src' ||
                    p === '/project/src/utils',
            }));
            fs.readdirSync.mockImplementation((p) => {
                if (p === '/project') return ['src'];
                if (p === '/project/src') return ['utils', 'index.js'];
                if (p === '/project/src/utils') return ['helper.js'];
                return [];
            });

            const result = getFilteredFiles('/project');

            expect(result).toContain('src/index.js');
            expect(result).toContain('src/utils/helper.js');
        });

        test('should return empty array when path is not a directory', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isDirectory: () => false });

            const result = getFilteredFiles('/project/file.js');

            expect(result).toEqual([]);
        });

        test('should handle permission errors gracefully', () => {
            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation();

            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockImplementation((p) => {
                if (p === '/project') return { isDirectory: () => true };
                if (p === '/project/restricted')
                    throw new Error('EACCES: permission denied');
                return { isDirectory: () => false };
            });
            fs.readdirSync.mockReturnValue(['restricted', 'allowed.js']);

            const result = getFilteredFiles('/project');

            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(result).toContain('allowed.js');

            consoleWarnSpy.mockRestore();
        });
    });
});
