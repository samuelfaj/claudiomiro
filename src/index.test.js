// Mock all dependencies BEFORE requiring the module
jest.mock('./shared/utils/logger', () => ({
    banner: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
}));

jest.mock('./shared/config/state', () => ({
    setFolder: jest.fn(),
    folder: '/test/folder',
    claudiomiroFolder: '/test/folder/.claudiomiro'
}));

jest.mock('./shared/utils/auto-update', () => ({
    checkForUpdatesAsync: jest.fn()
}));

// Mock command modules
jest.mock('./commands/task-executor', () => ({
    run: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('./commands/fix-command', () => ({
    run: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('./commands/loop-fixes', () => ({
    run: jest.fn().mockResolvedValue(undefined)
}));

const logger = require('./shared/utils/logger');
const { checkForUpdatesAsync } = require('./shared/utils/auto-update');
const { run: runTaskExecutor } = require('./commands/task-executor');
const { run: runFixCommand } = require('./commands/fix-command');
const { run: runLoopFixes } = require('./commands/loop-fixes');

// Store original process.argv and process.exit
const originalArgv = process.argv;
const originalExit = process.exit;

describe('src/index.js', () => {
    let indexModule;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Reset process.argv
        process.argv = ['node', 'claudiomiro'];

        // Mock process.exit
        process.exit = jest.fn();

        // Clear module cache and re-require
        jest.resetModules();
        indexModule = require('./index');
    });

    afterEach(() => {
        // Restore process.argv and process.exit
        process.argv = originalArgv;
        process.exit = originalExit;
    });

    describe('parseArgs()', () => {
        // Note: parseArgs is internal, so we test it through init()

        test('should route to task-executor when no special flags are present', async () => {
            process.argv = ['node', 'claudiomiro', '.'];

            await indexModule.init();

            expect(logger.banner).toHaveBeenCalled();
            expect(checkForUpdatesAsync).toHaveBeenCalledWith('claudiomiro');
            expect(runTaskExecutor).toHaveBeenCalledWith(['.']);
            expect(runFixCommand).not.toHaveBeenCalled();
            expect(runLoopFixes).not.toHaveBeenCalled();
        });

        test('should route to fix-command when --fix-command flag is present', async () => {
            process.argv = ['node', 'claudiomiro', '--fix-command="npm test"', '.'];

            await indexModule.init();

            expect(logger.banner).toHaveBeenCalled();
            expect(checkForUpdatesAsync).toHaveBeenCalledWith('claudiomiro');
            expect(runFixCommand).toHaveBeenCalledWith(['--fix-command="npm test"', '.']);
            expect(runTaskExecutor).not.toHaveBeenCalled();
            expect(runLoopFixes).not.toHaveBeenCalled();
        });

        test('should route to loop-fixes when --loop-fixes flag is present', async () => {
            process.argv = ['node', 'claudiomiro', '--loop-fixes', '.'];

            await indexModule.init();

            expect(logger.banner).toHaveBeenCalled();
            expect(checkForUpdatesAsync).toHaveBeenCalledWith('claudiomiro');
            expect(runLoopFixes).toHaveBeenCalledWith(['--loop-fixes', '.']);
            expect(runTaskExecutor).not.toHaveBeenCalled();
            expect(runFixCommand).not.toHaveBeenCalled();
        });

        test('should give --fix-command precedence over --loop-fixes', async () => {
            process.argv = ['node', 'claudiomiro', '--fix-command="npm test"', '--loop-fixes', '.'];

            await indexModule.init();

            expect(runFixCommand).toHaveBeenCalledWith(['--fix-command="npm test"', '--loop-fixes', '.']);
            expect(runLoopFixes).not.toHaveBeenCalled();
            expect(runTaskExecutor).not.toHaveBeenCalled();
        });
    });

    describe('init()', () => {
        test('should call logger.banner() first', async () => {
            process.argv = ['node', 'claudiomiro', '.'];

            await indexModule.init();

            expect(logger.banner).toHaveBeenCalled();
            // Verify banner was called before checkForUpdatesAsync
            const bannerCallOrder = logger.banner.mock.invocationCallOrder[0];
            const updateCallOrder = checkForUpdatesAsync.mock.invocationCallOrder[0];
            expect(bannerCallOrder).toBeLessThan(updateCallOrder);
        });

        test('should call checkForUpdatesAsync with "claudiomiro"', async () => {
            process.argv = ['node', 'claudiomiro', '.'];

            await indexModule.init();

            expect(checkForUpdatesAsync).toHaveBeenCalledWith('claudiomiro');
        });

        test('should pass all args to the command module', async () => {
            process.argv = ['node', 'claudiomiro', '.', '--fresh', '--push=false'];

            await indexModule.init();

            expect(runTaskExecutor).toHaveBeenCalledWith(['.', '--fresh', '--push=false']);
        });

        test('should handle empty args (defaults to task-executor)', async () => {
            process.argv = ['node', 'claudiomiro'];

            await indexModule.init();

            expect(runTaskExecutor).toHaveBeenCalledWith([]);
        });
    });

    describe('exports', () => {
        test('should export init function', () => {
            expect(indexModule.init).toBeDefined();
            expect(typeof indexModule.init).toBe('function');
        });
    });
});
