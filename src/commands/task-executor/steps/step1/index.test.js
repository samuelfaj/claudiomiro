const fs = require('fs');
const _path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
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
}));

// Import after mocks
const { step1, generateMultiRepoContext } = require('./index');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');
const state = require('../../../../shared/config/state');

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
});
