const path = require('path');

describe('State', () => {
    let state;
    let mockFs;
    let mockFindGitRoot;
    let mockLogger;

    beforeEach(() => {
    // Reset all modules and mocks
        jest.resetModules();

        // Create mock fs
        mockFs = {
            existsSync: jest.fn().mockReturnValue(true), // Default to paths existing
            mkdirSync: jest.fn(),
            readdirSync: jest.fn().mockReturnValue([]),
            statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
            renameSync: jest.fn(),
            cpSync: jest.fn(),
            rmSync: jest.fn(),
            copyFileSync: jest.fn(),
            unlinkSync: jest.fn(),
        };

        // Create mock findGitRoot
        mockFindGitRoot = jest.fn().mockReturnValue('/test/git-root');

        // Create mock logger
        mockLogger = {
            warning: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
        };

        // Mock modules
        jest.doMock('fs', () => mockFs);
        jest.doMock('../services/git-detector', () => ({
            findGitRoot: mockFindGitRoot,
        }));
        jest.doMock('../utils/logger', () => mockLogger);

        // Now require state with mocked dependencies
        state = require('./state');
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('setFolder', () => {
        test('should set folder and claudiomiro folder paths', () => {
            state.setFolder('/test/project');

            expect(state.folder).toBe(path.resolve('/test/project'));
            expect(state.claudiomiroFolder).toBe(path.join(path.resolve('/test/project'), '.claudiomiro', 'task-executor'));
            expect(state.workspaceClaudiomiroFolder).toBe(path.join(path.resolve('/test/project'), '.claudiomiro', 'task-executor'));
        });

        test('should migrate legacy claudiomiro layout into task-executor subfolder', () => {
            const projectFolder = '/test/project';
            const resolvedProject = path.resolve(projectFolder);
            const claudiomiroRoot = path.join(resolvedProject, '.claudiomiro');
            const taskExecutorFolder = path.join(claudiomiroRoot, 'task-executor');

            mockFs.existsSync.mockImplementation((p) => {
                if (!p) return false;
                if (p === claudiomiroRoot) return true;
                if (p === taskExecutorFolder) return false;
                if (p === path.join(claudiomiroRoot, 'AI_PROMPT.md')) return true;
                if (p === path.join(claudiomiroRoot, 'TASK1')) return true;
                if (p === path.join(claudiomiroRoot, 'cache')) return true;
                return false;
            });

            mockFs.readdirSync.mockReturnValue(['AI_PROMPT.md', 'TASK1', 'cache', 'token-optimizer']);
            mockFs.statSync.mockImplementation((p) => ({
                isDirectory: () => p.endsWith('TASK1') || p.endsWith('cache'),
            }));

            state.setFolder(projectFolder);

            expect(mockFs.mkdirSync).toHaveBeenCalledWith(taskExecutorFolder, { recursive: true });
            expect(mockFs.renameSync).toHaveBeenCalledWith(
                path.join(claudiomiroRoot, 'AI_PROMPT.md'),
                path.join(taskExecutorFolder, 'AI_PROMPT.md'),
            );
            expect(mockFs.renameSync).toHaveBeenCalledWith(
                path.join(claudiomiroRoot, 'TASK1'),
                path.join(taskExecutorFolder, 'TASK1'),
            );
            expect(mockFs.renameSync).toHaveBeenCalledWith(
                path.join(claudiomiroRoot, 'cache'),
                path.join(taskExecutorFolder, 'cache'),
            );
            expect(mockFs.renameSync).not.toHaveBeenCalledWith(
                path.join(claudiomiroRoot, 'token-optimizer'),
                expect.any(String),
            );
            expect(state.claudiomiroFolder).toBe(taskExecutorFolder);
            expect(mockLogger.info).toHaveBeenCalledWith('Migrated legacy .claudiomiro session into .claudiomiro/task-executor');
        });

        test('should fall back to legacy root when migration fails', () => {
            const projectFolder = '/legacy/failure';
            const resolvedProject = path.resolve(projectFolder);
            const claudiomiroRoot = path.join(resolvedProject, '.claudiomiro');
            const taskExecutorFolder = path.join(claudiomiroRoot, 'task-executor');

            mockFs.existsSync.mockImplementation((p) => {
                if (!p) return false;
                if (p === claudiomiroRoot) return true;
                if (p === taskExecutorFolder) return false;
                if (p === path.join(claudiomiroRoot, 'AI_PROMPT.md')) return true;
                return false;
            });

            mockFs.readdirSync.mockReturnValue(['AI_PROMPT.md']);
            mockFs.mkdirSync.mockImplementation((p) => {
                if (p === taskExecutorFolder) {
                    throw new Error('migration-failed');
                }
            });

            state.setFolder(projectFolder);

            expect(state.claudiomiroFolder).toBe(claudiomiroRoot);
            expect(mockLogger.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to migrate legacy .claudiomiro layout'));
        });

        test('should resolve relative paths', () => {
            state.setFolder('./relative');

            expect(path.isAbsolute(state.folder)).toBe(true);
        });
    });

    describe('cacheFolder', () => {
        test('should return cache folder path', () => {
            state.setFolder('/test/project');

            expect(state.cacheFolder).toBe(path.join('/test/project', '.claudiomiro', 'task-executor', 'cache'));
        });
    });

    describe('initializeCache', () => {
        test('should do nothing if claudiomiro folder not set', () => {
            // Don't call setFolder - _claudiomiroFolder is null
            state.initializeCache();

            expect(mockFs.existsSync).not.toHaveBeenCalled();
            expect(mockFs.mkdirSync).not.toHaveBeenCalled();
        });

        test('should create cache folder if it does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            state.setFolder('/test/project');
            state.initializeCache();

            expect(mockFs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('cache'),
                { recursive: true },
            );
        });

        test('should not create cache folder if it already exists', () => {
            mockFs.existsSync.mockReturnValue(true);

            state.setFolder('/test/project');
            state.initializeCache();

            expect(mockFs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('hasCacheFolder', () => {
        test('should return true if cache folder exists', () => {
            mockFs.existsSync.mockReturnValue(true);

            state.setFolder('/test/project');

            expect(state.hasCacheFolder()).toBe(true);
            expect(mockFs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('cache'),
            );
        });

        test('should return false if cache folder does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            state.setFolder('/test/project');

            expect(state.hasCacheFolder()).toBe(false);
        });
    });

    describe('setExecutorType', () => {
        test('should set valid executor type', () => {
            state.setExecutorType('claude');
            expect(state.executorType).toBe('claude');

            state.setExecutorType('codex');
            expect(state.executorType).toBe('codex');

            state.setExecutorType('deep-seek');
            expect(state.executorType).toBe('deep-seek');

            state.setExecutorType('glm');
            expect(state.executorType).toBe('glm');

            state.setExecutorType('gemini');
            expect(state.executorType).toBe('gemini');
        });

        test('should throw error for invalid executor type', () => {
            expect(() => state.setExecutorType('invalid')).toThrow('Invalid executor type: invalid');
        });
    });

    describe('executorType', () => {
        test('should default to claude', () => {
            expect(state.executorType).toBe('claude');
        });
    });

    describe('multi-repo support', () => {
        const backendPath = '/test/backend';
        const frontendPath = '/test/frontend';
        const gitConfig = {
            mode: 'monorepo',
            gitRoots: ['/test/root'],
        };

        describe('isMultiRepo', () => {
            test('should return false by default', () => {
                expect(state.isMultiRepo()).toBe(false);
            });

            test('should return true after setMultiRepo is called', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                expect(state.isMultiRepo()).toBe(true);
            });
        });

        describe('setMultiRepo', () => {
            test('should set all multi-repo properties', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);

                expect(state.isMultiRepo()).toBe(true);
                expect(state.getGitMode()).toBe('monorepo');
                expect(state.getGitRoots()).toEqual(['/test/root']);
            });

            test('should resolve backend and frontend paths', () => {
                state.setMultiRepo('./backend', './frontend', gitConfig);

                expect(path.isAbsolute(state.getRepository('backend'))).toBe(true);
                expect(path.isAbsolute(state.getRepository('frontend'))).toBe(true);
            });

            test('should call setFolder with backend path', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);

                expect(state.folder).toBe(path.resolve(backendPath));
            });

            test('should work with separate mode', () => {
                const separateConfig = {
                    mode: 'separate',
                    gitRoots: ['/test/backend', '/test/frontend'],
                };
                state.setMultiRepo(backendPath, frontendPath, separateConfig);

                expect(state.getGitMode()).toBe('separate');
                expect(state.getGitRoots()).toEqual(['/test/backend', '/test/frontend']);
            });

            test('should preserve initial workspace folder when switching repositories', () => {
                state.setFolder('/workspace/root');
                state.setMultiRepo(backendPath, frontendPath, gitConfig);

                expect(state.workspaceRoot).toBe(path.resolve('/workspace/root'));
                expect(state.folder).toBe(path.resolve(backendPath));
            });

            test('should throw error if backend path does not exist', () => {
                mockFs.existsSync.mockImplementation((p) => {
                    return !p.includes('backend');
                });

                expect(() => state.setMultiRepo(backendPath, frontendPath, gitConfig))
                    .toThrow('Backend path does not exist');
            });

            test('should throw error if frontend path does not exist', () => {
                mockFs.existsSync.mockImplementation((p) => {
                    return !p.includes('frontend');
                });

                expect(() => state.setMultiRepo(backendPath, frontendPath, gitConfig))
                    .toThrow('Frontend path does not exist');
            });

            test('should throw error if backend is not a git repository', () => {
                mockFindGitRoot.mockImplementation((p) => {
                    return p.includes('backend') ? null : '/test/git-root';
                });

                expect(() => state.setMultiRepo(backendPath, frontendPath, gitConfig))
                    .toThrow('Backend path is not a git repository');
            });

            test('should throw error if frontend is not a git repository', () => {
                mockFindGitRoot.mockImplementation((p) => {
                    return p.includes('frontend') ? null : '/test/git-root';
                });

                expect(() => state.setMultiRepo(backendPath, frontendPath, gitConfig))
                    .toThrow('Frontend path is not a git repository');
            });
        });

        describe('getRepository', () => {
            test('should return backend path for backend scope', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                expect(state.getRepository('backend')).toBe(path.resolve(backendPath));
            });

            test('should return frontend path for frontend scope', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                expect(state.getRepository('frontend')).toBe(path.resolve(frontendPath));
            });

            test('should return primary folder for integration scope', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                expect(state.getRepository('integration')).toBe(path.resolve(backendPath));
            });

            test('should return primary folder for unknown scope', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                expect(state.getRepository('unknown')).toBe(path.resolve(backendPath));
            });

            test('should log warning for unknown scope in multi-repo mode', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                state.getRepository('typo-scope');

                expect(mockLogger.warning).toHaveBeenCalledWith(
                    expect.stringContaining('Unknown scope "typo-scope"'),
                );
            });

            test('should not log warning for valid scopes', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);

                state.getRepository('backend');
                state.getRepository('frontend');
                state.getRepository('integration');

                expect(mockLogger.warning).not.toHaveBeenCalled();
            });

            test('should return _folder in single-repo mode', () => {
                state.setFolder('/test/project');
                expect(state.getRepository('backend')).toBe(path.resolve('/test/project'));
            });
        });

        describe('getGitMode', () => {
            test('should return null by default', () => {
                expect(state.getGitMode()).toBe(null);
            });

            test('should return monorepo when configured', () => {
                state.setMultiRepo(backendPath, frontendPath, { mode: 'monorepo', gitRoots: [] });
                expect(state.getGitMode()).toBe('monorepo');
            });

            test('should return separate when configured', () => {
                state.setMultiRepo(backendPath, frontendPath, { mode: 'separate', gitRoots: [] });
                expect(state.getGitMode()).toBe('separate');
            });
        });

        describe('getGitRoots', () => {
            test('should return empty array by default', () => {
                expect(state.getGitRoots()).toEqual([]);
            });

            test('should return git roots after setMultiRepo', () => {
                const gitRoots = ['/root1', '/root2'];
                state.setMultiRepo(backendPath, frontendPath, { mode: 'monorepo', gitRoots });
                expect(state.getGitRoots()).toEqual(gitRoots);
            });
        });

        describe('backward compatibility', () => {
            test('existing single-repo methods still work after multi-repo setup', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);

                expect(state.folder).toBe(path.resolve(backendPath));
                expect(state.claudiomiroFolder).toBe(path.join(path.resolve(backendPath), '.claudiomiro', 'task-executor'));
            });

            test('setFolder still works independently', () => {
                state.setFolder('/test/project');

                expect(state.folder).toBe(path.resolve('/test/project'));
                expect(state.isMultiRepo()).toBe(false);
            });
        });
    });

    describe('legacy systems support', () => {
        describe('hasLegacySystems', () => {
            test('should return false by default', () => {
                expect(state.hasLegacySystems()).toBe(false);
            });

            test('should return true when any legacy system configured', () => {
                state.setLegacySystems({ system: '/test/legacy' });
                expect(state.hasLegacySystems()).toBe(true);
            });

            test('should return false after clearing (set empty object)', () => {
                state.setLegacySystems({ system: '/test/legacy' });
                state.setLegacySystems({});
                expect(state.hasLegacySystems()).toBe(false);
            });
        });

        describe('setLegacySystems', () => {
            test('should set single legacy system path', () => {
                state.setLegacySystems({ system: '/test/legacy' });
                expect(state.getLegacySystem('system')).toBe(path.resolve('/test/legacy'));
            });

            test('should set multiple legacy system paths', () => {
                state.setLegacySystems({
                    system: '/test/system',
                    backend: '/test/backend',
                    frontend: '/test/frontend',
                });
                expect(state.getLegacySystem('system')).toBe(path.resolve('/test/system'));
                expect(state.getLegacySystem('backend')).toBe(path.resolve('/test/backend'));
                expect(state.getLegacySystem('frontend')).toBe(path.resolve('/test/frontend'));
            });

            test('should clear previous configuration when called again', () => {
                state.setLegacySystems({ system: '/test/first' });
                state.setLegacySystems({ backend: '/test/second' });
                expect(state.getLegacySystem('system')).toBe(null);
                expect(state.getLegacySystem('backend')).toBe(path.resolve('/test/second'));
            });

            test('should skip falsy values', () => {
                state.setLegacySystems({
                    system: '/test/system',
                    backend: null,
                    frontend: '',
                });
                expect(state.getLegacySystem('system')).toBe(path.resolve('/test/system'));
                expect(state.getLegacySystem('backend')).toBe(null);
                expect(state.getLegacySystem('frontend')).toBe(null);
            });

            test('should resolve relative paths', () => {
                state.setLegacySystems({ system: './relative/path' });
                expect(path.isAbsolute(state.getLegacySystem('system'))).toBe(true);
            });

            test('should throw error if path does not exist', () => {
                mockFs.existsSync.mockImplementation((p) => {
                    return !p.includes('nonexistent');
                });

                expect(() => state.setLegacySystems({ system: '/nonexistent/path' }))
                    .toThrow('Legacy system path does not exist');
            });

            test('should NOT require paths to be git repositories', () => {
                // Path exists but is not a git repo
                mockFindGitRoot.mockReturnValue(null);

                // Should not throw - no git validation for legacy systems
                expect(() => state.setLegacySystems({ system: '/test/non-git-folder' }))
                    .not.toThrow();
            });
        });

        describe('getLegacySystem', () => {
            test('should return path for configured type', () => {
                state.setLegacySystems({ backend: '/test/backend' });
                expect(state.getLegacySystem('backend')).toBe(path.resolve('/test/backend'));
            });

            test('should return null for unconfigured type', () => {
                state.setLegacySystems({ system: '/test/system' });
                expect(state.getLegacySystem('backend')).toBe(null);
            });

            test('should return null for unknown type', () => {
                state.setLegacySystems({ system: '/test/system' });
                expect(state.getLegacySystem('invalid')).toBe(null);
            });
        });

        describe('getAllLegacySystems', () => {
            test('should return empty Map by default', () => {
                expect(state.getAllLegacySystems().size).toBe(0);
            });

            test('should return Map with all configured systems', () => {
                state.setLegacySystems({
                    system: '/test/system',
                    backend: '/test/backend',
                });

                const allSystems = state.getAllLegacySystems();
                expect(allSystems.size).toBe(2);
                expect(allSystems.get('system')).toBe(path.resolve('/test/system'));
                expect(allSystems.get('backend')).toBe(path.resolve('/test/backend'));
            });

            test('should return Map copy (not reference)', () => {
                state.setLegacySystems({ system: '/test/system' });

                const allSystems = state.getAllLegacySystems();
                allSystems.set('hacked', '/hacked/path');

                // Internal state should not be affected
                expect(state.getLegacySystem('hacked')).toBe(null);
            });
        });

        describe('independence from multi-repo', () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';
            const gitConfig = { mode: 'monorepo', gitRoots: ['/test/root'] };

            test('legacy systems work independently of multi-repo mode', () => {
                state.setLegacySystems({ system: '/test/legacy' });

                expect(state.hasLegacySystems()).toBe(true);
                expect(state.isMultiRepo()).toBe(false);
            });

            test('both features can be used together', () => {
                state.setMultiRepo(backendPath, frontendPath, gitConfig);
                state.setLegacySystems({ system: '/test/legacy-system' });

                expect(state.isMultiRepo()).toBe(true);
                expect(state.hasLegacySystems()).toBe(true);
                expect(state.getRepository('backend')).toBe(path.resolve(backendPath));
                expect(state.getLegacySystem('system')).toBe(path.resolve('/test/legacy-system'));
            });
        });
    });
});
