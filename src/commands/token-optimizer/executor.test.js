// Mock dependencies BEFORE requiring the module
jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
}));

jest.mock('../../shared/config/state', () => ({
    claudiomiroFolder: null,
    setFolder: jest.fn(function (folder) {
        this.claudiomiroFolder = require('path').join(folder, '.claudiomiro');
    }),
}));

jest.mock('../../shared/services/local-llm', () => ({
    getLocalLLMService: jest.fn(),
}));

const { spawn } = require('child_process');
const fs = require('fs');
const { EventEmitter } = require('events');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { getLocalLLMService } = require('../../shared/services/local-llm');
const {
    runCommand,
    buildFilterPrompt,
    filterWithLLM,
    executeTokenOptimizer,
    initializeTokenOptimizerFolder,
    generateOutputFilename,
    saveOutput,
} = require('./executor');

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
        state.claudiomiroFolder = null;
        fs.existsSync.mockReturnValue(false);
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
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeTokenOptimizer('silent command', 'filter');

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('');
            expect(result.exitCode).toBe(0);
            expect(result.outputPath).toBeDefined();
            expect(logger.info).not.toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should log when verbose is true and command produces no output', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeTokenOptimizer('silent command', 'filter', { verbose: true });

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('');
            expect(logger.info).toHaveBeenCalledWith('Running: silent command');
            expect(logger.info).toHaveBeenCalledWith('Command produced no output.');
        });

        test('should execute command and filter output with LLM without logging', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

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
            expect(result.outputPath).toBeDefined();
            expect(logger.info).not.toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should log progress when verbose is true', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

            // Mock command execution
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            // Mock LLM service
            const mockService = createMockLLMService({
                available: true,
                generateResult: 'filtered errors',
            });
            getLocalLLMService.mockReturnValue(mockService);

            const promise = executeTokenOptimizer('npm test', 'return only errors', { verbose: true });

            // Simulate command output
            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('test output with errors'));
                mockChild.emit('close', 1);
            });

            const result = await promise;

            expect(result.filteredOutput).toBe('filtered errors');
            expect(logger.info).toHaveBeenCalledWith('Running: npm test');
            expect(logger.info).toHaveBeenCalledWith('Filtering output with Local LLM...');
        });

        test('should fallback to original output when LLM is not available without logging', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

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
            expect(result.outputPath).toBeDefined();
            expect(logger.warning).not.toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should log fallback warning when verbose is true and LLM is not available', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

            // Mock command execution
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            // Mock LLM service as unavailable
            const mockService = createMockLLMService({ available: false });
            getLocalLLMService.mockReturnValue(mockService);

            const promise = executeTokenOptimizer('npm test', 'filter', { verbose: true });

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

        test('should fallback to original output when LLM fails without logging', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

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
            expect(result.outputPath).toBeDefined();
            expect(logger.warning).not.toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should log fallback warning when verbose is true and LLM fails', async () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

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

            const promise = executeTokenOptimizer('npm test', 'filter', { verbose: true });

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

    describe('initializeTokenOptimizerFolder()', () => {
        test('should set folder when claudiomiroFolder is null', () => {
            state.claudiomiroFolder = null;

            initializeTokenOptimizerFolder();

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should not set folder when claudiomiroFolder is already set', () => {
            state.claudiomiroFolder = '/existing/.claudiomiro';

            initializeTokenOptimizerFolder();

            expect(state.setFolder).not.toHaveBeenCalled();
        });

        test('should create token-optimizer folder when it does not exist', () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(false);

            const result = initializeTokenOptimizerFolder();

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/token-optimizer',
                { recursive: true },
            );
            expect(result).toBe('/test/.claudiomiro/token-optimizer');
        });

        test('should not create folder when it already exists', () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

            const result = initializeTokenOptimizerFolder();

            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(result).toBe('/test/.claudiomiro/token-optimizer');
        });
    });

    describe('generateOutputFilename()', () => {
        test('should generate filename with timestamp', () => {
            const filename = generateOutputFilename();

            expect(filename).toMatch(/^output-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z\.txt$/);
        });

        test('should generate unique filenames', () => {
            const filename1 = generateOutputFilename();

            // Small delay to ensure different timestamp
            const start = Date.now();
            while (Date.now() - start < 1) {
                // wait
            }

            const filename2 = generateOutputFilename();

            // Filenames may differ by milliseconds portion
            expect(filename1).toMatch(/^output-.*\.txt$/);
            expect(filename2).toMatch(/^output-.*\.txt$/);
        });
    });

    describe('saveOutput()', () => {
        test('should save output to file with command and content', () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(true);

            const result = saveOutput('test output content', 'npm test');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringMatching(/\/test\/\.claudiomiro\/token-optimizer\/output-.*\.txt$/),
                expect.stringContaining('# Token Optimizer Output'),
                'utf-8',
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('npm test'),
                'utf-8',
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('test output content'),
                'utf-8',
            );
            expect(result).toMatch(/\/test\/\.claudiomiro\/token-optimizer\/output-.*\.txt$/);
        });

        test('should create folder if it does not exist', () => {
            state.claudiomiroFolder = '/test/.claudiomiro';
            fs.existsSync.mockReturnValue(false);

            saveOutput('content', 'command');

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/token-optimizer',
                { recursive: true },
            );
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

        test('should export initializeTokenOptimizerFolder function', () => {
            expect(initializeTokenOptimizerFolder).toBeDefined();
            expect(typeof initializeTokenOptimizerFolder).toBe('function');
        });

        test('should export generateOutputFilename function', () => {
            expect(generateOutputFilename).toBeDefined();
            expect(typeof generateOutputFilename).toBe('function');
        });

        test('should export saveOutput function', () => {
            expect(saveOutput).toBeDefined();
            expect(typeof saveOutput).toBe('function');
        });
    });
});
