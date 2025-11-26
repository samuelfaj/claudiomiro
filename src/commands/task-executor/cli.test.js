// Store original process.exit
const originalExit = process.exit;

describe('src/commands/task-executor/cli.js', () => {
    let fs;
    let logger;
    let state;
    let startFresh;
    let step0;
    let cliModule;

    beforeEach(() => {
        // Reset modules to ensure fresh mocks
        jest.resetModules();

        // Setup mocks BEFORE requiring the module
        jest.doMock('fs');
        jest.doMock('../../shared/utils/logger', () => ({
            banner: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
            success: jest.fn(),
            path: jest.fn(),
            newline: jest.fn(),
            startSpinner: jest.fn(),
            confirm: jest.fn().mockResolvedValue(true),
            step: jest.fn()
        }));

        jest.doMock('../../shared/config/state', () => {
            const path = require('path');
            const mockState = {
                _folder: null,
                _claudiomiroFolder: null,
                _executorType: 'claude',
                setFolder: jest.fn(function(folderPath) {
                    this._folder = path.resolve(folderPath);
                    this._claudiomiroFolder = path.join(this._folder, '.claudiomiro');
                }),
                get folder() { return this._folder; },
                get claudiomiroFolder() { return this._claudiomiroFolder; },
                setExecutorType: jest.fn(function(type) {
                    this._executorType = type;
                }),
                get executorType() { return this._executorType; }
            };
            return mockState;
        });

        jest.doMock('./services/file-manager', () => ({
            startFresh: jest.fn()
        }));

        jest.doMock('./steps', () => ({
            step0: jest.fn().mockResolvedValue(undefined),
            step1: jest.fn().mockResolvedValue(undefined),
            step2: jest.fn().mockResolvedValue(undefined),
            step3: jest.fn().mockResolvedValue(undefined),
            step4: jest.fn().mockResolvedValue(undefined),
            step5: jest.fn().mockResolvedValue(undefined),
            step6: jest.fn().mockResolvedValue(undefined),
            step7: jest.fn().mockResolvedValue(undefined),
            step8: jest.fn().mockResolvedValue(undefined)
        }));

        jest.doMock('./services/dag-executor', () => ({
            DAGExecutor: jest.fn().mockImplementation(() => ({
                run: jest.fn().mockResolvedValue(undefined),
                runStep2: jest.fn().mockResolvedValue(undefined)
            }))
        }));

        jest.doMock('./utils/validation', () => ({
            isFullyImplemented: jest.fn().mockReturnValue(true),
            hasApprovedCodeReview: jest.fn().mockReturnValue(true)
        }));

        // Now require modules
        fs = require('fs');
        logger = require('../../shared/utils/logger');
        state = require('../../shared/config/state');
        startFresh = require('./services/file-manager').startFresh;
        step0 = require('./steps').step0;
        cliModule = require('./cli');

        // Mock process.exit
        process.exit = jest.fn();

        // Reset state
        state._folder = null;
        state._claudiomiroFolder = null;
        state._executorType = 'claude';

        // Default fs mock: folder exists, claudiomiro folder does not exist
        fs.existsSync = jest.fn((p) => {
            if (p && p.includes('.claudiomiro')) return false;
            return true;
        });
        fs.readdirSync = jest.fn().mockReturnValue([]);
        fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => true });
        fs.readFileSync = jest.fn().mockReturnValue('');
    });

    afterEach(() => {
        process.exit = originalExit;
        jest.resetModules();
    });

    describe('init()', () => {
        test('should set folder from args', async () => {
            await cliModule.init(['/test/folder']);

            expect(state.setFolder).toHaveBeenCalledWith('/test/folder');
        });

        test('should default folder to process.cwd() when not provided', async () => {
            await cliModule.init([]);

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should exit with error if folder does not exist', async () => {
            fs.existsSync = jest.fn().mockReturnValue(false);

            await cliModule.init(['/nonexistent/folder']);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Folder does not exist'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should parse --steps=0,1,2 flag correctly', async () => {
            await cliModule.init(['.', '--steps=0,1,2']);

            expect(logger.info).toHaveBeenCalledWith('Running only steps: 0, 1, 2');
        });
    });

    describe('executor type parsing', () => {
        test('should default to claude executor', async () => {
            await cliModule.init(['.']);

            expect(state.setExecutorType).toHaveBeenCalledWith('claude');
            expect(logger.info).toHaveBeenCalledWith('Executor selected: claude');
        });

        test('should set codex executor when --codex flag is passed', async () => {
            await cliModule.init(['.', '--codex']);

            expect(state.setExecutorType).toHaveBeenCalledWith('codex');
            expect(logger.info).toHaveBeenCalledWith('Executor selected: codex');
        });

        test('should set deep-seek executor when --deep-seek flag is passed', async () => {
            await cliModule.init(['.', '--deep-seek']);

            expect(state.setExecutorType).toHaveBeenCalledWith('deep-seek');
        });

        test('should set glm executor when --glm flag is passed', async () => {
            await cliModule.init(['.', '--glm']);

            expect(state.setExecutorType).toHaveBeenCalledWith('glm');
        });

        test('should set gemini executor when --gemini flag is passed', async () => {
            await cliModule.init(['.', '--gemini']);

            expect(state.setExecutorType).toHaveBeenCalledWith('gemini');
        });
    });

    describe('--fresh flag', () => {
        test('should call startFresh when --fresh flag is passed', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p && p.includes('done.txt')) return true;
                if (p && p.includes('.claudiomiro')) return true;
                return true;
            });
            fs.readdirSync = jest.fn().mockReturnValue([]);

            await cliModule.init(['.', '--fresh']);

            expect(startFresh).toHaveBeenCalled();
        });
    });

    describe('exports', () => {
        test('should export init function', () => {
            expect(cliModule.init).toBeDefined();
            expect(typeof cliModule.init).toBe('function');
        });
    });
});
