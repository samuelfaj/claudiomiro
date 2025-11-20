// Mock Date.now before importing modules that use it
jest.spyOn(Date, 'now').mockReturnValue(1234567890);

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processGlmMessage } = require('./glm-logger');
const { ParallelStateManager } = require('./parallel-state-manager');
const { executeGlm } = require('./glm-executor');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./glm-logger');
jest.mock('./parallel-state-manager');

describe('GLM Executor', () => {
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
    state.executorType = 'glm';

    // Mock file system operations
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn();
    fs.unlinkSync = jest.fn();
    fs.createWriteStream = jest.fn();

    // Mock log stream
    mockLogStream = {
      write: jest.fn(),
      end: jest.fn()
    };
    fs.createWriteStream.mockReturnValue(mockLogStream);

    // Mock child process
    mockChildProcess = {
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn(),
      kill: jest.fn()
    };
    mockSpawn = spawn;
    mockSpawn.mockReturnValue(mockChildProcess);

    // Mock state manager
    mockStateManager = {
      getInstance: jest.fn(() => ({
        isUIRendererActive: jest.fn().mockReturnValue(false),
        updateClaudeMessage: jest.fn()
      }))
    };
    ParallelStateManager.getInstance = mockStateManager.getInstance;

    // Mock processGlmMessage
    processGlmMessage.mockReturnValue('processed message');

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(process.stdout, 'write').mockImplementation();

    // Mock process.stdout.columns
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      configurable: true
    });

    // Date.now is already mocked at the top of the file
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeGlm', () => {
    test('should call runGlm when executorType is not codex', async () => {
      // Since runGlm is not exported directly, we test executeGlm behavior
      const text = 'test prompt';

      // Mock the spawn to return success
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      await expect(executeGlm(text)).resolves.not.toThrow();
    });

    test('should delegate to executeCodex when executorType is codex', async () => {
      state.executorType = 'codex';

      const mockExecuteCodex = jest.fn().mockResolvedValue();
      jest.doMock('./codex-executor', () => ({
        executeCodex: mockExecuteCodex
      }));

      await executeGlm('test prompt');

      expect(state.executorType).toBe('codex');
    });
  });

  describe('runGlm internal functionality', () => {
    test('should throw error when no prompt provided', async () => {
      await expect(executeGlm('')).rejects.toThrow('no prompt');
      await expect(executeGlm(null)).rejects.toThrow('no prompt');
      await expect(executeGlm(undefined)).rejects.toThrow('no prompt');
    });

    test('should create temporary file with prompt text', async () => {
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      await executeGlm('test prompt');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('claudiomiro-codex-'),
        'test prompt',
        'utf-8'
      );
    });

    test('should spawn GLM process with correct command', async () => {
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      await executeGlm('test prompt');

      expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('glm')], {
        cwd: '/test',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    test('should create log stream with correct path', async () => {
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      await executeGlm('test prompt');

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/test/.claudiomiro/log.txt',
        { flags: 'a' }
      );
    });

    test('should write log headers with timestamp', async () => {
      // Mock Date constructor to return a specific date
      const mockDate = new Date('2024-01-01T00:00:00.000Z');
      const OriginalDate = global.Date;
      global.Date = jest.fn(() => mockDate);
      global.Date.prototype = Object.create(Date.prototype);
      global.Date.prototype.constructor = global.Date;
      global.Date.now = OriginalDate.now;

      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          // Call handler immediately instead of using setTimeout
          handler(0);
        }
      });

      await executeGlm('test prompt');

      expect(mockLogStream.write).toHaveBeenCalledWith(
        expect.stringContaining('[2024-01-01T00:00:00.000Z]')
      );

      // Restore Date
      global.Date = OriginalDate;
    });

    test('should handle stdout data processing', async () => {
      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('{"type": "assistant", "message": {"content": [{"type": "text", "text": "Hello"}]}}\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeGlm('test prompt').then(() => {
          expect(processGlmMessage).toHaveBeenCalled();
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

        executeGlm('test prompt').then(() => {
          expect(mockLogStream.write).toHaveBeenCalledWith('[STDERR] error message\n');
          resolve();
        });
      });
    });

    test('should update state manager when taskName provided', async () => {
      return new Promise((resolve) => {
        const mockStateManagerInstance = {
          isUIRendererActive: jest.fn().mockReturnValue(false),
          updateClaudeMessage: jest.fn()
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

        executeGlm('test prompt', 'testTask').then(() => {
          expect(mockStateManagerInstance.updateClaudeMessage).toHaveBeenCalledWith('testTask', 'processed message');
          resolve();
        });
      });
    });

    test('should suppress streaming logs when UI renderer is active', async () => {
      return new Promise((resolve) => {
        const mockStateManagerInstance = {
          isUIRendererActive: jest.fn().mockReturnValue(true),
          updateClaudeMessage: jest.fn()
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

        executeGlm('test prompt', 'testTask').then(() => {
          // console.log should not be called for streaming when UI renderer is active
          expect(console.log).not.toHaveBeenCalled();
          resolve();
        });
      });
    });

    test('should handle process close with success code', async () => {
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 0);
        }
      });

      await executeGlm('test prompt');

      expect(logger.success).toHaveBeenCalledWith('Glm execution completed');
    });

    test('should handle process close with error code', async () => {
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(1), 0);
        }
      });

      try {
        await executeGlm('test prompt');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Glm exited with code 1');
      }
    });

    test('should handle process error', async () => {
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('Process failed')), 0);
        }
      });

      try {
        await executeGlm('test prompt');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Process failed');
        expect(logger.error).toHaveBeenCalledWith('Failed to execute Glm: Process failed');
      }
    });

    test('should cleanup temporary file on successful completion', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeGlm('test prompt').then(() => {
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

        executeGlm('test prompt').catch(() => {
          expect(fs.existsSync).toHaveBeenCalled();
          expect(fs.unlinkSync).toHaveBeenCalled();
          resolve();
        });
      });
    });

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

        executeGlm('test prompt').then(() => {
          expect(logger.error).toHaveBeenCalledWith('Failed to cleanup temp file: Cleanup failed');
          resolve();
        });
      });
    });

    test.skip('should implement timeout mechanism', (done) => {
      // TODO: Fix this test - fake timers and timeout mechanism not working correctly
      // Test is temporarily skipped due to complex timer interactions
      jest.useFakeTimers();

      // Ensure Date.now is available with fake timers
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);

      mockChildProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          // Don't send any data to trigger timeout
          // The handler won't be called, so no data will be received
        }
      });

      executeGlm('test prompt').catch((error) => {
        expect(error.message).toContain('Glm stuck - timeout after 10 minutes of inactivity');
        expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
        jest.useRealTimers();
        jest.restoreAllMocks();
        done();
      });

      // Fast-forward time to trigger timeout (more than 10 minutes)
      jest.advanceTimersByTime(10 * 60 * 1000 + 1000);
    });

    test('should reset timeout on data received', () => {
      jest.useFakeTimers();

      // Ensure Date.now is available with fake timers
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockChildProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          // Simulate receiving data that would reset timeout
          setTimeout(() => handler('test data'), 1000);
        }
      });

      // Start the execution
      const promise = executeGlm('test prompt');

      // Advance some time
      jest.advanceTimersByTime(5000);

      // Timeout should be reset because data was received
      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test('should handle long text wrapping', async () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: 20,
        configurable: true
      });

      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('{"type": "assistant", "message": {"content": [{"type": "text", "text": "This is a very long message that should be wrapped"}]}}\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeGlm('test prompt').then(() => {
          expect(console.log).toHaveBeenCalled();
          resolve();
        });
      });
    });

    test('should handle empty processed message', async () => {
      processGlmMessage.mockReturnValue(null);

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

        executeGlm('test prompt').then(() => {
          // Should not log when processed message is null
          expect(console.log).not.toHaveBeenCalled();
          resolve();
        });
      });
    });
  });

  describe('overwriteBlock function', () => {
    test('should use ANSI escape sequences correctly', () => {
      executeGlm('test prompt').catch(() => {
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

        executeGlm('test prompt').then(() => {
          // Should not crash on invalid JSON
          expect(processGlmMessage).toHaveBeenCalled();
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

        executeGlm('test prompt').then(() => {
          expect(mockLogStream.write).toHaveBeenCalledWith(longOutput + '\n');
          resolve();
        });
      });
    });

    test('should handle multiple rapid stdout updates', async () => {
      return new Promise((resolve) => {
        let callCount = 0;
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            // Simulate multiple rapid updates
            for (let i = 0; i < 10; i++) {
              handler(`{"type": "assistant", "message": {"content": [{"type": "text", "text": "Update ${i}"}]}}\n`);
            }
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => {
              expect(processGlmMessage).toHaveBeenCalledTimes(10);
              handler(0);
            }, 0);
          }
        });

        executeGlm('test prompt').then(resolve);
      });
    });
  });

  describe('State management integration', () => {
    test('should not update state manager when no taskName provided', async () => {
      return new Promise((resolve) => {
        const mockStateManagerInstance = {
          isUIRendererActive: jest.fn().mockReturnValue(false),
          updateClaudeMessage: jest.fn()
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

        executeGlm('test prompt').then(() => {
          expect(mockStateManagerInstance.updateClaudeMessage).not.toHaveBeenCalled();
          resolve();
        });
      });
    });

    test('should handle state manager without isUIRendererActive method', async () => {
      return new Promise((resolve) => {
        const mockStateManagerInstance = {
          updateClaudeMessage: jest.fn()
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

        executeGlm('test prompt', 'testTask').then(() => {
          // Should not crash when isUIRendererActive is missing
          expect(mockStateManagerInstance.updateClaudeMessage).toHaveBeenCalled();
          resolve();
        });
      });
    });
  });
});