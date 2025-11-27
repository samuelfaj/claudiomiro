const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('./review-code');
jest.mock('./reanalyze-failed');
jest.mock('../../../../shared/services/git-commit');
jest.mock('../../utils/validation');
jest.mock('../../../../shared/config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));

// Mock console.warn
const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

// Import after mocking
const { step6 } = require('./index');
const { reviewCode } = require('./review-code');
const { reanalyzeFailed } = require('./reanalyze-failed');
const { commitOrFix } = require('../../../../shared/services/git-commit');
const { isFullyImplemented } = require('../../utils/validation');

describe('step6', () => {
  const mockTask = 'TASK1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset path.join mock to return the path arguments
    path.join.mockImplementation((...paths) => paths.join('/'));
    // Reset fs mocks
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('{}');
  });

  afterEach(() => {
    consoleWarn.mockClear();
  });

  describe('orchestration flow', () => {
    test('should call reviewCode and return result', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockReturnValue(false);

      // Act
      const result = await step6(mockTask);

      // Assert
      expect(reviewCode).toHaveBeenCalledWith(mockTask);
      expect(result).toBe(mockExecution);
    });

    test('should call commitOrFix when TODO is fully implemented', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(true);
      commitOrFix.mockResolvedValue();

      // Act
      await step6(mockTask, true);

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit and git push',
        mockTask
      );
    });

    test('should call commitOrFix without push when shouldPush is false', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(true);
      commitOrFix.mockResolvedValue();

      // Act
      await step6(mockTask, false);

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit ',
        mockTask
      );
    });

    test('should not call commitOrFix when TODO is not fully implemented', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockReturnValue(false);

      // Act
      await step6(mockTask);

      // Assert
      expect(commitOrFix).not.toHaveBeenCalled();
    });
  });

  describe('commit error handling', () => {
    test('should continue execution when commit fails', async () => {
      // Arrange
      const mockExecution = { success: true };
      const mockError = new Error('Git commit failed');
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(true);
      commitOrFix.mockRejectedValue(mockError);

      // Act
      const result = await step6(mockTask);

      // Assert
      expect(result).toBe(mockExecution);
      expect(consoleWarn).toHaveBeenCalledWith(
        '⚠️  Commit failed in step6, continuing anyway:',
        mockError.message
      );
    });

    test('should not warn when commit succeeds', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(true);
      commitOrFix.mockResolvedValue();

      // Act
      await step6(mockTask);

      // Assert
      expect(consoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('re-analysis logic', () => {
    test('should call reanalyzeFailed on 3rd attempt when TODO not implemented', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 3 }));
      reanalyzeFailed.mockResolvedValue();

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).toHaveBeenCalledWith(mockTask);
    });

    test('should call reanalyzeFailed on 6th attempt when TODO not implemented', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 6 }));
      reanalyzeFailed.mockResolvedValue();

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).toHaveBeenCalledWith(mockTask);
    });

    test('should not call reanalyzeFailed on 1st attempt when TODO not implemented', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 1 }));

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).not.toHaveBeenCalled();
    });

    test('should not call reanalyzeFailed on 2nd attempt when TODO not implemented', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 2 }));

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).not.toHaveBeenCalled();
    });

    test('should not call reanalyzeFailed on 4th attempt when TODO not implemented', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 4 }));

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).not.toHaveBeenCalled();
    });

    test('should not call reanalyzeFailed when TODO is implemented regardless of attempts', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(true);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 3 }));

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).not.toHaveBeenCalled();
      expect(commitOrFix).toHaveBeenCalled();
    });

    test('should not call reanalyzeFailed when info.json does not exist', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockReturnValue(false); // info.json doesn't exist

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).not.toHaveBeenCalled();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    test('should handle JSON parsing error gracefully', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue('invalid json');

      // Act & Assert
      await expect(step6(mockTask)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle zero attempt count', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 0 }));

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).toHaveBeenCalledWith(mockTask);
    });

    test('should handle negative attempt count', async () => {
      // Arrange
      const mockExecution = { success: false };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(false);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: -3 }));

      // Act
      await step6(mockTask);

      // Assert
      expect(reanalyzeFailed).toHaveBeenCalledWith(mockTask);
    });
  });

  describe('default parameters', () => {
    test('should use shouldPush=true by default', async () => {
      // Arrange
      const mockExecution = { success: true };
      reviewCode.mockResolvedValue(mockExecution);
      isFullyImplemented.mockReturnValue(true);
      commitOrFix.mockResolvedValue();

      // Act
      await step6(mockTask); // No shouldPush parameter

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit and git push',
        mockTask
      );
    });
  });
});