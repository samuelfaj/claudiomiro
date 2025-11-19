const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../services/claude-executor');
jest.mock('../../config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));

// Import after mocking
const { reviewCode } = require('./review-code');
const { executeClaude } = require('../../services/claude-executor');

describe('review-code', () => {
  const mockTask = 'TASK1';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset path.join mock to return path arguments joined with '/'
    path.join.mockImplementation((...paths) => paths.join('/'));

    // Default fs mocks
    fs.existsSync.mockReturnValue(false);
    fs.rmSync.mockImplementation();
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.includes('prompt-review.md')) {
        return 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
      }
      return 'mock file content';
    });
    fs.readdirSync.mockReturnValue([]);
    fs.statSync.mockReturnValue({ isDirectory: () => true });

    // Default executeClaude mock
    executeClaude.mockResolvedValue({ success: true });
  });

  describe('file cleanup', () => {
    test('should remove existing CODE_REVIEW.md file', async () => {
      // Arrange
      let existsCallCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CODE_REVIEW.md')) {
          existsCallCount++;
          return existsCallCount <= 1; // First call true (exists), subsequent calls false
        }
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(fs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('CODE_REVIEW.md')
      );
    });

    test('should remove existing GITHUB_PR.md file', async () => {
      // Arrange
      let existsCallCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('GITHUB_PR.md')) {
          existsCallCount++;
          return existsCallCount <= 1; // First call true (exists), subsequent calls false
        }
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(fs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('GITHUB_PR.md')
      );
    });

    test('should not remove files that do not exist', async () => {
      // Arrange
      fs.existsSync.mockReturnValue(false); // No files exist

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(fs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('context file collection', () => {
    test('should always include AI_PROMPT.md and INITIAL_PROMPT.md', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      const actualCall = executeClaude.mock.calls[0][0];
      expect(actualCall).toContain('AI_PROMPT.md');
      expect(actualCall).toContain('INITIAL_PROMPT.md');
      expect(actualCall).toContain('/test/.claudiomiro/AI_PROMPT.md');
      expect(actualCall).toContain('/test/.claudiomiro/INITIAL_PROMPT.md');
    });

    test('should include RESEARCH.md when it exists', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('RESEARCH.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      const actualCall = executeClaude.mock.calls[0][0];
      expect(actualCall).toContain('RESEARCH.md');
      expect(actualCall).toContain('/test/.claudiomiro/TASK1/RESEARCH.md');
    });

    test('should include CONTEXT.md when it exists', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CONTEXT.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('CONTEXT.md')
      );
    });

    test('should skip RESEARCH.md and CONTEXT.md when they do not exist', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('RESEARCH.md') || filePath.includes('CONTEXT.md')) return false;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('TASK1/RESEARCH.md')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('TASK1/CONTEXT.md')
      );
    });

    test('should collect context from other tasks', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('TASK2/CONTEXT.md')) return true;
        if (filePath.includes('TASK2/RESEARCH.md')) return true;
        if (filePath.includes('TASK3/CONTEXT.md')) return true;
        return false;
      });

      fs.readdirSync.mockReturnValue(['TASK1', 'TASK2', 'TASK3']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('TASK2/CONTEXT.md')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('TASK2/RESEARCH.md')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('TASK3/CONTEXT.md')
      );
    });

    test('should skip current task when collecting from other tasks', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('TASK1/CONTEXT.md')) return true; // Current task
        return false;
      });

      fs.readdirSync.mockReturnValue(['TASK1']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('TASK1/CONTEXT.md')
      );
    });

    test('should deduplicate context files', async () => {
      // Arrange - Simulate same file appearing multiple times
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('TASK2/CONTEXT.md')) return true;
        return false;
      });

      fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      // Act
      await reviewCode(mockTask);

      // Assert - CONTEXT.md should appear only once in the context
      const prompt = executeClaude.mock.calls[0][0];
      const contextMatches = prompt.match(/TASK2\/CONTEXT\.md/g);
      expect(contextMatches ? contextMatches.length : 0).toBe(1);
    });

    test('should handle empty task list gracefully', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      fs.readdirSync.mockReturnValue([]);

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalled();
    });

    test('should handle directory read errors gracefully', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      fs.readdirSync.mockImplementation(() => {
        throw new Error('Directory read error');
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalled();
    });

    test('should handle statSync errors gracefully', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
      fs.statSync.mockImplementation(() => {
        throw new Error('Stat error');
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalled();
    });
  });

  describe('prompt template loading and replacement', () => {
    test('should load prompt-review.md template', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('prompt-review.md'),
        'utf-8'
      );
    });

    test('should replace all placeholders in template', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('RESEARCH.md')) return true;
        return false;
      });

      const template = 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt-review.md')) {
          return template;
        }
        return 'mock file content';
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringMatching(/\{\{.*\}\}/)
      );
    });

    test('should include researchSection when RESEARCH.md exists', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('RESEARCH.md')) return true;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('4. **')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('** → Pre-implementation analysis and execution strategy')
      );
    });

    test('should have empty researchSection when RESEARCH.md does not exist', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('RESEARCH.md')) return false;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('4. **')
      );
    });
  });

  describe('executeClaude integration', () => {
    test('should call executeClaude with built prompt', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.any(String),
        mockTask
      );
    });

    test('should return executeClaude result', async () => {
      // Arrange
      const mockResult = { success: true, filesCreated: ['CODE_REVIEW.md'] };
      executeClaude.mockResolvedValue(mockResult);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act
      const result = await reviewCode(mockTask);

      // Assert
      expect(result).toBe(mockResult);
    });

    test('should propagate executeClaude errors', async () => {
      // Arrange
      const mockError = new Error('Claude execution failed');
      executeClaude.mockRejectedValue(mockError);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        return false;
      });

      // Act & Assert
      await expect(reviewCode(mockTask)).rejects.toThrow(mockError);
    });
  });

  describe('context section building', () => {
    test('should build context section when files exist', async () => {
      // Arrange
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('INITIAL_PROMPT.md')) return true;
        if (filePath.includes('TASK2/CONTEXT.md')) return true;
        return false;
      });

      fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('## 📚 CONTEXT FILES FOR COMPREHENSIVE REVIEW')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('AI_PROMPT.md')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('INITIAL_PROMPT.md')
      );
    });

    test('should not include context section when no files exist', async () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);

      // Act
      await reviewCode(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('## 📚 CONTEXT FILES FOR COMPREHENSIVE REVIEW')
      );
    });
  });
});