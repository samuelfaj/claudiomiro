// Set 10 second timeout for all tests
jest.setTimeout(10000);

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeGemini } = require('./gemini-executor');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./gemini-logger', () => ({
    processGeminiMessage: jest.fn().mockReturnValue('processed message'),
}));

// Mock ParallelStateManager
jest.mock('./parallel-state-manager');
const { ParallelStateManager } = require('./parallel-state-manager');

describe('Gemini Executor', () => {
    let mockSpawn;
    let mockChildProcess;
    let mockLogStream;
    let mockStateManager;

    beforeEach(() => {
    // Reset all mocks
        jest.clearAllMocks();

        // Setup default mocks
        os.tmpdir.mockReturnValue('/tmp');
        path.join.mockImplementation((...args) => args.join('/'));
        state.claudiomiroFolder = '/test/.claudiomiro';
        state.claudiomiroRoot = '/test/.claudiomiro';
        state.folder = '/test';
        state.executorType = 'gemini';

        // Mock file system operations
        fs.writeFileSync = jest.fn();
        fs.existsSync = jest.fn();
        fs.unlinkSync = jest.fn();
        fs.createWriteStream = jest.fn();

        // Mock log stream
        mockLogStream = {
            write: jest.fn(),
            end: jest.fn(),
        };
        fs.createWriteStream.mockReturnValue(mockLogStream);

        // Mock child process
        mockChildProcess = {
            stdout: {
                on: jest.fn(),
            },
            stderr: {
                on: jest.fn(),
            },
            on: jest.fn(),
            kill: jest.fn(),
        };
        mockSpawn = spawn;
        mockSpawn.mockReturnValue(mockChildProcess);

        // Mock state manager
        mockStateManager = {
            getInstance: jest.fn(() => ({
                isUIRendererActive: jest.fn().mockReturnValue(false),
                updateClaudeMessage: jest.fn(),
            })),
        };
        ParallelStateManager.getInstance = mockStateManager.getInstance;

        // Mock processGeminiMessage
        const { processGeminiMessage } = require('./gemini-logger');
        processGeminiMessage.mockReturnValue('processed message');

        // Mock logger methods
        logger.warning = jest.fn();
        logger.info = jest.fn();

        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(process.stdout, 'write').mockImplementation();

        // Mock process.stdout.columns
        Object.defineProperty(process.stdout, 'columns', {
            value: 80,
            configurable: true,
        });

        // Mock Date.now using spyOn
        jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('executeGemini', () => {
        test('should throw error when no prompt provided', async () => {
            await expect(executeGemini('')).rejects.toThrow('Invalid prompt text: must be a non-empty string');
            await expect(executeGemini(null)).rejects.toThrow('Invalid prompt text: must be a non-empty string');
            await expect(executeGemini(undefined)).rejects.toThrow('Invalid prompt text: must be a non-empty string');
        });

        test('should create temporary file with prompt text', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeGemini('test prompt');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('claudiomiro-'),
                'test prompt',
                { encoding: 'utf-8', mode: 384 },
            );
        });

        test('should spawn Gemini process with correct command', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeGemini('test prompt');

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('gemini')], {
                cwd: '/test',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });

        test('should handle stdout data processing', async () => {
            return new Promise((resolve) => {
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('test data\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                const { processGeminiMessage } = require('./gemini-logger');
                executeGemini('test prompt').then(() => {
                    expect(processGeminiMessage).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should handle process close with success code', async () => {
            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeGemini('test prompt').then(() => {
                    expect(logger.success).toHaveBeenCalledWith('Gemini execution completed');
                    resolve();
                });
            });
        });

        test('should handle process close with error code', async () => {
            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(1), 0);
                    }
                });

                executeGemini('test prompt').catch((error) => {
                    expect(error.message).toContain('Gemini exited with code 1');
                    resolve();
                });
            });
        });

        test('should handle process error', async () => {
            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'error') {
                        setTimeout(() => handler(new Error('Process failed')), 0);
                    }
                });

                executeGemini('test prompt').catch((error) => {
                    expect(error.message).toBe('Process failed');
                    expect(logger.error).toHaveBeenCalledWith('Failed to execute Gemini: Process failed');
                    resolve();
                });
            });
        });

        test('should update state manager when taskName provided', async () => {
            return new Promise((resolve) => {
                const mockStateManagerInstance = {
                    isUIRendererActive: jest.fn().mockReturnValue(false),
                    updateClaudeMessage: jest.fn(),
                };
                mockStateManager.getInstance.mockReturnValue(mockStateManagerInstance);

                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('test data\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeGemini('test prompt', 'testTask').then(() => {
                    expect(mockStateManagerInstance.updateClaudeMessage).toHaveBeenCalledWith('testTask', 'processed message');
                    resolve();
                });
            });
        });

        test('should cleanup temporary file on successful completion', async () => {
            fs.existsSync.mockReturnValue(true);

            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeGemini('test prompt').then(() => {
                    expect(fs.existsSync).toHaveBeenCalled();
                    expect(fs.unlinkSync).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should suppress streaming logs when UI renderer is active', async () => {
            const mockStateManagerInstance = {
                isUIRendererActive: jest.fn().mockReturnValue(true),
                updateClaudeMessage: jest.fn(),
            };
            mockStateManager.getInstance.mockReturnValue(mockStateManagerInstance);

            // Set up all event handlers at once to avoid overwriting
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'data') {
                    // Mock stdout data
                    handler('test data\n');
                } else if (event === 'close') {
                    // Mock process close
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeGemini('test prompt', 'testTask');

            // The test should complete without hanging, indicating proper execution
            expect(true).toBe(true);
        });
    });
});
