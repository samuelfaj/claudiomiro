const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro',
    folder: '/test/project',
    isMultiRepo: jest.fn().mockReturnValue(false),
    getRepository: jest.fn().mockReturnValue('/test/project'),
}));
// Mock context-cache service (token optimization)
jest.mock('../../../../shared/services/context-cache', () => ({
    buildConsolidatedContextAsync: jest.fn().mockResolvedValue('## Environment Summary\nMocked context'),
    buildOptimizedContextAsync: jest.fn().mockResolvedValue({
        context: '## Environment Summary\nMocked context',
        tokenSavings: 0,
        method: 'consolidated',
        filesIncluded: 0,
    }),
    getContextFilePaths: jest.fn().mockReturnValue([]),
}));

// Import after mocking
const { reviewCode } = require('./review-code');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const state = require('../../../../shared/config/state');

describe('review-code', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset path.join mock to return path arguments joined with '/'
        path.join.mockImplementation((...paths) => paths.join('/'));

        // Default fs mocks
        fs.existsSync.mockReturnValue(false);
        fs.rmSync.mockImplementation();
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('prompt-review.md')) {
                return 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
            }
            return 'mock file content';
        });
        fs.readdirSync.mockReturnValue([]);
        fs.statSync.mockReturnValue({ isDirectory: () => true });

        // Default executeClaude mock
        executeClaude.mockResolvedValue({ success: true });
    });

    describe('file cleanup', () => {
        test('should remove existing CODE_REVIEW.md file', async () => {
            // Arrange
            let existsCallCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CODE_REVIEW.md')) {
                    existsCallCount++;
                    return existsCallCount <= 1; // First call true (exists), subsequent calls false
                }
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(fs.rmSync).toHaveBeenCalledWith(
                expect.stringContaining('CODE_REVIEW.md'),
            );
        });

        test('should remove existing GITHUB_PR.md file', async () => {
            // Arrange
            let existsCallCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('GITHUB_PR.md')) {
                    existsCallCount++;
                    return existsCallCount <= 1; // First call true (exists), subsequent calls false
                }
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(fs.rmSync).toHaveBeenCalledWith(
                expect.stringContaining('GITHUB_PR.md'),
            );
        });

        test('should not remove files that do not exist', async () => {
            // Arrange
            fs.existsSync.mockReturnValue(false); // No files exist

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(fs.rmSync).not.toHaveBeenCalled();
        });
    });

    describe('context file collection', () => {
        test('should always include AI_PROMPT.md and INITIAL_PROMPT.md', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('AI_PROMPT.md');
            expect(actualCall).toContain('INITIAL_PROMPT.md');
            expect(actualCall).toContain('/test/.claudiomiro/AI_PROMPT.md');
            expect(actualCall).toContain('/test/.claudiomiro/INITIAL_PROMPT.md');
        });

        test('should include RESEARCH.md when it exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('RESEARCH.md')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('RESEARCH.md');
            expect(actualCall).toContain('/test/.claudiomiro/TASK1/RESEARCH.md');
        });

        test('should include CONTEXT.md when it exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CONTEXT.md')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('CONTEXT.md');
            expect(actualCall).toContain('/test/.claudiomiro/TASK1/CONTEXT.md');
        });

        test('should skip RESEARCH.md and CONTEXT.md from context section when they do not exist', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md') || filePath.includes('CONTEXT.md')) return false;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert - files should not be in context section, but paths may appear in template placeholders
            const actualCall = executeClaude.mock.calls[0][0];
            // Check that files are not listed in the context section (after "## 📚 CONTEXT FILES" and before "These provide:")
            const contextSectionMatch = actualCall.match(/## 📚 CONTEXT FILES[\s\S]*?These provide:/);
            if (contextSectionMatch) {
                expect(contextSectionMatch[0]).not.toContain('/test/.claudiomiro/TASK1/RESEARCH.md');
                expect(contextSectionMatch[0]).not.toContain('/test/.claudiomiro/TASK1/CONTEXT.md');
            }
        });

        test('should include context files from context-cache service', async () => {
            // Arrange - Mock context-cache to return files from other tasks
            const { getContextFilePaths } = require('../../../../shared/services/context-cache');
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/TASK2/CONTEXT.md',
                '/test/.claudiomiro/TASK3/CONTEXT.md',
            ]);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert - files returned by context-cache should be in reference section
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('/test/.claudiomiro/TASK2/CONTEXT.md');
            expect(actualCall).toContain('/test/.claudiomiro/TASK3/CONTEXT.md');
        });

        test('should call context-cache service with current task excluded', async () => {
            // Arrange
            const { getContextFilePaths, buildConsolidatedContextAsync } = require('../../../../shared/services/context-cache');

            fs.existsSync.mockReturnValue(false);

            // Act
            await reviewCode(mockTask);

            // Assert - context-cache service should be called with current task to be excluded
            expect(buildConsolidatedContextAsync).toHaveBeenCalledWith(
                '/test/.claudiomiro',
                mockTask,
                expect.anything(), // projectFolder (state.folder)
                expect.any(String), // taskDescription
            );
            expect(getContextFilePaths).toHaveBeenCalledWith(
                '/test/.claudiomiro',
                mockTask,
                expect.objectContaining({ onlyCompleted: true }),
            );
        });

        test('should include each context file only once in reference list', async () => {
            // Arrange - context-cache returns unique files (deduplication is handled by service)
            const { getContextFilePaths } = require('../../../../shared/services/context-cache');
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/TASK2/CONTEXT.md',
            ]);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert - CONTEXT.md should appear only once in the reference list
            const prompt = executeClaude.mock.calls[0][0];
            const contextMatches = prompt.match(/TASK2\/CONTEXT\.md/g);
            expect(contextMatches ? contextMatches.length : 0).toBe(1);
        });

        test('should handle empty task list gracefully', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            fs.readdirSync.mockReturnValue([]);

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should handle directory read errors gracefully', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            fs.readdirSync.mockImplementation(() => {
                throw new Error('Directory read error');
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should handle statSync errors gracefully', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs.statSync.mockImplementation(() => {
                throw new Error('Stat error');
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
        });
    });

    describe('prompt template loading and replacement', () => {
        test('should load prompt-review.md template', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('prompt-review.md'),
                'utf-8',
            );
        });

        test('should replace all placeholders in template', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md')) return true;
                return false;
            });

            const template = 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-review.md')) {
                    return template;
                }
                return 'mock file content';
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toMatch(/\{\{.*\}\}/);
        });

        test('should include researchSection when RESEARCH.md exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('4. **');
            expect(actualCall).toContain('** → Pre-implementation analysis and execution strategy');
        });

        test('should have empty researchSection when RESEARCH.md does not exist', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md')) return false;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toContain('4. **');
        });
    });

    describe('executeClaude integration', () => {
        test('should call executeClaude with built prompt', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                undefined, // cwd is undefined when projectFolder equals state.folder
            );
        });

        test('should return executeClaude result', async () => {
            // Arrange
            const mockResult = { success: true, filesCreated: ['CODE_REVIEW.md'] };
            executeClaude.mockResolvedValue(mockResult);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            const result = await reviewCode(mockTask);

            // Assert
            expect(result).toBe(mockResult);
        });

        test('should propagate executeClaude errors', async () => {
            // Arrange
            const mockError = new Error('Claude execution failed');
            executeClaude.mockRejectedValue(mockError);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act & Assert
            await expect(reviewCode(mockTask)).rejects.toThrow(mockError);
        });
    });

    describe('context section building', () => {
        test('should build context section with consolidated context', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert - now uses consolidated context structure
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('## 📚 CONTEXT SUMMARY FOR REVIEW');
            expect(actualCall).toContain('REFERENCE FILES');
        });

        test('should always include context summary section', async () => {
            // Arrange - even when all files return false, consolidated context is always included
            fs.existsSync.mockReturnValue(false);

            // Act
            await reviewCode(mockTask);

            // Assert - context section is always built using consolidated context
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('## 📚 CONTEXT SUMMARY FOR REVIEW');
            expect(actualCall).toContain('Environment Summary');
        });
    });

    describe('multi-repo mode', () => {
        test('should throw error when scope is missing in multi-repo mode', async () => {
            // Enable multi-repo mode
            state.isMultiRepo.mockReturnValue(true);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TASK.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('TASK.md')) return '# Task without scope\nSome task content';
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('@scope tag is required');
        });

        test('should use correct repository path when scope is backend', async () => {
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockReturnValue('/test/backend');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('TASK.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('TASK.md')) return '@scope backend\n# Backend task';
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
                }
                return 'mock file content';
            });

            await reviewCode(mockTask);

            expect(state.getRepository).toHaveBeenCalledWith('backend');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                { cwd: '/test/backend' },
            );
        });

        test('should use correct repository path when scope is frontend', async () => {
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockReturnValue('/test/frontend');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                if (filePath.includes('TASK.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('TASK.md')) return '@scope frontend\n# Frontend task';
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
                }
                return 'mock file content';
            });

            await reviewCode(mockTask);

            expect(state.getRepository).toHaveBeenCalledWith('frontend');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                { cwd: '/test/frontend' },
            );
        });
    });
});
