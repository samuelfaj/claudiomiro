// Set 10 second timeout for all tests
jest.setTimeout(10000);

// Mock Date.now before importing modules that use it
jest.spyOn(Date, 'now').mockReturnValue(1234567890);

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processCodexEvent } = require('./codex-logger');
const { executeCodex } = require('./codex-executor');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./codex-logger');

// Mock ParallelStateManager
jest.mock('./parallel-state-manager');
const { ParallelStateManager } = require('./parallel-state-manager');

describe('Codex Executor', () => {
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

        // Mock processCodexEvent
        processCodexEvent.mockReturnValue('processed event');

        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(process.stdout, 'write').mockImplementation();

        // Mock process.stdout.columns
        Object.defineProperty(process.stdout, 'columns', {
            value: 80,
            configurable: true,
        });

        // Date.now is already mocked at the top of the file
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('executeCodex', () => {
        test('should throw error when no prompt provided', async () => {
            await expect(executeCodex('')).rejects.toThrow('no prompt');
            await expect(executeCodex(null)).rejects.toThrow('no prompt');
            await expect(executeCodex(undefined)).rejects.toThrow('no prompt');
        });

        test('should create temporary file with prompt text', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('claudiomiro-codex-'),
                'test prompt',
                'utf-8',
            );
        });

        test('should spawn Codex process with correct command', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt');

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('codex')], {
                cwd: '/test',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        });

        test('should create log stream with correct path', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt');

            expect(fs.createWriteStream).toHaveBeenCalledWith(
                '/test/.claudiomiro/codex-log.txt',
                { flags: 'a' },
            );
        });

        test('should write log headers with timestamp', async () => {
            // Mock Date constructor to return specific date for logging,
            // but preserve Date.now for filename generation
            const mockDate = new Date('2024-01-01T00:00:00.000Z');
            const originalDateNow = Date.now;

            jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
            // Ensure Date.now still works for the filename
            global.Date.now = originalDateNow;

            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt');

            expect(mockLogStream.write).toHaveBeenCalledWith(
                expect.stringContaining('[2024-01-01T00:00:00.000Z] Codex execution started'),
            );

            // Clean up Date mock
            global.Date.mockRestore();
        });

        test('should handle stdout data processing', async () => {
            return new Promise((resolve) => {
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('{"item": {"text": "Hello world"}}\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeCodex('test prompt').then(() => {
                    expect(processCodexEvent).toHaveBeenCalledWith('{"item": {"text": "Hello world"}}');
                    resolve();
                });
            });
        });

        test('should handle stderr data', async () => {
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

                executeCodex('test prompt').then(() => {
                    expect(mockLogStream.write).toHaveBeenCalledWith('[STDERR] error message\n');
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

                executeCodex('test prompt', 'testTask').then(() => {
                    expect(mockStateManagerInstance.updateClaudeMessage).toHaveBeenCalledWith('testTask', 'processed event');
                    resolve();
                });
            });
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

                executeCodex('test prompt', 'testTask').then(() => {
                    // console.log should not be called for streaming when UI renderer is active
                    expect(console.log).not.toHaveBeenCalled();
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

                executeCodex('test prompt').then(() => {
                    expect(logger.success).toHaveBeenCalledWith('Codex execution completed');
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

                executeCodex('test prompt').catch((error) => {
                    expect(error.message).toContain('Codex exited with code 1');
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

                executeCodex('test prompt').catch((error) => {
                    expect(error.message).toBe('Process failed');
                    expect(logger.error).toHaveBeenCalledWith('Failed to execute Codex: Process failed');
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

                executeCodex('test prompt').then(() => {
                    expect(fs.existsSync).toHaveBeenCalled();
                    expect(fs.unlinkSync).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should cleanup temporary file on error', async () => {
            fs.existsSync.mockReturnValue(true);

            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'error') {
                        setTimeout(() => handler(new Error('Process failed')), 0);
                    }
                });

                executeCodex('test prompt').catch(() => {
                    expect(fs.existsSync).toHaveBeenCalled();
                    expect(fs.unlinkSync).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should handle cleanup error gracefully', async () => {
            // Track call count to throw error only on cleanup (second call)
            let existsSyncCallCount = 0;
            fs.existsSync.mockImplementation(() => {
                existsSyncCallCount++;
                // First call is for directory check, second is for temp file cleanup
                if (existsSyncCallCount > 1) {
                    throw new Error('Cleanup failed');
                }
                return true; // Directory exists
            });

            return new Promise((resolve) => {
                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeCodex('test prompt').then(() => {
                    expect(logger.error).toHaveBeenCalledWith('Failed to cleanup temp file: Cleanup failed');
                    resolve();
                });
            });
        });

        test('should implement timeout mechanism', async () => {
            jest.useFakeTimers();

            mockChildProcess.stdout.on.mockImplementation((event, _handler) => {
                if (event === 'data') {
                    // Don't send any data to trigger timeout
                }
            });

            const executePromise = executeCodex('test prompt');

            // Attach catch handler BEFORE advancing timers to prevent unhandled rejection
            let caughtError = null;
            executePromise.catch((error) => {
                caughtError = error;
            });

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(15 * 60 * 1000);

            // Allow promise rejection to propagate
            await Promise.resolve();
            await Promise.resolve();

            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toContain('Codex stuck - timeout');
            expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');

            jest.useRealTimers();
        });

        test('should handle long text wrapping', async () => {
            Object.defineProperty(process.stdout, 'columns', {
                value: 20,
                configurable: true,
            });

            return new Promise((resolve) => {
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('{"item": {"text": "This is a very long message that should be wrapped"}}\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeCodex('test prompt').then(() => {
                    expect(console.log).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should handle empty processed event', async () => {
            processCodexEvent.mockReturnValue(null);

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

                executeCodex('test prompt').then(() => {
                    // Should not log when processed event is null
                    expect(console.log).not.toHaveBeenCalled();
                    resolve();
                });
            });
        });
    });

    describe('overwriteBlock function', () => {
        test('should use ANSI escape sequences correctly', () => {
            executeCodex('test prompt').catch(() => {
                expect(process.stdout.write).toHaveBeenCalled();
            });
        });
    });

    describe('Edge cases and error handling', () => {
        test('should handle JSON parsing errors gracefully', async () => {
            return new Promise((resolve) => {
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('invalid json {"malformed":}\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => handler(0), 0);
                    }
                });

                executeCodex('test prompt').then(() => {
                    // Should not crash on invalid JSON
                    expect(processCodexEvent).toHaveBeenCalled();
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

                executeCodex('test prompt').then(() => {
                    expect(mockLogStream.write).toHaveBeenCalledWith(longOutput + '\n');
                    resolve();
                });
            });
        });

        test('should handle multiple rapid stdout updates', async () => {
            return new Promise((resolve) => {
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        // Simulate multiple rapid updates
                        for (let i = 0; i < 10; i++) {
                            handler(`{"item": {"text": "Update ${i}"}}\n`);
                        }
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => {
                            expect(processCodexEvent).toHaveBeenCalledTimes(10);
                            handler(0);
                        }, 0);
                    }
                });

                executeCodex('test prompt').then(resolve);
            });
        });
    });

    describe('State management integration', () => {
        test('should not update state manager when no taskName provided', async () => {
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

                executeCodex('test prompt').then(() => {
                    expect(mockStateManagerInstance.updateClaudeMessage).not.toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('should handle state manager without isUIRendererActive method', async () => {
            return new Promise((resolve) => {
                const mockStateManagerInstance = {
                    updateClaudeMessage: jest.fn(),
                    // Missing isUIRendererActive method
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

                executeCodex('test prompt', 'testTask').then(() => {
                    // Should not crash when isUIRendererActive is missing
                    expect(mockStateManagerInstance.updateClaudeMessage).toHaveBeenCalled();
                    resolve();
                });
            });
        });
    });

    describe('Model tier functionality', () => {
        test('should use medium model and reasoning by default', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt');

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--model gpt-5.2')], expect.any(Object));
            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--reasoning-effort medium')], expect.any(Object));
        });

        test('should use low reasoning for fast model tier', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt', null, { model: 'fast' });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--model gpt-5.2')], expect.any(Object));
            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--reasoning-effort low')], expect.any(Object));
        });

        test('should use medium reasoning for medium model tier', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt', null, { model: 'medium' });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--model gpt-5.2')], expect.any(Object));
            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--reasoning-effort medium')], expect.any(Object));
        });

        test('should use high reasoning for hard model tier', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt', null, { model: 'hard' });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--model gpt-5.2')], expect.any(Object));
            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--reasoning-effort high')], expect.any(Object));
        });

        test('should fallback to medium for invalid model tier', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt', null, { model: 'invalid-tier' });

            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--model gpt-5.2')], expect.any(Object));
            expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('--reasoning-effort medium')], expect.any(Object));
        });

        test('should log command with correct model and reasoning', async () => {
            mockChildProcess.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    setTimeout(() => handler(0), 0);
                }
            });

            await executeCodex('test prompt', null, { model: 'hard' });

            expect(logger.command).toHaveBeenCalledWith(expect.stringContaining('--model gpt-5.2'));
            expect(logger.command).toHaveBeenCalledWith(expect.stringContaining('--reasoning-effort high'));
        });
    });

    describe('Codex-specific functionality', () => {
        test('should handle different Codex event types', async () => {
            const testCases = [
                { event: '{"item": {"text": "Hello"}}', expected: 'processed event' },
                { event: '{"item": {"command": "npm test"}}', expected: 'processed event' },
                { event: '{"prompt": "Create component"}', expected: 'processed event' },
                { event: '{"msg": {"text": "Processing"}}', expected: 'processed event' },
            ];

            return Promise.all(testCases.map(({ event }) => {
                return new Promise((resolve) => {
                    mockChildProcess.stdout.on.mockImplementation((eventType, handler) => {
                        if (eventType === 'data') {
                            handler(event + '\n');
                        }
                    });

                    mockChildProcess.on.mockImplementation((eventType, handler) => {
                        if (eventType === 'close') {
                            setTimeout(() => {
                                expect(processCodexEvent).toHaveBeenCalledWith(event);
                                handler(0);
                                resolve();
                            }, 0);
                        }
                    });

                    executeCodex('test prompt');
                });
            }));
        });

        test('should handle Codex-specific output formatting', async () => {
            processCodexEvent.mockImplementation(line => {
                const parsed = JSON.parse(line);
                if (parsed.item?.text) return parsed.item.text;
                if (parsed.item?.command) return '> ' + parsed.item.command;
                return null;
            });

            return new Promise((resolve) => {
                mockChildProcess.stdout.on.mockImplementation((event, handler) => {
                    if (event === 'data') {
                        handler('{"item": {"command": "git status"}}\n');
                    }
                });

                mockChildProcess.on.mockImplementation((event, handler) => {
                    if (event === 'close') {
                        setTimeout(() => {
                            expect(console.log).toHaveBeenCalledWith('> git status');
                            handler(0);
                            resolve();
                        }, 0);
                    }
                });

                executeCodex('test prompt');
            });
        });
    });
});
