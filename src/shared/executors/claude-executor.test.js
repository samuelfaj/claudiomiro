const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processClaudeMessage } = require('./claude-logger');
const { executeClaude } = require('./claude-executor');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./claude-logger');

// Mock ParallelStateManager
jest.mock('./parallel-state-manager');
const { ParallelStateManager } = require('./parallel-state-manager');

describe('Claude Executor', () => {
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
        state.folder = '/test';

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

        // Mock processClaudeMessage
        processClaudeMessage.mockReturnValue('processed message');

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

    describe('executeClaude', () => {
        test('should throw error when no prompt provided', async () => {
            await expect(executeClaude('')).rejects.toThrow('no prompt');
            await expect(executeClaude(null)).rejects.toThrow('no prompt');
            await expect(executeClaude(undefined)).rejects.toThrow('no prompt');
        });

        test('should create temporary file with prompt text', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('claudiomiro-'),
                'test prompt',
                'utf-8',
            );
        });

        test('should spawn Claude process with correct command', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt');

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude')], {
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

                executeClaude('test prompt').then(() => {
                    expect(processClaudeMessage).toHaveBeenCalled();
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

                executeClaude('test prompt').then(() => {
                    expect(logger.success).toHaveBeenCalledWith('Claude execution completed');
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

                executeClaude('test prompt').catch((error) => {
                    expect(error.message).toContain('Claude exited with code 1');
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

                executeClaude('test prompt').catch((error) => {
                    expect(error.message).toBe('Process failed');
                    expect(logger.error).toHaveBeenCalledWith('Failed to execute Claude: Process failed');
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

                executeClaude('test prompt', 'testTask').then(() => {
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

                executeClaude('test prompt').then(() => {
                    expect(fs.existsSync).toHaveBeenCalled();
                    expect(fs.unlinkSync).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should implement timeout mechanism', (done) => {
            jest.useFakeTimers();

            mockChildProcess.stdout.on.mockImplementation((event, _handler) => {
                if (event === 'data') {
                    // Don't send any data to trigger timeout
                }
            });

            executeClaude('test prompt').catch((error) => {
                expect(error.message).toContain('Claude stuck - timeout');
                expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
                jest.useRealTimers();
                done();
            });

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(15 * 60 * 1000);
        });

        test('should suppress streaming logs when UI renderer is active', async () => {
            return new Promise((resolve) => {
                const mockStateManagerInstance = {
                    isUIRendererActive: jest.fn().mockReturnValue(true),
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

                executeClaude('test prompt', 'testTask').then(() => {
                    expect(console.log).not.toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should handle stderr data logging', async () => {
            return new Promise((resolve) => {
                mockChildProcess.stderr.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('error message\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeClaude('test prompt').then(() => {
                    expect(mockLogStream.write).toHaveBeenCalledWith('[STDERR] error message\n');
                    resolve();
                });
            });
        });

        test('should write log headers with timestamp', async () => {
            const mockDate = new Date('2024-01-01T00:00:00.000Z');
            const originalDate = global.Date;
            jest.spyOn(global, 'Date').mockImplementation((...args) => {
                if (args.length === 0) {
                    return mockDate;
                }
                return new originalDate(...args);
            });
            global.Date.now = jest.fn(() => 1704067200000); // Mock Date.now() specifically

            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt');

            expect(mockLogStream.write).toHaveBeenCalledWith(
                expect.stringContaining('[2024-01-01T00:00:00.000Z] Claude execution started'),
            );

            global.Date.mockRestore();
        });

        test('should use state.folder as default cwd when no options provided', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt');

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude')], {
                cwd: '/test',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });

        test('should use provided cwd from options when specified', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt', null, { cwd: '/custom/path' });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude')], {
                cwd: '/custom/path',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });

        test('should use state.folder when empty options object provided', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt', null, {});

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude')], {
                cwd: '/test',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });

        test('should use state.folder when options has undefined cwd', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt', null, { cwd: undefined });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude')], {
                cwd: '/test',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });

        test('should use provided cwd with taskName', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeClaude('test prompt', 'TASK0', { cwd: '/another/repo' });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude')], {
                cwd: '/another/repo',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });
    });

    describe('Edge cases and error handling', () => {
        test('should handle cleanup error gracefully', async () => {
            fs.existsSync.mockImplementation(() => {
                throw new Error('Cleanup failed');
            });

            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeClaude('test prompt').then(() => {
                    expect(logger.error).toHaveBeenCalledWith('Failed to cleanup temp file: Cleanup failed');
                    resolve();
                });
            });
        });

        test('should handle extremely long output', async () => {
            return new Promise((resolve) => {
                const longOutput = 'x'.repeat(10000);
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler(longOutput + '\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeClaude('test prompt').then(() => {
                    expect(mockLogStream.write).toHaveBeenCalledWith(longOutput + '\n');
                    resolve();
                });
            });
        });
    });
});
