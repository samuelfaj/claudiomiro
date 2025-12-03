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
// Mock scope-parser
jest.mock('../../utils/scope-parser', () => ({
    parseTaskScope: jest.fn().mockReturnValue(null),
    validateScope: jest.fn().mockReturnValue(true),
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

    // Valid execution.json for most tests
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

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset path.join mock to return path arguments joined with '/'
        path.join.mockImplementation((...paths) => paths.join('/'));

        // Default fs mocks - BLUEPRINT.md and execution.json must exist for new flow
        fs.existsSync.mockImplementation((filePath) => {
            if (filePath.includes('BLUEPRINT.md')) return true;
            if (filePath.includes('execution.json')) return true;
            return false;
        });
        fs.rmSync.mockImplementation();
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('prompt-review.md')) {
                return 'Template with {{contextSection}} {{blueprintPath}} {{executionJsonPath}} {{codeReviewMdPath}}';
            }
            if (filePath.includes('BLUEPRINT.md')) {
                return '## 2. CONTEXT CHAIN\n## 3. NEXT';
            }
            if (filePath.includes('execution.json')) {
                return JSON.stringify(validExecution);
            }
            return 'mock file content';
        });
        fs.readdirSync.mockReturnValue([]);
        fs.statSync.mockReturnValue({ isDirectory: () => true });

        // Default executeClaude mock
        executeClaude.mockResolvedValue({ success: true });
    });

    describe('requires BLUEPRINT.md', () => {
        test('should throw error when BLUEPRINT.md does not exist', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return false;
                return true;
            });

            // Act & Assert
            await expect(reviewCode(mockTask)).rejects.toThrow(
                'BLUEPRINT.md not found for task TASK1. Cannot perform code review.',
            );
        });
    });

    describe('file cleanup', () => {
        test('should remove existing CODE_REVIEW.md file', async () => {
            // Arrange
            let codeReviewCallCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('CODE_REVIEW.md')) {
                    codeReviewCallCount++;
                    return codeReviewCallCount <= 1; // First call true (exists), subsequent calls false
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
            let prCallCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('GITHUB_PR.md')) {
                    prCallCount++;
                    return prCallCount <= 1; // First call true (exists), subsequent calls false
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
            // Arrange - BLUEPRINT.md and execution.json must exist, but CODE_REVIEW.md and GITHUB_PR.md don't
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('CODE_REVIEW.md')) return false;
                if (filePath.includes('GITHUB_PR.md')) return false;
                return false;
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(fs.rmSync).not.toHaveBeenCalled();
        });
    });

    describe('BLUEPRINT-based context', () => {
        test('should extract context files from BLUEPRINT.md CONTEXT CHAIN', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return `# TASK BLUEPRINT
## 2. CONTEXT CHAIN
### Priority 0
- src/important.js
- src/critical.ts
## 3. EXECUTION CONTRACT`;
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(validExecution);
                }
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}}';
                }
                return '';
            });

            // Act
            await reviewCode(mockTask);

            // Assert - context files from BLUEPRINT should be included
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('src/important.js');
            expect(actualCall).toContain('src/critical.ts');
        });

        test('should include artifacts from execution.json', async () => {
            // Arrange
            const executionWithArtifacts = {
                ...validExecution,
                artifacts: [
                    { type: 'file', path: 'src/new-feature.js' },
                    { type: 'test', path: 'src/new-feature.test.js' },
                ],
                completion: { summary: ['Added feature'] },
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(executionWithArtifacts);
                }
                if (filePath.includes('prompt-review.md')) {
                    return 'Template {{contextSection}}';
                }
                return '';
            });

            // Act
            await reviewCode(mockTask);

            // Assert - artifacts should be in modified files section
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('FILE: src/new-feature.js');
            expect(actualCall).toContain('TEST: src/new-feature.test.js');
        });

        test('should handle empty CONTEXT CHAIN gracefully', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(validExecution);
                }
                if (filePath.includes('prompt-review.md')) {
                    return 'Template {{contextSection}}';
                }
                return '';
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalled();
        });
    });

    describe('prompt template loading and replacement', () => {
        test('should load prompt-review.md template', async () => {
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
            const template = 'Template with {{contextSection}} {{blueprintPath}} {{executionJsonPath}} {{codeReviewMdPath}}';
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-review.md')) {
                    return template;
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(validExecution);
                }
                return 'mock file content';
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toMatch(/\{\{.*\}\}/);
        });

        test('should include blueprintPath placeholder replacement', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-review.md')) {
                    return 'Check {{blueprintPath}} for details';
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(validExecution);
                }
                return 'mock file content';
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('BLUEPRINT.md');
            expect(actualCall).not.toContain('{{blueprintPath}}');
        });

        test('should include executionJsonPath placeholder replacement', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-review.md')) {
                    return 'Check {{executionJsonPath}} for status';
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(validExecution);
                }
                return 'mock file content';
            });

            // Act
            await reviewCode(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('execution.json');
            expect(actualCall).not.toContain('{{executionJsonPath}}');
        });
    });

    describe('executeClaude integration', () => {
        test('should call executeClaude with built prompt', async () => {
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

            // Act
            const result = await reviewCode(mockTask);

            // Assert
            expect(result).toBe(mockResult);
        });

        test('should propagate executeClaude errors', async () => {
            // Arrange
            const mockError = new Error('Claude execution failed');
            executeClaude.mockRejectedValue(mockError);

            // Act & Assert
            await expect(reviewCode(mockTask)).rejects.toThrow(mockError);
        });
    });

    describe('context section building', () => {
        test('should build context section from BLUEPRINT', async () => {
            // Act
            await reviewCode(mockTask);

            // Assert - uses BLUEPRINT-based context structure
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('Task Definition (from BLUEPRINT.md)');
            expect(actualCall).toContain('Modified Files (from execution.json)');
        });
    });

    describe('multi-repo mode', () => {
        test('should throw error when scope is missing in multi-repo mode', async () => {
            const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
            // Enable multi-repo mode
            state.isMultiRepo.mockReturnValue(true);
            parseTaskScope.mockReturnValue(null);
            validateScope.mockImplementation(() => {
                throw new Error('@scope tag is required in multi-repo mode');
            });

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# Task without scope\nSome task content';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('@scope tag is required');
        });

        test('should use correct repository path when scope is backend', async () => {
            const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockReturnValue('/test/backend');
            parseTaskScope.mockReturnValue('backend');
            validateScope.mockReturnValue(true);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '@scope backend\n# Backend task';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}} {{blueprintPath}} {{executionJsonPath}} {{codeReviewMdPath}}';
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
            const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockReturnValue('/test/frontend');
            parseTaskScope.mockReturnValue('frontend');
            validateScope.mockReturnValue(true);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '@scope frontend\n# Frontend task';
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('prompt-review.md')) {
                    return 'Template with {{contextSection}} {{blueprintPath}} {{executionJsonPath}} {{codeReviewMdPath}}';
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

    describe('BLUEPRINT flow validation', () => {
        test('should throw when completion validation fails (incomplete phases)', async () => {
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
                if (filePath.includes('BLUEPRINT.md')) return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                if (filePath.includes('execution.json')) return JSON.stringify(invalidExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('Task not ready for review');
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
                if (filePath.includes('BLUEPRINT.md')) return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                if (filePath.includes('execution.json')) return JSON.stringify(invalidExecution);
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('Task not ready for review');
        });

        test('should throw with clear message when execution.json is invalid JSON', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '## 2. CONTEXT CHAIN\n## 3. NEXT';
                if (filePath.includes('execution.json')) return 'invalid json {';
                if (filePath.includes('prompt-review.md')) return 'Template {{contextSection}}';
                return '';
            });

            await expect(reviewCode(mockTask)).rejects.toThrow('Failed to parse execution.json');
        });
    });
});
