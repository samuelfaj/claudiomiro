const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/services/prompt-reader');
jest.mock('../../services/file-manager');

// Create mock state with multi-repo support
const mockState = {
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn(() => false),
    getGitMode: jest.fn(() => null),
    getRepository: jest.fn((_scope) => '/test/project'),
};
jest.mock('../../../../shared/config/state', () => mockState);

jest.mock('../../../../shared/utils/logger', () => ({
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
}));

// Import after mocks
const { step0, createBranches, generateBranchName } = require('./index');
const { execSync } = require('child_process');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getMultilineInput, askClarificationQuestions } = require('../../../../shared/services/prompt-reader');
const { startFresh } = require('../../services/file-manager');
const logger = require('../../../../shared/utils/logger');

describe('step0', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset state mock to single-repo mode
        mockState.isMultiRepo.mockReturnValue(false);
        mockState.getGitMode.mockReturnValue(null);
        mockState.getRepository.mockImplementation(() => '/test/project');
        // Mock process.exit
        jest.spyOn(process, 'exit').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('generateBranchName', () => {
        test('should generate branch name from task description', () => {
            const task = 'Add user authentication system';
            const result = generateBranchName(task);
            expect(result).toBe('claudiomiro/add-user-authentication-system');
        });

        test('should limit to first 5 words', () => {
            const task = 'This is a very long task description with many words';
            const result = generateBranchName(task);
            expect(result).toBe('claudiomiro/this-is-a-very-long');
        });

        test('should remove special characters', () => {
            const task = 'Fix bug #123: handle @user mentions!';
            const result = generateBranchName(task);
            expect(result).toBe('claudiomiro/fix-bug-123-handle-user');
        });

        test('should convert to lowercase', () => {
            const task = 'ADD NEW Feature';
            const result = generateBranchName(task);
            expect(result).toBe('claudiomiro/add-new-feature');
        });

        test('should fallback to task when empty after cleanup', () => {
            const task = '!!!@@@###';
            const result = generateBranchName(task);
            expect(result).toBe('claudiomiro/task');
        });
    });

    describe('createBranches', () => {
        test('should do nothing in single-repo mode', () => {
            mockState.isMultiRepo.mockReturnValue(false);

            createBranches('test-branch');

            expect(execSync).not.toHaveBeenCalled();
        });

        test('should create single branch in monorepo mode', () => {
            mockState.isMultiRepo.mockReturnValue(true);
            mockState.getGitMode.mockReturnValue('monorepo');

            createBranches('test-branch');

            expect(execSync).toHaveBeenCalledTimes(1);
            expect(execSync).toHaveBeenCalledWith(
                'git checkout -b test-branch',
                { cwd: '/test/project', stdio: 'pipe' },
            );
            expect(logger.info).toHaveBeenCalledWith('Created branch test-branch in monorepo');
        });

        test('should create branches in both repos for separate git mode', () => {
            mockState.isMultiRepo.mockReturnValue(true);
            mockState.getGitMode.mockReturnValue('separate');
            mockState.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/test/backend';
                if (scope === 'frontend') return '/test/frontend';
                return '/test/project';
            });

            createBranches('test-branch');

            expect(execSync).toHaveBeenCalledTimes(2);
            expect(execSync).toHaveBeenCalledWith(
                'git checkout -b test-branch',
                { cwd: '/test/backend', stdio: 'pipe' },
            );
            expect(execSync).toHaveBeenCalledWith(
                'git checkout -b test-branch',
                { cwd: '/test/frontend', stdio: 'pipe' },
            );
            expect(logger.info).toHaveBeenCalledWith('Created branch test-branch in backend repo');
            expect(logger.info).toHaveBeenCalledWith('Created branch test-branch in frontend repo');
        });

        test('should switch to existing branch when it already exists', () => {
            mockState.isMultiRepo.mockReturnValue(true);
            mockState.getGitMode.mockReturnValue('monorepo');

            // First call throws "already exists" error
            const error = new Error('git error');
            error.stderr = Buffer.from('fatal: A branch named \'test-branch\' already exists');
            execSync.mockImplementationOnce(() => { throw error; });
            // Second call (checkout) succeeds
            execSync.mockImplementationOnce(() => { });

            createBranches('test-branch');

            expect(execSync).toHaveBeenCalledWith(
                'git checkout -b test-branch',
                { cwd: '/test/project', stdio: 'pipe' },
            );
            expect(execSync).toHaveBeenCalledWith(
                'git checkout test-branch',
                { cwd: '/test/project', stdio: 'pipe' },
            );
            expect(logger.info).toHaveBeenCalledWith('Branch test-branch already exists in monorepo, switched to it');
        });

        test('should throw error for non-existing-branch errors', () => {
            mockState.isMultiRepo.mockReturnValue(true);
            mockState.getGitMode.mockReturnValue('monorepo');

            const error = new Error('git error');
            error.stderr = Buffer.from('fatal: Not a git repository');
            execSync.mockImplementationOnce(() => { throw error; });

            expect(() => createBranches('test-branch')).toThrow('Failed to create branch in monorepo');
        });
    });

    describe('step0', () => {
        test('should execute successfully with valid task input and existing questions', async () => {
            // Arrange
            const mockTask = 'Implement user authentication system with JWT tokens';
            getMultilineInput.mockResolvedValue(mockTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (filePath.includes('PENDING_CLARIFICATION.flag')) return false;
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.writeFileSync.mockImplementation(() => { });
            fs.unlinkSync.mockImplementation(() => { });

            // Act
            await step0(false, mockTask);

            // Assert
            expect(startFresh).toHaveBeenCalledWith(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'INITIAL_PROMPT.md'),
                mockTask,
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'newbranch.txt'),
                'true',
            );
            expect(logger.success).toHaveBeenCalledWith('Clarification answers already exist, skipping question generation');
            expect(executeClaude).not.toHaveBeenCalled();
            expect(getMultilineInput).not.toHaveBeenCalled(); // Should use promptText parameter
        });

        test('should skip newbranch.txt creation when sameBranch=true', async () => {
            // Arrange
            const mockTask = 'Add user authentication';
            getMultilineInput.mockResolvedValue(mockTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return true;
                return false;
            });

            fs.writeFileSync.mockImplementation(() => { });

            // Act
            await step0(true, mockTask);

            // Assert
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'INITIAL_PROMPT.md'),
                mockTask,
            );
            expect(fs.writeFileSync).not.toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'newbranch.txt'),
                'true',
            );
        });

        test('should generate clarification questions when they do not exist', async () => {
            // Arrange
            const mockTask = 'Create REST API for user management';
            getMultilineInput.mockResolvedValue(mockTask);

            let _existsCallCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return true;
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Generate clarification questions for {{TASK}} in {{claudiomiroFolder}}';
                }
                if (filePath.includes('CLARIFICATION_QUESTIONS.json')) {
                    return '{"question1": "What is the tech stack?"}';
                }
                return '';
            });

            fs.writeFileSync.mockImplementation(() => { });

            askClarificationQuestions.mockResolvedValue('{"question1": "answer1", "question2": "answer2"}');
            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step0(false, mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledTimes(2); // git hooks + prompt
            expect(logger.startSpinner).toHaveBeenCalledWith('Exploring codebase and generating clarification questions...');
            expect(logger.stopSpinner).toHaveBeenCalled();
            expect(askClarificationQuestions).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'CLARIFICATION_ANSWERS.json'),
                '{"question1": "answer1", "question2": "answer2"}',
            );
        });

        test('should create empty answers file when no questions are generated', async () => {
            // Arrange
            const mockTask = 'Simple task with no questions needed';
            getMultilineInput.mockResolvedValue(mockTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return false; // No questions generated
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Generate clarification questions for {{TASK}}';
                }
                return '';
            });

            fs.writeFileSync.mockImplementation(() => { });
            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step0(false, mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'CLARIFICATION_ANSWERS.json'),
                '[]',
            );
            expect(askClarificationQuestions).not.toHaveBeenCalled();
        });

        test('should handle error when answer collection fails', async () => {
            // Arrange
            const mockTask = 'Complex task that needs clarification';
            getMultilineInput.mockResolvedValue(mockTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return true;
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Generate clarification questions for {{TASK}}';
                }
                if (filePath.includes('CLARIFICATION_QUESTIONS.json')) {
                    return '{"question1": "What is the tech stack?"}';
                }
                return '';
            });

            fs.writeFileSync.mockImplementation(() => { });
            executeClaude.mockResolvedValue({ success: true });
            askClarificationQuestions.mockRejectedValue(new Error('User cancelled input'));

            // Act
            await step0(false, mockTask);

            // Assert
            expect(logger.error).toHaveBeenCalledWith('Error collecting answers: User cancelled input');
            expect(logger.info).toHaveBeenCalledWith('Questions have been saved to:');
            expect(logger.info).toHaveBeenCalledWith('  ' + path.join('/test/.claudiomiro/task-executor', 'CLARIFICATION_QUESTIONS.json'));
            expect(logger.info).toHaveBeenCalledWith('You can answer them manually in:');
            expect(logger.info).toHaveBeenCalledWith('  ' + path.join('/test/.claudiomiro/task-executor', 'CLARIFICATION_ANSWERS.json'));
            expect(logger.info).toHaveBeenCalledWith('Then run: claudiomiro --continue');
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/.claudiomiro/task-executor', 'PENDING_CLARIFICATION.flag'),
                'pending',
            );
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should remove PENDING_CLARIFICATION.flag when resuming', async () => {
            // Arrange
            const mockTask = 'Resuming task with clarification';
            getMultilineInput.mockResolvedValue(mockTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (filePath.includes('PENDING_CLARIFICATION.flag')) return true;
                return false;
            });

            fs.writeFileSync.mockImplementation(() => { });
            fs.unlinkSync.mockImplementation(() => { });

            // Act
            await step0(false, mockTask);

            // Assert
            expect(fs.unlinkSync).toHaveBeenCalledWith(path.join('/test/.claudiomiro/task-executor', 'PENDING_CLARIFICATION.flag'));
            expect(logger.info).toHaveBeenCalledWith('Resuming from clarification phase...');
            expect(logger.newline).toHaveBeenCalled();
        });

        test('should exit when task is too short (< 10 characters)', async () => {
            // Arrange
            const shortTask = 'Add login';
            getMultilineInput.mockResolvedValue(shortTask);

            // Mock process.exit to actually throw to stop execution
            process.exit.mockImplementation(() => {
                throw new Error('process.exit called');
            });

            // Act & Assert
            await expect(step0()).rejects.toThrow('process.exit called');
            expect(logger.error).toHaveBeenCalledWith('Please provide more details (at least 10 characters)');
            expect(process.exit).toHaveBeenCalledWith(0);
            expect(startFresh).not.toHaveBeenCalled();
        });

        test('should exit when task is empty', async () => {
            // Arrange
            getMultilineInput.mockResolvedValue('');
            process.exit.mockImplementation(() => {
                throw new Error('process.exit called');
            });

            // Act & Assert
            await expect(step0()).rejects.toThrow('process.exit called');
            expect(logger.error).toHaveBeenCalledWith('Please provide more details (at least 10 characters)');
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        test('should exit when task has only whitespace', async () => {
            // Arrange
            getMultilineInput.mockResolvedValue('   \t  \n  ');
            process.exit.mockImplementation(() => {
                throw new Error('process.exit called');
            });

            // Act & Assert
            await expect(step0()).rejects.toThrow('process.exit called');
            expect(logger.error).toHaveBeenCalledWith('Please provide more details (at least 10 characters)');
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        test('should proceed with exactly 10 characters', async () => {
            // Arrange
            const exactTask = '1234567890'; // Exactly 10 characters
            getMultilineInput.mockResolvedValue(exactTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return true;
                return false;
            });

            fs.writeFileSync.mockImplementation(() => { });

            // Act
            await step0(false, exactTask);

            // Assert
            expect(logger.error).not.toHaveBeenCalled();
            expect(startFresh).toHaveBeenCalled();
        });

        test('should handle git hooks verification', async () => {
            // Arrange
            const mockTask = 'Set up project with git hooks';
            getMultilineInput.mockResolvedValue(mockTask);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return false;
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Generate clarification questions for {{TASK}}';
                }
                return '';
            });

            fs.writeFileSync.mockImplementation(() => { });
            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step0(false, mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                'If the repository uses Husky, lint-staged, or any other Git hooks, verify that they are properly configured and functioning.If no such hooks exist, take no action.',
            );
            expect(executeClaude).toHaveBeenCalledTimes(2); // git hooks + prompt
        });

        describe('multi-repo integration', () => {
            test('should call createBranches in multi-repo mode instead of Claude prompt', async () => {
                // Arrange
                const mockTask = 'Add authentication feature for multi-repo project';
                mockState.isMultiRepo.mockReturnValue(true);
                mockState.getGitMode.mockReturnValue('monorepo');

                fs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                    if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return false;
                    if (filePath.includes('prompt.md')) return true;
                    return false;
                });

                fs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('prompt.md')) {
                        return 'Generate clarification questions for {{TASK}}';
                    }
                    return '';
                });

                fs.writeFileSync.mockImplementation(() => { });
                executeClaude.mockResolvedValue({ success: true });

                // Act
                await step0(false, mockTask);

                // Assert - Branch created programmatically
                expect(execSync).toHaveBeenCalledWith(
                    expect.stringContaining('git checkout -b claudiomiro/'),
                    expect.objectContaining({ cwd: '/test/project' }),
                );
                // Assert - Prompt should NOT contain branch creation step
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('Generate clarification questions'),
                );
                expect(promptCall[0]).not.toContain('## FIRST STEP:');
                expect(promptCall[0]).not.toContain('Create a git branch');
            });

            test('should include branch step in prompt for single-repo mode', async () => {
                // Arrange
                const mockTask = 'Add authentication feature for single-repo project';
                mockState.isMultiRepo.mockReturnValue(false);

                fs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                    if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return false;
                    if (filePath.includes('prompt.md')) return true;
                    return false;
                });

                fs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('prompt.md')) {
                        return 'Generate clarification questions for {{TASK}}';
                    }
                    return '';
                });

                fs.writeFileSync.mockImplementation(() => { });
                executeClaude.mockResolvedValue({ success: true });

                // Act
                await step0(false, mockTask);

                // Assert - No programmatic branch creation
                expect(execSync).not.toHaveBeenCalled();
                // Assert - Prompt SHOULD contain branch creation step
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('Generate clarification questions'),
                );
                expect(promptCall[0]).toContain('## FIRST STEP:');
                expect(promptCall[0]).toContain('Create a git branch');
            });

            test('should skip branch creation entirely when sameBranch=true in multi-repo mode', async () => {
                // Arrange
                const mockTask = 'Continue work on existing branch';
                mockState.isMultiRepo.mockReturnValue(true);
                mockState.getGitMode.mockReturnValue('separate');

                fs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('CLARIFICATION_ANSWERS.json')) return true;
                    return false;
                });

                fs.writeFileSync.mockImplementation(() => { });

                // Act
                await step0(true, mockTask);

                // Assert - No branch creation (sameBranch=true)
                expect(execSync).not.toHaveBeenCalled();
            });
        });
    });
});
