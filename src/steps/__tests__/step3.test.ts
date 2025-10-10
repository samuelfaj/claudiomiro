import { Step3 } from '../step3';
import * as fs from 'fs';
import state from '../../config/state';

// Mock dependencies
jest.mock('../../../logger', () => ({
  info: jest.fn(),
}));

jest.mock('../../services/claude-executor', () => ({
  ClaudeExecutor: {
    execute: jest.fn(),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  rmSync: jest.fn(),
}));

describe('Step3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset state
    state.setFolder('/test/path');

    // Mock file system operations
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.rmSync as jest.Mock).mockImplementation(() => {});
  });

  describe('execute', () => {
    it('should execute successfully with task parameter', async () => {
      const task = 'testTask';

      const { ClaudeExecutor } = require('../../services/claude-executor');
      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step3.execute(task);

      expect(ClaudeExecutor.execute).toHaveBeenCalled();
      expect(ClaudeExecutor.execute.mock.calls[0][0]).toContain('PHASE: EXECUTION LOOP (DEPENDENCY + SAFETY)');
      expect(ClaudeExecutor.execute.mock.calls[0][1]).toBe(task);
    });

    it('should remove existing CODE_REVIEW.md file', async () => {
      const task = 'testTask';

      const { ClaudeExecutor } = require('../../services/claude-executor');
      ClaudeExecutor.execute.mockResolvedValue(undefined);

      // Mock that CODE_REVIEW.md exists
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('CODE_REVIEW.md')) {
          return true;
        }
        return false;
      });

      await Step3.execute(task);

      expect(fs.rmSync).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should handle Claude execution failure', async () => {
      const task = 'testTask';

      const { ClaudeExecutor } = require('../../services/claude-executor');
      const claudeError = new Error('Claude execution failed');
      ClaudeExecutor.execute.mockRejectedValue(claudeError);

      await expect(Step3.execute(task)).rejects.toThrow('Claude execution failed');
    });

    it('should include correct folder paths in prompt', async () => {
      const task = 'testTask';

      const { ClaudeExecutor } = require('../../services/claude-executor');
      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step3.execute(task);

      const prompt = ClaudeExecutor.execute.mock.calls[0][0];
      expect(prompt).toContain('/test/path/.claudiomiro/testTask/TODO.md');
      expect(prompt).toContain('PHASE: EXECUTION LOOP (DEPENDENCY + SAFETY)');
      expect(prompt).toContain('OBJECTIVE:');
      expect(prompt).toContain('LOOP:');
      expect(prompt).toContain('TESTS:');
      expect(prompt).toContain('FAILURES:');
      expect(prompt).toContain('STATE:');
      expect(prompt).toContain('MCP:');
    });
  });

  describe('Static class pattern', () => {
    it('should be a static class with execute method', () => {
      expect(typeof Step3.execute).toBe('function');
      expect(Step3.execute).toBeInstanceOf(Function);
    });

    it('should be a static-only class', () => {
      // Verify it's a static class pattern
      expect(typeof Step3.execute).toBe('function');
    });
  });

  describe('Type safety', () => {
    it('should accept string task parameter', () => {
      // This should compile without type errors
      const task: string = 'testTask';
      expect(typeof task).toBe('string');
    });

    it('should return Promise<void>', () => {
      // This should compile without type errors
      const result: Promise<void> = Step3.execute('testTask');
      expect(result).toBeInstanceOf(Promise);
    });
  });
});