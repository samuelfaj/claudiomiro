// Mock all dependencies BEFORE requiring the module
jest.mock('fs');
jest.mock('../../shared/utils/logger', () => ({
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

jest.mock('../../shared/config/state', () => {
    const mockState = {
        _folder: null,
        _claudiomiroFolder: null,
        _executorType: 'claude',
        setFolder: jest.fn(function(folderPath) {
            const path = require('path');
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

jest.mock('./services/file-manager', () => ({
    startFresh: jest.fn()
}));

jest.mock('./steps', () => ({
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

jest.mock('./services/dag-executor', () => ({
    DAGExecutor: jest.fn().mockImplementation(() => ({
        run: jest.fn().mockResolvedValue(undefined),
        runStep2: jest.fn().mockResolvedValue(undefined)
    }))
}));

jest.mock('./utils/validation', () => ({
    isFullyImplemented: jest.fn().mockReturnValue(true),
    hasApprovedCodeReview: jest.fn().mockReturnValue(true)
}));

const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { startFresh } = require('./services/file-manager');

// Store original process.exit
const originalExit = process.exit;

describe('src/commands/task-executor/cli.js', () => {
    let cliModule;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock process.exit
        process.exit = jest.fn();

        // Reset state
        state._folder = null;
        state._claudiomiroFolder = null;
        state._executorType = 'claude';

        // Default fs mock: folder exists, claudiomiro folder does not exist
        fs.existsSync = jest.fn((p) => {
            if (p.endsWith('.claudiomiro')) return false;
            return true; // folder exists
        });
        fs.readdirSync = jest.fn().mockReturnValue([]);
        fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => true });
        fs.readFileSync = jest.fn().mockReturnValue('');

        // Clear module cache and re-require
        jest.resetModules();
        cliModule = require('./cli');
    });

    afterEach(() => {
        process.exit = originalExit;
    });

    describe('init()', () => {
        test('should set folder from args', async () => {
            // Mock: no claudiomiro folder yet, step0 returns done
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['/test/folder']);

            expect(state.setFolder).toHaveBeenCalledWith('/test/folder');
        });

        test('should default folder to process.cwd() when not provided', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init([]);

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should call step0 when claudiomiro folder does not exist', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            const { step0 } = require('./steps');

            // Make step0 return done after first call
            step0.mockImplementation(() => {
                // After step0, claudiomiro folder exists with done.txt
                fs.existsSync = jest.fn((p) => {
                    if (p.includes('done.txt')) return true;
                    return true;
                });
                fs.readdirSync = jest.fn().mockReturnValue(['TASK1']);
                return Promise.resolve();
            });

            await cliModule.init(['.']);

            expect(step0).toHaveBeenCalled();
        });

        test('should parse --fresh flag correctly', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('done.txt')) return true;
                if (p.includes('.claudiomiro')) return true;
                return true;
            });
            fs.readdirSync = jest.fn().mockReturnValue([]);

            await cliModule.init(['.', '--fresh']);

            expect(startFresh).toHaveBeenCalled();
        });

        test('should parse --continue flag correctly', async () => {
            // Setup for --continue: claudiomiro folder exists with PENDING_CLARIFICATION.flag
            fs.existsSync = jest.fn((p) => {
                if (p.includes('PENDING_CLARIFICATION.flag')) return true;
                if (p.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (p.includes('.claudiomiro')) return true;
                return true;
            });
            fs.readdirSync = jest.fn().mockReturnValue([]);

            const { step0 } = require('./steps');
            step0.mockResolvedValue(undefined);

            // Should resume from clarification
            await cliModule.init(['.', '--continue']);

            expect(logger.info).toHaveBeenCalledWith('Resuming from clarification phase...');
        });

        test('should parse --steps=0,1,2 flag correctly', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', '--steps=0,1,2']);

            expect(logger.info).toHaveBeenCalledWith('Running only steps: 0, 1, 2');
        });

        test('should exit with error if folder does not exist', async () => {
            fs.existsSync = jest.fn().mockReturnValue(false);

            await cliModule.init(['/nonexistent/folder']);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Folder does not exist'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });
    });

    describe('executor type parsing', () => {
        test('should default to claude executor', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.']);

            expect(state.setExecutorType).toHaveBeenCalledWith('claude');
            expect(logger.info).toHaveBeenCalledWith('Executor selected: claude');
        });

        test('should set codex executor when --codex flag is passed', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', '--codex']);

            expect(state.setExecutorType).toHaveBeenCalledWith('codex');
            expect(logger.info).toHaveBeenCalledWith('Executor selected: codex');
        });

        test('should set deep-seek executor when --deep-seek flag is passed', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', '--deep-seek']);

            expect(state.setExecutorType).toHaveBeenCalledWith('deep-seek');
        });

        test('should set glm executor when --glm flag is passed', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', '--glm']);

            expect(state.setExecutorType).toHaveBeenCalledWith('glm');
        });

        test('should set gemini executor when --gemini flag is passed', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', '--gemini']);

            expect(state.setExecutorType).toHaveBeenCalledWith('gemini');
        });
    });

    describe('exports', () => {
        test('should export init function', () => {
            expect(cliModule.init).toBeDefined();
            expect(typeof cliModule.init).toBe('function');
        });
    });
});
