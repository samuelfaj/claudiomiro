// Mock dependencies BEFORE requiring the module
jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
}));

jest.mock('./executor', () => ({
    executeTokenOptimizer: jest.fn(),
}));

const logger = require('../../shared/utils/logger');
const { executeTokenOptimizer } = require('./executor');
const { run, printUsage, extractQuotedValue } = require('./index');

describe('src/commands/token-optimizer/index.js', () => {
    let mockExit;
    let mockConsoleLog;

    beforeEach(() => {
        jest.clearAllMocks();
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
        mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        mockExit.mockRestore();
        mockConsoleLog.mockRestore();
    });

    describe('extractQuotedValue()', () => {
        test('should extract double-quoted value', () => {
            expect(extractQuotedValue('--command="npm test"')).toBe('npm test');
        });

        test('should extract single-quoted value', () => {
            expect(extractQuotedValue("--command='npm test'")).toBe('npm test');
        });

        test('should handle values with equals sign', () => {
            expect(extractQuotedValue('--command="npm test --coverage=true"')).toBe('npm test --coverage=true');
        });

        test('should return null for null input', () => {
            expect(extractQuotedValue(null)).toBeNull();
        });

        test('should return null for undefined input', () => {
            expect(extractQuotedValue(undefined)).toBeNull();
        });

        test('should return null for argument without equals', () => {
            expect(extractQuotedValue('--command')).toBeNull();
        });

        test('should handle unquoted value', () => {
            expect(extractQuotedValue('--command=test')).toBe('test');
        });
    });

    describe('printUsage()', () => {
        test('should print usage information', () => {
            printUsage();

            expect(mockConsoleLog).toHaveBeenCalled();
            const output = mockConsoleLog.mock.calls.map(call => call[0]).join('');
            expect(output).toContain('--command');
            expect(output).toContain('--filter');
            expect(output).toContain('CLAUDIOMIRO_LOCAL_LLM');
        });
    });

    describe('run()', () => {
        test('should show help with --help flag', async () => {
            await run(['--help']);

            expect(mockConsoleLog).toHaveBeenCalled();
            expect(executeTokenOptimizer).not.toHaveBeenCalled();
        });

        test('should show help with -h flag', async () => {
            await run(['-h']);

            expect(mockConsoleLog).toHaveBeenCalled();
            expect(executeTokenOptimizer).not.toHaveBeenCalled();
        });

        test('should error when command is missing', async () => {
            await run(['--filter="return errors"']);

            expect(logger.error).toHaveBeenCalledWith('Missing required arguments.');
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        test('should error when filter is missing', async () => {
            await run(['--command="npm test"']);

            expect(logger.error).toHaveBeenCalledWith('Missing required arguments.');
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        test('should execute token optimizer with valid arguments', async () => {
            executeTokenOptimizer.mockResolvedValue({
                filteredOutput: 'filtered result',
                exitCode: 0,
            });

            await run(['--command="npm test"', '--filter="return only errors"']);

            expect(executeTokenOptimizer).toHaveBeenCalledWith('npm test', 'return only errors');
            expect(mockConsoleLog).toHaveBeenCalledWith('\nfiltered result');
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should preserve command exit code', async () => {
            executeTokenOptimizer.mockResolvedValue({
                filteredOutput: 'errors found',
                exitCode: 1,
            });

            await run(['--command="npm test"', '--filter="return errors"']);

            expect(mockExit).toHaveBeenCalledWith(1);
        });

        test('should handle empty filtered output', async () => {
            executeTokenOptimizer.mockResolvedValue({
                filteredOutput: '',
                exitCode: 0,
            });

            await run(['--command="echo ok"', '--filter="return errors"']);

            // Should not print empty output
            expect(mockConsoleLog).not.toHaveBeenCalledWith('\n');
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should warn when fallback is used', async () => {
            executeTokenOptimizer.mockResolvedValue({
                filteredOutput: 'original output',
                exitCode: 0,
                fallback: true,
            });

            await run(['--command="npm test"', '--filter="return errors"']);

            expect(logger.warning).toHaveBeenCalledWith('Output shown without filtering (Ollama unavailable).');
        });

        test('should handle executor errors', async () => {
            executeTokenOptimizer.mockRejectedValue(new Error('Execution failed'));

            await run(['--command="npm test"', '--filter="return errors"']);

            expect(logger.error).toHaveBeenCalledWith('Execution failed');
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        test('should parse single-quoted arguments', async () => {
            executeTokenOptimizer.mockResolvedValue({
                filteredOutput: 'result',
                exitCode: 0,
            });

            await run(["--command='npm test'", "--filter='return errors'"]);

            expect(executeTokenOptimizer).toHaveBeenCalledWith('npm test', 'return errors');
        });
    });

    describe('exports', () => {
        test('should export run function', () => {
            expect(run).toBeDefined();
            expect(typeof run).toBe('function');
        });

        test('should export printUsage function', () => {
            expect(printUsage).toBeDefined();
            expect(typeof printUsage).toBe('function');
        });

        test('should export extractQuotedValue function', () => {
            expect(extractQuotedValue).toBeDefined();
            expect(typeof extractQuotedValue).toBe('function');
        });
    });
});
