const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('./claude-executor');
const { fixCommand, executeCommand } = require('./fix-command');

// Mock modules
jest.mock('child_process');
jest.mock('fs');
jest.mock('path');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./claude-executor');

// Mock process.exit
const originalExit = process.exit;
let mockExit;

describe('fix-command', () => {
  let mockSpawn;
  let mockChildProcess;
  let mockLogStream;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    path.join.mockImplementation((...args) => args.join('/'));
    state.claudiomiroFolder = '/test/.claudiomiro';
    state.folder = '/test';

    // Mock file system operations
    fs.existsSync = jest.fn();
    fs.mkdirSync = jest.fn();
    fs.createWriteStream = jest.fn();

    // Mock log stream
    mockLogStream = {
      write: jest.fn(),
      end: jest.fn()
    };
    fs.createWriteStream.mockReturnValue(mockLogStream);

    // Mock child process with proper event handling
    mockChildProcess = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            mockChildProcess.stdoutDataCallback = callback;
          }
        })
      },
      stderr: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            mockChildProcess.stderrDataCallback = callback;
          }
        })
      },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          mockChildProcess.closeCallback = callback;
        }
        if (event === 'error') {
          mockChildProcess.errorCallback = callback;
        }
      }),
      // Helper methods to simulate events
      emitClose: function(code) {
        if (this.closeCallback) this.closeCallback(code);
      },
      emitError: function(error) {
        if (this.errorCallback) this.errorCallback(error);
      },
      emitStdout: function(data) {
        if (this.stdoutDataCallback) this.stdoutDataCallback(data);
      },
      emitStderr: function(data) {
        if (this.stderrDataCallback) this.stderrDataCallback(data);
      }
    };
    mockSpawn = spawn;
    mockSpawn.mockReturnValue(mockChildProcess);

    // Mock executeClaude
    executeClaude.mockResolvedValue();

    // Mock console.log
    jest.spyOn(console, 'log').mockImplementation();

    // Mock process.exit
    mockExit = jest.fn();
    process.exit = mockExit;

    // Mock process.stdout.columns
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      configurable: true
    });

    // Mock process.platform
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true
    });
  });

  afterEach(() => {
    process.exit = originalExit;
    jest.restoreAllMocks();
  });

  describe('executeCommand', () => {
    test('should spawn command with correct parameters on Linux', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('ls -la').then((result) => {
          expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'ls -la'], {
            cwd: '/test',
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false
          });
          expect(result.success).toBe(true);
          expect(result.exitCode).toBe(0);
          resolve();
        });
      });
    });

    test('should spawn command with correct parameters on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('dir').then((result) => {
          expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'dir'], {
            cwd: '/test',
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false
          });
          resolve();
        });
      });
    });

    test('should initialize state folder if not set', async () => {
      state.claudiomiroFolder = null;
      state.setFolder = jest.fn();
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('ls').then(() => {
          expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
          expect(fs.mkdirSync).toHaveBeenCalled();
          resolve();
        });
      });
    });

    test('should create claudiomiro folder if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('ls').then(() => {
          expect(fs.mkdirSync).toHaveBeenCalledWith('/test/.claudiomiro', { recursive: true });
          resolve();
        });
      });
    });

    test('should create log stream with correct path', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('ls').then(() => {
          expect(fs.createWriteStream).toHaveBeenCalledWith(
            '/test/.claudiomiro/log.txt',
            { flags: 'a' }
          );
          resolve();
        });
      });
    });

    test('should write log headers with timestamp', async () => {
      fs.existsSync.mockReturnValue(true);
      const mockDate = new Date('2024-01-01T00:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('test command').then(() => {
          expect(mockLogStream.write).toHaveBeenCalledWith(
            expect.stringContaining('[2024-01-01T00:00:00.000Z] Command execution started: test command')
          );
          global.Date.mockRestore();
          resolve();
        });
      });
    });

    test('should handle stdout data', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('file1\nfile2\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('ls').then((result) => {
          expect(console.log).toHaveBeenCalledWith('file1');
          expect(console.log).toHaveBeenCalledWith('file2');
          expect(mockLogStream.write).toHaveBeenCalledWith('[STDOUT] file1\nfile2\n');
          expect(result.output).toContain('file1\nfile2\n');
          resolve();
        });
      });
    });

    test('should handle stderr data', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('error message\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 0);
          }
        });

        executeCommand('ls').then((result) => {
          expect(console.log).toHaveBeenCalledWith('error message');
          expect(mockLogStream.write).toHaveBeenCalledWith('[STDERR] error message\n');
          expect(result.output).toContain('error message\n');
          resolve();
        });
      });
    });

    test('should handle successful command execution', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('ls').then((result) => {
          expect(logger.success).toHaveBeenCalledWith('Command executed successfully (exit code: 0)');
          expect(result.success).toBe(true);
          expect(result.exitCode).toBe(0);
          resolve();
        });
      });
    });

    test('should handle failed command execution', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 0);
          }
        });

        executeCommand('false').then((result) => {
          expect(logger.error).toHaveBeenCalledWith('Command failed with exit code: 1');
          expect(result.success).toBe(false);
          expect(result.exitCode).toBe(1);
          resolve();
        });
      });
    });

    test('should handle process error', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Command not found')), 0);
          }
        });

        executeCommand('nonexistent').then((result) => {
          expect(logger.error).toHaveBeenCalledWith('Failed to execute command: Command not found');
          expect(result.success).toBe(false);
          expect(result.exitCode).toBe(-1);
          expect(result.error).toBe('Command not found');
          resolve();
        });
      });
    });

    test('should wrap long lines correctly', async () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: 20,
        configurable: true
      });

      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('This is a very long line that should be wrapped at column 20\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('echo').then(() => {
          expect(console.log).toHaveBeenCalledTimes(4); // Should be wrapped into 4 lines
          resolve();
        });
      });
    });

    test('should stop spinner and log command execution', async () => {
      fs.existsSync.mockReturnValue(true);

      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        executeCommand('test command').then(() => {
          expect(logger.stopSpinner).toHaveBeenCalled();
          expect(logger.command).toHaveBeenCalledWith('test command');
          expect(logger.separator).toHaveBeenCalled();
          resolve();
        });
      });
    });
  });

  describe('fixCommand', () => {
    test('should succeed on first attempt and exit', async () => {
      fs.existsSync.mockReturnValue(true);

      // Mock executeCommand to return success
      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: true, exitCode: 0, output: 'Success' });

      // This should call process.exit(0)
      fixCommand('ls', 3);

      // Wait a bit for the async operation
      setTimeout(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      }, 10);
    });

    test('should attempt to fix command on failure', async () => {
      fs.existsSync.mockReturnValue(true);

      // Simulate command failure twice (for 2 attempts)
      let attemptCount = 0;
      setTimeout(() => {
        mockChildProcess.emitClose(1);
        attemptCount++;
        if (attemptCount < 2) {
          // Simulate second failure after Claude execution
          setTimeout(() => {
            mockChildProcess.emitClose(1);
          }, 5);
        }
      }, 10);

      await expect(fixCommand('ls', 2)).rejects.toThrow('All 2 attempts to fix the command "ls" have failed');

      expect(executeClaude).toHaveBeenCalledWith('fix command "ls"');
      expect(logger.info).toHaveBeenCalledWith('fix command "ls"');
    }, 10000);

    test('should create claudiomiro folder if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Error' });

      await expect(fixCommand('ls', 1)).rejects.toThrow();

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/.claudiomiro', { recursive: true });
    });

    test('should handle Claude execution error gracefully', async () => {
      fs.existsSync.mockReturnValue(true);

      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Error' });

      executeClaude.mockRejectedValue(new Error('Claude failed'));

      // Mock console.log for error logging
      const consoleSpy = jest.spyOn(console, 'log');

      await expect(fixCommand('ls', 1)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Attempt 1 failed: Claude failed');
    });

    test('should respect maxAttempts parameter', async () => {
      fs.existsSync.mockReturnValue(true);

      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Error' });

      await expect(fixCommand('ls', 3)).rejects.toThrow('All 3 attempts to fix the command "ls" have failed');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(3);
      expect(executeClaude).toHaveBeenCalledTimes(3);
    });

    test('should handle zero maxAttempts', async () => {
      fs.existsSync.mockReturnValue(true);

      await expect(fixCommand('ls', 0)).rejects.toThrow('All 0 attempts to fix the command "ls" have failed');
    });

    test('should use correct command in error message', async () => {
      fs.existsSync.mockReturnValue(true);

      // Simulate command failure
      setTimeout(() => {
        mockChildProcess.emitClose(1);
      }, 10);

      await expect(fixCommand('npm install', 1)).rejects.toThrow('All 1 attempts to fix the command "npm install" have failed');
    }, 10000);

    test('should handle special characters in command', async () => {
      fs.existsSync.mockReturnValue(true);

      const commandWithSpecialChars = 'git commit -m "Fix bug #123 & update docs"';

      // Simulate command failure
      setTimeout(() => {
        mockChildProcess.emitClose(1);
      }, 10);

      await expect(fixCommand(commandWithSpecialChars, 1)).rejects.toThrow(
        expect.stringContaining('git commit -m "Fix bug #123 & update docs"')
      );

      expect(executeClaude).toHaveBeenCalledWith(`fix command "${commandWithSpecialChars}"`);
    }, 10000);

    test('should handle very long commands', async () => {
      fs.existsSync.mockReturnValue(true);

      const longCommand = 'x'.repeat(1000);

      // Simulate command failure
      setTimeout(() => {
        mockChildProcess.emitClose(1);
      }, 10);

      await expect(fixCommand(longCommand, 1)).rejects.toThrow(
        expect.stringContaining(longCommand)
      );

      expect(executeClaude).toHaveBeenCalledWith(`fix command "${longCommand}"`);
    }, 10000);
  });

  describe('Edge cases and error handling', () => {
    test('should handle empty command', async () => {
      fs.existsSync.mockReturnValue(true);

      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: true, exitCode: 0, output: '' });

      fixCommand('', 1);

      setTimeout(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      }, 10);
    });

    test('should handle command with only whitespace', async () => {
      fs.existsSync.mockReturnValue(true);

      // Simulate command failure
      setTimeout(() => {
        mockChildProcess.emitClose(1);
      }, 10);

      await expect(fixCommand('   ', 1)).rejects.toThrow(
        expect.stringContaining('   ')
      );
    }, 10000);

    test('should handle executeCommand throwing exception', async () => {
      fs.existsSync.mockReturnValue(true);

      // Simulate spawn error
      setTimeout(() => {
        mockChildProcess.emitError(new Error('Spawn failed'));
      }, 10);

      await expect(fixCommand('ls', 1)).rejects.toThrow();
    }, 10000);

    test('should handle undefined/null command gracefully', async () => {
      fs.existsSync.mockReturnValue(true);

      // Simulate command failure
      setTimeout(() => {
        mockChildProcess.emitClose(1);
      }, 10);

      await expect(fixCommand(undefined, 1)).rejects.toThrow(
        expect.stringContaining('undefined')
      );
    }, 10000);
  });
});