// Mock all dependencies BEFORE requiring the module
jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
}));

jest.mock('../../shared/config/state', () => ({
    setFolder: jest.fn(),
    folder: '/test/folder',
    claudiomiroFolder: '/test/folder/.claudiomiro'
}));

jest.mock('./executor', () => ({
    fixCommand: jest.fn().mockResolvedValue(undefined)
}));

const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { fixCommand } = require('./executor');
const { run } = require('./index');

describe('src/commands/fix-command/index.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('run()', () => {
        test('should parse --fix-command="npm test" correctly', async () => {
            const args = ['--fix-command="npm test"', '.'];

            await run(args);

            expect(fixCommand).toHaveBeenCalledWith('npm test', 20);
        });

        test('should parse --fix-command with equals sign in command', async () => {
            const args = ['--fix-command="npm run test -- --coverage=true"', '.'];

            await run(args);

            expect(fixCommand).toHaveBeenCalledWith('npm run test -- --coverage=true', 20);
        });

        test('should parse --limit=5 correctly', async () => {
            const args = ['--fix-command="npm test"', '--limit=5', '.'];

            await run(args);

            expect(fixCommand).toHaveBeenCalledWith('npm test', 5);
        });

        test('should set maxAttempts to Infinity when --no-limit is passed', async () => {
            const args = ['--fix-command="npm test"', '--no-limit', '.'];

            await run(args);

            expect(fixCommand).toHaveBeenCalledWith('npm test', Infinity);
        });

        test('should default maxAttempts to 20 when no limit flag is provided', async () => {
            const args = ['--fix-command="npm test"', '.'];

            await run(args);

            expect(fixCommand).toHaveBeenCalledWith('npm test', 20);
        });

        test('should default folder to process.cwd() when not provided', async () => {
            const args = ['--fix-command="npm test"'];

            await run(args);

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should extract folder from args correctly', async () => {
            const args = ['--fix-command="npm test"', '/custom/folder'];

            await run(args);

            expect(state.setFolder).toHaveBeenCalledWith('/custom/folder');
        });

        test('should log info about the command being fixed', async () => {
            const args = ['--fix-command="npm test"', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Fixing command: npm test (max attempts: 20)');
        });

        test('should log "no limit" when --no-limit is passed', async () => {
            const args = ['--fix-command="npm test"', '--no-limit', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Fixing command: npm test (max attempts: no limit)');
        });

        test('should handle null fixCommandText gracefully', async () => {
            const args = ['.'];

            await run(args);

            // fixCommand should still be called with null
            expect(fixCommand).toHaveBeenCalledWith(null, 20);
        });

        test('should strip quotes from command text', async () => {
            const args = ["--fix-command='npm test'", '.'];

            await run(args);

            expect(fixCommand).toHaveBeenCalledWith('npm test', 20);
        });
    });

    describe('exports', () => {
        test('should export run function', () => {
            expect(run).toBeDefined();
            expect(typeof run).toBe('function');
        });
    });
});
