// Mock all dependencies BEFORE requiring the module
jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn()
}));

jest.mock('../../shared/config/state', () => ({
    setFolder: jest.fn(),
    folder: '/test/folder',
    claudiomiroFolder: '/test/folder/.claudiomiro'
}));

const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { run } = require('./index');

describe('src/commands/loop-fixes/index.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('run()', () => {
        test('should log "Running loop-fixes" with iteration limit', async () => {
            const args = ['--loop-fixes', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: 10)');
        });

        test('should log warning "not yet implemented"', async () => {
            const args = ['--loop-fixes', '.'];

            await run(args);

            expect(logger.warning).toHaveBeenCalledWith('loop-fixes command not yet implemented');
        });

        test('should parse --limit=5 correctly', async () => {
            const args = ['--loop-fixes', '--limit=5', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: 5)');
        });

        test('should default maxIterations to 10 when no limit flag', async () => {
            const args = ['--loop-fixes', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: 10)');
        });

        test('should show "no limit" when --no-limit is passed', async () => {
            const args = ['--loop-fixes', '--no-limit', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: no limit)');
        });

        test('should set folder from args', async () => {
            const args = ['--loop-fixes', '/custom/folder'];

            await run(args);

            expect(state.setFolder).toHaveBeenCalledWith('/custom/folder');
        });

        test('should default folder to process.cwd() when not provided', async () => {
            const args = ['--loop-fixes'];

            await run(args);

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should handle multiple flags correctly', async () => {
            const args = ['--loop-fixes', '--limit=15', '--no-limit', '/some/path'];

            await run(args);

            // --no-limit takes precedence
            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: no limit)');
            expect(state.setFolder).toHaveBeenCalledWith('/some/path');
        });
    });

    describe('exports', () => {
        test('should export run function', () => {
            expect(run).toBeDefined();
            expect(typeof run).toBe('function');
        });
    });
});
