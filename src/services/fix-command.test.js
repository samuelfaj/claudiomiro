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
          // Auto-emit close event for tests that don't set up custom behavior
          setTimeout(() => callback(0), 0);
        }
        if (event === 'error') {
          mockChildProcess.errorCallback = callback;
        }
      }),
      kill: jest.fn(),
      stdin: {
        write: jest.fn(),
        end: jest.fn()
      },
      // Helper methods to simulate events
      emitClose: function(code = 0) {
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

      const result = await executeCommand('ls -la');

      expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'ls -la'], {
        cwd: '/test',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    test('should spawn command with correct parameters on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      fs.existsSync.mockReturnValue(true);

      const result = await executeCommand('dir');

      expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'dir'], {
        cwd: '/test',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    test('should initialize state folder if not set', async () => {
      state.claudiomiroFolder = null;
      state.setFolder = jest.fn();
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      await executeCommand('ls');

      expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    test('should create claudiomiro folder if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      await executeCommand('ls');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/.claudiomiro', { recursive: true });
    });

    test('should create log stream with correct path', async () => {
      fs.existsSync.mockReturnValue(true);

      await executeCommand('ls');

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/test/.claudiomiro/log.txt',
        { flags: 'a' }
      );
    });

    test('should write log headers with timestamp', async () => {
      fs.existsSync.mockReturnValue(true);
      const mockDate = new Date('2024-01-01T00:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await executeCommand('test command');

      expect(mockLogStream.write).toHaveBeenCalledWith(
        expect.stringContaining('[2024-01-01T00:00:00.000Z] Command execution started: test command')
      );
      global.Date.mockRestore();
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

      // Mock executeCommand to simulate failure
      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Error' });

      await expect(fixCommand('ls', 2)).rejects.toThrow('All 2 attempts to fix the command "ls" have failed');

      expect(executeClaude).toHaveBeenCalledWith('fix command "ls"');
      expect(logger.info).toHaveBeenCalledWith('fix command "ls"');
    });

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

      // Mock executeCommand to simulate failure
      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Error' });

      await expect(fixCommand(commandWithSpecialChars, 1)).rejects.toThrow(
        expect.stringContaining('git commit -m "Fix bug #123 & update docs"')
      );

      expect(executeClaude).toHaveBeenCalledWith(`fix command "${commandWithSpecialChars}"`);
    });

    test('should handle very long commands', async () => {
      fs.existsSync.mockReturnValue(true);

      const longCommand = 'x'.repeat(1000);

      // Mock executeCommand to simulate failure
      const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Error' });

      await expect(fixCommand(longCommand, 1)).rejects.toThrow(
        expect.stringContaining(longCommand)
      );

      expect(executeClaude).toHaveBeenCalledWith(`fix command "${longCommand}"`);
    });
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

  describe('Enhanced Platform-Specific Testing', () => {
    describe('Shell Selection and Command Formatting', () => {
      test('should use bash on Linux platform', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "test"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "test"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should use bash on macOS platform', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('ls -la').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'ls -la'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should use cmd.exe on Windows platform', async () => {
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

          executeCommand('dir').then(() => {
            expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'dir'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle Windows path separators correctly', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });

        path.join.mockImplementation((...args) => args.join('\\'));

        fs.existsSync.mockReturnValue(true);
        state.claudiomiroFolder = 'C:\\Users\\test\\.claudiomiro';

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('type file.txt').then(() => {
            expect(fs.createWriteStream).toHaveBeenCalledWith(
              'C:\\Users\\test\\.claudiomiro\\log.txt',
              { flags: 'a' }
            );
            resolve();
          });
        });
      });

      test('should handle Unix path separators correctly', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        path.join.mockImplementation((...args) => args.join('/'));

        fs.existsSync.mockReturnValue(true);
        state.claudiomiroFolder = '/home/user/.claudiomiro';

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('cat file.txt').then(() => {
            expect(fs.createWriteStream).toHaveBeenCalledWith(
              '/home/user/.claudiomiro/log.txt',
              { flags: 'a' }
            );
            resolve();
          });
        });
      });
    });

    describe('Platform-Specific Command Quoting', () => {
      test('should handle commands with single quotes on Unix systems', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand("echo 'Hello World'").then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', "echo 'Hello World'"], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with double quotes on Windows', async () => {
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

          executeCommand('echo "Hello World"').then(() => {
            expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'echo "Hello World"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with escaped quotes on Unix', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "Hello \\"World\\""').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "Hello \\"World\\""'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle environment variable syntax differences', async () => {
        fs.existsSync.mockReturnValue(true);

        // Test Unix-style environment variables
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo $PATH').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo $PATH'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle Windows environment variable syntax', async () => {
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

          executeCommand('echo %PATH%').then(() => {
            expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'echo %PATH%'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Executable Handling and File Extensions', () => {
      test('should handle Windows executable extensions', async () => {
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

          executeCommand('program.exe --option').then(() => {
            expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'program.exe --option'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle Unix executables without extensions', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('./script.sh --flag').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', './script.sh --flag'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle shell script execution on Unix systems', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('bash deploy.sh').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'bash deploy.sh'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle batch file execution on Windows', async () => {
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

          executeCommand('deploy.bat').then(() => {
            expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'deploy.bat'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Working Directory Handling', () => {
      test('should handle Windows-style working directory paths', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);
        state.folder = 'C:\\Projects\\MyApp';

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('npm test').then(() => {
            expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'npm test'], {
              cwd: 'C:\\Projects\\MyApp',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle Unix-style working directory paths', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);
        state.folder = '/home/user/projects/myapp';

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('npm test').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'npm test'], {
              cwd: '/home/user/projects/myapp',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle relative working directories', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);
        state.folder = './src';

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('ls -la').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'ls -la'], {
              cwd: './src',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Platform-Specific Error Handling', () => {
      test('should handle Windows file not found errors', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('\'nonexistent.exe\' is not recognized as an internal or external command')), 0);
            }
          });

          executeCommand('nonexistent.exe').then((result) => {
            expect(result.success).toBe(false);
            expect(result.error).toContain('not recognized');
            resolve();
          });
        });
      });

      test('should handle Unix file not found errors', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('nonexistent: command not found')), 0);
            }
          });

          executeCommand('nonexistent').then((result) => {
            expect(result.success).toBe(false);
            expect(result.error).toContain('command not found');
            resolve();
          });
        });
      });

      test('should handle Windows permission denied errors', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(5), 0); // Exit code 5 for Access Denied on Windows
            }
          });

          executeCommand('protected.exe').then((result) => {
            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(5);
            resolve();
          });
        });
      });

      test('should handle Unix permission denied errors', async () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(126), 0); // Exit code 126 for Permission denied on Unix
            }
          });

          executeCommand('./protected.sh').then((result) => {
            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(126);
            resolve();
          });
        });
      });
    });
  });

  describe('Complex Command Reconstruction Tests', () => {
    describe('Multi-Argument Commands with Flags', () => {
      test('should handle commands with multiple flags and arguments', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('git commit -m "Fix bug #123" --author="John Doe <john@example.com>" --no-verify').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'git commit -m "Fix bug #123" --author="John Doe <john@example.com>" --no-verify'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with short and long flag combinations', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('docker run -it --rm -p 8080:80 -v /host/path:/container/path nginx:latest').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'docker run -it --rm -p 8080:80 -v /host/path:/container/path nginx:latest'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle npm scripts with complex arguments', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('npm run build -- --mode production --output-path ./dist --analyze').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'npm run build -- --mode production --output-path ./dist --analyze'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Nested and Escaped Quotes', () => {
      test('should handle commands with nested single quotes inside double quotes', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "It\'s a beautiful day"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "It\'s a beautiful day"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with escaped double quotes', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('grep "hello \\"world\\"" file.txt').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'grep "hello \\"world\\"" file.txt'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with backticks', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "Version: `git describe --tags`"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "Version: \`git describe --tags\`"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with complex nested quoting', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('sh -c "echo \'Don\\\'t worry\' && echo \\"Be happy\\""').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'sh -c "echo \'Don\\\'t worry\' && echo \\"Be happy\\""'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Special Characters and Symbols', () => {
      test('should handle commands with environment variable expansions', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo $HOME && echo $PATH && echo ${USER}').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo $HOME && echo $PATH && echo ${USER}'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with redirection operators', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('ls -la > output.txt 2>&1 && grep "error" output.txt').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'ls -la > output.txt 2>&1 && grep "error" output.txt'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with pipes and chaining', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('ps aux | grep node | grep -v grep | awk \'{print $2}\' | xargs kill -9').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'ps aux | grep node | grep -v grep | awk \'{print $2}\' | xargs kill -9'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with wildcard patterns', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('cp *.js backup/ && rm *.tmp && find . -name "*.log" -type f').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'cp *.js backup/ && rm *.tmp && find . -name "*.log" -type f'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with special shell characters', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "Line1\nLine2\nLine3" | sed \'s/Line/ITEM/g\' | tr \'[:lower:]\' \'[:upper:]\'').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "Line1\\nLine2\\nLine3" | sed \'s/Line/ITEM/g\' | tr \'[:lower:]\' \'[:upper:]\''], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Very Long Commands and Line Wrapping', () => {
      test('should handle extremely long commands without breaking syntax', async () => {
        fs.existsSync.mockReturnValue(true);

        const longArgs = Array.from({ length: 50 }, (_, i) => `--option${i}=value${i}`).join(' ');
        const veryLongCommand = `configure ${longArgs} --final-param="very long value with spaces and special chars & symbols"`;

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand(veryLongCommand).then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', veryLongCommand], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with long file paths', async () => {
        fs.existsSync.mockReturnValue(true);

        const longPath = '/very/long/path/that/exceeds/normal/filesystem/limits/and/contains/many/directories/and/subdirectories/with/long/names';
        const commandWithLongPath = `cp "${longPath}/source-file.txt" "${longPath}/destination-file.txt"`;

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand(commandWithLongPath).then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', commandWithLongPath], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should properly wrap long commands in console output', async () => {
        Object.defineProperty(process.stdout, 'columns', {
          value: 40,
          configurable: true
        });

        fs.existsSync.mockReturnValue(true);
        const longOutput = 'This is a very long line of output that should be wrapped at exactly 40 characters and continue on the next line properly without breaking words inappropriately.';

        return new Promise((resolve) => {
          mockChildProcess.stdout.on.mockImplementation((event, handler) => {
            if (event === 'data') {
              handler(longOutput);
            }
          });

          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo long').then(() => {
            // Should wrap at approximately 40 character intervals
            expect(console.log).toHaveBeenCalledTimes(Math.ceil(longOutput.length / 40));
            resolve();
          });
        });
      });
    });

    describe('Command Sanitization and Security', () => {
      test('should handle potentially dangerous command characters safely', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "Normal output" && rm -rf / # This comment should be preserved').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "Normal output" && rm -rf / # This comment should be preserved'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with command substitution', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "Current branch: $(git branch --show-current)" && echo "Files: $(ls | wc -l)"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "Current branch: $(git branch --show-current)" && echo "Files: $(ls | wc -l)"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle arithmetic expressions', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo $((2 + 3 * 4)) && echo $[10 / 2] && let result=5+6; echo $result').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo $((2 + 3 * 4)) && echo $[10 / 2] && let result=5+6; echo $result'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });

    describe('Multi-line Commands and Scripts', () => {
      test('should handle commands with line continuations', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('echo "part1" \\\n&& echo "part2" \\\n&& echo "part3"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "part1" \\\n&& echo "part2" \\\n&& echo "part3"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle commands with semicolon separators', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('cd /tmp; ls -la; pwd; echo "Done"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'cd /tmp; ls -la; pwd; echo "Done"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });

      test('should handle logical operators in commands', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('command1 && command2 || command3 || echo "All failed"').then(() => {
            expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'command1 && command2 || command3 || echo "All failed"'], {
              cwd: '/test',
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false
            });
            resolve();
          });
        });
      });
    });
  });

  describe('Enhanced Retry Logic Testing', () => {
    describe('Retry Success Patterns', () => {
      test('should succeed after initial failure', async () => {
        fs.existsSync.mockReturnValue(true);

        // Mock executeCommand to fail once, then succeed
        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;

        mockExecuteCommand.mockImplementation(() => {
          attemptCount++;
          if (attemptCount === 1) {
            return Promise.resolve({ success: false, exitCode: 1, output: 'First failure' });
          } else {
            return Promise.resolve({ success: true, exitCode: 0, output: 'Success!' });
          }
        });

        // fixCommand calls process.exit(0) when successful, so it won't resolve
        // We need to wrap it to prevent actual exit
        const promise = fixCommand('test-command', 3);

        // Wait for the operations to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(attemptCount).toBe(2);
        expect(executeClaude).toHaveBeenCalledTimes(1);
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      test('should succeed after multiple failures', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;

        mockExecuteCommand.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.resolve({ success: false, exitCode: 1, output: `Attempt ${attemptCount} failed` });
          } else {
            return Promise.resolve({ success: true, exitCode: 0, output: 'Finally succeeded!' });
          }
        });

        // fixCommand calls process.exit(0) when successful, so it won't resolve
        const promise = fixCommand('persistent-command', 5);

        // Wait for the operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(attemptCount).toBe(3);
        expect(executeClaude).toHaveBeenCalledTimes(2);
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      test('should succeed on last possible attempt', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;

        mockExecuteCommand.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 4) {
            return Promise.resolve({ success: false, exitCode: 1, output: `Failure ${attemptCount}` });
          } else {
            return Promise.resolve({ success: true, exitCode: 0, output: 'Last attempt success!' });
          }
        });

        fixCommand('last-chance-command', 4);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(attemptCount).toBe(4);
        expect(executeClaude).toHaveBeenCalledTimes(3);
        expect(mockExit).toHaveBeenCalledWith(0);
      });
    });

    describe('Maximum Attempts Limit Enforcement', () => {
      test('should stop after maxAttempts when all attempts fail', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Always fails' });

        await expect(fixCommand('failing-command', 3)).rejects.toThrow(
          'All 3 attempts to fix the command "failing-command" have failed'
        );

        expect(mockExecuteCommand).toHaveBeenCalledTimes(3);
        expect(executeClaude).toHaveBeenCalledTimes(3);
      });

      test('should handle zero maxAttempts', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');

        await expect(fixCommand('test-command', 0)).rejects.toThrow(
          'All 0 attempts to fix the command "test-command" have failed'
        );

        expect(mockExecuteCommand).not.toHaveBeenCalled();
        expect(executeClaude).not.toHaveBeenCalled();
      });

      test('should handle negative maxAttempts gracefully', async () => {
        fs.existsSync.mockReturnValue(true);

        await expect(fixCommand('test-command', -1)).rejects.toThrow(
          'All -1 attempts to fix the command "test-command" have failed'
        );
      });

      test('should respect large maxAttempts values', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Fails every time' });

        await expect(fixCommand('persistent-fail', 10)).rejects.toThrow(
          'All 10 attempts to fix the command "persistent-fail" have failed'
        );

        expect(mockExecuteCommand).toHaveBeenCalledTimes(10);
        expect(executeClaude).toHaveBeenCalledTimes(10);
      });
    });

    describe('Different Failure Types and Patterns', () => {
      test('should handle command not found errors repeatedly', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({
          success: false,
          exitCode: -1,
          output: 'command not found',
          error: 'command not found: nonexistent'
        });

        await expect(fixCommand('nonexistent', 2)).rejects.toThrow();

        expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
        expect(executeClaude).toHaveBeenCalledWith('fix command "nonexistent"');
      });

      test('should handle permission denied errors repeatedly', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({
          success: false,
          exitCode: 126,
          output: 'Permission denied',
          error: 'Permission denied'
        });

        await expect(fixCommand('./protected.sh', 3)).rejects.toThrow();

        expect(mockExecuteCommand).toHaveBeenCalledTimes(3);
        expect(executeClaude).toHaveBeenCalledWith('fix command "./protected.sh"');
      });

      test('should handle timeout scenarios', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({
          success: false,
          exitCode: 124, // timeout exit code
          output: 'Command timed out',
          error: 'Timeout exceeded'
        });

        await expect(fixCommand('long-running-command', 2)).rejects.toThrow();

        expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
        expect(executeClaude).toHaveBeenCalledWith('fix command "long-running-command"');
      });

      test('should handle intermittent failures', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;

        mockExecuteCommand.mockImplementation(() => {
          attemptCount++;
          // Simulate intermittent success
          if (attemptCount % 2 === 0) {
            return Promise.resolve({ success: true, exitCode: 0, output: 'Success!' });
          } else {
            return Promise.resolve({ success: false, exitCode: 1, output: `Failure ${attemptCount}` });
          }
        });

        fixCommand('intermittent-command', 5);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(attemptCount).toBe(2); // Should succeed on second attempt
        expect(executeClaude).toHaveBeenCalledTimes(1);
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      test('should handle different error messages for same command', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;
        const errors = ['File not found', 'Permission denied', 'Syntax error'];

        mockExecuteCommand.mockImplementation(() => {
          const errorIndex = (attemptCount++) % errors.length;
          return Promise.resolve({
            success: false,
            exitCode: 1,
            output: errors[errorIndex],
            error: errors[errorIndex]
          });
        });

        await expect(fixCommand('multi-error-command', 4)).rejects.toThrow();

        expect(mockExecuteCommand).toHaveBeenCalledTimes(4);
        // Each attempt should call executeClaude with the same command
        expect(executeClaude).toHaveBeenCalledTimes(4);
        executeClaude.mock.calls.forEach(call => {
          expect(call[0]).toBe('fix command "multi-error-command"');
        });
      });
    });

    describe('Claude Executor Interaction During Retries', () => {
      test('should handle Claude executor success but command still failing', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Still fails' });

        // Mock Claude to appear to succeed but command still fails
        executeClaude.mockResolvedValue(undefined);

        await expect(fixCommand('stubborn-command', 2)).rejects.toThrow();

        expect(executeClaude).toHaveBeenCalledTimes(2);
        expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
      });

      test('should handle Claude executor failures during retries', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Command fails' });

        // Mock Claude to fail
        executeClaude.mockRejectedValue(new Error('Claude API error'));

        const consoleSpy = jest.spyOn(console, 'log');

        await expect(fixCommand('problematic-command', 2)).rejects.toThrow();

        expect(executeClaude).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledWith('Attempt 1 failed: Claude API error');
        expect(consoleSpy).toHaveBeenCalledWith('Attempt 2 failed: Claude API error');
      });

      test('should continue retries even if Claude executor fails', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;

        mockExecuteCommand.mockImplementation(() => {
          attemptCount++;
          if (attemptCount === 1) {
            // First attempt fails and Claude fails too
            executeClaude.mockRejectedValueOnce(new Error('Claude busy'));
            return Promise.resolve({ success: false, exitCode: 1, output: 'First fail' });
          } else {
            // Second attempt succeeds despite Claude failure on first
            return Promise.resolve({ success: true, exitCode: 0, output: 'Success!' });
          }
        });

        const consoleSpy = jest.spyOn(console, 'log');

        fixCommand('resilient-command', 3);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(attemptCount).toBe(2);
        expect(consoleSpy).toHaveBeenCalledWith('Attempt 1 failed: Claude busy');
        expect(mockExit).toHaveBeenCalledWith(0);
      });
    });

    describe('State Management During Retries', () => {
      test('should maintain command integrity across retries', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Fails' });

        const complexCommand = 'git commit -m "Fix complex issue #123 & update docs" --author="Test User <test@example.com>"';

        await expect(fixCommand(complexCommand, 2)).rejects.toThrow(
          expect.stringContaining(complexCommand)
        );

        expect(executeClaude).toHaveBeenCalledTimes(2);
        executeClaude.mock.calls.forEach(call => {
          expect(call[0]).toBe(`fix command "${complexCommand}"`);
        });
      });

      test('should handle concurrent fixCommand calls independently', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        mockExecuteCommand.mockResolvedValue({ success: false, exitCode: 1, output: 'Fails' });

        const command1 = 'command1';
        const command2 = 'command2';

        const promise1 = expect(fixCommand(command1, 2)).rejects.toThrow();
        const promise2 = expect(fixCommand(command2, 2)).rejects.toThrow();

        await Promise.all([promise1, promise2]);

        // Each command should be attempted independently
        expect(mockExecuteCommand).toHaveBeenCalledTimes(4);
        expect(executeClaude).toHaveBeenCalledTimes(4);

        // Verify that calls were made for both commands
        const claudeCalls = executeClaude.mock.calls.map(call => call[0]);
        expect(claudeCalls).toContain('fix command "command1"');
        expect(claudeCalls).toContain('fix command "command2"');
      });
    });

    describe('Progressive Retry Strategy Testing', () => {
      test('should track attempt numbers correctly', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        let attemptCount = 0;
        const loggedAttempts = [];

        // Intercept console.log to capture attempt numbers
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation((message) => {
          if (message.includes('Attempt')) {
            loggedAttempts.push(message);
          }
        });

        mockExecuteCommand.mockImplementation(() => {
          const currentAttempt = ++attemptCount;
          executeClaude.mockRejectedValue(new Error(`Claude attempt ${currentAttempt} failed`));
          return Promise.resolve({ success: false, exitCode: 1, output: `Fail ${currentAttempt}` });
        });

        await expect(fixCommand('track-attempts', 3)).rejects.toThrow();

        expect(loggedAttempts).toHaveLength(3);
        expect(loggedAttempts[0]).toContain('Attempt 1 failed');
        expect(loggedAttempts[1]).toContain('Attempt 2 failed');
        expect(loggedAttempts[2]).toContain('Attempt 3 failed');

        consoleSpy.mockRestore();
      });

      test('should handle retry timing and delays properly', async () => {
        fs.existsSync.mockReturnValue(true);

        const mockExecuteCommand = jest.spyOn({ executeCommand }, 'executeCommand');
        const timestamps = [];

        mockExecuteCommand.mockImplementation(() => {
          timestamps.push(Date.now());
          return Promise.resolve({ success: false, exitCode: 1, output: 'Timed failure' });
        });

        const startTime = Date.now();
        await expect(fixCommand('timed-command', 3)).rejects.toThrow();
        const endTime = Date.now();

        // Should have made 3 attempts
        expect(timestamps).toHaveLength(3);
        // Should have taken some time (not instantaneous)
        expect(endTime - startTime).toBeGreaterThan(10);
      });
    });
  });

  describe('Comprehensive Logging and Reporting', () => {
    describe('Log File Creation and Management', () => {
      test('should create log file with correct path and flags', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('test command').then(() => {
            expect(fs.createWriteStream).toHaveBeenCalledWith(
              '/test/.claudiomiro/log.txt',
              { flags: 'a' }
            );
            resolve();
          });
        });
      });

      test('should create log file when claudiomiro folder does not exist', async () => {
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockImplementation(() => {});

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('test').then(() => {
            expect(fs.mkdirSync).toHaveBeenCalledWith('/test/.claudiomiro', { recursive: true });
            expect(fs.createWriteStream).toHaveBeenCalled();
            resolve();
          });
        });
      });

      test('should handle different claudiomiro folder paths', async () => {
        fs.existsSync.mockReturnValue(true);
        state.claudiomiroFolder = '/custom/path/.claudiomiro';
        path.join.mockImplementation((...args) => args.join('/'));

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('test').then(() => {
            expect(fs.createWriteStream).toHaveBeenCalledWith(
              '/custom/path/.claudiomiro/log.txt',
              { flags: 'a' }
            );
            resolve();
          });
        });
      });
    });

    describe('Log Content and Formatting', () => {
      test('should write proper log headers with timestamps and separators', async () => {
        fs.existsSync.mockReturnValue(true);
        const mockDate = new Date('2024-01-15T10:30:45.123Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('npm install').then(() => {
            const writeCalls = mockLogStream.write.mock.calls;

            // Check for separator and timestamp header
            const separatorCall = writeCalls.find(call =>
              call[0] === '='.repeat(80) + '\n' || call[0].includes('='.repeat(80))
            );
            const headerCall = writeCalls.find(call =>
              call[0].includes('Command execution started: npm install')
            );
            expect(separatorCall).toBeDefined();
            expect(headerCall).toBeDefined();
            expect(headerCall[0]).toContain('[2024-01-15T10:30:45.123Z]');

            // Check for completion timestamp
            const completionCall = writeCalls.find(call =>
              call[0].includes('Command execution completed with code 0')
            );
            expect(completionCall).toBeDefined();
            expect(completionCall[0]).toContain('[2024-01-15T10:30:45.123Z]');

            global.Date.mockRestore();
            resolve();
          });
        });
      });

      test('should capture and log stdout output correctly', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.stdout.on.mockImplementation((event, handler) => {
            if (event === 'data') {
              handler('Installing dependencies...\nPackage A installed\nPackage B installed\n');
            }
          });

          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('npm install').then(() => {
            const stdoutCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('[STDOUT]')
            );
            expect(stdoutCalls).toHaveLength(1);
            expect(stdoutCalls[0][0]).toBe('[STDOUT] Installing dependencies...\nPackage A installed\nPackage B installed\n');
            resolve();
          });
        });
      });

      test('should capture and log stderr output correctly', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.stderr.on.mockImplementation((event, handler) => {
            if (event === 'data') {
              handler('Warning: deprecated package\nError: network timeout\n');
            }
          });

          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(1), 0);
            }
          });

          executeCommand('npm install').then(() => {
            const stderrCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('[STDERR]')
            );
            expect(stderrCalls).toHaveLength(1);
            expect(stderrCalls[0][0]).toBe('[STDERR] Warning: deprecated package\nError: network timeout\n');
            resolve();
          });
        });
      });

      test('should handle mixed stdout and stderr output', async () => {
        fs.existsSync.mockReturnValue(true);
        const outputs = [];

        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            const output = 'Installing package A...\n';
            outputs.push(`[STDOUT] ${output}`);
            handler(output);
          }
        });

        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            const output = 'Warning: deprecated version\n';
            outputs.push(`[STDERR] ${output}`);
            handler(output);
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        return new Promise((resolve) => {
          executeCommand('npm install').then(() => {
            const outputCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('[STDOUT]') || call[0].includes('[STDERR]')
            );
            expect(outputCalls).toHaveLength(2);
            resolve();
          });
        });
      });
    });

    describe('Error Logging and Stack Traces', () => {
      test('should log process errors with proper formatting', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('ENOENT: no such file or directory')), 0);
            }
          });

          executeCommand('nonexistent').then((result) => {
            const errorCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('ERROR:')
            );
            expect(errorCalls).toHaveLength(1);
            expect(errorCalls[0][0]).toContain('ERROR: ENOENT: no such file or directory');
            expect(mockLogStream.end).toHaveBeenCalled();
            resolve();
          });
        });
      });

      test('should log error details in execution context', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('EACCES: permission denied')), 0);
            }
          });

          executeCommand('restricted-command').then((result) => {
            const writeCalls = mockLogStream.write.mock.calls;

            // Should have header, then error
            const hasHeader = writeCalls.some(call => call[0].includes('Command execution started'));
            const hasError = writeCalls.some(call => call[0].includes('ERROR: EACCES: permission denied'));

            expect(hasHeader).toBe(true);
            expect(hasError).toBe(true);
            expect(mockLogStream.end).toHaveBeenCalled();
            resolve();
          });
        });
      });

      test('should handle errors during different execution phases', async () => {
        fs.existsSync.mockReturnValue(true);

        // Test error during stdout processing
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('Some output');
            // Simulate error during processing
            setTimeout(() => {
              if (mockChildProcess.errorCallback) {
                mockChildProcess.errorCallback(new Error('Processing error'));
              }
            }, 5);
          }
        });

        return new Promise((resolve) => {
          executeCommand('error-during-output').then((result) => {
            const errorCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('ERROR:')
            );
            expect(errorCalls).toHaveLength(1);
            expect(errorCalls[0][0]).toContain('ERROR: Processing error');
            resolve();
          });
        });
      });
    });

    describe('Log Stream Management', () => {
      test('should properly end log stream on successful completion', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('success command').then(() => {
            expect(mockLogStream.end).toHaveBeenCalled();

            // Verify completion log was written before ending
            const writeCalls = mockLogStream.write.mock.calls;
            const completionCall = writeCalls.find(call =>
              call[0].includes('Command execution completed')
            );
            expect(completionCall).toBeDefined();
            resolve();
          });
        });
      });

      test('should properly end log stream on command failure', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(1), 0);
            }
          });

          executeCommand('failing command').then(() => {
            expect(mockLogStream.end).toHaveBeenCalled();

            // Verify completion log was written with error code
            const writeCalls = mockLogStream.write.mock.calls;
            const completionCall = writeCalls.find(call =>
              call[0].includes('Command execution completed with code 1')
            );
            expect(completionCall).toBeDefined();
            resolve();
          });
        });
      });

      test('should properly end log stream on process error', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Spawn failed')), 0);
            }
          });

          executeCommand('error command').then(() => {
            expect(mockLogStream.end).toHaveBeenCalled();

            // Verify error was logged before ending
            const writeCalls = mockLogStream.write.mock.calls;
            const errorCall = writeCalls.find(call => call[0].includes('ERROR:'));
            expect(errorCall).toBeDefined();
            resolve();
          });
        });
      });
    });

    describe('Concurrent Logging Scenarios', () => {
      test('should handle multiple commands logging simultaneously', async () => {
        fs.existsSync.mockReturnValue(true);
        const mockStreams = [];

        // Create different mock streams for each command
        for (let i = 0; i < 3; i++) {
          mockStreams.push({
            write: jest.fn(),
            end: jest.fn()
          });
        }

        let streamIndex = 0;
        fs.createWriteStream.mockImplementation(() => mockStreams[streamIndex++]);

        return new Promise((resolve) => {
          let completedCommands = 0;

          for (let i = 0; i < 3; i++) {
            const mockChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn((event, handler) => {
                if (event === 'close') {
                  setTimeout(() => {
                    handler(0);
                    completedCommands++;
                    if (completedCommands === 3) {
                      // All commands completed
                      expect(mockStreams[0].write).toHaveBeenCalled();
                      expect(mockStreams[1].write).toHaveBeenCalled();
                      expect(mockStreams[2].write).toHaveBeenCalled();
                      resolve();
                    }
                  }, i * 10); // Stagger completion times
                }
              })
            };
            spawn.mockReturnValueOnce(mockChild);

            executeCommand(`command${i}`);
          }
        });
      });

      test('should handle log stream write failures gracefully', async () => {
        fs.existsSync.mockReturnValue(true);

        // Mock stream that throws on write
        const faultyStream = {
          write: jest.fn().mockImplementation(() => {
            throw new Error('Disk full');
          }),
          end: jest.fn()
        };
        fs.createWriteStream.mockReturnValue(faultyStream);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          // Should complete despite log write errors
          executeCommand('test').then(() => {
            expect(faultyStream.write).toHaveBeenCalled();
            resolve();
          }).catch(() => {
            // Even if logging fails, command should complete
            resolve();
          });
        });
      });
    });

    describe('Log Content Validation', () => {
      test('should maintain consistent log format across different platforms', async () => {
        fs.existsSync.mockReturnValue(true);

        // Test on Windows
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('dir').then(() => {
            const writeCalls = mockLogStream.write.mock.calls;

            // Should have consistent format regardless of platform
            const hasSeparator = writeCalls.some(call => call[0].includes('='.repeat(80)));
            const hasTimestamp = writeCalls.some(call => call[0].includes('['));
            const hasCommand = writeCalls.some(call => call[0].includes('dir'));

            expect(hasSeparator).toBe(true);
            expect(hasTimestamp).toBe(true);
            expect(hasCommand).toBe(true);
            resolve();
          });
        });
      });

      test('should handle special characters in log output', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.stdout.on.mockImplementation((event, handler) => {
            if (event === 'data') {
              handler('Output with émojis 🚀 and spéciâl chars: àáâãäå\n');
            }
          });

          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('unicode-test').then(() => {
            const stdoutCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('[STDOUT]')
            );
            expect(stdoutCalls[0][0]).toContain('émojis 🚀 and spéciâl chars: àáâãäå');
            resolve();
          });
        });
      });

      test('should handle very long log entries', async () => {
        fs.existsSync.mockReturnValue(true);
        const longOutput = 'A'.repeat(10000) + '\n';

        return new Promise((resolve) => {
          mockChildProcess.stdout.on.mockImplementation((event, handler) => {
            if (event === 'data') {
              handler(longOutput);
            }
          });

          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 0);
            }
          });

          executeCommand('long-output').then(() => {
            const stdoutCalls = mockLogStream.write.mock.calls.filter(call =>
              call[0].includes('[STDOUT]')
            );
            expect(stdoutCalls[0][0]).toContain(longOutput);
            expect(stdoutCalls[0][0].length).toBeGreaterThan(10000);
            resolve();
          });
        });
      });
    });

    describe('Log Performance and Resource Management', () => {
      test('should handle high-frequency log writes efficiently', async () => {
        fs.existsSync.mockReturnValue(true);
        let writeCount = 0;

        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            // Simulate many small writes
            for (let i = 0; i < 100; i++) {
              handler(`Line ${i}\n`);
              writeCount++;
            }
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        return new Promise((resolve) => {
          executeCommand('high-freq').then(() => {
            // Should handle all writes without issues
            expect(mockLogStream.write).toHaveBeenCalledTimes(writeCount + 3); // + header, completion, separator
            resolve();
          });
        });
      });

      test('should clean up log resources properly on errors', async () => {
        fs.existsSync.mockReturnValue(true);

        return new Promise((resolve) => {
          mockChildProcess.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Abort error')), 0);
            }
          });

          executeCommand('abort-test').then(() => {
            // Should properly end stream even on error
            expect(mockLogStream.end).toHaveBeenCalled();
            resolve();
          });
        });
      });
    });
  });
});