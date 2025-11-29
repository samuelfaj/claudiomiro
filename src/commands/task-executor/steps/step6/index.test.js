const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('./review-code');
jest.mock('./reanalyze-failed');
jest.mock('../../../../shared/services/git-commit');
jest.mock('../../utils/validation');
jest.mock('../../utils/scope-parser');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro',
    isMultiRepo: jest.fn(),
    getGitMode: jest.fn(),
    getRepository: jest.fn(),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
}));

// Import after mocking
const { step6 } = require('./index');
const { reviewCode } = require('./review-code');
const { reanalyzeFailed } = require('./reanalyze-failed');
const { smartCommit } = require('../../../../shared/services/git-commit');
const { isFullyImplementedAsync } = require('../../utils/validation');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

describe('step6', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset path.join mock to return the path arguments
        path.join.mockImplementation((...paths) => paths.join('/'));
        // Reset fs mocks
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue('{}');
        // Default to single-repo mode (backward compatible)
        state.isMultiRepo.mockReturnValue(false);
        state.getGitMode.mockReturnValue(null);
        state.getRepository.mockReturnValue('/test');
        // Default scope-parser mocks
        parseTaskScope.mockReturnValue(null);
        validateScope.mockReturnValue(true);
    });

    describe('orchestration flow', () => {
        test('should call reviewCode and return result', async () => {
            // Arrange
            const mockExecution = { success: true };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(false);

            // Act
            const result = await step6(mockTask);

            // Assert
            expect(reviewCode).toHaveBeenCalledWith(mockTask);
            expect(result).toBe(mockExecution);
        });

        test('should call smartCommit when TODO is fully implemented', async () => {
            // Arrange
            const mockExecution = { success: true };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
        });

        test('should call smartCommit without push when shouldPush is false', async () => {
            // Arrange
            const mockExecution = { success: true };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask, false);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: false,
                createPR: false,
            });
        });

        test('should not call smartCommit when TODO is not fully implemented', async () => {
            // Arrange
            const mockExecution = { success: true };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(false);

            // Act
            await step6(mockTask);

            // Assert
            expect(smartCommit).not.toHaveBeenCalled();
        });
    });

    describe('commit error handling', () => {
        test('should continue execution when commit fails', async () => {
            // Arrange
            const mockExecution = { success: true };
            const mockError = new Error('Git commit failed');
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockRejectedValue(mockError);

            // Act
            const result = await step6(mockTask);

            // Assert
            expect(result).toBe(mockExecution);
            expect(logger.warning).toHaveBeenCalledWith(
                '⚠️  Commit failed in step6, continuing anyway:',
                mockError.message,
            );
        });

        test('should not warn when commit succeeds', async () => {
            // Arrange
            const mockExecution = { success: true };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask);

            // Assert
            expect(logger.warning).not.toHaveBeenCalled();
        });
    });

    describe('re-analysis logic', () => {
        test('should call reanalyzeFailed on 3rd attempt when TODO not implemented', async () => {
            // Arrange
            const mockExecution = { success: false };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('info.json')) return true;
                return false;
            });
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 3 }));

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeFailed).not.toHaveBeenCalled();
            expect(smartCommit).toHaveBeenCalled();
        });

        test('should not call reanalyzeFailed when info.json does not exist', async () => {
            // Arrange
            const mockExecution = { success: false };
            reviewCode.mockResolvedValue(mockExecution);
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: false, confidence: 0.8 });
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
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask); // No shouldPush parameter

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
        });
    });

    describe('multi-repo commit scenarios', () => {
        beforeEach(() => {
            // Common setup for multi-repo tests
            reviewCode.mockResolvedValue({ success: true });
            isFullyImplementedAsync.mockResolvedValue({ completed: true, confidence: 0.8 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TASK.md')) return true;
                return false;
            });
            fs.readFileSync.mockReturnValue('@scope backend');
        });

        test('should commit normally in single-repo mode (backward compatible)', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(false);
            parseTaskScope.mockReturnValue(null);

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledTimes(1);
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(validateScope).not.toHaveBeenCalled();
        });

        test('should create single commit in monorepo mode', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('monorepo');
            parseTaskScope.mockReturnValue('backend');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledTimes(1);
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(logger.info).toHaveBeenCalledWith('Committed TASK1 to monorepo');
        });

        test('should commit to backend repo only for backend scope', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            state.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/test/backend';
                if (scope === 'frontend') return '/test/frontend';
                return '/test';
            });
            parseTaskScope.mockReturnValue('backend');
            fs.readFileSync.mockReturnValue('@scope backend');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledTimes(1);
            expect(smartCommit).toHaveBeenCalledWith({
                cwd: '/test/backend',
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(logger.info).toHaveBeenCalledWith('Committed TASK1 to backend repo');
        });

        test('should commit to frontend repo only for frontend scope', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            state.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/test/backend';
                if (scope === 'frontend') return '/test/frontend';
                return '/test';
            });
            parseTaskScope.mockReturnValue('frontend');
            fs.readFileSync.mockReturnValue('@scope frontend');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledTimes(1);
            expect(smartCommit).toHaveBeenCalledWith({
                cwd: '/test/frontend',
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(logger.info).toHaveBeenCalledWith('Committed TASK1 to frontend repo');
        });

        test('should commit to backend then frontend for integration scope', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            state.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/test/backend';
                if (scope === 'frontend') return '/test/frontend';
                return '/test';
            });
            parseTaskScope.mockReturnValue('integration');
            fs.readFileSync.mockReturnValue('@scope integration');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledTimes(2);
            expect(smartCommit).toHaveBeenNthCalledWith(1, {
                cwd: '/test/backend',
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(smartCommit).toHaveBeenNthCalledWith(2, {
                cwd: '/test/frontend',
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(logger.info).toHaveBeenCalledWith('Committed TASK1 to backend repo');
            expect(logger.info).toHaveBeenCalledWith('Committed TASK1 to frontend repo');
        });

        test('should call validateScope in multi-repo mode', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            parseTaskScope.mockReturnValue('backend');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(validateScope).toHaveBeenCalledWith('backend', true);
        });

        test('should pass correct cwd to smartCommit for backend scope', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            state.getRepository.mockReturnValue('/custom/backend/path');
            parseTaskScope.mockReturnValue('backend');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith(
                expect.objectContaining({
                    cwd: '/custom/backend/path',
                }),
            );
        });

        test('should pass correct cwd to smartCommit for frontend scope', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            state.getRepository.mockReturnValue('/custom/frontend/path');
            parseTaskScope.mockReturnValue('frontend');

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith(
                expect.objectContaining({
                    cwd: '/custom/frontend/path',
                }),
            );
        });
    });
});
