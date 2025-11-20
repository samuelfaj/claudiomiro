const { spawn } = require('child_process');
const { gitStatus } = require('./git-status');

// Mock modules
jest.mock('child_process');

describe('git-status', () => {
  let mockSpawn;
  let mockChildProcess;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock child process
    mockChildProcess = {
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn()
    };
    mockSpawn = spawn;
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  describe('gitStatus', () => {
    test('should spawn git status command with correct parameters', async () => {
      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler('M file1.js\n?? file2.js\n');
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        gitStatus().then((result) => {
          expect(spawn).toHaveBeenCalledWith('git', ['status']);
          expect(result).toContain('M file1.js');
          expect(result).toContain('?? file2.js');
          resolve();
        });
      });
    });

    test('should handle git status output', async () => {
      return new Promise((resolve) => {
        const output = 'M modified.txt\nD deleted.txt\nA added.txt\n?? untracked.txt\n';

        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler(output);
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        gitStatus().then((result) => {
          expect(result).toContain('M modified.txt');
          expect(result).toContain('D deleted.txt');
          expect(result).toContain('A added.txt');
          expect(result).toContain('?? untracked.txt');
          resolve();
        });
      });
    });

    test('should handle clean repository (no output)', async () => {
      return new Promise((resolve) => {
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler(''); // No output for clean repo
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        gitStatus().then((result) => {
          expect(result).toBe('');
          resolve();
        });
      });
    });

    test('should handle git status error and reject', async () => {
      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 0); // Non-zero exit code
          }
        });

        gitStatus().catch((error) => {
          expect(error).toBeInstanceOf(Error);
          resolve();
        });
      });
    });

    test('should handle multiline git status output', async () => {
      return new Promise((resolve) => {
        const multilineOutput = `M file1.js
M file2.js
A newfile.js
D oldfile.js
?? untracked1.js
?? untracked2.js`;

        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            handler(multilineOutput);
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        });

        gitStatus().then((result) => {
          expect(result).toBe(multilineOutput);
          expect(result.split('\n')).toHaveLength(6);
          resolve();
        });
      });
    });

    test('should accumulate output from multiple stdout data events', async () => {
      return new Promise((resolve) => {
        const chunks = ['M file1.js\n', 'A file2.js\n', '?? file3.js\n'];
        let dataHandler;
        let closeHandler;

        // Capture the handlers
        mockChildProcess.stdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            dataHandler = handler;
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });

        // Simulate multiple data events
        setTimeout(() => {
          chunks.forEach(chunk => dataHandler(chunk));
          setTimeout(() => closeHandler(0), 10);
        }, 10);

        gitStatus().then((result) => {
          expect(result).toBe(chunks.join(''));
          expect(result).toContain('M file1.js');
          expect(result).toContain('A file2.js');
          expect(result).toContain('?? file3.js');
          resolve();
        });
      });
    });

    test('should accumulate stderr and include it in error message', async () => {
      return new Promise((resolve) => {
        const stderrOutput = 'fatal: not a git repository\n';
        let stderrDataHandler;
        let closeHandler;

        // Capture the stderr handler
        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            stderrDataHandler = handler;
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });

        // Simulate stderr data and error exit code
        setTimeout(() => {
          stderrDataHandler(stderrOutput);
          setTimeout(() => closeHandler(128), 10);
        }, 10);

        gitStatus().catch((error) => {
          expect(error.message).toBe(stderrOutput);
          resolve();
        });
      });
    });

    test('should handle multiple stderr data events', async () => {
      return new Promise((resolve) => {
        const stderrChunks = ['error: ', 'fatal: not a git repository\n', 'another error\n'];
        let stderrDataHandler;
        let closeHandler;

        // Capture the stderr handler
        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            stderrDataHandler = handler;
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });

        // Simulate multiple stderr data events
        setTimeout(() => {
          stderrChunks.forEach(chunk => stderrDataHandler(chunk));
          setTimeout(() => closeHandler(1), 10);
        }, 10);

        gitStatus().catch((error) => {
          expect(error.message).toBe(stderrChunks.join(''));
          resolve();
        });
      });
    });

    test('should handle empty stderr with non-zero exit code', async () => {
      return new Promise((resolve) => {
        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 0);
          }
        });

        gitStatus().catch((error) => {
          expect(error.message).toBe('');
          resolve();
        });
      });
    });

    test('should handle large stderr output', async () => {
      return new Promise((resolve) => {
        const largeStderr = 'x'.repeat(10000) + '\n';
        let stderrDataHandler;
        let closeHandler;

        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            stderrDataHandler = handler;
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });

        setTimeout(() => {
          stderrDataHandler(largeStderr);
          setTimeout(() => closeHandler(1), 10);
        }, 10);

        gitStatus().catch((error) => {
          expect(error.message).toBe(largeStderr);
          resolve();
        });
      });
    });

    test('should handle git not initialized error', async () => {
      return new Promise((resolve) => {
        const notGitRepoError = 'fatal: not a git repository (or any of the parent directories): .git';
        let stderrDataHandler;
        let closeHandler;

        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            stderrDataHandler = handler;
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });

        setTimeout(() => {
          stderrDataHandler(notGitRepoError);
          setTimeout(() => closeHandler(128), 10);
        }, 10);

        gitStatus().catch((error) => {
          expect(error.message).toBe(notGitRepoError);
          resolve();
        });
      });
    });

    test('should handle permission denied error', async () => {
      return new Promise((resolve) => {
        const permissionError = 'fatal: unable to access \'.git\': Permission denied';
        let stderrDataHandler;
        let closeHandler;

        mockChildProcess.stderr.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            stderrDataHandler = handler;
          }
        });

        mockChildProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });

        setTimeout(() => {
          stderrDataHandler(permissionError);
          setTimeout(() => closeHandler(1), 10);
        }, 10);

        gitStatus().catch((error) => {
          expect(error.message).toBe(permissionError);
          resolve();
        });
      });
    });
  });
});