const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('./review-code');
jest.mock('./reanalyze-blocked');
jest.mock('./curate-insights', () => ({
    curateInsights: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../../shared/services/git-commit');
jest.mock('../../utils/validation');
jest.mock('../../utils/scope-parser');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
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
const { reanalyzeBlocked } = require('./reanalyze-blocked');
const { curateInsights } = require('./curate-insights');
const { smartCommit } = require('../../../../shared/services/git-commit');
const { isCompletedFromExecution } = require('../../utils/validation');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

describe('step6', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset path.join mock to return the path arguments
        path.join.mockImplementation((...paths) => paths.join('/'));
        // Reset fs mocks - execution.json must exist
        fs.existsSync.mockImplementation((filePath) => {
            if (filePath.includes('execution.json')) return true;
            return false;
        });
        fs.readFileSync.mockReturnValue(JSON.stringify({
            status: 'in_progress',
            attempts: 1,
            phases: [],
            completion: { status: 'pending_validation' },
        }));
        // Default to single-repo mode
        state.isMultiRepo.mockReturnValue(false);
        state.getGitMode.mockReturnValue(null);
        state.getRepository.mockReturnValue('/test');
        // Default scope-parser mocks
        parseTaskScope.mockReturnValue(null);
        validateScope.mockReturnValue(true);
    });

    describe('requires execution.json', () => {
        test('should throw error when execution.json does not exist', async () => {
            // Arrange
            fs.existsSync.mockReturnValue(false);

            // Act & Assert
            await expect(step6(mockTask)).rejects.toThrow(
                'execution.json not found for task TASK1. Step 4 must generate execution.json.',
            );
        });
    });

    describe('orchestration flow', () => {
        test('should call reviewCode and return result', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });

            // Act
            const result = await step6(mockTask);

            // Assert
            expect(reviewCode).toHaveBeenCalledWith(mockTask, expect.objectContaining({ model: 'fast' }));
            expect(result).toBe(mockResult);
        });

        test('should call smartCommit when task is completed', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask, true);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: true,
                createPR: false,
            });
            expect(curateInsights).toHaveBeenCalledWith(mockTask, expect.objectContaining({
                executionPath: expect.stringContaining('execution.json'),
                blueprintPath: expect.stringContaining('BLUEPRINT.md'),
                codeReviewPath: expect.stringContaining('CODE_REVIEW.md'),
                reflectionPath: expect.stringContaining('REFLECTION.md'),
            }));
        });

        test('should call smartCommit without push when shouldPush is false', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask, false);

            // Assert
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: mockTask,
                shouldPush: false,
                createPR: false,
            });
            expect(curateInsights).toHaveBeenCalled();
        });

        test('should not call smartCommit when task is not completed', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });

            // Act
            await step6(mockTask);

            // Assert
            expect(smartCommit).not.toHaveBeenCalled();
            expect(curateInsights).not.toHaveBeenCalled();
        });
    });

    describe('commit error handling', () => {
        test('should continue execution when commit fails', async () => {
            // Arrange
            const mockResult = { success: true };
            const mockError = new Error('Git commit failed');
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
            smartCommit.mockRejectedValue(mockError);

            // Act
            const result = await step6(mockTask);

            // Assert
            expect(result).toBe(mockResult);
            expect(logger.warning).toHaveBeenCalledWith(
                '⚠️  Commit failed in step6, continuing anyway:',
                mockError.message,
            );
            expect(curateInsights).not.toHaveBeenCalled();
        });

        test('should not warn when commit succeeds', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });

            // Act
            await step6(mockTask);

            // Assert
            expect(logger.warning).not.toHaveBeenCalled();
            expect(curateInsights).toHaveBeenCalled();
        });
    });

    describe('re-analysis logic', () => {
        test('should call reanalyzeBlocked on 3rd attempt when task not completed', async () => {
            // Arrange
            const mockResult = { success: false };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 3, status: 'blocked' }));
            reanalyzeBlocked.mockResolvedValue();

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).toHaveBeenCalledWith(mockTask, expect.objectContaining({ model: 'hard' }));
        });

        test('should call reanalyzeBlocked on 6th attempt when task not completed', async () => {
            // Arrange
            const mockResult = { success: false };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 6, status: 'blocked' }));
            reanalyzeBlocked.mockResolvedValue();

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).toHaveBeenCalledWith(mockTask, expect.objectContaining({ model: 'hard' }));
        });

        test('should not call reanalyzeBlocked on 1st attempt when task not completed', async () => {
            // Arrange
            const mockResult = { success: false };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 1, status: 'in_progress' }));

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).not.toHaveBeenCalled();
        });

        test('should not call reanalyzeBlocked on 2nd attempt when task not completed', async () => {
            // Arrange
            const mockResult = { success: false };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 2, status: 'in_progress' }));

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).not.toHaveBeenCalled();
        });

        test('should not call reanalyzeBlocked on 4th attempt when task not completed', async () => {
            // Arrange
            const mockResult = { success: false };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 4, status: 'in_progress' }));

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).not.toHaveBeenCalled();
        });

        test('should not call reanalyzeBlocked when task is completed regardless of attempts', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 3, status: 'completed' }));

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).not.toHaveBeenCalled();
            expect(smartCommit).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        test('should not call reanalyzeBlocked for zero attempts', async () => {
            // Arrange
            const mockResult = { success: false };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.8 });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ attempts: 0, status: 'pending' }));

            // Act
            await step6(mockTask);

            // Assert
            expect(reanalyzeBlocked).not.toHaveBeenCalled();
        });
    });

    describe('default parameters', () => {
        test('should use shouldPush=true by default', async () => {
            // Arrange
            const mockResult = { success: true };
            reviewCode.mockResolvedValue(mockResult);
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
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

    describe('escalation with @difficulty tag', () => {
        beforeEach(() => {
            // Common setup for escalation tests
            reviewCode.mockResolvedValue({ success: true });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
        });

        test('should skip HARD model escalation when @difficulty fast', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@difficulty fast\n# BLUEPRINT\nTask content';
                }
                return JSON.stringify({
                    status: 'completed',
                    attempts: 1,
                    phases: [],
                    completion: { status: 'completed' },
                });
            });
            // First call returns completed (after fast model review)
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });

            // Act
            await step6(mockTask);

            // Assert
            // Should only call reviewCode once with fast model (no escalation to hard)
            expect(reviewCode).toHaveBeenCalledTimes(1);
            expect(reviewCode).toHaveBeenCalledWith(mockTask, { model: 'fast' });
            expect(logger.info).toHaveBeenCalledWith('[Step6] Task has @difficulty fast - skipping HARD model escalation');
        });

        test('should escalate to HARD model when @difficulty medium', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@difficulty medium\n# BLUEPRINT\nTask content';
                }
                return JSON.stringify({
                    status: 'completed',
                    attempts: 1,
                    phases: [],
                    completion: { status: 'completed' },
                });
            });
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });

            // Act
            await step6(mockTask);

            // Assert
            // Should call reviewCode twice: fast then hard (escalation)
            expect(reviewCode).toHaveBeenCalledTimes(2);
            expect(reviewCode).toHaveBeenNthCalledWith(1, mockTask, { model: 'fast' });
            expect(reviewCode).toHaveBeenNthCalledWith(2, mockTask, { model: 'hard' });
            expect(logger.info).toHaveBeenCalledWith('[Step6] Fast review passed, escalating to HARD model for final validation');
        });

        test('should escalate to HARD model when @difficulty hard', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@difficulty hard\n# BLUEPRINT\nTask content';
                }
                return JSON.stringify({
                    status: 'completed',
                    attempts: 1,
                    phases: [],
                    completion: { status: 'completed' },
                });
            });
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });

            // Act
            await step6(mockTask);

            // Assert
            // Should call reviewCode twice: fast then hard (escalation)
            expect(reviewCode).toHaveBeenCalledTimes(2);
            expect(reviewCode).toHaveBeenNthCalledWith(1, mockTask, { model: 'fast' });
            expect(reviewCode).toHaveBeenNthCalledWith(2, mockTask, { model: 'hard' });
        });

        test('should escalate to HARD model when no @difficulty tag', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '# BLUEPRINT\nTask content without difficulty tag';
                }
                return JSON.stringify({
                    status: 'completed',
                    attempts: 1,
                    phases: [],
                    completion: { status: 'completed' },
                });
            });
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });

            // Act
            await step6(mockTask);

            // Assert
            // Should call reviewCode twice: fast then hard (escalation)
            expect(reviewCode).toHaveBeenCalledTimes(2);
            expect(reviewCode).toHaveBeenNthCalledWith(1, mockTask, { model: 'fast' });
            expect(reviewCode).toHaveBeenNthCalledWith(2, mockTask, { model: 'hard' });
        });

        test('should not escalate when fast review fails (task not completed)', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@difficulty medium\n# BLUEPRINT\nTask content';
                }
                return JSON.stringify({
                    status: 'in_progress',
                    attempts: 1,
                    phases: [],
                    completion: { status: 'pending' },
                });
            });
            // Fast review fails - task not completed
            isCompletedFromExecution.mockReturnValue({ completed: false, confidence: 0.5 });

            // Act
            await step6(mockTask);

            // Assert
            // Should only call reviewCode once (no escalation since fast failed)
            expect(reviewCode).toHaveBeenCalledTimes(1);
            expect(reviewCode).toHaveBeenCalledWith(mockTask, { model: 'fast' });
        });
    });

    describe('multi-repo commit scenarios', () => {
        beforeEach(() => {
            // Common setup for multi-repo tests
            reviewCode.mockResolvedValue({ success: true });
            isCompletedFromExecution.mockReturnValue({ completed: true, confidence: 1.0 });
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });
            fs.readFileSync.mockReturnValue('@scope backend');
        });

        test('should commit normally in single-repo mode', async () => {
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
