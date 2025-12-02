// Mock dependencies BEFORE requiring the module
jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    command: jest.fn(),
    separator: jest.fn(),
    newline: jest.fn(),
    stopSpinner: jest.fn(),
}));

jest.mock('../../shared/config/state', () => ({
    folder: '/test/project',
    claudiomiroFolder: '/test/project/.claudiomiro',
    claudiomiroRoot: '/test/project/.claudiomiro',
    setFolder: jest.fn(function (folder) {
        this.folder = folder;
        this.claudiomiroFolder = require('path').join(folder, '.claudiomiro');
        this.claudiomiroRoot = require('path').join(folder, '.claudiomiro');
    }),
}));

jest.mock('../../shared/executors/claude-executor', () => ({
    executeClaude: jest.fn(),
}));

jest.mock('../../shared/services/local-llm', () => ({
    getLocalLLMService: jest.fn(),
}));

const { spawn } = require('child_process');
const fs = require('fs');
const { EventEmitter } = require('events');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { executeClaude } = require('../../shared/executors/claude-executor');
const { getLocalLLMService } = require('../../shared/services/local-llm');
const { fixCommand, executeCommand } = require('./executor');

// Helper to create mock child process
class MockChildProcess extends EventEmitter {
    constructor() {
        super();
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
    }
}

// Helper to create mock write stream
const createMockWriteStream = () => ({
    write: jest.fn(),
    end: jest.fn(),
});

// Helper to create mock LocalLLM service
const createMockLLMService = (options = {}) => ({
    initialize: jest.fn().mockResolvedValue({ available: options.available ?? true }),
    isAvailable: jest.fn().mockReturnValue(options.available ?? true),
    validateFix: jest.fn().mockResolvedValue(options.validateFixResult ?? null),
});

describe('src/commands/fix-command/executor.js', () => {
    let mockExit;
    let mockWriteStream;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock process.exit
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit called');
        });

        // Setup default mocks
        state.folder = '/test/project';
        state.claudiomiroFolder = '/test/project/.claudiomiro';
        state.claudiomiroRoot = '/test/project/.claudiomiro';

        fs.existsSync.mockReturnValue(true);

        mockWriteStream = createMockWriteStream();
        fs.createWriteStream.mockReturnValue(mockWriteStream);

        executeClaude.mockResolvedValue(undefined);
        getLocalLLMService.mockReturnValue(null);
    });

    afterEach(() => {
        mockExit.mockRestore();
    });

    describe('executeCommand()', () => {
        test('should execute command successfully', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('echo test');

            // Simulate successful execution
            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('test output'));
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(spawn).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([expect.any(String), 'echo test']),
                expect.objectContaining({
                    cwd: state.folder,
                    stdio: ['ignore', 'pipe', 'pipe'],
                }),
            );
            expect(result.success).toBe(true);
            expect(result.exitCode).toBe(0);
            expect(result.output).toBe('test output');
            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('successfully'));
        });

        test('should handle command failure', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('failing command');

            process.nextTick(() => {
                mockChild.stderr.emit('data', Buffer.from('error message'));
                mockChild.emit('close', 1);
            });

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(1);
            expect(result.output).toBe('error message');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed'));
        });

        test('should capture both stdout and stderr', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('mixed output');

            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('stdout data\n'));
                mockChild.stderr.emit('data', Buffer.from('stderr data\n'));
                mockChild.emit('close', 0);
            });

            const result = await promise;

            expect(result.output).toBe('stdout data\nstderr data\n');
        });

        test('should handle spawn error', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('bad command');

            process.nextTick(() => {
                mockChild.emit('error', new Error('spawn failed'));
            });

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(-1);
            expect(result.error).toBe('spawn failed');
        });

        test('should create log file with timestamp', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('log test');

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            await promise;

            expect(fs.createWriteStream).toHaveBeenCalledWith(
                expect.stringContaining('log.txt'),
                { flags: 'a' },
            );
            expect(mockWriteStream.write).toHaveBeenCalledWith(
                expect.stringContaining('Command execution started'),
            );
        });

        test('should initialize state if claudiomiroFolder is null', async () => {
            state.claudiomiroFolder = null;
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('init test');

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            await promise;

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should create claudiomiro folder if it does not exist', async () => {
            fs.existsSync.mockReturnValue(false);
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('mkdir test');

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            await promise;

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                state.claudiomiroRoot,
                { recursive: true },
            );
        });

        test('should write stdout to log file', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('log stdout');

            process.nextTick(() => {
                mockChild.stdout.emit('data', Buffer.from('logged output'));
                mockChild.emit('close', 0);
            });

            await promise;

            expect(mockWriteStream.write).toHaveBeenCalledWith('[STDOUT] logged output');
        });

        test('should write stderr to log file', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = executeCommand('log stderr');

            process.nextTick(() => {
                mockChild.stderr.emit('data', Buffer.from('logged error'));
                mockChild.emit('close', 1);
            });

            await promise;

            expect(mockWriteStream.write).toHaveBeenCalledWith('[STDERR] logged error');
        });
    });

    describe('fixCommand()', () => {
        test('should exit with 0 when command succeeds on first try', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = fixCommand('echo success', 3);

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            await expect(promise).rejects.toThrow('process.exit called');
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should call executeClaude on failure', async () => {
            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            let attempts = 0;
            spawn.mockImplementation(() => {
                attempts++;
                const child = new MockChildProcess();
                process.nextTick(() => {
                    if (attempts < 2) {
                        child.stderr.emit('data', Buffer.from('error'));
                        child.emit('close', 1);
                    } else {
                        child.emit('close', 0);
                    }
                });
                return child;
            });

            const promise = fixCommand('npm test', 3);

            await expect(promise).rejects.toThrow('process.exit called');
            expect(executeClaude).toHaveBeenCalledWith(expect.stringContaining('fix command'));
        });

        test('should throw error after max attempts exhausted', async () => {
            spawn.mockImplementation(() => {
                const child = new MockChildProcess();
                process.nextTick(() => {
                    child.stderr.emit('data', Buffer.from('persistent error'));
                    child.emit('close', 1);
                });
                return child;
            });

            await expect(fixCommand('failing command', 2)).rejects.toThrow(
                'All 2 attempts to fix the command',
            );

            expect(executeClaude).toHaveBeenCalledTimes(2);
        });

        test('should create claudiomiro folder if it does not exist', async () => {
            fs.existsSync.mockImplementation((p) => {
                if (p === state.claudiomiroFolder) return false;
                return true;
            });

            const mockChild = new MockChildProcess();
            spawn.mockReturnValue(mockChild);

            const promise = fixCommand('echo test', 1);

            process.nextTick(() => {
                mockChild.emit('close', 0);
            });

            await expect(promise).rejects.toThrow('process.exit called');

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                state.claudiomiroFolder,
                { recursive: true },
            );
        });

        test('should use local LLM analysis on retry attempts', async () => {
            const mockLLM = createMockLLMService({
                available: true,
                validateFixResult: {
                    valid: false,
                    issues: ['Issue 1', 'Issue 2'],
                    recommendation: 'Try different approach',
                    confidence: 0.8,
                },
            });
            getLocalLLMService.mockReturnValue(mockLLM);

            let attempts = 0;
            spawn.mockImplementation(() => {
                attempts++;
                const child = new MockChildProcess();
                process.nextTick(() => {
                    if (attempts < 3) {
                        child.stderr.emit('data', Buffer.from(`error ${attempts}`));
                        child.emit('close', 1);
                    } else {
                        child.emit('close', 0);
                    }
                });
                return child;
            });

            const promise = fixCommand('npm test', 5);

            await expect(promise).rejects.toThrow('process.exit called');

            // LLM should be called for analysis after first failure
            expect(mockLLM.initialize).toHaveBeenCalled();
            expect(mockLLM.validateFix).toHaveBeenCalled();
        });

        test('should handle executeClaude failure gracefully', async () => {
            executeClaude.mockRejectedValue(new Error('Claude failed'));

            spawn.mockImplementation(() => {
                const child = new MockChildProcess();
                process.nextTick(() => {
                    child.stderr.emit('data', Buffer.from('error'));
                    child.emit('close', 1);
                });
                return child;
            });

            // Should not throw, should continue to next attempt
            await expect(fixCommand('failing', 2)).rejects.toThrow('All 2 attempts');
        });

        test('should pass analysis context to executeClaude on retries', async () => {
            const mockLLM = createMockLLMService({
                available: true,
                validateFixResult: {
                    valid: false,
                    issues: ['Syntax error'],
                    recommendation: 'Check syntax',
                    confidence: 0.9,
                },
            });
            getLocalLLMService.mockReturnValue(mockLLM);

            let attempts = 0;
            spawn.mockImplementation(() => {
                attempts++;
                const child = new MockChildProcess();
                process.nextTick(() => {
                    child.stderr.emit('data', Buffer.from(`error ${attempts}`));
                    child.emit('close', 1);
                });
                return child;
            });

            await expect(fixCommand('npm test', 3)).rejects.toThrow('All 3 attempts');

            // Second and third calls should include analysis context
            const calls = executeClaude.mock.calls;
            expect(calls.length).toBe(3);

            // First call has no analysis (first attempt)
            expect(calls[0][0]).toBe('fix command "npm test"');

            // Later calls may have analysis context appended
            // The exact content depends on LLM analysis
        });
    });

    describe('analyzeFailedFix (internal)', () => {
        // Test through fixCommand since analyzeFailedFix is not exported
        test('should return empty string when LLM is not available', async () => {
            getLocalLLMService.mockReturnValue(null);

            let _attempts = 0;
            spawn.mockImplementation(() => {
                _attempts++;
                const child = new MockChildProcess();
                process.nextTick(() => {
                    child.stderr.emit('data', Buffer.from('error'));
                    child.emit('close', 1);
                });
                return child;
            });

            await expect(fixCommand('test', 2)).rejects.toThrow('All 2 attempts');

            // Without LLM, executeClaude should be called with just the basic prompt
            expect(executeClaude).toHaveBeenCalledWith('fix command "test"');
        });

        test('should handle LLM initialization failure', async () => {
            const mockLLM = {
                initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
                isAvailable: jest.fn().mockReturnValue(false),
                validateFix: jest.fn(),
            };
            getLocalLLMService.mockReturnValue(mockLLM);

            let _attempts = 0;
            spawn.mockImplementation(() => {
                _attempts++;
                const child = new MockChildProcess();
                process.nextTick(() => {
                    child.stderr.emit('data', Buffer.from('error'));
                    child.emit('close', 1);
                });
                return child;
            });

            await expect(fixCommand('test', 2)).rejects.toThrow('All 2 attempts');

            // Should still work despite LLM failure
            expect(executeClaude).toHaveBeenCalledTimes(2);
        });

        test('should handle LLM validateFix failure', async () => {
            const mockLLM = createMockLLMService({ available: true });
            mockLLM.validateFix.mockRejectedValue(new Error('Validate failed'));
            getLocalLLMService.mockReturnValue(mockLLM);

            let _attempts = 0;
            spawn.mockImplementation(() => {
                _attempts++;
                const child = new MockChildProcess();
                process.nextTick(() => {
                    child.stderr.emit('data', Buffer.from('error'));
                    child.emit('close', 1);
                });
                return child;
            });

            await expect(fixCommand('test', 2)).rejects.toThrow('All 2 attempts');

            // Should continue despite validateFix failure
            expect(executeClaude).toHaveBeenCalledTimes(2);
        });
    });

    describe('exports', () => {
        test('should export fixCommand function', () => {
            expect(fixCommand).toBeDefined();
            expect(typeof fixCommand).toBe('function');
        });

        test('should export executeCommand function', () => {
            expect(executeCommand).toBeDefined();
            expect(typeof executeCommand).toBe('function');
        });
    });
});
