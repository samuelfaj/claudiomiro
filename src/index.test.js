// Store original process.argv and process.exit
const originalArgv = process.argv;
const originalExit = process.exit;

describe('src/index.js', () => {
    // Mock references that will be set in beforeEach
    let logger;
    let checkForUpdatesAsync;
    let runTaskExecutor;
    let runFixCommand;
    let runLoopFixes;
    let indexModule;

    beforeEach(() => {
        // Reset modules to ensure fresh mocks
        jest.resetModules();

        // Setup mocks BEFORE requiring the module
        jest.doMock('./shared/utils/logger', () => ({
            banner: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
        }));

        jest.doMock('./shared/config/state', () => ({
            setFolder: jest.fn(),
            folder: '/test/folder',
            claudiomiroFolder: '/test/folder/.claudiomiro',
        }));

        jest.doMock('./shared/utils/auto-update', () => ({
            checkForUpdatesAsync: jest.fn(),
        }));

        jest.doMock('./commands/task-executor', () => ({
            run: jest.fn().mockResolvedValue(undefined),
        }));

        jest.doMock('./commands/fix-command', () => ({
            run: jest.fn().mockResolvedValue(undefined),
        }));

        jest.doMock('./commands/loop-fixes', () => ({
            run: jest.fn().mockResolvedValue(undefined),
        }));

        // Now require the module and get references to mocks
        logger = require('./shared/utils/logger');
        checkForUpdatesAsync = require('./shared/utils/auto-update').checkForUpdatesAsync;
        runTaskExecutor = require('./commands/task-executor').run;
        runFixCommand = require('./commands/fix-command').run;
        runLoopFixes = require('./commands/loop-fixes').run;
        indexModule = require('./index');

        // Reset process.argv
        process.argv = ['node', 'claudiomiro'];

        // Mock process.exit
        process.exit = jest.fn();
    });

    afterEach(() => {
        // Restore process.argv and process.exit
        process.argv = originalArgv;
        process.exit = originalExit;
        jest.resetModules();
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
