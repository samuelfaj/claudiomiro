import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { GeminiExecutor } from '../gemini-executor';

// Mock all dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../config/state');
jest.mock('../gemini-logger', () => ({
  GeminiLogger: {
    processMessage: jest.fn()
  }
}));
jest.mock('../parallel-state-manager');

import logger from '../../../logger';
import state from '../../config/state';
import { GeminiLogger } from '../gemini-logger';
import ParallelStateManager from '../parallel-state-manager';

// Mock ChildProcess class for testing
const EventEmitter = require('events');
class MockChildProcess extends EventEmitter {
  stdout: any;
  stderr: any;

  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }
}

describe('gemini-executor', () => {
  let mockChildProcess: MockChildProcess;
  let mockWriteStream: any;
  let writeStreamWriteSpy: jest.Mock;
  let writeStreamEndSpy: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup state mock
    (state as any).folder = '/test/folder';
    (state as any).claudiomiroFolder = '/test/.claudiomiro';

    // Setup fs mocks
    (fs.writeFileSync as jest.Mock) = jest.fn();
    (fs.existsSync as jest.Mock) = jest.fn().mockReturnValue(true);
    (fs.unlinkSync as jest.Mock) = jest.fn();

    // Setup write stream mock
    writeStreamWriteSpy = jest.fn();
    writeStreamEndSpy = jest.fn();
    mockWriteStream = {
      write: writeStreamWriteSpy,
      end: writeStreamEndSpy
    };
    (fs.createWriteStream as jest.Mock) = jest.fn().mockReturnValue(mockWriteStream);

    // Setup logger mocks
    logger.stopSpinner = jest.fn();
    logger.info = jest.fn();
    logger.command = jest.fn();
    logger.separator = jest.fn();
    logger.newline = jest.fn();
    logger.success = jest.fn();
    logger.error = jest.fn();
    (logger as any).warn = jest.fn();
    (logger as any).debug = jest.fn();

    // Setup gemini-logger mock
    (GeminiLogger.processMessage as jest.Mock).mockImplementation((line: string) => {
      if (line.includes('{"text":')) {
        return JSON.parse(line).text;
      }
      return null;
    });

    // Setup parallel state manager mock
    (ParallelStateManager.getInstance as jest.Mock) = jest.fn().mockReturnValue({
      isUIRendererActive: jest.fn().mockReturnValue(false),
      updateClaudeMessage: jest.fn()
    });

    // Setup child process mock
    mockChildProcess = new MockChildProcess();
    (spawn as jest.Mock).mockReturnValue(mockChildProcess);
  });

  describe('setup', () => {
    it('should mock all dependencies correctly', () => {
      expect(fs.writeFileSync).toBeDefined();
      expect(spawn).toBeDefined();
      expect(logger.stopSpinner).toBeDefined();
      expect(GeminiLogger.processMessage).toBeDefined();
      expect(ParallelStateManager.getInstance).toBeDefined();
    });

    it('should setup state correctly', () => {
      expect(state.folder).toBe('/test/folder');
      expect(state.claudiomiroFolder).toBe('/test/.claudiomiro');
    });

    it('should setup write stream correctly', () => {
      expect(fs.createWriteStream).toBeDefined();
      expect(mockWriteStream.write).toBeDefined();
      expect(mockWriteStream.end).toBeDefined();
    });
  });

  describe('success flow', () => {
    it('should resolve promise on exit code 0', async () => {
      const testText = 'Test prompt text';

      const promise = GeminiExecutor.execute(testText);

      // Simulate successful process completion
      mockChildProcess.emit('close', 0);

      await expect(promise).resolves.toBeUndefined();
      expect(logger.success).toHaveBeenCalledWith('Gemini execution completed');
    });

    it('should call spawn with correct arguments', async () => {
      const testText = 'Test prompt text';

      GeminiExecutor.execute(testText);

      expect(spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('cat')], {
        cwd: state.folder,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should create temporary file with prompt text', async () => {
      const testText = 'Test prompt text';

      GeminiExecutor.execute(testText);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('claudiomiro-gemini-prompt-'),
        testText,
        { encoding: 'utf-8', mode: 0o600 }
      );
    });

    it('should cleanup temporary file on success', async () => {
      const testText = 'Test prompt text';

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('close', 0);

      await promise;
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should log command execution sequence', async () => {
      const testText = 'Test prompt text';

      GeminiExecutor.execute(testText);

      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Executing Gemini CLI');
      expect(logger.command).toHaveBeenCalledWith('gemini ...');
    });

    it('should create log file with correct path', async () => {
      const testText = 'Test prompt text';

      GeminiExecutor.execute(testText);

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        path.join(state.claudiomiroFolder, 'gemini-log.txt'),
        { flags: 'a' }
      );
    });

    it('should write timestamp to log file', async () => {
      const testText = 'Test prompt text';

      GeminiExecutor.execute(testText);

      expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini execution started'));
    });
  });

  describe('streaming', () => {
    it('should process complete JSON lines immediately', async () => {
      const testText = 'Test prompt text';
      const jsonLine = '{"text": "Hello world"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Hello world"}');
    });

    it('should buffer partial lines across multiple data events', async () => {
      const testText = 'Test prompt text';
      const partial1 = '{"text": "Hello';
      const partial2 = ' world"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(partial1));
      mockChildProcess.stdout.emit('data', Buffer.from(partial2));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Hello world"}');
    });

    it('should process multiple lines in single data chunk', async () => {
      const testText = 'Test prompt text';
      const multipleLines = '{"text": "Line 1"}\n{"text": "Line 2"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(multipleLines));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Line 1"}');
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Line 2"}');
    });

    it('should handle empty lines without errors', async () => {
      const testText = 'Test prompt text';
      const linesWithEmpty = '{"text": "Line 1"}\n\n{"text": "Line 2"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(linesWithEmpty));

      // Should only process non-empty lines
      expect(GeminiLogger.processMessage).toHaveBeenCalledTimes(2);
    });

    it('should write output to log file', async () => {
      const testText = 'Test prompt text';
      const output = '{"text": "Test output"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      expect(writeStreamWriteSpy).toHaveBeenCalledWith(output);
    });

    it('should handle console output when not suppressed', async () => {
      const testText = 'Test prompt text';
      const output = '{"text": "Test output"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      // Console output should occur when not suppressed
      expect(GeminiLogger.processMessage).toHaveBeenCalled();
    });

    it('should process completion messages', async () => {
      const testText = 'Test prompt text';
      const completionMsg = '{"text": "Completed successfully"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(completionMsg));
      mockChildProcess.emit('close', 0);

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Completed successfully"}');
    });

    it('should integrate with GeminiLogger.processMessage', async () => {
      const testText = 'Test prompt text';
      const jsonLine = '{"text": "Test message"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(jsonLine));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Test message"}');
    });

    it('should maintain buffer across data events', async () => {
      const testText = 'Test prompt text';
      const partial1 = '{"text": "Hello';
      const partial2 = ' world';
      const partial3 = '"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(partial1));
      mockChildProcess.stdout.emit('data', Buffer.from(partial2));
      mockChildProcess.stdout.emit('data', Buffer.from(partial3));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Hello world"}');
    });
  });

  describe('error handling', () => {
    it('should reject promise on non-zero exit code', async () => {
      const testText = 'Test prompt text';

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow('Gemini exited with code 1');
      expect(logger.error).toHaveBeenCalledWith('Gemini exited with code 1');
    });

    it('should cleanup on error', async () => {
      const testText = 'Test prompt text';

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('close', 1);

      try {
        await promise;
      } catch (error) {
        // Expected to throw
      }

      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should reject promise on spawn error', async () => {
      const testText = 'Test prompt text';
      const spawnError = new Error('Failed to spawn process');

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('error', spawnError);

      await expect(promise).rejects.toThrow('Failed to spawn process');
      expect(logger.error).toHaveBeenCalledWith('Failed to execute Gemini: Failed to spawn process');
    });

    it('should cleanup on spawn error', async () => {
      const testText = 'Test prompt text';
      const spawnError = new Error('Failed to spawn process');

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('error', spawnError);

      try {
        await promise;
      } catch (error) {
        // Expected to throw
      }

      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should write error to log file', async () => {
      const testText = 'Test prompt text';
      const spawnError = new Error('Failed to spawn process');

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('error', spawnError);

      try {
        await promise;
      } catch (error) {
        // Expected to throw
      }

      expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR:'));
    });

    it('should handle cleanup failure gracefully', async () => {
      const testText = 'Test prompt text';

      // Make unlinkSync throw
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('close', 0);

      // Should still resolve despite cleanup failure
      await expect(promise).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith('Failed to cleanup temp file: Cleanup failed');
    });

    it('should handle missing temp file during cleanup', async () => {
      const testText = 'Test prompt text';

      // Make existsSync return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('close', 0);

      await expect(promise).resolves.toBeUndefined();
      // Should not attempt to unlink non-existent file
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should close log stream on all exit paths', async () => {
      const testText = 'Test prompt text';

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.emit('close', 0);

      await promise;
      expect(writeStreamEndSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle stderr output', async () => {
      const testText = 'Test prompt text';
      const stderrOutput = 'Warning: Something happened\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stderr.emit('data', Buffer.from(stderrOutput));

      expect(writeStreamWriteSpy).toHaveBeenCalledWith('[STDERR] ' + stderrOutput);
    });

    it('should handle long text wrapping', async () => {
      const testText = 'Test prompt text';
      const longLine = '{"text": "' + 'x'.repeat(200) + '"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(longLine));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith(expect.stringContaining('x'.repeat(200)));
    });

    it('should handle sequential chunks correctly', async () => {
      const testText = 'Test prompt text';
      const chunk1 = '{"text": "Chunk1"}\n';
      const chunk2 = '{"text": "Chunk2"}\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(chunk1));
      mockChildProcess.stdout.emit('data', Buffer.from(chunk2));

      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Chunk1"}');
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Chunk2"}');
    });

    it('should handle empty lines in output', async () => {
      const testText = 'Test prompt text';
      const output = '\n\n{"text": "Actual content"}\n\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      // Should only process non-empty lines
      expect(GeminiLogger.processMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle non-JSON lines gracefully', async () => {
      const testText = 'Test prompt text';
      const nonJsonLine = 'This is not JSON\n';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(nonJsonLine));

      // GeminiLogger.processMessage should be called but may return null
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('This is not JSON');
    });

    it('should handle full end-to-end flow', async () => {
      const testText = 'Test prompt text';
      const output1 = '{"text": "First line"}\n';
      const output2 = '{"text": "Second line"}\n';

      const promise = GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(output1));
      mockChildProcess.stdout.emit('data', Buffer.from(output2));
      mockChildProcess.emit('close', 0);

      await expect(promise).resolves.toBeUndefined();
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "First line"}');
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Second line"}');
      expect(logger.success).toHaveBeenCalledWith('Gemini execution completed');
    });
  });

  describe('ParallelStateManager', () => {
    it('should not interact with state manager when taskName is null', async () => {
      const testText = 'Test prompt text';

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from('{"text": "Test"}\n'));

      expect(ParallelStateManager.getInstance).not.toHaveBeenCalled();
    });

    it('should call getInstance when taskName provided', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task';

      GeminiExecutor.execute(testText, taskName);

      expect(ParallelStateManager.getInstance).toHaveBeenCalled();
    });

    it('should call updateClaudeMessage per message when taskName provided', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task';
      const output = '{"text": "Message 1"}\n{"text": "Message 2"}\n';

      const stateManager = ParallelStateManager.getInstance();

      GeminiExecutor.execute(testText, taskName);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      expect(stateManager.updateClaudeMessage).toHaveBeenCalledTimes(2);
      expect(stateManager.updateClaudeMessage).toHaveBeenCalledWith(taskName, 'Message 1');
      expect(stateManager.updateClaudeMessage).toHaveBeenCalledWith(taskName, 'Message 2');
    });

    it('should not call updateClaudeMessage without taskName', async () => {
      const testText = 'Test prompt text';
      const output = '{"text": "Test message"}\n';

      const stateManager = ParallelStateManager.getInstance();

      GeminiExecutor.execute(testText);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      expect(stateManager.updateClaudeMessage).not.toHaveBeenCalled();
    });

    it('should handle multiple messages with state manager', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task';
      const output1 = '{"text": "First"}\n';
      const output2 = '{"text": "Second"}\n';

      const stateManager = ParallelStateManager.getInstance();

      GeminiExecutor.execute(testText, taskName);
      mockChildProcess.stdout.emit('data', Buffer.from(output1));
      mockChildProcess.stdout.emit('data', Buffer.from(output2));

      expect(stateManager.updateClaudeMessage).toHaveBeenCalledTimes(2);
    });

    it('should suppress console output when UI renderer is active', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task';
      const output = '{"text": "Test message"}\n';

      const stateManager = ParallelStateManager.getInstance();
      (stateManager.isUIRendererActive as jest.Mock).mockReturnValue(true);

      GeminiExecutor.execute(testText, taskName);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      // GeminiLogger.processMessage should still be called
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Test message"}');
    });

    it('should handle non-text messages with state manager', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task';
      const output = '{"text": ""}\n'; // Empty text

      GeminiExecutor.execute(testText, taskName);
      mockChildProcess.stdout.emit('data', Buffer.from(output));

      // GeminiLogger.processMessage may return null for empty text
      expect(GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": ""}');
    });

    it('should handle special characters in taskName', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task_123';

      GeminiExecutor.execute(testText, taskName);

      expect(ParallelStateManager.getInstance).toHaveBeenCalled();
    });

    it('should warn on invalid taskName format', async () => {
      const testText = 'Test prompt text';
      const taskName = 'invalid@task';

      GeminiExecutor.execute(testText, taskName);

      expect((logger as any).warning).toHaveBeenCalledWith(
        `Invalid taskName format: ${taskName}. Must be alphanumeric with dashes/underscores.`
      );
    });

    it('should handle state manager on errors', async () => {
      const testText = 'Test prompt text';
      const taskName = 'test-task';

      const promise = GeminiExecutor.execute(testText, taskName);
      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow();
      // State manager should still be initialized
      expect(ParallelStateManager.getInstance).toHaveBeenCalled();
    });
  });
});