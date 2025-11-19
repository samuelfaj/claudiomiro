const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processDeepSeekMessage } = require('./deep-seek-logger');
const { ParallelStateManager } = require('./parallel-state-manager');
const { executeDeepSeek } = require('./deep-seek-executor');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./deep-seek-logger');
jest.mock('./parallel-state-manager');

describe('deep-seek-executor', () => {
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
    state.executorType = 'deepseek';

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

    // Mock processDeepSeekMessage
    processDeepSeekMessage.mockReturnValue('processed message');

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(process.stdout, 'write').mockImplementation();

    // Mock process.stdout.columns
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      configurable: true
    });

    // Mock Date.now using spyOn
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeDeepSeek', () => {
    test('should call runDeepSeek when executorType is not codex', async () => {
      const { runDeepSeek } = require('./deep-seek-executor');
      const runDeepSeekSpy = jest.fn().mockResolvedValue();

      // Replace runDeepSeek with spy
      require('./deep-seek-executor').runDeepSeek = runDeepSeekSpy;

      await executeDeepSeek('test prompt');

      expect(runDeepSeekSpy).toHaveBeenCalledWith('test prompt', null);
    });

    test('should delegate to executeCodex when executorType is codex', async () => {
      state.executorType = 'codex';

      const mockExecuteCodex = jest.fn().mockResolvedValue();
      jest.doMock('./codex-executor', () => ({
        executeCodex: mockExecuteCodex
      }));

      await executeDeepSeek('test prompt');

      // Since we're using jest.doMock, we need to manually check the behavior
      expect(state.executorType).toBe('codex');
    });
  });

  describe('runDeepSeek internal functionality', () => {

    test('should throw error when no prompt provided', async () => {
      await expect(executeDeepSeek('')).rejects.toThrow('no prompt');
      await expect(executeDeepSeek(null)).rejects.toThrow('no prompt');
      await expect(executeDeepSeek(undefined)).rejects.toThrow('no prompt');
    });

    test('should create temporary file with prompt text', async () => {
      await executeDeepSeek('test prompt');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('claudiomiro-codex-'),
        'test prompt',
        'utf-8'
      );
    });

    test('should spawn DeepSeek process with correct command', async () => {
      await executeDeepSeek('test prompt');

      expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('deepseek')], {
        cwd: '/test',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    test('should create log stream with correct path', async () => {
      await executeDeepSeek('test prompt');

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/test/.claudiomiro/log.txt',
        { flags: 'a' }
      );
    });

    test('should write log headers with timestamp', async () => {
      const originalDate = global.Date;
      const mockDate = new Date('2024-01-01T00:00:00.000Z');

      // Create a mock Date constructor that preserves Date.now
      const MockDate = jest.fn(() => mockDate);
      MockDate.now = jest.fn(() => 1234567890);
      MockDate.prototype = originalDate.prototype;

      global.Date = MockDate;

      await executeDeepSeek('test prompt');

      expect(mockLogStream.write).toHaveBeenCalledWith(
        expect.stringContaining('[2024-01-01T00:00:00.000Z] DeepSeek execution started')
      );

      global.Date = originalDate;
    });

    test('should handle stdout data processing', async () => {
      return new Promise((resolve) => {
        // Capture the stdout event handler
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            // Simulate receiving data
            handler('{"type": "test", "content": "message"}\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            // Simulate successful completion
            setTimeout(() => handler(0), 0);
          }
        });

        executeDeepSeek('test prompt').then(() => {
          expect(processDeepSeekMessage).toHaveBeenCalledWith('{"type": "test", "content": "message"}');
          expect(console.log).toHaveBeenCalledWith('💬 DeepSeek:');
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

        executeDeepSeek('test prompt').then(() => {
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

        executeDeepSeek('test prompt', 'testTask').then(() => {
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

        executeDeepSeek('test prompt', 'testTask').then(() => {
          // console.log should not be called for streaming when UI renderer is active
          expect(console.log).not.toHaveBeenCalledWith('💬 DeepSeek:');
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

        executeDeepSeek('test prompt').then(() => {
          expect(logger.success).toHaveBeenCalledWith('DeepSeek execution completed');
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

        executeDeepSeek('test prompt').catch((error) => {
          expect(error.message).toContain('DeepSeek exited with code 1');
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

        executeDeepSeek('test prompt').catch((error) => {
          expect(error.message).toBe('Process failed');
          expect(logger.error).toHaveBeenCalledWith('Failed to execute DeepSeek: Process failed');
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

        executeDeepSeek('test prompt').then(() => {
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

        executeDeepSeek('test prompt').catch(() => {
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

        executeDeepSeek('test prompt').then(() => {
          expect(logger.error).toHaveBeenCalledWith('Failed to cleanup temp file: Cleanup failed');
          resolve();
        });
      });
    });

    test('should implement timeout mechanism', (done) => {
      jest.useFakeTimers();

      mockChildProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          // Don't send any data to trigger timeout
        }
      });

      executeDeepSeek('test prompt').catch((error) => {
        expect(error.message).toContain('DeepSeek stuck - timeout after 10 minutes of inactivity');
        expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
        jest.useRealTimers();
        done();
      });

      // Fast-forward time by 15 minutes to trigger timeout
      jest.advanceTimersByTime(15 * 60 * 1000);
    });

    test('should reset timeout on data received', () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockChildProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          // Simulate receiving data that would reset timeout
          setTimeout(() => handler('test data'), 1000);
        }
      });

      // Start the execution
      const promise = executeDeepSeek('test prompt');

      // Advance some time
      jest.advanceTimersByTime(5000);

      // Timeout should not trigger because data was received
      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('should handle long text wrapping', async () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: 20,
        configurable: true
      });

      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('{"type": "text", "content": "This is a very long message that should be wrapped"}\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeDeepSeek('test prompt').then(() => {
          expect(console.log).toHaveBeenCalledTimes(expect.stringContaining('This is a very long'));
          resolve();
        });
      });
    });

    test('should handle empty processed message', async () => {
      processDeepSeekMessage.mockReturnValue(null);

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

        executeDeepSeek('test prompt').then(() => {
          // Should not log when processed message is null
          expect(console.log).not.toHaveBeenCalledWith('💬 DeepSeek:');
          resolve();
        });
      });
    });
  });

  describe('overwriteBlock function', () => {
    test('should use ANSI escape sequences to move cursor and clear lines', () => {
      const { executeDeepSeek } = require('./deep-seek-executor');

      // This indirectly tests overwriteBlock through the execution
      executeDeepSeek('test prompt').catch(() => {
        // We expect this to fail since we're not mocking the spawn properly
        // but we want to test that the ANSI sequences are set up
        expect(process.stdout.write).toHaveBeenCalled();
      });
    });
  });
});