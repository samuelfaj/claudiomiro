const fs = require('fs');
const _path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/services/legacy-system', () => ({
    generateLegacySystemContext: jest.fn(() => ''),
}));
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    isMultiRepo: jest.fn(() => false),
    getRepository: jest.fn((scope) => `/test/${scope}`),
    getGitMode: jest.fn(() => 'separate'),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('./state-manager', () => ({
    getStatePaths: jest.fn(() => ({
        todoPath: '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_TODO.md',
        overviewPath: '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_OVERVIEW.md',
        passedPath: '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_PASSED.md',
    })),
    countPendingItems: jest.fn(() => 0),
    countCompletedItems: jest.fn(() => 0),
    isVerificationPassed: jest.fn(() => true), // Default: skip refinement loop
    deleteOverview: jest.fn(),
    createPassedFile: jest.fn(),
}));

// Import after mocks
const { step1, generateMultiRepoContext, runRefinementLoop } = require('./index');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');
const state = require('../../../../shared/config/state');
const { generateLegacySystemContext } = require('../../../../shared/services/legacy-system');
const stateManager = require('./state-manager');

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
                expect.stringContaining('## FIRST STEP: \n\nCreate a git branch for this task\n\n'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Generate AI_PROMPT.md for task: This is the initial task content from user at /test/.claudiomiro/task-executor'),
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
                expect.stringContaining('Generate AI_PROMPT.md for task: Task content for same branch test at /test/.claudiomiro/task-executor'),
            );
            // Verify that the prompt does NOT contain the branch step text
            expect(executeClaude).toHaveBeenCalledWith(
                expect.not.stringContaining('## FIRST STEP: \n\nCreate a git branch for this task\n\n'),
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
                expect.stringContaining('Generate AI_PROMPT.md for task:  at /test/.claudiomiro/task-executor'),
            );
            expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md created successfully');
        });
    });

    describe('generateMultiRepoContext', () => {
        test('should return empty string when single-repo mode', () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(false);

            // Act
            const result = generateMultiRepoContext();

            // Assert
            expect(result).toBe('');
            expect(state.isMultiRepo).toHaveBeenCalled();
        });

        test('should return markdown context when multi-repo mode enabled', () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => `/path/to/${scope}`);
            state.getGitMode.mockReturnValue('separate');

            // Act
            const result = generateMultiRepoContext();

            // Assert
            expect(result).toContain('## Multi-Repository Context');
            expect(result).toContain('**Backend Repository:** `/path/to/backend`');
            expect(result).toContain('**Frontend Repository:** `/path/to/frontend`');
            expect(result).toContain('**Git Mode:** separate');
        });

        test('should include @scope documentation in multi-repo context', () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => `/path/to/${scope}`);
            state.getGitMode.mockReturnValue('monorepo');

            // Act
            const result = generateMultiRepoContext();

            // Assert
            expect(result).toContain('### Task Scope Requirements');
            expect(result).toContain('@scope backend');
            expect(result).toContain('@scope frontend');
            expect(result).toContain('@scope integration');
            expect(result).toContain('Tasks without @scope will fail validation in multi-repo mode.');
        });

        test('should include code example with @scope tag', () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => `/path/to/${scope}`);
            state.getGitMode.mockReturnValue('separate');

            // Act
            const result = generateMultiRepoContext();

            // Assert
            expect(result).toContain('@dependencies [TASK0]');
            expect(result).toContain('@scope backend');
            expect(result).toContain('# Task Title');
        });
    });

    describe('step1 with multi-repo context', () => {
        test('should include multi-repo context in prompt when multi-repo enabled', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => `/project/${scope}`);
            state.getGitMode.mockReturnValue('separate');

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
                if(filePath.includes('INITIAL_PROMPT.md')) return 'Multi-repo task';
                if(filePath.includes('prompt.md')) return 'Base prompt {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('## Multi-Repository Context'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/project/backend'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/project/frontend'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('@scope'),
            );
        });

        test('should NOT include multi-repo context when single-repo mode (backward compatibility)', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(false);

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
                if(filePath.includes('INITIAL_PROMPT.md')) return 'Single-repo task';
                if(filePath.includes('prompt.md')) return 'Base prompt {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.not.stringContaining('## Multi-Repository Context'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Base prompt Single-repo task'),
            );
        });
    });

    describe('step1 with legacy system context', () => {
        test('should include legacy context in prompt when legacy systems configured', async () => {
            // Arrange
            const mockLegacyContext = '\n\n## Legacy System Reference\n\n**⚠️ REFERENCE ONLY - DO NOT MODIFY**\n\nLegacy system: /path/to/legacy';
            generateLegacySystemContext.mockReturnValue(mockLegacyContext);
            state.isMultiRepo.mockReturnValue(false);

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
                if(filePath.includes('INITIAL_PROMPT.md')) return 'Task with legacy system';
                if(filePath.includes('prompt.md')) return 'Base prompt {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true);

            // Assert
            expect(generateLegacySystemContext).toHaveBeenCalled();
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('## Legacy System Reference'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('⚠️ REFERENCE ONLY - DO NOT MODIFY'),
            );
        });

        test('should not include legacy context when no legacy systems configured', async () => {
            // Arrange
            generateLegacySystemContext.mockReturnValue('');
            state.isMultiRepo.mockReturnValue(false);

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
                if(filePath.includes('INITIAL_PROMPT.md')) return 'Task without legacy';
                if(filePath.includes('prompt.md')) return 'Base prompt {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true);

            // Assert
            expect(generateLegacySystemContext).toHaveBeenCalled();
            expect(executeClaude).toHaveBeenCalledWith(
                expect.not.stringContaining('## Legacy System Reference'),
            );
        });

        test('should append legacy context AFTER multi-repo context', async () => {
            // Arrange
            const mockLegacyContext = '\n\n## Legacy System Reference\n\nLegacy content here';
            generateLegacySystemContext.mockReturnValue(mockLegacyContext);
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => `/project/${scope}`);
            state.getGitMode.mockReturnValue('separate');

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
                if(filePath.includes('INITIAL_PROMPT.md')) return 'Multi-repo task with legacy';
                if(filePath.includes('prompt.md')) return 'Base prompt {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true);

            // Assert - legacy context appears AFTER multi-repo context
            const promptArg = executeClaude.mock.calls[0][0];
            const multiRepoIndex = promptArg.indexOf('## Multi-Repository Context');
            const legacyIndex = promptArg.indexOf('## Legacy System Reference');
            expect(multiRepoIndex).toBeGreaterThan(-1);
            expect(legacyIndex).toBeGreaterThan(-1);
            expect(legacyIndex).toBeGreaterThan(multiRepoIndex);
        });

        test('should combine both multi-repo and legacy contexts correctly', async () => {
            // Arrange
            const mockLegacyContext = '\n\n## Legacy System Reference\n\nLegacy system at /legacy';
            generateLegacySystemContext.mockReturnValue(mockLegacyContext);
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => `/project/${scope}`);
            state.getGitMode.mockReturnValue('monorepo');

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
                if(filePath.includes('INITIAL_PROMPT.md')) return 'Complex task';
                if(filePath.includes('prompt.md')) return 'Base prompt {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true);

            // Assert - both contexts are present
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('## Multi-Repository Context'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('## Legacy System Reference'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/project/backend'),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/legacy'),
            );
        });
    });

    describe('runRefinementLoop', () => {
        beforeEach(() => {
            // Reset state manager mocks to non-skipping behavior
            stateManager.isVerificationPassed.mockReturnValue(false);
        });

        test('should skip if already verified (PASSED file exists)', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(true);

            // Act
            await runRefinementLoop(10);

            // Assert
            expect(executeClaude).not.toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith(
                'AI_PROMPT.md already verified, skipping refinement',
            );
        });

        test('should throw error if refinement-prompt.md not found', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('refinement-prompt.md')) return false;
                return true;
            });

            // Act & Assert
            await expect(runRefinementLoop(10)).rejects.toThrow('refinement-prompt.md not found');
        });

        test('should throw error if verification-prompt.md not found', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('verification-prompt.md')) return false;
                if (filePath.includes('refinement-prompt.md')) return true;
                return true;
            });
            fs.readFileSync.mockReturnValue('prompt content');

            // Act & Assert
            await expect(runRefinementLoop(10)).rejects.toThrow('verification-prompt.md not found');
        });

        test('should complete when PASSED file is created during verification', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);
            let passedCreated = false;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('PROMPT_REFINEMENT_PASSED.md')) return passedCreated;
                if (filePath.includes('PROMPT_REFINEMENT_OVERVIEW.md')) return true; // In verification phase
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('prompt content {{todoPath}} {{passedPath}} {{claudiomiroFolder}}');

            executeClaude.mockImplementation(async () => {
                passedCreated = true; // Simulate Claude creating PASSED file
            });

            stateManager.countCompletedItems.mockReturnValue(3);

            // Act
            await runRefinementLoop(10);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith(
                'Verification passed! AI_PROMPT.md is ready for decomposition.',
            );
        });

        test('should run multiple iterations for refinement and verification phases', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);
            let callCount = 0;

            // Simulate: refinement -> verification -> passed
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('PROMPT_REFINEMENT_PASSED.md')) {
                    return callCount >= 2; // PASSED created after 2nd call
                }
                if (filePath.includes('PROMPT_REFINEMENT_OVERVIEW.md')) {
                    // Overview created after 1st call (enters verification on 2nd)
                    return callCount >= 1;
                }
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('prompt content');

            stateManager.countPendingItems.mockReturnValue(0);
            stateManager.countCompletedItems.mockReturnValue(2);

            executeClaude.mockImplementation(async () => {
                callCount++;
            });

            // Act
            await runRefinementLoop(10);

            // Assert
            // Should have run at least 2 iterations: refinement + verification
            expect(executeClaude).toHaveBeenCalledTimes(2);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Refinement iteration'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Verification iteration'));
        });

        test('should throw error when max iterations reached', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('PROMPT_REFINEMENT_PASSED.md')) return false;
                if (filePath.includes('PROMPT_REFINEMENT_OVERVIEW.md')) return false;
                if (filePath.includes('PROMPT_REFINEMENT_TODO.md')) return true;
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('prompt {{iteration}} {{maxIterations}}');

            stateManager.countPendingItems.mockReturnValue(5); // Always pending
            stateManager.countCompletedItems.mockReturnValue(2);

            executeClaude.mockResolvedValue({ success: true });

            // Act & Assert
            await expect(runRefinementLoop(3)).rejects.toThrow(
                'AI_PROMPT.md refinement did not complete after 3 iterations',
            );
            expect(executeClaude).toHaveBeenCalledTimes(3);
            expect(logger.error).toHaveBeenCalledWith('Max iterations (3) reached');
        });

        test('should auto-create PASSED file when no pending items but Claude did not create it', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('PROMPT_REFINEMENT_PASSED.md')) return false;
                if (filePath.includes('PROMPT_REFINEMENT_OVERVIEW.md')) return true; // Verification phase
                if (filePath.includes('PROMPT_REFINEMENT_TODO.md')) return true;
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('verification prompt');

            stateManager.countPendingItems.mockReturnValue(0); // No pending items
            stateManager.countCompletedItems.mockReturnValue(5);

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await runRefinementLoop(10);

            // Assert
            expect(stateManager.createPassedFile).toHaveBeenCalledWith(5, 1);
            expect(logger.warning).toHaveBeenCalledWith(
                'No pending items but PASSED file not created. Auto-creating...',
            );
            expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md refinement complete!');
        });

        test('should handle unlimited iterations', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);
            let iterationCount = 0;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('PROMPT_REFINEMENT_PASSED.md')) return iterationCount >= 5;
                if (filePath.includes('PROMPT_REFINEMENT_OVERVIEW.md')) return iterationCount >= 4;
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('prompt {{maxIterations}}');

            stateManager.countPendingItems.mockReturnValue(0);

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            // Act
            await runRefinementLoop(Infinity);

            // Assert
            expect(logger.info).toHaveBeenCalledWith('Max iterations: unlimited (--no-limit)');
        });

        test('should throw error if Claude execution fails', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('prompt content');

            executeClaude.mockRejectedValue(new Error('Claude API error'));

            // Act & Assert
            await expect(runRefinementLoop(10)).rejects.toThrow('AI_PROMPT.md refinement failed: Claude API error');
            expect(logger.stopSpinner).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Refinement failed on iteration 1'),
            );
        });

        test('should log progress during refinement phase', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);
            let iteration = 0;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('PROMPT_REFINEMENT_PASSED.md')) return iteration >= 2;
                if (filePath.includes('PROMPT_REFINEMENT_OVERVIEW.md')) return iteration >= 1;
                if (filePath.includes('refinement-prompt.md')) return true;
                if (filePath.includes('verification-prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue('prompt');

            stateManager.countPendingItems.mockReturnValue(3);
            stateManager.countCompletedItems.mockReturnValue(2);

            executeClaude.mockImplementation(async () => {
                iteration++;
            });

            // Act
            await runRefinementLoop(10);

            // Assert
            expect(logger.info).toHaveBeenCalledWith('Progress: 2 completed, 3 pending');
        });
    });

    describe('step1 with refinement loop integration', () => {
        test('should run refinement loop after generating AI_PROMPT.md', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(true); // Skip actual loop
            let existsCallCount = 0;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) {
                    existsCallCount++;
                    return existsCallCount > 1;
                }
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('INITIAL_PROMPT.md')) return 'Task';
                if (filePath.includes('prompt.md')) return 'Generate {{TASK}}';
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step1(true, 10);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('AI_PROMPT.md created successfully');
            expect(stateManager.isVerificationPassed).toHaveBeenCalled();
        });

        test('should pass maxIterations parameter to refinement loop', async () => {
            // Arrange
            stateManager.isVerificationPassed.mockReturnValue(false);

            // Make it fail after checking loop starts
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true; // Skip generation
                if (filePath.includes('refinement-prompt.md')) return false; // Fail early
                return false;
            });

            // Act & Assert
            await expect(step1(true, 15)).rejects.toThrow('refinement-prompt.md not found');
        });
    });
});
