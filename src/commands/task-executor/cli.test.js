/**
 * cli.js test suite
 *
 * NOTE: This test file uses a lightweight mocking approach to avoid loading
 * the entire module dependency graph (steps, dag-executor, etc.) which causes
 * memory issues in Jest. The tests verify the CLI's argument parsing and
 * basic initialization logic.
 */

const path = require('path');

// Mock all dependencies BEFORE requiring cli.js
jest.mock('fs');
jest.mock('../../shared/utils/logger');
jest.mock('../../shared/config/state');
jest.mock('./services/file-manager');
jest.mock('./steps');
jest.mock('./services/dag-executor');
jest.mock('./utils/validation');

const fs = require('fs');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { startFresh } = require('./services/file-manager');

// Setup default mock implementations
logger.banner = jest.fn();
logger.info = jest.fn();
logger.error = jest.fn();
logger.warning = jest.fn();
logger.success = jest.fn();
logger.path = jest.fn();
logger.newline = jest.fn();
logger.startSpinner = jest.fn();
logger.confirm = jest.fn().mockResolvedValue(true);
logger.step = jest.fn();

// Mock state with getters and setters
let mockFolder = null;
let mockClaudiomiroFolder = null;
let mockExecutorType = 'claude';

state.setFolder = jest.fn((folderPath) => {
    mockFolder = path.resolve(folderPath);
    mockClaudiomiroFolder = path.join(mockFolder, '.claudiomiro');
});

state.initializeCache = jest.fn();

Object.defineProperty(state, 'folder', {
    get: () => mockFolder,
    configurable: true,
});

Object.defineProperty(state, 'claudiomiroFolder', {
    get: () => mockClaudiomiroFolder,
    configurable: true,
});

state.setExecutorType = jest.fn((type) => {
    mockExecutorType = type;
});

Object.defineProperty(state, 'executorType', {
    get: () => mockExecutorType,
    configurable: true,
});

// Now require the module under test
const cliModule = require('./cli');

// Store original process.exit
const originalExit = process.exit;

describe('src/commands/task-executor/cli.js', () => {
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Reset state
        mockFolder = null;
        mockClaudiomiroFolder = null;
        mockExecutorType = 'claude';

        // Mock process.exit
        process.exit = jest.fn();

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
