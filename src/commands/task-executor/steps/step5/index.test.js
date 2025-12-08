/**
 * Step5 Integration Tests
 *
 * These tests verify the orchestration logic of step5.
 * Individual module tests are in:
 *   - utils/security.test.js
 *   - utils/execution-io.test.js
 *   - utils/phase-gate.test.js
 *   - validators/completion.test.js
 *   - validators/*.test.js
 */

const fs = require('fs');
const _path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../utils/scope-parser', () => ({
    parseTaskScope: jest.fn().mockReturnValue(null),
    validateScope: jest.fn().mockReturnValue(true),
}));
jest.mock('./reflection-hook', () => ({
    shouldReflect: jest.fn().mockReturnValue({ should: false }),
    createReflection: jest.fn(),
    storeReflection: jest.fn(),
    buildReflectionTrajectory: jest.fn().mockReturnValue(''),
}));
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn().mockReturnValue(false),
    getRepository: jest.fn().mockReturnValue('/test/backend'),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    warning: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock('../../../../shared/services/context-cache', () => ({
    buildConsolidatedContextAsync: jest.fn().mockResolvedValue('## Environment Summary\nMocked context'),
    getContextFilePaths: jest.fn().mockReturnValue([]),
    markTaskCompleted: jest.fn(),
}));
jest.mock('./generate-review-checklist', () => ({
    generateReviewChecklist: jest.fn().mockResolvedValue({ success: true, checklistPath: null, itemCount: 0 }),
    loadArtifactsFromExecution: jest.fn(),
    buildChecklistPrompt: jest.fn(),
}));
// Mock validators
jest.mock('./validators', () => ({
    verifyPreConditions: jest.fn().mockResolvedValue({ passed: true, blocked: false }),
    validateImplementationStrategy: jest.fn().mockResolvedValue({ valid: true, missing: [], expectedPhases: 1 }),
    validateSuccessCriteria: jest.fn().mockResolvedValue([]),
    verifyChanges: jest.fn().mockResolvedValue({ valid: true, undeclared: [], missing: [] }),
    validateReviewChecklist: jest.fn().mockResolvedValue({ valid: true, missing: [], totalChecklistItems: 0 }),
    validateCompletion: jest.fn().mockReturnValue(true),
}));
// Mock utils - use a simple inline implementation
jest.mock('./utils/execution-io', () => ({
    loadExecution: jest.fn().mockReturnValue({
        status: 'pending',
        attempts: 0,
        phases: [{ id: 1, name: 'Phase 1', status: 'pending', preConditions: [] }],
        artifacts: [],
        completion: { status: 'pending_validation' },
        currentPhase: { id: 1, name: 'Phase 1' },
    }),
    saveExecution: jest.fn(),
    recordError: jest.fn(),
}));
jest.mock('./utils/phase-gate', () => ({
    enforcePhaseGate: jest.fn().mockReturnValue(true),
    updatePhaseProgress: jest.fn(),
}));
jest.mock('./utils/execution-helpers', () => ({
    trackArtifacts: jest.fn(),
    trackUncertainty: jest.fn(),
    estimateCodeChangeSize: jest.fn().mockReturnValue(100),
    VALID_STATUSES: ['pending', 'in_progress', 'completed', 'blocked'],
}));
jest.mock('./utils/security', () => ({
    isDangerousCommand: jest.fn().mockReturnValue(false),
    isCriticalError: jest.fn().mockReturnValue(false),
    CRITICAL_ERROR_PATTERNS: [],
}));
jest.mock('child_process', () => {
    const { EventEmitter } = require('events');
    return {
        exec: jest.fn((cmd, opts, cb) => {
            if (typeof opts === 'function') {
                cb = opts;
                opts = {};
            }
            if (cb) cb(null, { stdout: 'success', stderr: '' });
            return new EventEmitter();
        }),
    };
});

// Import after mocks
const { step5, VALID_STATUSES } = require('./index');
const { loadExecution, saveExecution, recordError } = require('./utils/execution-io');
const { verifyPreConditions } = require('./validators');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const state = require('../../../../shared/config/state');

describe('step5 orchestration', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock - BLUEPRINT.md and prompt files exist
        fs.existsSync.mockImplementation((filePath) => {
            if (filePath.includes('BLUEPRINT.md')) return true;
            if (filePath.includes('execution.json')) return true;
            if (filePath.includes('SHELL-COMMAND-RULE.md')) return true;
            if (filePath.includes('prompts/base.md')) return true;
            if (filePath.includes('prompts/first-execution.md')) return true;
            if (filePath.includes('prompts/error-recovery.md')) return true;
            if (filePath.includes('prompts/blocked-dependency.md')) return true;
            if (filePath.includes('prompts/blocked-execution.md')) return true;
            if (filePath.includes('prompt.md')) return false;
            return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT: TASK1\n\nTask content';
            if (filePath.includes('SHELL-COMMAND-RULE.md')) return 'Shell rules';
            if (filePath.includes('prompts/base.md')) return '# Base Prompt\n\n{{taskFolder}}\n{{claudiomiroFolder}}';
            if (filePath.includes('prompts/first-execution.md')) return '# First Execution\n\nFresh start';
            if (filePath.includes('prompts/error-recovery.md')) return '# Error Recovery\n\n{{errorDetails}}';
            if (filePath.includes('prompts/blocked-dependency.md')) return '# Blocked Dependency\n\n{{blockedByDetails}}';
            if (filePath.includes('prompts/blocked-execution.md')) return '# Blocked Execution\n\n{{blockReason}}';
            return '';
        });

        fs.writeFileSync.mockImplementation(() => {});

        executeClaude.mockResolvedValue({ success: true });
    });

    describe('step5 main flow', () => {
        test('should execute successfully with BLUEPRINT.md flow', async () => {
            const result = await step5(mockTask);

            expect(executeClaude).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        test('should throw error when BLUEPRINT.md is missing', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return false;
                return false;
            });

            await expect(step5(mockTask)).rejects.toThrow('BLUEPRINT.md not found');
        });

        test('should throw error when BLUEPRINT.md is empty', async () => {
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '';
                return '';
            });

            await expect(step5(mockTask)).rejects.toThrow('BLUEPRINT.md is empty');
        });

        test('should call loadExecution to load execution.json', async () => {
            await step5(mockTask);

            expect(loadExecution).toHaveBeenCalled();
        });

        test('should call saveExecution after execution', async () => {
            await step5(mockTask);

            expect(saveExecution).toHaveBeenCalled();
        });

        test('should call verifyPreConditions', async () => {
            await step5(mockTask);

            expect(verifyPreConditions).toHaveBeenCalled();
        });

        test('should record error when execution fails', async () => {
            const error = new Error('Claude execution failed');
            executeClaude.mockRejectedValue(error);

            await expect(step5(mockTask)).rejects.toThrow('Claude execution failed');

            expect(recordError).toHaveBeenCalled();
        });

        test('should not reset execution.json on validation error', async () => {
            // Mock validation failure
            const { validateImplementationStrategy } = require('./validators');
            validateImplementationStrategy.mockResolvedValue({
                valid: false,
                missing: [{ phase: 1, reason: 'missing step' }],
            });

            await expect(step5(mockTask)).rejects.toThrow('Validation failed');

            // Should record error, not reset
            expect(recordError).toHaveBeenCalled();

            // Should save with in_progress status, not reset to pending
            const saveCall = saveExecution.mock.calls[saveExecution.mock.calls.length - 1];
            const savedExecution = saveCall[1];
            expect(savedExecution.status).toBe('in_progress');
            expect(savedExecution.pendingFixes).toContain('implementation-strategy');
        });

        test('should pass pending fixes context to Claude on retry', async () => {
            // Reset the mock to valid state first
            const { validateImplementationStrategy } = require('./validators');
            validateImplementationStrategy.mockResolvedValue({ valid: true, missing: [], expectedPhases: 1 });

            // Mock execution with pending fixes (triggers error-recovery prompt)
            loadExecution.mockReturnValue({
                status: 'in_progress',
                attempts: 1,
                phases: [{ id: 1, name: 'Phase 1', status: 'pending' }],
                artifacts: [],
                completion: { lastError: 'Previous error' },
                currentPhase: { id: 1, name: 'Phase 1' },
                pendingFixes: ['success-criteria'],
                errorHistory: [{ message: 'Previous error', failedValidation: 'success-criteria' }],
            });

            await step5(mockTask);

            // Check that Claude was called with error-recovery prompt
            const claudeCall = executeClaude.mock.calls[0];
            const prompt = claudeCall[0];
            // Error-recovery prompt uses {{errorDetails}} which gets replaced
            expect(prompt).toContain('Error Recovery');
            expect(prompt).toContain('success-criteria');
        });
    });

    describe('scope-aware execution', () => {
        beforeEach(() => {
            // Reset validators to valid state
            const { validateImplementationStrategy } = require('./validators');
            validateImplementationStrategy.mockResolvedValue({ valid: true, missing: [], expectedPhases: 1 });

            parseTaskScope.mockReturnValue(null);
            validateScope.mockReturnValue(true);
            state.isMultiRepo.mockReturnValue(false);

            // Ensure prompt files are accessible
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return true;
                if (filePath.includes('prompts/base.md')) return true;
                if (filePath.includes('prompts/first-execution.md')) return true;
                if (filePath.includes('prompts/error-recovery.md')) return true;
                if (filePath.includes('prompts/blocked-dependency.md')) return true;
                if (filePath.includes('prompts/blocked-execution.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT: TASK1\n\nTask content';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return 'Shell rules';
                if (filePath.includes('prompts/base.md')) return '# Base Prompt\n\n{{taskFolder}}\n{{claudiomiroFolder}}';
                if (filePath.includes('prompts/first-execution.md')) return '# First Execution\n\nFresh start';
                if (filePath.includes('prompts/error-recovery.md')) return '# Error Recovery\n\n{{errorDetails}}';
                if (filePath.includes('prompts/blocked-dependency.md')) return '# Blocked Dependency\n\n{{blockedByDetails}}';
                if (filePath.includes('prompts/blocked-execution.md')) return '# Blocked Execution\n\n{{blockReason}}';
                return '';
            });
        });

        test('should use state.folder as cwd in single-repo mode', async () => {
            state.isMultiRepo.mockReturnValue(false);

            await step5(mockTask);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ cwd: '/test/project' }),
            );
        });

        test('should use state.getRepository as cwd for @scope backend', async () => {
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockReturnValue('/test/backend');
            parseTaskScope.mockReturnValue('backend');

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '@scope backend\n\n# BLUEPRINT: Task\n\nTask content';
                if (filePath.includes('SHELL-COMMAND-RULE.md')) return 'Shell rules';
                if (filePath.includes('prompts/base.md')) return '# Base Prompt\n\n{{taskFolder}}\n{{claudiomiroFolder}}';
                if (filePath.includes('prompts/first-execution.md')) return '# First Execution\n\nFresh start';
                if (filePath.includes('prompts/error-recovery.md')) return '# Error Recovery\n\n{{errorDetails}}';
                if (filePath.includes('prompts/blocked-dependency.md')) return '# Blocked Dependency\n\n{{blockedByDetails}}';
                if (filePath.includes('prompts/blocked-execution.md')) return '# Blocked Execution\n\n{{blockReason}}';
                return '';
            });

            await step5(mockTask);

            expect(parseTaskScope).toHaveBeenCalledWith(expect.stringContaining('@scope backend'));
            expect(state.getRepository).toHaveBeenCalledWith('backend');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ cwd: '/test/backend' }),
            );
        });

        test('should throw validation error when scope missing in multi-repo mode', async () => {
            state.isMultiRepo.mockReturnValue(true);
            parseTaskScope.mockReturnValue(null);
            validateScope.mockImplementation(() => {
                throw new Error('@scope tag is required in multi-repo mode');
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return '# BLUEPRINT: Task\n\nTask content without scope';
                return '';
            });

            await expect(step5(mockTask)).rejects.toThrow('@scope tag is required in multi-repo mode');
            expect(validateScope).toHaveBeenCalledWith(null, true);
        });
    });

    describe('VALID_STATUSES', () => {
        test('should export valid statuses', () => {
            expect(VALID_STATUSES).toEqual(['pending', 'in_progress', 'completed', 'blocked']);
        });
    });
});
