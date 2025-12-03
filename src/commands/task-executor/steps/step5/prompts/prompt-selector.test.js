/**
 * Prompt Selector Tests
 *
 * Tests for the prompt selection logic based on execution state.
 */

const fs = require('fs');
const _path = require('path');

jest.mock('fs');

const {
    ExecutionState,
    detectExecutionState,
    selectPrompt,
    loadPromptFile,
    buildErrorDetails,
    buildBlockedByDetails,
    buildBlockReason,
} = require('./prompt-selector');

describe('prompt-selector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('ExecutionState', () => {
        test('should have all expected states', () => {
            expect(ExecutionState.FIRST_EXECUTION).toBe('first-execution');
            expect(ExecutionState.ERROR_RECOVERY).toBe('error-recovery');
            expect(ExecutionState.BLOCKED_DEPENDENCY).toBe('blocked-dependency');
            expect(ExecutionState.BLOCKED_EXECUTION).toBe('blocked-execution');
        });
    });

    describe('detectExecutionState', () => {
        test('should return FIRST_EXECUTION for fresh execution', () => {
            const execution = {
                status: 'pending',
                pendingFixes: [],
                errorHistory: [],
                completion: {},
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.FIRST_EXECUTION);
        });

        test('should return ERROR_RECOVERY when errorHistory is not empty', () => {
            const execution = {
                status: 'in_progress',
                errorHistory: [{ message: 'Error', timestamp: '2025-01-01' }],
                pendingFixes: [],
                completion: {},
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.ERROR_RECOVERY);
        });

        test('should return ERROR_RECOVERY when pendingFixes is not empty', () => {
            const execution = {
                status: 'in_progress',
                errorHistory: [],
                pendingFixes: ['success-criteria'],
                completion: {},
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.ERROR_RECOVERY);
        });

        test('should return BLOCKED_DEPENDENCY when completion.blockedBy is not empty', () => {
            const execution = {
                status: 'in_progress',
                errorHistory: [],
                pendingFixes: [],
                completion: {
                    blockedBy: ['Missing validation for userId'],
                },
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.BLOCKED_DEPENDENCY);
        });

        test('should return BLOCKED_EXECUTION when status is blocked', () => {
            const execution = {
                status: 'blocked',
                errorHistory: [],
                pendingFixes: [],
                completion: {},
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.BLOCKED_EXECUTION);
        });

        test('should prioritize blocked status over other states', () => {
            const execution = {
                status: 'blocked',
                errorHistory: [{ message: 'Error' }],
                pendingFixes: ['some-fix'],
                completion: {
                    blockedBy: ['Some issue'],
                },
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.BLOCKED_EXECUTION);
        });

        test('should handle empty completion object', () => {
            const execution = {
                status: 'pending',
                pendingFixes: [],
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.FIRST_EXECUTION);
        });

        test('should handle missing errorHistory and pendingFixes', () => {
            const execution = {
                status: 'in_progress',
                completion: {},
            };

            expect(detectExecutionState(execution)).toBe(ExecutionState.FIRST_EXECUTION);
        });
    });

    describe('loadPromptFile', () => {
        test('should load prompt file when it exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Prompt Content');

            const content = loadPromptFile('base');

            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('base.md'),
                'utf-8',
            );
            expect(content).toBe('# Prompt Content');
        });

        test('should throw error when prompt file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            expect(() => loadPromptFile('nonexistent')).toThrow('Prompt file not found');
        });
    });

    describe('buildErrorDetails', () => {
        test('should format pending fixes', () => {
            const execution = {
                pendingFixes: ['success-criteria', 'implementation-strategy'],
                completion: {},
                attempts: 2,
            };

            const result = buildErrorDetails(execution);

            expect(result).toContain('Pending Fixes');
            expect(result).toContain('success-criteria');
            expect(result).toContain('implementation-strategy');
        });

        test('should include last error', () => {
            const execution = {
                pendingFixes: [],
                completion: { lastError: 'Something went wrong' },
                attempts: 1,
            };

            const result = buildErrorDetails(execution);

            expect(result).toContain('Last Error');
            expect(result).toContain('Something went wrong');
        });

        test('should include error history', () => {
            const execution = {
                pendingFixes: [],
                errorHistory: [
                    { message: 'First error', failedValidation: 'test1', timestamp: '2025-01-01' },
                    { message: 'Second error', failedValidation: 'test2', timestamp: '2025-01-02' },
                ],
                completion: {},
                attempts: 3,
            };

            const result = buildErrorDetails(execution);

            expect(result).toContain('Error History');
            expect(result).toContain('First error');
            expect(result).toContain('Second error');
        });

        test('should include attempt count', () => {
            const execution = {
                pendingFixes: [],
                completion: {},
                attempts: 5,
            };

            const result = buildErrorDetails(execution);

            expect(result).toContain('Attempt: 5');
        });

        test('should handle missing optional fields', () => {
            const execution = {};

            const result = buildErrorDetails(execution);

            expect(result).toContain('Attempt: 1');
        });
    });

    describe('buildBlockedByDetails', () => {
        test('should format blocked by issues', () => {
            const execution = {
                completion: {
                    blockedBy: [
                        'Missing validation for userId',
                        'Wrong response status code',
                    ],
                },
            };

            const result = buildBlockedByDetails(execution);

            expect(result).toContain('Issues to Fix');
            expect(result).toContain('Missing validation for userId');
            expect(result).toContain('Wrong response status code');
        });

        test('should include reference to CODE_REVIEW.md', () => {
            const execution = {
                completion: {
                    blockedBy: ['Some issue'],
                },
            };

            const result = buildBlockedByDetails(execution);

            expect(result).toContain('CODE_REVIEW.md');
            expect(result).toContain('Additional Context');
        });

        test('should handle empty blockedBy array', () => {
            const execution = {
                completion: {
                    blockedBy: [],
                },
            };

            const result = buildBlockedByDetails(execution);

            expect(result).toContain('Issues to Fix');
        });
    });

    describe('buildBlockReason', () => {
        test('should format block summary', () => {
            const execution = {
                completion: {
                    summary: ['Pre-condition failed: file not found'],
                },
            };

            const result = buildBlockReason(execution);

            expect(result).toContain('Block Summary');
            expect(result).toContain('Pre-condition failed');
        });

        test('should include deviations', () => {
            const execution = {
                completion: {
                    deviations: ['Expected file at X, found at Y'],
                },
            };

            const result = buildBlockReason(execution);

            expect(result).toContain('Details');
            expect(result).toContain('Expected file at X');
        });

        test('should include current phase info', () => {
            const execution = {
                currentPhase: {
                    id: 2,
                    name: 'Implementation',
                    lastAction: 'Creating file',
                },
                completion: {},
            };

            const result = buildBlockReason(execution);

            expect(result).toContain('Phase 2');
            expect(result).toContain('Implementation');
            expect(result).toContain('Creating file');
        });

        test('should handle missing optional fields', () => {
            const execution = {
                completion: {},
            };

            const result = buildBlockReason(execution);

            expect(result).toBe('');
        });
    });

    describe('selectPrompt', () => {
        beforeEach(() => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('base.md')) {
                    return '# Base Prompt\n\nTask: {{taskFolder}}\nFolder: {{claudiomiroFolder}}';
                }
                if (filePath.includes('first-execution.md')) {
                    return '# First Execution';
                }
                if (filePath.includes('error-recovery.md')) {
                    return '# Error Recovery\n\n{{errorDetails}}';
                }
                if (filePath.includes('blocked-dependency.md')) {
                    return '# Blocked Dependency\n\n{{blockedByDetails}}';
                }
                if (filePath.includes('blocked-execution.md')) {
                    return '# Blocked Execution\n\n{{blockReason}}';
                }
                return '';
            });
        });

        test('should select first-execution prompt for fresh execution', () => {
            const execution = {
                status: 'pending',
                pendingFixes: [],
                errorHistory: [],
                completion: {},
            };

            const result = selectPrompt(execution, { taskFolder: '/task', claudiomiroFolder: '/claudiomiro' });

            expect(result.state).toBe(ExecutionState.FIRST_EXECUTION);
            expect(result.prompt).toContain('First Execution');
            expect(result.prompt).toContain('Base Prompt');
        });

        test('should select error-recovery prompt and inject error details', () => {
            const execution = {
                status: 'in_progress',
                pendingFixes: ['success-criteria'],
                errorHistory: [],
                completion: { lastError: 'Validation failed' },
                attempts: 2,
            };

            const result = selectPrompt(execution, { taskFolder: '/task' });

            expect(result.state).toBe(ExecutionState.ERROR_RECOVERY);
            expect(result.prompt).toContain('Error Recovery');
            expect(result.prompt).toContain('success-criteria');
            expect(result.prompt).toContain('Validation failed');
        });

        test('should select blocked-dependency prompt and inject blocked details', () => {
            const execution = {
                status: 'in_progress',
                pendingFixes: [],
                errorHistory: [],
                completion: {
                    blockedBy: ['Missing validation'],
                },
            };

            const result = selectPrompt(execution, { taskFolder: '/task' });

            expect(result.state).toBe(ExecutionState.BLOCKED_DEPENDENCY);
            expect(result.prompt).toContain('Blocked Dependency');
            expect(result.prompt).toContain('Missing validation');
        });

        test('should select blocked-execution prompt and inject block reason', () => {
            const execution = {
                status: 'blocked',
                completion: {
                    summary: ['Pre-condition failed'],
                },
                currentPhase: { id: 1, name: 'Setup' },
            };

            const result = selectPrompt(execution, { taskFolder: '/task' });

            expect(result.state).toBe(ExecutionState.BLOCKED_EXECUTION);
            expect(result.prompt).toContain('Blocked Execution');
            expect(result.prompt).toContain('Pre-condition failed');
        });

        test('should replace taskFolder and claudiomiroFolder placeholders', () => {
            const execution = {
                status: 'pending',
                pendingFixes: [],
                errorHistory: [],
                completion: {},
            };

            const result = selectPrompt(execution, {
                taskFolder: '/path/to/task',
                claudiomiroFolder: '/path/to/claudiomiro',
            });

            expect(result.prompt).toContain('/path/to/task');
            expect(result.prompt).toContain('/path/to/claudiomiro');
            expect(result.prompt).not.toContain('{{taskFolder}}');
            expect(result.prompt).not.toContain('{{claudiomiroFolder}}');
        });

        test('should return basePrompt and specificPrompt separately', () => {
            const execution = {
                status: 'pending',
                pendingFixes: [],
                errorHistory: [],
                completion: {},
            };

            const result = selectPrompt(execution);

            expect(result.basePrompt).toBeDefined();
            expect(result.specificPrompt).toBeDefined();
            expect(result.basePrompt).toContain('Base Prompt');
            expect(result.specificPrompt).toContain('First Execution');
        });
    });
});
