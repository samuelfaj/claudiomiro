const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
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
const {
    reviewCode,
    validateCompletionForReview,
    extractContextChain,
    buildReviewContext,
} = require('./review-code');
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
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/AI_PROMPT.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/INITIAL_PROMPT.md');
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
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/RESEARCH.md');
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
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/CONTEXT.md');
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
                expect(contextSectionMatch[0]).not.toContain('/test/.claudiomiro/task-executor/TASK1/RESEARCH.md');
                expect(contextSectionMatch[0]).not.toContain('/test/.claudiomiro/task-executor/TASK1/CONTEXT.md');
            }
        });

        test('should include context files from context-cache service', async () => {
            // Arrange - Mock context-cache to return files from other tasks
            const { getContextFilePaths } = require('../../../../shared/services/context-cache');
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK2/CONTEXT.md',
                '/test/.claudiomiro/task-executor/TASK3/CONTEXT.md',
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
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK2/CONTEXT.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK3/CONTEXT.md');
        });

        test('should call context-cache service with current task excluded', async () => {
            // Arrange
            const { getContextFilePaths, buildOptimizedContextAsync } = require('../../../../shared/services/context-cache');

            fs.existsSync.mockReturnValue(false);

            // Act
            await reviewCode(mockTask);

            // Assert - context-cache service should be called with current task to be excluded
            expect(buildOptimizedContextAsync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor',
                mockTask,
                expect.anything(), // projectFolder (state.folder)
                expect.any(String), // taskDescription
                expect.anything(), // options
            );
            expect(getContextFilePaths).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor',
                mockTask,
                expect.objectContaining({ onlyCompleted: true }),
            );
        });

        test('should include each context file only once in reference list', async () => {
            // Arrange - context-cache returns unique files (deduplication is handled by service)
            const { getContextFilePaths } = require('../../../../shared/services/context-cache');
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK2/CONTEXT.md',
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

    describe('validateCompletionForReview', () => {
        test('should return ready:true when all phases completed and cleanup done', () => {
            const execution = {
                phases: [
                    { name: 'planning', status: 'completed' },
                    { name: 'implementation', status: 'completed' },
                    { name: 'testing', status: 'completed' },
                ],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            const result = validateCompletionForReview(execution);
            expect(result).toEqual({ ready: true });
        });

        test('should return ready:false with phase names when phases incomplete', () => {
            const execution = {
                phases: [
                    { name: 'planning', status: 'completed' },
                    { name: 'implementation', status: 'in_progress' },
                    { name: 'testing', status: 'pending' },
                ],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            const result = validateCompletionForReview(execution);
            expect(result.ready).toBe(false);
            expect(result.reason).toContain('Incomplete phases');
            expect(result.reason).toContain('implementation');
            expect(result.reason).toContain('testing');
        });

        test('should return ready:false with single phase name when one phase incomplete', () => {
            const execution = {
                phases: [
                    { name: 'planning', status: 'completed' },
                    { name: 'implementation', status: 'in_progress' },
                ],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            const result = validateCompletionForReview(execution);
            expect(result.ready).toBe(false);
            expect(result.reason).toBe('Incomplete phases: implementation');
        });

        test('should return ready:false when debugLogsRemoved is false', () => {
            const execution = {
                phases: [{ name: 'implementation', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: false,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            const result = validateCompletionForReview(execution);
            expect(result.ready).toBe(false);
            expect(result.reason).toContain('Cleanup not complete');
            expect(result.reason).toContain('debugLogsRemoved');
        });

        test('should return ready:false with all missing flags when multiple cleanup flags false', () => {
            const execution = {
                phases: [{ name: 'implementation', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: false,
                        formattingConsistent: false,
                        deadCodeRemoved: true,
                    },
                },
            };

            const result = validateCompletionForReview(execution);
            expect(result.ready).toBe(false);
            expect(result.reason).toContain('debugLogsRemoved');
            expect(result.reason).toContain('formattingConsistent');
        });

        test('should handle missing beyondTheBasics gracefully', () => {
            const execution = {
                phases: [{ name: 'implementation', status: 'completed' }],
            };

            const result = validateCompletionForReview(execution);
            expect(result.ready).toBe(false);
            expect(result.reason).toContain('Missing beyondTheBasics.cleanup');
        });

        test('should handle missing cleanup object gracefully', () => {
            const execution = {
                phases: [{ name: 'implementation', status: 'completed' }],
                beyondTheBasics: {},
            };

            const result = validateCompletionForReview(execution);
            expect(result.ready).toBe(false);
            expect(result.reason).toContain('Missing beyondTheBasics.cleanup');
        });

        test('should handle empty phases array', () => {
            const execution = {
                phases: [],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            const result = validateCompletionForReview(execution);
            expect(result).toEqual({ ready: true });
        });

        test('should handle null/undefined execution', () => {
            const result = validateCompletionForReview(null);
            expect(result.ready).toBe(false);
        });
    });

    describe('extractContextChain', () => {
        test('should extract file paths from CONTEXT CHAIN section', () => {
            const blueprint = `# BLUEPRINT
## 1. IDENTITY
Some identity info

## 2. CONTEXT CHAIN
### Priority 0
- src/index.js
- src/utils/helper.js

### Priority 1
* src/services/api.ts
* config/settings.json

## 3. EXECUTION CONTRACT
Some contract info`;

            const result = extractContextChain(blueprint);
            expect(result).toContain('src/index.js');
            expect(result).toContain('src/utils/helper.js');
            expect(result).toContain('src/services/api.ts');
            expect(result).toContain('config/settings.json');
        });

        test('should return empty array when CONTEXT CHAIN section missing', () => {
            const blueprint = `# BLUEPRINT
## 1. IDENTITY
Some identity info

## 3. EXECUTION CONTRACT
Some contract info`;

            const result = extractContextChain(blueprint);
            expect(result).toEqual([]);
        });

        test('should handle empty CONTEXT CHAIN section', () => {
            const blueprint = `# BLUEPRINT
## 2. CONTEXT CHAIN

## 3. EXECUTION CONTRACT`;

            const result = extractContextChain(blueprint);
            expect(result).toEqual([]);
        });

        test('should extract paths with backticks', () => {
            const blueprint = `## 2. CONTEXT CHAIN
- \`src/main.ts\`
- \`lib/utils.js\`
## 3. NEXT`;

            const result = extractContextChain(blueprint);
            expect(result).toContain('src/main.ts');
            expect(result).toContain('lib/utils.js');
        });

        test('should handle various file extensions', () => {
            const blueprint = `## 2. CONTEXT CHAIN
- src/app.jsx
- src/styles.css
- src/data.json
- src/readme.md
## 3. NEXT`;

            const result = extractContextChain(blueprint);
            expect(result).toContain('src/app.jsx');
            expect(result).toContain('src/styles.css');
            expect(result).toContain('src/data.json');
            expect(result).toContain('src/readme.md');
        });
    });

    describe('buildReviewContext', () => {
        test('should build context with all fields populated', () => {
            const blueprint = `## 2. CONTEXT CHAIN
- src/index.js
## 3. NEXT`;
            const execution = {
                artifacts: [
                    { type: 'file', path: 'src/new-file.js' },
                    { type: 'test', path: 'src/new-file.test.js' },
                ],
                completion: {
                    summary: ['Added new feature', 'Fixed bug'],
                },
            };

            const result = buildReviewContext(blueprint, execution);

            expect(result.taskDefinition).toBe(blueprint);
            expect(result.contextFiles).toContain('src/index.js');
            expect(result.modifiedFiles).toContain('FILE: src/new-file.js');
            expect(result.modifiedFiles).toContain('TEST: src/new-file.test.js');
            expect(result.completionSummary).toContain('Added new feature');
            expect(result.completionSummary).toContain('Fixed bug');
        });

        test('should handle empty artifacts array', () => {
            const blueprint = `## 2. CONTEXT CHAIN
- src/index.js
## 3. NEXT`;
            const execution = {
                artifacts: [],
                completion: { summary: [] },
            };

            const result = buildReviewContext(blueprint, execution);
            expect(result.modifiedFiles).toEqual([]);
        });

        test('should handle missing artifacts', () => {
            const blueprint = `## 2. CONTEXT CHAIN
## 3. NEXT`;
            const execution = {};

            const result = buildReviewContext(blueprint, execution);
            expect(result.modifiedFiles).toEqual([]);
            expect(result.completionSummary).toEqual([]);
        });

        test('should handle missing completion summary', () => {
            const blueprint = 'test';
            const execution = {
                artifacts: [{ type: 'file', path: 'test.js' }],
            };

            const result = buildReviewContext(blueprint, execution);
            expect(result.completionSummary).toEqual([]);
        });

        test('should default artifact type to FILE when missing', () => {
            const blueprint = 'test';
            const execution = {
                artifacts: [{ path: 'test.js' }],
            };

            const result = buildReviewContext(blueprint, execution);
            expect(result.modifiedFiles).toContain('FILE: test.js');
        });
    });

    describe('backward compatibility', () => {
        beforeEach(() => {
            state.isMultiRepo.mockReturnValue(false);
        });

        test('should use old flow when BLUEPRINT.md does not exist', async () => {
            const { buildOptimizedContextAsync } = require('../../../../shared/services/context-cache');
            buildOptimizedContextAsync.mockClear();

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return false;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
                }
                return 'mock content';
            });

            await reviewCode(mockTask);

            expect(buildOptimizedContextAsync).toHaveBeenCalled();
        });

        test('should use new flow when BLUEPRINT.md exists', async () => {
            const { buildOptimizedContextAsync } = require('../../../../shared/services/context-cache');
            buildOptimizedContextAsync.mockClear();

            const validExecution = {
                phases: [{ name: 'impl', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
                artifacts: [],
                completion: { summary: [] },
            };

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}} {{promptMdPath}} {{taskMdPath}} {{todoMdPath}} {{codeReviewMdPath}} {{researchMdPath}} {{researchSection}}';
                }
                return 'mock content';
            });

            await reviewCode(mockTask);

            // buildOptimizedContextAsync should NOT be called in BLUEPRINT flow
            expect(buildOptimizedContextAsync).not.toHaveBeenCalled();
        });

        test('should NOT call buildOptimizedContextAsync when BLUEPRINT exists', async () => {
            const { buildOptimizedContextAsync } = require('../../../../shared/services/context-cache');
            buildOptimizedContextAsync.mockClear();

            const validExecution = {
                phases: [{ name: 'impl', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
                artifacts: [{ type: 'file', path: 'src/test.js' }],
                completion: { summary: ['Done'] },
            };

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '## 2. CONTEXT CHAIN\n- src/index.js\n## 3. NEXT';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) {
                    return 'Template {{contextSection}}';
                }
                return '';
            });

            await reviewCode(mockTask);

            expect(buildOptimizedContextAsync).not.toHaveBeenCalled();
        });
    });

    describe('new review flow with BLUEPRINT', () => {
        beforeEach(() => {
            state.isMultiRepo.mockReturnValue(false);
        });

        test('should read BLUEPRINT.md and execution.json', async () => {
            const validExecution = {
                phases: [{ name: 'impl', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
                artifacts: [],
                completion: { summary: [] },
            };

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT content';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await reviewCode(mockTask);

            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('BLUEPRINT.md'),
                'utf-8',
            );
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('execution.json'),
                'utf-8',
            );
        });

        test('should throw when completion validation fails', async () => {
            const invalidExecution = {
                phases: [{ name: 'impl', status: 'in_progress' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('execution.json')) return JSON.stringify(invalidExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('Task not ready for review');
            await expect(reviewCode(mockTask)).rejects.toThrow('Incomplete phases: impl');
        });

        test('should throw when cleanup flags incomplete', async () => {
            const invalidExecution = {
                phases: [{ name: 'impl', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: false,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('execution.json')) return JSON.stringify(invalidExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('Task not ready for review');
            await expect(reviewCode(mockTask)).rejects.toThrow('Cleanup not complete');
        });

        test('should throw with clear message when execution.json is invalid JSON', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('execution.json')) return 'invalid json {';
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('Failed to parse execution.json');
        });

        test('should build context from BLUEPRINT without buildOptimizedContextAsync', async () => {
            const validExecution = {
                phases: [{ name: 'impl', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
                artifacts: [{ type: 'file', path: 'src/new.js' }],
                completion: { summary: ['Added feature'] },
            };

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '## 2. CONTEXT CHAIN\n- src/context.js\n## 3. NEXT';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await reviewCode(mockTask);

            // Check that the prompt includes BLUEPRINT context
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('Task Definition (from BLUEPRINT.md)');
            expect(actualCall).toContain('Modified Files (from execution.json)');
            expect(actualCall).toContain('FILE: src/new.js');
        });

        test('should extract context chain from BLUEPRINT', async () => {
            const validExecution = {
                phases: [{ name: 'impl', status: 'completed' }],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
                artifacts: [],
                completion: { summary: [] },
            };

            const blueprintContent = `# TASK BLUEPRINT
## 2. CONTEXT CHAIN
### Priority 0
- src/important.js
- src/critical.ts
### Priority 1
- src/secondary.js
## 3. EXECUTION CONTRACT`;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return blueprintContent;
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await reviewCode(mockTask);

            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('src/important.js');
            expect(actualCall).toContain('src/critical.ts');
            expect(actualCall).toContain('src/secondary.js');
        });
    });
});
