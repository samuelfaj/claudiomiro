const path = require('path');

describe('State', () => {
    let state;
    let mockFs;

    beforeEach(() => {
    // Reset all modules and mocks
        jest.resetModules();

        // Create mock fs
        mockFs = {
            existsSync: jest.fn(),
            mkdirSync: jest.fn(),
        };

        // Mock fs module
        jest.doMock('fs', () => mockFs);

        // Now require state with mocked fs
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
            expect(state.claudiomiroFolder).toBe(path.join(path.resolve('/test/project'), '.claudiomiro'));
        });

        test('should resolve relative paths', () => {
            state.setFolder('./relative');

            expect(path.isAbsolute(state.folder)).toBe(true);
        });
    });

    describe('cacheFolder', () => {
        test('should return cache folder path', () => {
            state.setFolder('/test/project');

            expect(state.cacheFolder).toBe(path.join('/test/project', '.claudiomiro', 'cache'));
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
                expect(state.claudiomiroFolder).toBe(path.join(path.resolve(backendPath), '.claudiomiro'));
            });

            test('setFolder still works independently', () => {
                state.setFolder('/test/project');

                expect(state.folder).toBe(path.resolve('/test/project'));
                expect(state.isMultiRepo()).toBe(false);
            });
        });
    });
});
