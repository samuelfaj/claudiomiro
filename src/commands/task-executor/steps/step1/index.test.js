const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));
jest.mock('../../../../shared/utils/logger', () => ({
  newline: jest.fn(),
  startSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Import after mocks
const { step1 } = require('./index');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');

describe('step1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('step1', () => {
    test('should skip if AI_PROMPT.md already exists', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('AI_PROMPT.md')) return true;
        return false;
      });

      // Act
      await step1(false);

      // Assert
      expect(executeClaude).not.toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md already exists, skipping generation');
      expect(logger.startSpinner).not.toHaveBeenCalled();
      expect(logger.stopSpinner).not.toHaveBeenCalled();
    });

    test('should generate AI_PROMPT.md when it does not exist', async () => {
      // Arrange
      let existsCallCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('AI_PROMPT.md')) {
          existsCallCount++;
          // First call: false (doesn't exist)
          // Second call: true (created after execution)
          return existsCallCount > 1;
        }
        if(filePath.includes('INITIAL_PROMPT.md')) return true;
        if(filePath.includes('prompt.md')) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('INITIAL_PROMPT.md')) {
          return 'This is the initial task content from user';
        }
        if(filePath.includes('prompt.md')) {
          return 'Generate AI_PROMPT.md for task: {{TASK}} at {{claudiomiroFolder}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step1(false);

      // Assert
      expect(logger.newline).toHaveBeenCalled();
      expect(logger.startSpinner).toHaveBeenCalledWith('Generating AI_PROMPT.md with clarifications...');
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('## FIRST STEP: \n\nCreate a git branch for this task\n\n')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('Generate AI_PROMPT.md for task: This is the initial task content from user at /test/.claudiomiro')
      );
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md created successfully');
    });

    test('should throw error if AI_PROMPT.md not created after execution', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        // Always return false for AI_PROMPT.md (never exists)
        if(filePath.includes('AI_PROMPT.md')) return false;
        if(filePath.includes('INITIAL_PROMPT.md')) return true;
        if(filePath.includes('prompt.md')) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('INITIAL_PROMPT.md')) {
          return 'Initial task content';
        }
        if(filePath.includes('prompt.md')) {
          return 'Generate AI_PROMPT.md for task: {{TASK}} at {{claudiomiroFolder}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act & Assert
      await expect(step1(false)).rejects.toThrow('Error creating AI_PROMPT.md file');
      expect(logger.newline).toHaveBeenCalled();
      expect(logger.startSpinner).toHaveBeenCalledWith('Generating AI_PROMPT.md with clarifications...');
      expect(executeClaude).toHaveBeenCalled();
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('AI_PROMPT.md was not created');
    });

    test('should handle branch step parameter (sameBranch = true)', async () => {
      // Arrange
      let existsCallCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('AI_PROMPT.md')) {
          existsCallCount++;
          return existsCallCount > 1;
        }
        if(filePath.includes('INITIAL_PROMPT.md')) return true;
        if(filePath.includes('prompt.md')) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('INITIAL_PROMPT.md')) {
          return 'Task content for same branch test';
        }
        if(filePath.includes('prompt.md')) {
          return 'Generate AI_PROMPT.md for task: {{TASK}} at {{claudiomiroFolder}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step1(true);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('Generate AI_PROMPT.md for task: Task content for same branch test at /test/.claudiomiro')
      );
      // Verify that the prompt does NOT contain the branch step text
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('## FIRST STEP: \n\nCreate a git branch for this task\n\n')
      );
      expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md created successfully');
    });

    test('should handle missing INITIAL_PROMPT.md gracefully', async () => {
      // Arrange
      let existsCallCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('AI_PROMPT.md')) {
          existsCallCount++;
          return existsCallCount > 1;
        }
        // INITIAL_PROMPT.md does not exist
        if(filePath.includes('INITIAL_PROMPT.md')) return false;
        if(filePath.includes('prompt.md')) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('prompt.md')) {
          return 'Generate AI_PROMPT.md for task: {{TASK}} at {{claudiomiroFolder}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step1(false);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('Generate AI_PROMPT.md for task:  at /test/.claudiomiro')
      );
      expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md created successfully');
    });
  });
});