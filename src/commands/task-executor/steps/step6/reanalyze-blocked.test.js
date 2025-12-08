const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
}));

// Import after mocking
const { reanalyzeBlocked } = require('./reanalyze-blocked');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');

describe('reanalyze-blocked', () => {
    const mockTask = 'TASK1';

    // Valid execution.json for most tests
    const validExecution = {
        status: 'blocked',
        attempts: 3,
        currentPhase: { id: 'impl', name: 'Implementation' },
        phases: [{ id: 'impl', name: 'Implementation', status: 'blocked' }],
        errorHistory: [
            { timestamp: '2025-01-01T10:00:00Z', message: 'First error' },
            { timestamp: '2025-01-01T11:00:00Z', message: 'Second error' },
        ],
        uncertainties: [
            { id: 'U1', topic: 'API version', assumption: 'Use v2', confidence: 0.6 },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset path.join mock to return path arguments joined with '/'
        path.join.mockImplementation((...paths) => paths.join('/'));

        // Default fs mocks
        fs.existsSync.mockImplementation((filePath) => {
            if (filePath.includes('execution.json')) return true;
            if (filePath.includes('BLUEPRINT.md')) return true;
            if (filePath.includes('AI_PROMPT.md')) return true;
            if (filePath.includes('SHELL-COMMAND-RULE.md')) return true;
            return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('execution.json')) {
                return JSON.stringify(validExecution);
            }
            if (filePath.includes('BLUEPRINT.md')) {
                return '# BLUEPRINT: TASK1\n\n## Task Definition\nImplement feature X';
            }
            if (filePath.includes('SHELL-COMMAND-RULE.md')) {
                return '# Shell Command Rules';
            }
            return 'mock file content';
        });

        // Default executeClaude mock
        executeClaude.mockResolvedValue({ success: true });
    });

    describe('file requirements', () => {
        test('should throw error when execution.json does not exist', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return false;
                return true;
            });

            await expect(reanalyzeBlocked(mockTask)).rejects.toThrow(
                'execution.json not found for task TASK1',
            );
        });

        test('should throw error when BLUEPRINT.md does not exist', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return false;
                return true;
            });

            await expect(reanalyzeBlocked(mockTask)).rejects.toThrow(
                'BLUEPRINT.md not found for task TASK1',
            );
        });
    });

    describe('prompt building', () => {
        test('should include BLUEPRINT.md content in prompt', async () => {
            const blueprintContent = '# BLUEPRINT: TASK1\n\nCustom blueprint content';
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return blueprintContent;
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('Custom blueprint content');
        });

        test('should include failure history when errorHistory exists', async () => {
            const executionWithErrors = {
                ...validExecution,
                errorHistory: [
                    { timestamp: '2025-01-01T10:00:00Z', message: 'Database connection failed' },
                    { timestamp: '2025-01-01T11:00:00Z', message: 'Validation error' },
                ],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithErrors);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('FAILURE PATTERN ANALYSIS');
            expect(promptCall).toContain('Database connection failed');
            expect(promptCall).toContain('Validation error');
        });

        test('should include uncertainties section when uncertainties exist', async () => {
            const executionWithUncertainties = {
                ...validExecution,
                uncertainties: [
                    { id: 'U1', topic: 'API version', assumption: 'Use v2', confidence: 0.6 },
                    { id: 'U2', topic: 'Cache TTL', assumption: '5 minutes', confidence: 0.7 },
                ],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithUncertainties);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('UNRESOLVED UNCERTAINTIES');
            expect(promptCall).toContain('API version');
            expect(promptCall).toContain('Cache TTL');
        });

        test('should not include resolved uncertainties', async () => {
            const executionWithResolvedUncertainty = {
                ...validExecution,
                uncertainties: [
                    { id: 'U1', topic: 'Resolved issue', assumption: 'Old', confidence: 0.6, resolution: 'Fixed' },
                ],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithResolvedUncertainty);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            // Should not contain unresolved uncertainties section if all are resolved
            expect(promptCall).not.toContain('Resolved issue');
        });

        test('should include context files section when AI_PROMPT.md exists', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return true;
                return false;
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('CONTEXT FILES');
            expect(promptCall).toContain('AI_PROMPT.md');
        });

        test('should include current phase info in prompt', async () => {
            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('Current Phase: Implementation');
            expect(promptCall).toContain('ID: impl');
        });

        test('should include attempt count in prompt', async () => {
            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('failed 3 times');
        });
    });

    describe('executeClaude integration', () => {
        test('should call executeClaude with task identifier and model option', async () => {
            await reanalyzeBlocked(mockTask);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ model: 'hard' }),
            );
        });

        test('should return executeClaude result', async () => {
            const mockResult = { success: true, updated: true };
            executeClaude.mockResolvedValue(mockResult);

            const result = await reanalyzeBlocked(mockTask);

            expect(result).toBe(mockResult);
        });

        test('should propagate executeClaude errors', async () => {
            const mockError = new Error('Claude execution failed');
            executeClaude.mockRejectedValue(mockError);

            await expect(reanalyzeBlocked(mockTask)).rejects.toThrow(mockError);
        });
    });

    describe('logging', () => {
        test('should log debug message with task and attempt count', async () => {
            await reanalyzeBlocked(mockTask);

            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Re-analyzing blocked task TASK1'),
            );
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('attempt 3'),
            );
        });

        test('should log info when task status changes from blocked', async () => {
            const updatedExecution = { ...validExecution, status: 'pending' };

            // First read returns original, subsequent reads return updated
            let readCount = 0;
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    readCount++;
                    return readCount === 1
                        ? JSON.stringify(validExecution)
                        : JSON.stringify(updatedExecution);
                }
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('new status: pending'),
            );
        });

        test('should log warning when task remains blocked', async () => {
            // Both reads return blocked status
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(validExecution);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            expect(logger.warning).toHaveBeenCalledWith(
                expect.stringContaining('still blocked'),
            );
        });
    });

    describe('edge cases', () => {
        test('should handle execution.json without errorHistory', async () => {
            const executionWithoutErrors = {
                status: 'blocked',
                attempts: 1,
                currentPhase: { id: 'impl', name: 'Implementation' },
                phases: [],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithoutErrors);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).not.toContain('FAILURE PATTERN ANALYSIS');
        });

        test('should handle execution.json without uncertainties', async () => {
            const executionWithoutUncertainties = {
                status: 'blocked',
                attempts: 1,
                currentPhase: { id: 'impl', name: 'Implementation' },
                phases: [],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithoutUncertainties);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).not.toContain('UNRESOLVED UNCERTAINTIES');
        });

        test('should handle missing currentPhase gracefully', async () => {
            const executionWithoutPhase = {
                status: 'blocked',
                attempts: 1,
                phases: [],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithoutPhase);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).toContain('Current Phase: Unknown');
        });

        test('should only include last 3 errors from errorHistory', async () => {
            const executionWithManyErrors = {
                ...validExecution,
                errorHistory: [
                    { timestamp: '2025-01-01T08:00:00Z', message: 'First error - should not appear' },
                    { timestamp: '2025-01-01T09:00:00Z', message: 'Second error - should not appear' },
                    { timestamp: '2025-01-01T10:00:00Z', message: 'Third error - should appear' },
                    { timestamp: '2025-01-01T11:00:00Z', message: 'Fourth error - should appear' },
                    { timestamp: '2025-01-01T12:00:00Z', message: 'Fifth error - should appear' },
                ],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return JSON.stringify(executionWithManyErrors);
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return '# Shell Rules';
                return '';
            });

            await reanalyzeBlocked(mockTask);

            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).not.toContain('First error');
            expect(promptCall).not.toContain('Second error');
            expect(promptCall).toContain('Third error');
            expect(promptCall).toContain('Fourth error');
            expect(promptCall).toContain('Fifth error');
        });
    });
});
