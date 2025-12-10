const fs = require('fs');
const _path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn().mockReturnValue(false),
    getRepository: jest.fn().mockReturnValue(null),
    getGitMode: jest.fn().mockReturnValue(null),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
}));
jest.mock('../../../../shared/services/context-cache/context-collector', () => ({
    buildOptimizedContextAsync: jest.fn().mockResolvedValue({
        context: 'mocked optimized context',
        tokenSavings: 100,
        filesIncluded: 5,
        method: 'fallback',
    }),
}));
jest.mock('../../../../shared/services/legacy-system/context-generator', () => ({
    generateLegacySystemContext: jest.fn().mockReturnValue(''),
}));
jest.mock('./decomposition-json-validator', () => ({
    runValidation: jest.fn(),
}));

// Import after mocks are defined
const { step2, cleanupDecompositionArtifacts } = require('./index');
const { runValidation } = require('./decomposition-json-validator');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');
const state = require('../../../../shared/config/state');
const { buildOptimizedContextAsync } = require('../../../../shared/services/context-cache/context-collector');
const { generateLegacySystemContext } = require('../../../../shared/services/legacy-system/context-generator');

describe('step2', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset NODE_ENV to test value for each test
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
    // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('step2 function', () => {
        test('should execute Claude with replaced prompt in test environment', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}/TASKX directory';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(logger.newline).toHaveBeenCalled();
            expect(logger.startSpinner).toHaveBeenCalledWith('Creating tasks...');
            expect(executeClaude).toHaveBeenCalledWith(
                'Create tasks in /test/.claudiomiro/task-executor/TASKX directory',
                null,
                expect.objectContaining({ model: 'hard' }),
            );
            expect(logger.stopSpinner).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');

            // In test environment, validation should be skipped
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
        });

        test('should validate task creation in non-test environment when TASK0/BLUEPRINT.md exists', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0') && filePath.includes('BLUEPRINT.md')) return true;
                // TASK1 won't be checked because short-circuit evaluation
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('BLUEPRINT.md'),
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
        });

        test('should validate task creation in non-test environment when TASK1/BLUEPRINT.md exists (TASK0 does not)', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';
            let callOrder = [];

            fs.existsSync.mockImplementation((filePath) => {
                callOrder.push(filePath);
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0') && filePath.includes('BLUEPRINT.md')) return false;
                if (filePath.includes('TASK1') && filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');

            // Verify TASK0 was checked before TASK1
            const task0Index = callOrder.findIndex(path => path.includes('TASK0') && path.includes('BLUEPRINT.md'));
            const task1Index = callOrder.findIndex(path => path.includes('TASK1') && path.includes('BLUEPRINT.md'));
            expect(task0Index).toBeLessThan(task1Index);
        });

        test('should throw error when no BLUEPRINT.md created in non-test environment', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0') && filePath.includes('BLUEPRINT.md')) return false;
                if (filePath.includes('TASK1') && filePath.includes('BLUEPRINT.md')) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act & Assert
            await expect(step2()).rejects.toThrow('Error creating tasks');
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
        });

        test('should handle executeClaude failure', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            const errorMessage = 'Claude execution failed';
            executeClaude.mockRejectedValue(new Error(errorMessage));

            // Act & Assert
            await expect(step2()).rejects.toThrow(errorMessage);
            expect(logger.startSpinner).toHaveBeenCalledWith('Creating tasks...');
            expect(executeClaude).toHaveBeenCalled();
            // Note: stopSpinner and success won't be called because error occurs before them
        });

        test('should read prompt.md from correct path', async () => {
            // Arrange
            let actualFilePath = '';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    actualFilePath = filePath;
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(actualFilePath).toContain('step2/prompt.md');
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should replace claudiomiroFolder placeholder in prompt', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Tasks go in {{claudiomiroFolder}}/TASKX and {{claudiomiroFolder}}/TASKY';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                'Tasks go in /test/.claudiomiro/task-executor/TASKX and /test/.claudiomiro/task-executor/TASKY',
                null,
                expect.objectContaining({ model: 'hard' }),
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
        });

        test('should skip validation in test environment even when tasks do not exist', async () => {
            // Arrange - NODE_ENV is 'test' by default in this test file
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                // Both TASK0 and TASK1 don't exist
                if (filePath.includes('TASK0')) return false;
                if (filePath.includes('TASK1')) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
            // Validation should be skipped, so no error should be thrown
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
        });

        test('should inject legacy context when available', async () => {
            // Arrange
            generateLegacySystemContext.mockReturnValue('## Legacy Systems Reference\nLegacy backend at /legacy/backend');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Legacy: {{legacySystemContext}}, Folder: {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(generateLegacySystemContext).toHaveBeenCalled();
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('## Legacy Systems Reference'),
                null,
                expect.objectContaining({ model: 'hard' }),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Legacy backend at /legacy/backend'),
                null,
                expect.objectContaining({ model: 'hard' }),
            );
        });

        test('should inject optimized context', async () => {
            // Arrange
            buildOptimizedContextAsync.mockResolvedValue({
                context: 'optimized project context here',
                tokenSavings: 200,
                filesIncluded: 10,
                method: 'llm',
            });

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Context: {{optimizedContext}}, Folder: {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(buildOptimizedContextAsync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor',
                null,
                '/test/project',
                'task decomposition',
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('optimized project context here'),
                null,
                expect.objectContaining({ model: 'hard' }),
            );
        });

        test('should handle empty legacy context gracefully', async () => {
            // Arrange
            generateLegacySystemContext.mockReturnValue('');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Legacy: {{legacySystemContext}}, Folder: {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(generateLegacySystemContext).toHaveBeenCalled();
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('None - no legacy systems configured'),
                null,
                expect.objectContaining({ model: 'hard' }),
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
        });

        test('should handle context building failure gracefully', async () => {
            // Arrange
            buildOptimizedContextAsync.mockRejectedValue(new Error('Context build failed'));

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Context: {{optimizedContext}}, Folder: {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(buildOptimizedContextAsync).toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Context building failed'),
            );
            // Should still complete successfully with empty context
            expect(executeClaude).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
        });
    });

    describe('cleanupDecompositionArtifacts', () => {
        test('should delete DECOMPOSITION_ANALYSIS.json when preserveOnError is false', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);

            // Act
            cleanupDecompositionArtifacts(false);

            // Assert
            expect(fs.unlinkSync).toHaveBeenCalledWith(
                expect.stringContaining('DECOMPOSITION_ANALYSIS.json'),
            );
            expect(logger.debug).toHaveBeenCalledWith('DECOMPOSITION_ANALYSIS.json cleaned up');
        });

        test('should NOT delete DECOMPOSITION_ANALYSIS.json when preserveOnError is true (default)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);

            // Act
            cleanupDecompositionArtifacts(); // Default: preserveOnError = true

            // Assert
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        test('should do nothing if DECOMPOSITION_ANALYSIS.json does not exist', () => {
            // Arrange
            fs.existsSync.mockReturnValue(false);

            // Act
            cleanupDecompositionArtifacts(false);

            // Assert
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });
    });

    describe('step2 with validation and cleanup', () => {
        test('should run decomposition validation in non-test environment', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0') && filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('DECOMPOSITION_ANALYSIS.json')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });
            runValidation.mockReturnValue({ valid: true, blocking: [], warnings: [] });

            // Act
            await step2();

            // Assert
            expect(runValidation).toHaveBeenCalledWith('/test/.claudiomiro/task-executor');
            expect(logger.success).toHaveBeenCalledWith('Decomposition analysis validated');
        });

        test('should delete DECOMPOSITION_ANALYSIS.json on success', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0') && filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('DECOMPOSITION_ANALYSIS.json')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });
            runValidation.mockReturnValue({ valid: true, blocking: [], warnings: [] });

            // Act
            await step2();

            // Assert
            expect(fs.unlinkSync).toHaveBeenCalledWith(
                expect.stringContaining('DECOMPOSITION_ANALYSIS.json'),
            );
            expect(logger.debug).toHaveBeenCalledWith('DECOMPOSITION_ANALYSIS.json deleted (success)');
        });

        test('should preserve DECOMPOSITION_ANALYSIS.json on failure', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('DECOMPOSITION_ANALYSIS.json')) return true;
                // No TASK0 or TASK1 - will cause failure
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act & Assert
            await expect(step2()).rejects.toThrow('Error creating tasks');

            // DECOMPOSITION_ANALYSIS.json should be preserved
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(
                expect.stringContaining('DECOMPOSITION_ANALYSIS.json'),
            );
            expect(logger.info).toHaveBeenCalledWith('DECOMPOSITION_ANALYSIS.json preserved for debugging');
        });

        test('should preserve DECOMPOSITION_ANALYSIS.json when validation fails', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0') && filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('DECOMPOSITION_ANALYSIS.json')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });
            runValidation.mockImplementation(() => {
                throw new Error('Validation failed: Missing Phase A');
            });

            // Act & Assert
            await expect(step2()).rejects.toThrow('Validation failed');

            // DECOMPOSITION_ANALYSIS.json should be preserved for debugging
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(
                expect.stringContaining('DECOMPOSITION_ANALYSIS.json'),
            );
            expect(logger.info).toHaveBeenCalledWith('DECOMPOSITION_ANALYSIS.json preserved for debugging');
        });
    });

    describe('multi-repo mode', () => {
        test('should include multi-repo context in prompt when isMultiRepo returns true', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/test/backend';
                if (scope === 'frontend') return '/test/frontend';
                return null;
            });
            state.getGitMode.mockReturnValue('monorepo');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return '{{multiRepoContext}}Create tasks';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('MULTI-REPO MODE ACTIVE'),
                null,
                expect.anything(),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('@scope'),
                null,
                expect.anything(),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/test/backend'),
                null,
                expect.anything(),
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/test/frontend'),
                null,
                expect.anything(),
            );
        });

        test('should NOT include multi-repo context when isMultiRepo returns false', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(false);

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return '{{multiRepoContext}}Create tasks';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.not.stringContaining('MULTI-REPO MODE ACTIVE'),
                null,
                expect.anything(),
            );
        });
    });
});
