// Mock all dependencies BEFORE requiring the module
jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
}));

jest.mock('../../shared/config/state', () => ({
    setFolder: jest.fn(),
    folder: '/test/folder',
    claudiomiroFolder: '/test/folder/.claudiomiro',
}));

jest.mock('../../shared/services/prompt-reader', () => ({
    getMultilineInput: jest.fn(),
}));

jest.mock('./executor', () => ({
    loopFixes: jest.fn(),
}));

const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { getMultilineInput } = require('../../shared/services/prompt-reader');
const { loopFixes } = require('./executor');
const { run, parsePromptArg } = require('./index');

describe('src/commands/loop-fixes/index.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        loopFixes.mockResolvedValue(undefined);
        getMultilineInput.mockResolvedValue('Interactive prompt');
    });

    describe('parsePromptArg()', () => {
        test('should return null when --prompt= is not provided', () => {
            const args = ['--loop-fixes', '.'];

            const result = parsePromptArg(args);

            expect(result).toBeNull();
        });

        test('should parse simple prompt', () => {
            const args = ['--loop-fixes', '--prompt=Check for issues', '.'];

            const result = parsePromptArg(args);

            expect(result).toBe('Check for issues');
        });

        test('should handle prompt with double quotes', () => {
            const args = ['--loop-fixes', '--prompt="Check for issues"', '.'];

            const result = parsePromptArg(args);

            expect(result).toBe('Check for issues');
        });

        test('should handle prompt with single quotes', () => {
            const args = ['--loop-fixes', "--prompt='Check for issues'", '.'];

            const result = parsePromptArg(args);

            expect(result).toBe('Check for issues');
        });

        test('should handle prompt with equals sign', () => {
            const args = ['--loop-fixes', '--prompt=Check if a=b is correct', '.'];

            const result = parsePromptArg(args);

            expect(result).toBe('Check if a=b is correct');
        });

        test('should handle prompt with multiple equals signs', () => {
            const args = ['--loop-fixes', '--prompt=a=b=c=d', '.'];

            const result = parsePromptArg(args);

            expect(result).toBe('a=b=c=d');
        });

        test('should return null for empty prompt value', () => {
            const args = ['--loop-fixes', '--prompt=', '.'];

            const result = parsePromptArg(args);

            expect(result).toBeNull();
        });
    });

    describe('run()', () => {
        test('should log "Running loop-fixes" with iteration limit', async () => {
            const args = ['--loop-fixes', '--prompt=Test prompt', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: 20)');
        });

        test('should parse --limit=5 correctly', async () => {
            const args = ['--loop-fixes', '--prompt=Test prompt', '--limit=5', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: 5)');
            expect(loopFixes).toHaveBeenCalledWith('Test prompt', 5);
        });

        test('should default maxIterations to 20 when no limit flag', async () => {
            const args = ['--loop-fixes', '--prompt=Test prompt', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: 20)');
            expect(loopFixes).toHaveBeenCalledWith('Test prompt', 20);
        });

        test('should show "no limit" when --no-limit is passed', async () => {
            const args = ['--loop-fixes', '--prompt=Test prompt', '--no-limit', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: no limit)');
            expect(loopFixes).toHaveBeenCalledWith('Test prompt', Infinity);
        });

        test('should set folder from args', async () => {
            const args = ['--loop-fixes', '--prompt=Test prompt', '/custom/folder'];

            await run(args);

            expect(state.setFolder).toHaveBeenCalledWith('/custom/folder');
        });

        test('should default folder to process.cwd() when not provided', async () => {
            const args = ['--loop-fixes', '--prompt=Test prompt'];

            await run(args);

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should handle multiple flags correctly', async () => {
            const args = ['--loop-fixes', '--limit=15', '--no-limit', '--prompt=Test', '/some/path'];

            await run(args);

            // --no-limit takes precedence
            expect(logger.info).toHaveBeenCalledWith('Running loop-fixes (max iterations: no limit)');
            expect(state.setFolder).toHaveBeenCalledWith('/some/path');
            expect(loopFixes).toHaveBeenCalledWith('Test', Infinity);
        });

        test('should call loopFixes with parsed prompt', async () => {
            const args = ['--loop-fixes', '--prompt=Check for inconsistencies', '.'];

            await run(args);

            expect(loopFixes).toHaveBeenCalledWith('Check for inconsistencies', 20);
        });

        test('should use interactive input when --prompt= is not provided', async () => {
            getMultilineInput.mockResolvedValue('Interactive user prompt');
            const args = ['--loop-fixes', '.'];

            await run(args);

            expect(logger.info).toHaveBeenCalledWith('No --prompt= provided. Please enter your prompt:');
            expect(getMultilineInput).toHaveBeenCalled();
            expect(loopFixes).toHaveBeenCalledWith('Interactive user prompt', 20);
        });

        test('should throw error when no prompt is provided and interactive input is empty', async () => {
            getMultilineInput.mockResolvedValue('');
            const args = ['--loop-fixes', '.'];

            await expect(run(args)).rejects.toThrow('A prompt is required');

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('A prompt is required'));
        });

        test('should throw error when no prompt is provided and interactive input is whitespace', async () => {
            getMultilineInput.mockResolvedValue('   ');
            const args = ['--loop-fixes', '.'];

            await expect(run(args)).rejects.toThrow('A prompt is required');
        });

        test('should handle prompt with special characters', async () => {
            const args = ['--loop-fixes', '--prompt=Check for $pecial & <characters>', '.'];

            await run(args);

            expect(loopFixes).toHaveBeenCalledWith('Check for $pecial & <characters>', 20);
        });

        test('should handle prompt with newlines (from shell escaping)', async () => {
            const args = ['--loop-fixes', '--prompt=Line1\\nLine2', '.'];

            await run(args);

            expect(loopFixes).toHaveBeenCalledWith('Line1\\nLine2', 20);
        });
    });

    describe('exports', () => {
        test('should export run function', () => {
            expect(run).toBeDefined();
            expect(typeof run).toBe('function');
        });

        test('should export parsePromptArg function', () => {
            expect(parsePromptArg).toBeDefined();
            expect(typeof parsePromptArg).toBe('function');
        });
    });
});
