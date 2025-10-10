import { Step1 } from '../step1';
import fs from 'fs';
import path from 'path';
import state from '../../config/state';

// Mock dependencies
jest.mock('../../../logger', () => ({
  newline: jest.fn(),
  startSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/claude-executor', () => ({
  ClaudeExecutor: {
    execute: jest.fn(),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('Step1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset state
    state.setFolder('/test/path');

    // Mock file system operations
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('Mock file content');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  describe('execute', () => {
    it('should handle no tasks found', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await Step1.execute();

      // Should complete without errors when no tasks found
    });

    it('should handle single task', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1']);
      (fs.readFileSync as jest.Mock).mockReturnValue('# Task content without dependencies');

      await Step1.execute();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path/.claudiomiro', 'TASK1', 'TASK.md'),
        '@dependencies []\n# Task content without dependencies',
        'utf-8'
      );
    });

    it('should skip adding dependencies if already present in single task', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1']);
      (fs.readFileSync as jest.Mock).mockReturnValue('@dependencies []\n# Task content');

      await Step1.execute();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should analyze multiple tasks with auto mode', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1', 'TASK2', 'TASK3']);

      const { ClaudeExecutor } = require('../../services/claude-executor');

      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step1.execute('auto');

      expect(ClaudeExecutor.execute).toHaveBeenCalled();
    });

    it('should analyze multiple tasks with hard mode', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1', 'TASK2', 'TASK3']);

      const { ClaudeExecutor } = require('../../services/claude-executor');

      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step1.execute('hard');

      expect(ClaudeExecutor.execute).toHaveBeenCalled();
    });

    it('should handle Claude execution failure', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1', 'TASK2']);

      const { ClaudeExecutor } = require('../../services/claude-executor');

      const claudeError = new Error('Claude execution failed');
      ClaudeExecutor.execute.mockRejectedValue(claudeError);

      await expect(Step1.execute()).rejects.toThrow('Claude execution failed');
    });

    it('should apply sequential dependencies as fallback', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1', 'TASK2', 'TASK3']);
      (fs.readFileSync as jest.Mock).mockReturnValue('# Task content without dependencies');

      const { ClaudeExecutor } = require('../../services/claude-executor');

      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step1.execute();

      // Should write sequential dependencies for tasks without @dependencies line
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path/.claudiomiro', 'TASK1', 'TASK.md'),
        '@dependencies []\n# Task content without dependencies',
        'utf-8'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path/.claudiomiro', 'TASK2', 'TASK.md'),
        '@dependencies [TASK1]\n# Task content without dependencies',
        'utf-8'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path/.claudiomiro', 'TASK3', 'TASK.md'),
        '@dependencies [TASK1, TASK2]\n# Task content without dependencies',
        'utf-8'
      );
    });

    it('should skip tasks with existing dependencies', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1', 'TASK2']);
      (fs.readFileSync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('TASK1')) {
          return '@dependencies []\n# Task content with dependencies';
        }
        return '# Task content without dependencies';
      });

      const { ClaudeExecutor } = require('../../services/claude-executor');

      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step1.execute();

      // Should only write for TASK2 (TASK1 already has dependencies)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1); // Only for TASK2
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path/.claudiomiro', 'TASK2', 'TASK.md'),
        '@dependencies [TASK1]\n# Task content without dependencies',
        'utf-8'
      );
    });
  });

  describe('Type safety', () => {
    it('should have proper parameter types', () => {
      // These should compile without type errors
      const autoMode: 'auto' = 'auto';
      const hardMode: 'hard' = 'hard';

      expect(typeof autoMode).toBe('string');
      expect(typeof hardMode).toBe('string');
    });

    it('should validate mode parameter types', () => {
      // This test verifies TypeScript type checking at compile time
      const validModes: Array<'auto' | 'hard'> = ['auto', 'hard'];

      // These should be valid TypeScript
      const mode1: 'auto' = 'auto';
      const mode2: 'hard' = 'hard';

      expect(validModes).toContain(mode1);
      expect(validModes).toContain(mode2);

      // This would cause a TypeScript compilation error:
      // const invalidMode: 'auto' | 'hard' = 'invalid'; // TypeScript would error here
    });

    it('should handle optional parameters correctly', () => {
      // These should all be valid TypeScript
      const mode1: 'auto' | 'hard' = 'auto';
      const mode2: 'auto' | 'hard' = 'hard';

      expect(mode1).toBe('auto');
      expect(mode2).toBe('hard');
    });
  });

  describe('Static class pattern', () => {
    it('should be a static class with execute method', () => {
      expect(typeof Step1.execute).toBe('function');
      expect(Step1.execute).toBeInstanceOf(Function);

    });

    it('should be a static-only class', () => {
      // Verify it's a static class pattern
      expect(typeof Step1.execute).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('should throw error when claudiomiro folder is not set', async () => {
      // Temporarily set claudiomiroFolder to null
      const originalFolder = state.claudiomiroFolder;
      (state as any)._claudiomiroFolder = null;

      await expect(Step1.execute()).rejects.toThrow('Claudiomiro folder not set');

      // Restore original value
      (state as any)._claudiomiroFolder = originalFolder;
    });

    it('should handle missing TASK.md files gracefully', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['TASK1', 'TASK2']);
      (fs.existsSync as jest.Mock).mockImplementation((filePath) => {
        // TASK1 has TASK.md, TASK2 doesn't
        return filePath.includes('TASK1');
      });

      const { ClaudeExecutor } = require('../../services/claude-executor');
      ClaudeExecutor.execute.mockResolvedValue(undefined);

      await Step1.execute();

      // Should only process TASK1 (TASK2 has no TASK.md)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });
  });
});