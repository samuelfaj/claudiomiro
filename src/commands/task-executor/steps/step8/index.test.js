const fs = require('fs');
const path = require('path');

// CRITICAL: Mock process.exit FIRST to prevent test termination
const mockExit = jest.fn();
jest.spyOn(process, 'exit').mockImplementation(mockExit);

// Mock all dependencies
jest.mock('fs');
jest.mock('../../../../shared/services/git-commit');
jest.mock('../../../../shared/config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro',
  folder: '/test/project'
}));
jest.mock('../../../../shared/utils/logger', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  stopSpinner: jest.fn()
}));

// Import modules after mocks are defined
const { step8 } = require('./index');
const { commitOrFix } = require('../../../../shared/services/git-commit');

describe('step8', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockExit to track calls properly
    mockExit.mockClear();
  });

  describe('step8', () => {
    test('should execute commit/push and exit successfully', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step8([], true);

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit and git push and create pull request',
        null
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/.claudiomiro', 'done.txt'),
        '1'
      );
      expect(require('../../../../shared/utils/logger').info).toHaveBeenCalledWith(
        '✅ Claudiomiro has been successfully executed. Check out: /test/project'
      );
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(require('../../../../shared/utils/logger').warning).not.toHaveBeenCalled();
    });

    test('should generate commit-only prompt when shouldPush is false', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step8([], false);

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit ',
        null
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/.claudiomiro', 'done.txt'),
        '1'
      );
      expect(require('../../../../shared/utils/logger').info).toHaveBeenCalledWith(
        '✅ Claudiomiro has been successfully executed. Check out: /test/project'
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    test('should generate commit+push+PR prompt when shouldPush is true', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step8([], true);

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit and git push and create pull request',
        null
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/.claudiomiro', 'done.txt'),
        '1'
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    test('should create done.txt with correct content', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step8([], true);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/.claudiomiro', 'done.txt'),
        '1'
      );
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    test('should log success message with folder path', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      const logger = require('../../../../shared/utils/logger');

      // Act
      await step8([], true);

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        '✅ Claudiomiro has been successfully executed. Check out: /test/project'
      );
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    test('should warn and continue when commitOrFix fails', async () => {
      // Arrange
      const errorMessage = 'Git command failed';
      commitOrFix.mockRejectedValue(new Error(errorMessage));
      fs.writeFileSync.mockImplementation(() => {});
      const logger = require('../../../../shared/utils/logger');

      // Act
      await step8([], true);

      // Assert
      expect(logger.warning).toHaveBeenCalledWith(
        '⚠️  Commit/PR failed in step8, continuing anyway:',
        errorMessage
      );
      // fs.writeFileSync is NOT called when commitOrFix fails (it's inside the try block)
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '✅ Claudiomiro has been successfully executed. Check out: /test/project'
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    test('should call process.exit with code 0', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step8([], true);

      // Assert
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockExit).toHaveBeenCalledTimes(1);
    });

    test('should NOT write done.txt when commit fails', async () => {
      // Arrange
      commitOrFix.mockRejectedValue(new Error('Commit failed'));
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step8([], true);

      // Assert - done.txt is NOT created when commit fails (it's inside try block)
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    test('should handle tasks parameter (even though not used)', async () => {
      // Arrange
      commitOrFix.mockResolvedValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      const mockTasks = ['TASK1', 'TASK2', 'TASK3'];

      // Act
      await step8(mockTasks, false);

      // Assert
      expect(commitOrFix).toHaveBeenCalledWith(
        'git add . and git commit ',
        null
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/.claudiomiro', 'done.txt'),
        '1'
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});