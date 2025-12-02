const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/services/prompt-reader');
jest.mock('../../services/file-manager');
jest.mock('../../../../shared/services/legacy-system', () => ({
    generateLegacySystemContext: jest.fn(() => ''),
}));

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
const { step0 } = require('./index');
const { execSync } = require('child_process');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getMultilineInput, askClarificationQuestions } = require('../../../../shared/services/prompt-reader');
const { startFresh } = require('../../services/file-manager');
const logger = require('../../../../shared/utils/logger');
const { generateLegacySystemContext } = require('../../../../shared/services/legacy-system');

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
            test('should NOT call createBranches in multi-repo mode (handled by CLI)', async () => {
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

                // Assert - Branch creation removed from step0
                expect(execSync).not.toHaveBeenCalled();

                // Assert - Prompt should NOT contain branch creation step
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('Generate clarification questions'),
                );
                expect(promptCall[0]).not.toContain('## FIRST STEP:');
                expect(promptCall[0]).not.toContain('Create a git branch');
            });

            test('should NOT include branch step in prompt for single-repo mode (handled by CLI)', async () => {
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
                // Assert - Prompt should NOT contain branch creation step anymore
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('Generate clarification questions'),
                );
                expect(promptCall[0]).not.toContain('## FIRST STEP:');
                expect(promptCall[0]).not.toContain('Create a git branch');
            });
        });

        describe('legacy system context integration', () => {
            test('should include legacy context in prompt when legacy systems configured', async () => {
                // Arrange
                const mockTask = 'Implement feature with legacy system reference';
                const mockLegacyContext = '\n\n## Legacy System Reference\n\n**⚠️ REFERENCE ONLY - DO NOT MODIFY**\n\nLegacy system: /path/to/legacy';

                generateLegacySystemContext.mockReturnValue(mockLegacyContext);

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
                expect(generateLegacySystemContext).toHaveBeenCalled();
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('Generate clarification questions'),
                );
                expect(promptCall[0]).toContain('## Legacy System Reference');
                expect(promptCall[0]).toContain('⚠️ REFERENCE ONLY - DO NOT MODIFY');
            });

            test('should not include legacy context when no legacy systems configured', async () => {
                // Arrange
                const mockTask = 'Implement feature without legacy system';

                generateLegacySystemContext.mockReturnValue('');

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
                expect(generateLegacySystemContext).toHaveBeenCalled();
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('Generate clarification questions'),
                );
                expect(promptCall[0]).not.toContain('## Legacy System Reference');
            });

            test('should append legacy context after base prompt', async () => {
                // Arrange
                const mockTask = 'Implement feature with legacy context order test';
                const mockLegacyContext = '\n\n## Legacy System Reference\n\nLegacy content here';

                generateLegacySystemContext.mockReturnValue(mockLegacyContext);

                fs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('CLARIFICATION_ANSWERS.json')) return false;
                    if (filePath.includes('CLARIFICATION_QUESTIONS.json')) return false;
                    if (filePath.includes('prompt.md')) return true;
                    return false;
                });

                fs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('prompt.md')) {
                        return 'BASE_PROMPT_MARKER for {{TASK}}';
                    }
                    return '';
                });

                fs.writeFileSync.mockImplementation(() => { });
                executeClaude.mockResolvedValue({ success: true });

                // Act
                await step0(false, mockTask);

                // Assert - legacy context appears AFTER base prompt
                const promptCall = executeClaude.mock.calls.find(call =>
                    call[0].includes('BASE_PROMPT_MARKER'),
                );
                const basePromptIndex = promptCall[0].indexOf('BASE_PROMPT_MARKER');
                const legacyContextIndex = promptCall[0].indexOf('## Legacy System Reference');
                expect(legacyContextIndex).toBeGreaterThan(basePromptIndex);
            });
        });
    });
});
