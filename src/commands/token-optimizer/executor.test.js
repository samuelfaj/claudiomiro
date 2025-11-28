// Mock dependencies BEFORE requiring the module
jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
}));

jest.mock('../../shared/services/local-llm', () => ({
    getLocalLLMService: jest.fn(),
}));

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const logger = require('../../shared/utils/logger');
const { getLocalLLMService } = require('../../shared/services/local-llm');
const { runCommand, buildFilterPrompt, filterWithLLM, executeTokenOptimizer } = require('./executor');

// Helper to create mock child process
class MockChildProcess extends EventEmitter {
    constructor() {
        super();
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
    }
}

// Helper to create mock LocalLLM service
const createMockLLMService = (options = {}) => ({
    initialize: jest.fn().mockResolvedValue({ available: options.available ?? true }),
    isAvailable: jest.fn().mockReturnValue(options.available ?? true),
    generate: jest.fn().mockResolvedValue(options.generateResult ?? 'filtered output'),
});

describe('src/commands/token-optimizer/executor.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('runCommand()', () => {
        test('should execute command and capture stdout', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = runCommand('echo test');

            // Simulate output
            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('test output'));
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(spawn).toHaveBeenCalledWith('echo test', {
                shell: true,
                stdio: ['inherit', 'pipe', 'pipe'],
            });
            expect(result.stdout).toBe('test output');
            expect(result.stderr).toBe('');
            expect(result.exitCode).toBe(0);
        });

        test('should capture stderr', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = runCommand('failing command');

            process.nextTick(() => {
                mockChild.stderr.emit('data', Buffer.from('error message'));
                mockChild.emit('close', 1);
            });

            const result = await promise;

            expect(result.stdout).toBe('');
            expect(result.stderr).toBe('error message');
            expect(result.exitCode).toBe(1);
        });

        test('should capture both stdout and stderr', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = runCommand('mixed output');

            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('stdout data\n'));
                mockChild.stderr.emit('data', Buffer.from('stderr data\n'));
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.stdout).toBe('stdout data\n');
            expect(result.stderr).toBe('stderr data\n');
            expect(result.exitCode).toBe(0);
        });

        test('should handle spawn error', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = runCommand('bad command');

            process.nextTick(() => {
                mockChild.emit('error', new Error('spawn failed'));
            });

            const result = await promise;

            expect(result.stderr).toContain('spawn failed');
            expect(result.exitCode).toBe(1);
        });

        test('should default exit code to 1 when null', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = runCommand('null exit');

            process.nextTick(() => {
                mockChild.emit('close', null);
            });

            const result = await promise;

            expect(result.exitCode).toBe(1);
        });
    });

    describe('buildFilterPrompt()', () => {
        test('should build prompt with command output and filter instruction', () => {
            const prompt = buildFilterPrompt('test output', 'return only errors');

            expect(prompt).toContain('CLI output filter');
            expect(prompt).toContain('return only errors');
            expect(prompt).toContain('test output');
        });

        test('should include conciseness instruction', () => {
            const prompt = buildFilterPrompt('output', 'filter');

            expect(prompt).toContain('Be concise');
            expect(prompt).toContain('Do not add explanations or commentary');
        });
    });

    describe('filterWithLLM()', () => {
        test('should return filtered output when LLM is available', async () => {
            const mockService = createMockLLMService({
                available: true,
                generateResult: 'filtered errors only',
            });
            getLocalLLMService.mockReturnValue(mockService);

            const result = await filterWithLLM('full output with errors', 'return only errors');

            expect(mockService.initialize).toHaveBeenCalled();
            expect(mockService.isAvailable).toHaveBeenCalled();
            expect(mockService.generate).toHaveBeenCalledWith(
                expect.stringContaining('full output with errors'),
                { maxTokens: 2000 },
            );
            expect(result).toBe('filtered errors only');
        });

        test('should return null when LLM is not available', async () => {
            const mockService = createMockLLMService({ available: false });
            getLocalLLMService.mockReturnValue(mockService);

            const result = await filterWithLLM('output', 'filter');

            expect(mockService.initialize).toHaveBeenCalled();
            expect(mockService.isAvailable).toHaveBeenCalled();
            expect(mockService.generate).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('executeTokenOptimizer()', () => {
        test('should throw error if command is missing', async () => {
            await expect(executeTokenOptimizer(null, 'filter')).rejects.toThrow('Command is required');
            await expect(executeTokenOptimizer('', 'filter')).rejects.toThrow('Command is required');
        });

        test('should throw error if filter is missing', async () => {
            await expect(executeTokenOptimizer('echo test', null)).rejects.toThrow('Filter instruction is required');
            await expect(executeTokenOptimizer('echo test', '')).rejects.toThrow('Filter instruction is required');
        });

        test('should return empty output when command produces no output', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeTokenOptimizer('silent command', 'filter');

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('');
            expect(result.exitCode).toBe(0);
            expect(logger.info).toHaveBeenCalledWith('Command produced no output.');
        });

        test('should execute command and filter output with LLM', async () => {
            // Mock command execution
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            // Mock LLM service
            const mockService = createMockLLMService({
                available: true,
                generateResult: 'filtered errors',
            });
            getLocalLLMService.mockReturnValue(mockService);

            const promise = executeTokenOptimizer('npm test', 'return only errors');

            // Simulate command output
            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('test output with errors'));
                mockChild.emit('close', 1);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('filtered errors');
            expect(result.exitCode).toBe(1);
            expect(logger.info).toHaveBeenCalledWith('Running: npm test');
            expect(logger.info).toHaveBeenCalledWith('Filtering output with Local LLM...');
        });

        test('should fallback to original output when LLM is not available', async () => {
            // Mock command execution
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            // Mock LLM service as unavailable
            const mockService = createMockLLMService({ available: false });
            getLocalLLMService.mockReturnValue(mockService);

            const promise = executeTokenOptimizer('npm test', 'filter');

            // Simulate command output
            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('original output'));
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('original output');
            expect(result.fallback).toBe(true);
            expect(logger.warning).toHaveBeenCalledWith('Local LLM not available. Returning original output.');
        });

        test('should fallback to original output when LLM fails', async () => {
            // Mock command execution
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            // Mock LLM service that throws error
            const mockService = {
                initialize: jest.fn().mockResolvedValue({ available: true }),
                isAvailable: jest.fn().mockReturnValue(true),
                generate: jest.fn().mockRejectedValue(new Error('LLM error')),
            };
            getLocalLLMService.mockReturnValue(mockService);

            const promise = executeTokenOptimizer('npm test', 'filter');

            // Simulate command output
            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('original output'));
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('original output');
            expect(result.fallback).toBe(true);
            expect(logger.warning).toHaveBeenCalledWith('LLM filtering failed: LLM error');
        });
    });

    describe('exports', () => {
        test('should export runCommand function', () => {
            expect(runCommand).toBeDefined();
            expect(typeof runCommand).toBe('function');
        });

        test('should export buildFilterPrompt function', () => {
            expect(buildFilterPrompt).toBeDefined();
            expect(typeof buildFilterPrompt).toBe('function');
        });

        test('should export filterWithLLM function', () => {
            expect(filterWithLLM).toBeDefined();
            expect(typeof filterWithLLM).toBe('function');
        });

        test('should export executeTokenOptimizer function', () => {
            expect(executeTokenOptimizer).toBeDefined();
            expect(typeof executeTokenOptimizer).toBe('function');
        });
    });
});
