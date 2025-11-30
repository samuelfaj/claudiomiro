const fs = require('fs');
const path = require('path');

// CRITICAL: Mock process.exit FIRST to prevent test termination
const mockExit = jest.fn();
jest.spyOn(process, 'exit').mockImplementation(mockExit);

// Mock all dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../../shared/services/git-commit');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn(),
    getGitMode: jest.fn(),
    getRepository: jest.fn(),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    stopSpinner: jest.fn(),
}));

// Import modules after mocks are defined
const { step8 } = require('./index');
const { smartCommit } = require('../../../../shared/services/git-commit');
const { execSync } = require('child_process');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

describe('step8', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mockExit to track calls properly
        mockExit.mockClear();
        // Default to single-repo mode
        state.isMultiRepo.mockReturnValue(false);
        state.getGitMode.mockReturnValue(null);
        state.getRepository.mockReturnValue('/test/project');
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
                path.join('/test/.claudiomiro/task-executor', 'done.txt'),
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
                path.join('/test/.claudiomiro/task-executor', 'done.txt'),
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
                path.join('/test/.claudiomiro/task-executor', 'done.txt'),
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
                path.join('/test/.claudiomiro/task-executor', 'done.txt'),
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
                path.join('/test/.claudiomiro/task-executor', 'done.txt'),
                '1',
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });
    });

    describe('monorepo mode', () => {
        beforeEach(() => {
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('monorepo');
        });

        test('should use smartCommit with createPR for monorepo mode', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - should use existing behavior (single PR via smartCommit)
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: true,
                createPR: true,
            });
            expect(smartCommit).toHaveBeenCalledTimes(1);
            expect(mockExit).toHaveBeenCalledWith(0);
        });
    });

    describe('separate git mode (multi-repo)', () => {
        beforeEach(() => {
            state.isMultiRepo.mockReturnValue(true);
            state.getGitMode.mockReturnValue('separate');
            state.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/test/backend';
                if (scope === 'frontend') return '/test/frontend';
                return '/test/project';
            });
        });

        test('should create commits in both repos for separate git mode', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            execSync.mockReturnValue('https://github.com/test/repo/pull/1\n');
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - should call smartCommit twice (once per repo)
            expect(smartCommit).toHaveBeenCalledTimes(2);
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: true,
                createPR: false,
                cwd: '/test/backend',
            });
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: true,
                createPR: false,
                cwd: '/test/frontend',
            });
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should create PRs with cross-references in separate git mode', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            execSync.mockReturnValue('https://github.com/test/repo/pull/1\n');
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - should call gh pr create for each repo
            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('gh pr create'),
                expect.objectContaining({ cwd: '/test/backend' }),
            );
            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('gh pr create'),
                expect.objectContaining({ cwd: '/test/frontend' }),
            );
        });

        test('should update backend PR with frontend URL after both PRs created', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            execSync.mockReturnValue('https://github.com/test/repo/pull/1\n');
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - should call gh pr edit to update backend PR
            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('gh pr edit'),
                expect.objectContaining({ cwd: '/test/backend' }),
            );
        });

        test('should use correct cwd for each repository', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            execSync.mockReturnValue('https://github.com/test/repo/pull/1\n');
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert
            expect(state.getRepository).toHaveBeenCalledWith('backend');
            expect(state.getRepository).toHaveBeenCalledWith('frontend');
        });

        test('should fall back to single-repo when shouldPush is false', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], false);

            // Assert - should use existing behavior (single smartCommit call)
            expect(smartCommit).toHaveBeenCalledTimes(1);
            expect(smartCommit).toHaveBeenCalledWith({
                taskName: null,
                shouldPush: false,
                createPR: false,
            });
        });

        test('should handle gh pr create failure gracefully', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            execSync.mockImplementation(() => {
                throw new Error('gh: command failed');
            });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - should log warning but continue
            expect(logger.warning).toHaveBeenCalledWith(
                expect.stringContaining('Failed to create PR'),
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        test('should handle gh pr edit failure gracefully', async () => {
            // Arrange
            smartCommit.mockResolvedValue({ success: true, method: 'shell' });
            let callCount = 0;
            execSync.mockImplementation(() => {
                callCount++;
                // First two calls succeed (gh pr create), third fails (gh pr edit)
                if (callCount <= 2) {
                    return 'https://github.com/test/repo/pull/1\n';
                }
                throw new Error('gh pr edit failed');
            });
            fs.writeFileSync.mockImplementation(() => {});

            // Act
            await step8([], true);

            // Assert - should log warning but continue
            expect(logger.warning).toHaveBeenCalledWith(
                expect.stringContaining('Failed to update PR in'),
            );
            expect(mockExit).toHaveBeenCalledWith(0);
        });
    });
});
