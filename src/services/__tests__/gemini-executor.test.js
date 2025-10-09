const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { executeGemini } = require('../gemini-executor');

// Mock all dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../config/state');
jest.mock('../gemini-logger');
jest.mock('../parallel-state-manager');

const logger = require('../../../logger');
const state = require('../../config/state');
const { processGeminiMessage } = require('../gemini-logger');
const { MockChildProcess } = require('../../__tests__/mocks/child_process');
const { ParallelStateManager } = require('../parallel-state-manager');

describe('gemini-executor', () => {
  let mockChildProcess;
  let mockWriteStream;
  let writeStreamWriteSpy;
  let writeStreamEndSpy;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup state mock
    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/.claudiomiro';

    // Setup fs mocks
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.unlinkSync = jest.fn();

    // Setup write stream mock
    writeStreamWriteSpy = jest.fn();
    writeStreamEndSpy = jest.fn();
    mockWriteStream = {
      write: writeStreamWriteSpy,
      end: writeStreamEndSpy
    };
    fs.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);

    // Setup logger mocks
    logger.stopSpinner = jest.fn();
    logger.command = jest.fn();
    logger.separator = jest.fn();
    logger.newline = jest.fn();
    logger.success = jest.fn();
    logger.error = jest.fn();

    // Setup child_process mock
    mockChildProcess = new MockChildProcess();
    spawn.mockReturnValue(mockChildProcess);

    // Setup processGeminiMessage mock
    processGeminiMessage.mockImplementation((line) => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
          return parsed.candidates[0].content.parts.map(p => p.text).join('');
        }
      } catch (e) {
        // Not JSON, ignore
      }
      return null;
    });

    // Mock console.log to prevent test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('executeGemini success flow', () => {
    it('should resolve promise on successful execution (code 0)', async () => {
      const promise = executeGemini('test prompt');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await expect(promise).resolves.toBeUndefined();
      expect(logger.success).toHaveBeenCalledWith('Gemini execution completed');
    });

    it('should spawn with correct arguments', async () => {
      const promise = executeGemini('test prompt');

      expect(spawn).toHaveBeenCalledWith(
        'sh',
        ['-c', expect.stringContaining('gemini --prompt')],
        expect.objectContaining({
          cwd: '/test/folder',
          stdio: ['ignore', 'pipe', 'pipe']
        })
      );

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should create temporary file with prompt text', async () => {
      const promise = executeGemini('test prompt content');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/claudiomiro-gemini-prompt-\d+\.txt$/),
        'test prompt content',
        'utf-8'
      );

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should clean up temporary file after execution', async () => {
      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringMatching(/claudiomiro-gemini-prompt-\d+\.txt$/)
      );
    });

    it('should call logger methods in correct sequence', async () => {
      const promise = executeGemini('test prompt');

      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.command).toHaveBeenCalledWith(
        expect.stringContaining('gemini --prompt')
      );
      expect(logger.separator).toHaveBeenCalled();

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;

      expect(logger.success).toHaveBeenCalledWith('Gemini execution completed');
    });

    it('should create log file with correct path', async () => {
      const promise = executeGemini('test prompt');

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/test/.claudiomiro/gemini-log.txt',
        { flags: 'a' }
      );

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should write log separator and timestamp to log file', async () => {
      const promise = executeGemini('test prompt');

      expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('='.repeat(80)));
      expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.+\] Gemini execution started/));

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });
  });

  describe('stdout streaming and message processing', () => {
    it('should process complete JSON lines from stdout', async () => {
      const promise = executeGemini('test prompt');

      const jsonLine1 = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Hello' }]
          }
        }]
      });
      const jsonLine2 = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'World' }]
          }
        }]
      });

      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine1 + '\n' + jsonLine2 + '\n'));

      expect(processGeminiMessage).toHaveBeenCalledWith(jsonLine1);
      expect(processGeminiMessage).toHaveBeenCalledWith(jsonLine2);

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should handle partial JSON lines with buffering', async () => {
      const promise = executeGemini('test prompt');

      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Complete message' }]
          }
        }]
      });
      const part1 = jsonLine.substring(0, 20);
      const part2 = jsonLine.substring(20);

      // Send partial data
      mockChildProcess.stdout.emit('data', Buffer.from(part1));
      expect(processGeminiMessage).not.toHaveBeenCalled();

      // Send rest with newline
      mockChildProcess.stdout.emit('data', Buffer.from(part2 + '\n'));
      expect(processGeminiMessage).toHaveBeenCalledWith(jsonLine);

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should call processGeminiMessage for each complete line', async () => {
      const promise = executeGemini('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('line1\nline2\nline3\n'));

      expect(processGeminiMessage).toHaveBeenCalledTimes(3);
      expect(processGeminiMessage).toHaveBeenNthCalledWith(1, 'line1');
      expect(processGeminiMessage).toHaveBeenNthCalledWith(2, 'line2');
      expect(processGeminiMessage).toHaveBeenNthCalledWith(3, 'line3');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should write stdout data to log file', async () => {
      const promise = executeGemini('test prompt');

      const testData = 'test output data\n';
      mockChildProcess.stdout.emit('data', Buffer.from(testData));

      expect(writeStreamWriteSpy).toHaveBeenCalledWith(testData);

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should output Gemini messages to console', async () => {
      const promise = executeGemini('test prompt');

      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Test message' }]
          }
        }]
      });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      expect(console.log).toHaveBeenCalledWith('🤖 Gemini:');
      expect(console.log).toHaveBeenCalledWith('Test message');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should write completion message to log file', async () => {
      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;

      expect(writeStreamWriteSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.+\] Gemini execution completed with code 0/)
      );
      expect(writeStreamEndSpy).toHaveBeenCalled();
    });
  });

  describe('error handling scenarios', () => {
    it('should reject promise on non-zero exit code', async () => {
      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('close', 1), 10);

      await expect(promise).rejects.toThrow('Gemini exited with code 1');
      expect(logger.error).toHaveBeenCalledWith('Gemini exited with code 1');
    });

    it('should clean up temp file on non-zero exit code', async () => {
      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('close', 1), 10);

      await expect(promise).rejects.toThrow();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should reject promise on spawn error', async () => {
      const promise = executeGemini('test prompt');

      const testError = new Error('Spawn failed');
      setTimeout(() => mockChildProcess.emit('error', testError), 10);

      await expect(promise).rejects.toThrow('Spawn failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to execute Gemini'));
    });

    it('should clean up temp file on spawn error', async () => {
      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('error', new Error('Test error')), 10);

      await expect(promise).rejects.toThrow();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should write error to log file on spawn error', async () => {
      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('error', new Error('Test error message')), 10);

      await expect(promise).rejects.toThrow();
      expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Test error message'));
      expect(writeStreamEndSpy).toHaveBeenCalled();
    });

    it('should handle temp file cleanup failure gracefully', async () => {
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);

      await expect(promise).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to cleanup temp file'));
    });

    it('should handle missing temp file during cleanup', async () => {
      fs.existsSync.mockReturnValue(false);

      const promise = executeGemini('test prompt');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);

      await expect(promise).resolves.toBeUndefined();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and integration', () => {
    it('should handle stderr data and write to log file', async () => {
      const promise = executeGemini('test prompt');

      const stderrData = 'Error output\n';
      mockChildProcess.stderr.emit('data', Buffer.from(stderrData));

      expect(writeStreamWriteSpy).toHaveBeenCalledWith('[STDERR] ' + stderrData);

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should maintain buffer with incomplete lines', async () => {
      const promise = executeGemini('test prompt');

      // Send data without newline
      mockChildProcess.stdout.emit('data', Buffer.from('incomplete'));
      expect(processGeminiMessage).not.toHaveBeenCalled();

      // Send more data, still no newline
      mockChildProcess.stdout.emit('data', Buffer.from(' line'));
      expect(processGeminiMessage).not.toHaveBeenCalled();

      // Complete the line
      mockChildProcess.stdout.emit('data', Buffer.from(' complete\n'));
      expect(processGeminiMessage).toHaveBeenCalledWith('incomplete line complete');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should handle long text wrapping in console output', async () => {
      // Mock a narrow terminal
      const originalColumns = process.stdout.columns;
      process.stdout.columns = 20;

      const promise = executeGemini('test prompt');

      const longText = 'a'.repeat(50);
      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: longText }]
          }
        }]
      });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      // Should wrap into multiple console.log calls
      expect(console.log).toHaveBeenCalledWith('🤖 Gemini:');
      // Line wrapping should occur
      const logCalls = console.log.mock.calls.filter(call => call[0] !== '🤖 Gemini:');
      expect(logCalls.length).toBeGreaterThan(1);

      process.stdout.columns = originalColumns;

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should handle multiple stdout chunks in sequence', async () => {
      const promise = executeGemini('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('line1\n'));
      mockChildProcess.stdout.emit('data', Buffer.from('line2\n'));
      mockChildProcess.stdout.emit('data', Buffer.from('line3\n'));

      expect(processGeminiMessage).toHaveBeenCalledTimes(3);

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should handle empty lines in stdout', async () => {
      const promise = executeGemini('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('line1\n\nline2\n'));

      expect(processGeminiMessage).toHaveBeenCalledWith('line1');
      expect(processGeminiMessage).toHaveBeenCalledWith('');
      expect(processGeminiMessage).toHaveBeenCalledWith('line2');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should handle non-JSON lines gracefully', async () => {
      processGeminiMessage.mockReturnValue(null);

      const promise = executeGemini('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('not json\n'));

      // Should not crash, processGeminiMessage returns null
      expect(processGeminiMessage).toHaveBeenCalledWith('not json');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('not json'));

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should complete full execution flow end-to-end', async () => {
      const promise = executeGemini('integration test prompt');

      // Simulate realistic execution
      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Starting...' }]
          }
        }]
      }) + '\n'));
      mockChildProcess.stderr.emit('data', Buffer.from('debug info\n'));
      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Done!' }]
          }
        }]
      }) + '\n'));

      setTimeout(() => mockChildProcess.emit('close', 0), 10);

      await expect(promise).resolves.toBeUndefined();

      // Verify complete flow
      expect(fs.writeFileSync).toHaveBeenCalled(); // Temp file created
      expect(spawn).toHaveBeenCalled(); // Process spawned
      expect(processGeminiMessage).toHaveBeenCalled(); // Messages processed
      expect(writeStreamWriteSpy).toHaveBeenCalled(); // Log written
      expect(fs.unlinkSync).toHaveBeenCalled(); // Temp file cleaned
      expect(logger.success).toHaveBeenCalled(); // Success logged
    });
  });

  describe('ParallelStateManager integration', () => {
    let mockStateManager;

    beforeEach(() => {
      // Create mock state manager instance
      mockStateManager = {
        updateClaudeMessage: jest.fn()
      };

      // Mock getInstance to return our mock instance
      ParallelStateManager.getInstance = jest.fn(() => mockStateManager);
    });

    it('should work without taskName (backward compatibility)', async () => {
      const promise = executeGemini('test prompt');

      // Should not call getInstance
      expect(ParallelStateManager.getInstance).not.toHaveBeenCalled();

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should call getInstance when taskName provided', async () => {
      const promise = executeGemini('test prompt', 'TASK1');

      // Should call getInstance
      expect(ParallelStateManager.getInstance).toHaveBeenCalled();

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should call updateClaudeMessage when taskName provided and message received', async () => {
      const promise = executeGemini('test prompt', 'TASK1');

      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Test message from Gemini' }]
          }
        }]
      });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledWith('TASK1', 'Test message from Gemini');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should not call updateClaudeMessage when taskName not provided', async () => {
      const promise = executeGemini('test prompt');

      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Test message' }]
          }
        }]
      });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      expect(mockStateManager.updateClaudeMessage).not.toHaveBeenCalled();

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should call updateClaudeMessage for multiple messages', async () => {
      const promise = executeGemini('test prompt', 'TASK2');

      const jsonLine1 = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Message 1' }]
          }
        }]
      });
      const jsonLine2 = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Message 2' }]
          }
        }]
      });
      const jsonLine3 = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Message 3' }]
          }
        }]
      });

      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine1 + '\n'));
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine2 + '\n'));
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine3 + '\n'));

      expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledTimes(3);
      expect(mockStateManager.updateClaudeMessage).toHaveBeenNthCalledWith(1, 'TASK2', 'Message 1');
      expect(mockStateManager.updateClaudeMessage).toHaveBeenNthCalledWith(2, 'TASK2', 'Message 2');
      expect(mockStateManager.updateClaudeMessage).toHaveBeenNthCalledWith(3, 'TASK2', 'Message 3');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should not call updateClaudeMessage for non-text messages', async () => {
      const promise = executeGemini('test prompt', 'TASK3');

      // processGeminiMessage returns null for non-text messages
      processGeminiMessage.mockReturnValue(null);

      const jsonLine = JSON.stringify({ type: 'other', data: 'something' });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      expect(mockStateManager.updateClaudeMessage).not.toHaveBeenCalled();

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should handle taskName with special characters', async () => {
      const promise = executeGemini('test prompt', 'TASK-123_special');

      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Test' }]
          }
        }]
      });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledWith('TASK-123_special', 'Test');

      setTimeout(() => mockChildProcess.emit('close', 0), 10);
      await promise;
    });

    it('should pass correct taskName even with errors', async () => {
      const promise = executeGemini('test prompt', 'TASK_ERROR');

      const jsonLine = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Error message' }]
          }
        }]
      });
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));

      expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledWith('TASK_ERROR', 'Error message');

      setTimeout(() => mockChildProcess.emit('close', 1), 10);
      await expect(promise).rejects.toThrow();
    });
  });
});