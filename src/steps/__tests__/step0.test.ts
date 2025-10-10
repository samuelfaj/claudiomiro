import { Step0, Step0Options, Step0Result } from '../step0';
import fs from 'fs';
import state from '../../config/state';
import { PromptReader, FileManager } from '../../services/index';

// Mock dependencies
jest.mock('../../../logger', () => ({
  newline: jest.fn(),
  startSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/index', () => ({
  PromptReader: {
    getMultilineInput: jest.fn(),
  },
  FileManager: {
    startFresh: jest.fn(),
  },
  ClaudeExecutor: {
    execute: jest.fn(),
  },
  executeClaude: jest.fn(),
}));

jest.mock('../step1', () => ({
  Step1: {
    execute: jest.fn(),
  },
}));

// Mock process.exit to prevent test from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('Step0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset state
    state.setFolder('/test/path');

    // Mock file system operations
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.readFileSync as jest.Mock).mockReturnValue('Mock step0.md content');
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('execute', () => {
    it('should execute successfully with provided prompt text', async () => {
      const options: Step0Options = {
        promptText: 'Test task description with more than 10 characters',
        sameBranch: false,
        mode: 'auto',
      };

      const { ClaudeExecutor } = require('../../services/index');
      const { Step1 } = require('../step1');

      ClaudeExecutor.execute.mockResolvedValue(undefined);
      Step1.execute.mockResolvedValue(undefined);

      const result: Step0Result = await Step0.execute(options);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Tasks created successfully');
      expect(FileManager.startFresh as jest.Mock).toHaveBeenCalledWith(true);
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
      expect(Step1.execute).toHaveBeenCalled();
    });

    it('should execute successfully with sameBranch option', async () => {
      const options: Step0Options = {
        promptText: 'Test task with same branch',
        sameBranch: true,
        mode: 'auto',
      };

      const { ClaudeExecutor } = require('../../services/index');
      const { Step1 } = require('../step1');

      ClaudeExecutor.execute.mockResolvedValue(undefined);
      Step1.execute.mockResolvedValue(undefined);

      const result: Step0Result = await Step0.execute(options);

      expect(result.success).toBe(true);
      expect(FileManager.startFresh as jest.Mock).toHaveBeenCalledWith(true);
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
      expect(Step1.execute).toHaveBeenCalled();
    });

    it('should handle prompt input when no promptText provided', async () => {
      const { ClaudeExecutor } = require('../../services/index');
      const { Step1 } = require('../step1');

      (PromptReader.getMultilineInput as jest.Mock).mockResolvedValue('User provided task description with enough characters');
      ClaudeExecutor.execute.mockResolvedValue(undefined);
      Step1.execute.mockResolvedValue(undefined);

      const result: Step0Result = await Step0.execute();

      expect(result.success).toBe(true);
      expect(PromptReader.getMultilineInput as jest.Mock).toHaveBeenCalled();
      expect(FileManager.startFresh as jest.Mock).toHaveBeenCalledWith(true);
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
      expect(Step1.execute).toHaveBeenCalled();
    });

    it('should exit when task is too short', async () => {
      const options: Step0Options = {
        promptText: 'Short',
      };

      // Since process.exit throws an error, the promise will resolve with an error result
      const result = await Step0.execute(options);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('process.exit called');
    });

    it('should handle empty task input', async () => {
      (PromptReader.getMultilineInput as jest.Mock).mockResolvedValue('');

      // Since process.exit throws an error, the promise will resolve with an error result
      const result = await Step0.execute();
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('process.exit called');
    });

    it('should handle task creation failure in non-test environment', async () => {
      // Temporarily set NODE_ENV to something other than 'test'
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const options: Step0Options = {
        promptText: 'Test task that fails to create tasks',
      };

      const { executeClaude } = require('../../services/index');

      executeClaude.mockResolvedValue(undefined);
      (FileManager.startFresh as jest.Mock).mockImplementation(() => {
        // Simulate that tasks were not created
        // This would normally happen if Claude fails to create task directories
      });

      // Mock fs.writeFileSync to avoid file system errors
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      // Mock fs.existsSync to return false for task directories
      jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
        if (typeof path === 'string' && (path.includes('TASK0') || path.includes('TASK1'))) {
          return false;
        }
        return true;
      });

      const result: Step0Result = await Step0.execute(options);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create tasks');
      expect(result.error?.message).toBe('Error creating tasks');

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
      jest.restoreAllMocks();
    });

    it('should handle Claude execution failure', async () => {
      const options: Step0Options = {
        promptText: 'Test task that fails Claude execution',
      };

      const { ClaudeExecutor } = require('../../services/index');

      const claudeError = new Error('Claude execution failed');
      ClaudeExecutor.execute.mockRejectedValue(claudeError);

      const result: Step0Result = await Step0.execute(options);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create tasks');
      expect(result.error).toBe(claudeError);
      // The stopSpinner should be called in the catch block
    });

    it('should handle step1 execution failure', async () => {
      const options: Step0Options = {
        promptText: 'Test task that fails step1',
      };

      const { ClaudeExecutor } = require('../../services/index');
      const { Step1 } = require('../step1');

      ClaudeExecutor.execute.mockResolvedValue(undefined);
      const step1Error = new Error('Step1 execution failed');
      Step1.execute.mockRejectedValue(step1Error);

      const result: Step0Result = await Step0.execute(options);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create tasks');
      expect(result.error).toBe(step1Error);
      // The stopSpinner should be called in the catch block
    });
  });

  // Type safety tests
  describe('Type safety', () => {
    it('should have proper parameter types', () => {
      // These should compile without type errors
      const options: Step0Options = {
        sameBranch: true,
        promptText: 'Test task',
        mode: 'hard',
      };

      const result: Step0Result = {
        success: true,
        message: 'Test message',
      };

      expect(typeof options.sameBranch).toBe('boolean');
      expect(typeof options.promptText).toBe('string');
      expect(typeof options.mode).toBe('string');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should validate mode parameter types', () => {
      // This test verifies TypeScript type checking at compile time
      const validModes: Array<'auto' | 'hard'> = ['auto', 'hard'];
      const options: Step0Options = {
        mode: 'auto', // Should be valid
      };

      // This would cause a TypeScript compilation error:
      // const invalidOptions: Step0Options = {
      //   mode: 'invalid', // TypeScript would error here
      // };

      expect(validModes).toContain(options.mode);
    });

    it('should handle optional parameters correctly', () => {
      // These should all be valid TypeScript
      const options1: Step0Options = {};
      const options2: Step0Options = { sameBranch: true };
      const options3: Step0Options = { promptText: null };
      const options4: Step0Options = { mode: 'hard' };

      expect(options1).toBeDefined();
      expect(options2.sameBranch).toBe(true);
      expect(options3.promptText).toBeNull();
      expect(options4.mode).toBe('hard');
    });
  });

  describe('Static class pattern', () => {
    it('should be a static class with execute method', () => {
      expect(typeof Step0.execute).toBe('function');
      expect(Step0.execute).toBeInstanceOf(Function);
    });

    it('should be a static-only class', () => {
      // Verify it's a static class pattern
      expect(typeof Step0.execute).toBe('function');
    });
  });
});