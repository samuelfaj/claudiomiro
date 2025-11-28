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
    folder: '/test/project',
}));
jest.mock('../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    stopSpinner: jest.fn(),
}));

// Import modules after mocks are defined
const { step8 } = require('./index');
const { smartCommit } = require('../../../../shared/services/git-commit');
const logger = require('../../../../shared/utils/logger');

describe('step8', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mockExit to track calls properly
        mockExit.mockClear();
    });

    describe('step8', () => {
        test('should execute commit/push and exit successfully', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: true,
                createPR: true,
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro', 'done.txt'),
                '1',
            );
            expect(logger.info).toHaveBeenCalledWith(
                '✅ Claudiomiro has been successfully executed. Check out: /test/project',
            );
            expect(mockExit).toHaveBeenCalledWith(0);
            expect(logger.warning).not.toHaveBeenCalled();
        });

        test('should call smartCommit without push and PR when shouldPush is false', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], false);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: false,
                createPR: false,
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro', 'done.txt'),
                '1',
            );
            expect(logger.info).toHaveBeenCalledWith(
                '✅ Claudiomiro has been successfully executed. Check out: /test/project',
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should call smartCommit with push and PR when shouldPush is true', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: true,
                createPR: true,
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro', 'done.txt'),
                '1',
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should create done.txt with correct content', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro', 'done.txt'),
                '1',
            );
            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        });

        test('should log success message with folder path', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(logger.info).toHaveBeenCalledWith(
                '✅ Claudiomiro has been successfully executed. Check out: /test/project',
            );
        });

        test('should log shell method when commit via shell', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(logger.info).toHaveBeenCalledWith('📦 Final commit via shell (saved Claude tokens)');
        });

        test('should log claude method when commit via Claude', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'claude' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(logger.info).toHaveBeenCalledWith('📦 Final commit/PR via Claude');
        });

        test('should warn and continue when smartCommit fails', async () => {
            // Arrange
            const errorMessage = 'Git command failed';
            smartCommit.mockRejectedValue(new Error(errorMessage));
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(logger.warning).toHaveBeenCalledWith(
                '⚠️  Commit/PR failed in step8, continuing anyway:',
                errorMessage,
            );
            // fs.writeFileSync is NOT called when smartCommit fails (it's inside the try block)
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                '✅ Claudiomiro has been successfully executed. Check out: /test/project',
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should call process.exit with code 0', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(mockExit).toHaveBeenCalledWith(0);
            expect(mockExit).toHaveBeenCalledTimes(1);
        });

        test('should NOT write done.txt when commit fails', async () => {
            // Arrange
            smartCommit.mockRejectedValue(new Error('Commit failed'));
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - done.txt is NOT created when commit fails (it's inside try block)
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should handle tasks parameter (even though not used)', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});
            const mockTasks = ['TASK1', 'TASK2', 'TASK3'];

            // Act
            await step8(mockTasks, false);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: false,
                createPR: false,
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro', 'done.txt'),
                '1',
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });
    });
});
