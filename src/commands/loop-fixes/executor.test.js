// Mock dependencies BEFORE requiring the module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    rmSync: jest.fn(),
    unlinkSync: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
}));

jest.mock('../../shared/config/state', () => ({
    claudiomiroRoot: null,
    setFolder: jest.fn(function (folder) {
        this.claudiomiroRoot = require('path').join(folder, '.claudiomiro');
    }),
}));

jest.mock('../../shared/executors/claude-executor', () => ({
    executeClaude: jest.fn(),
}));

jest.mock('../../shared/services/local-llm', () => ({
    getLocalLLMService: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { executeClaude } = require('../../shared/executors/claude-executor');
const { getLocalLLMService } = require('../../shared/services/local-llm');
const {
    loopFixes,
    countPendingItems,
    countCompletedItems,
    initializeFolder,
    getLoopFixesFolder,
} = require('./executor');

// Helper to create mock LocalLLM service
const createMockLLMService = (options = {}) => ({
    initialize: jest.fn().mockResolvedValue({ available: options.available ?? true }),
    isAvailable: jest.fn().mockReturnValue(options.available ?? true),
    validateFix: jest.fn().mockResolvedValue(options.validateFixResult ?? null),
});

describe('src/commands/loop-fixes/executor.js', () => {
    const testFolder = '/test/project';
    const claudiomiroRoot = `${testFolder}/.claudiomiro`;
    const loopFixesFolder = `${claudiomiroRoot}/loop-fixes`;

    beforeEach(() => {
        jest.clearAllMocks();
        state.claudiomiroRoot = claudiomiroRoot;
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue('');
        executeClaude.mockResolvedValue(undefined);
        getLocalLLMService.mockReturnValue(null);
    });

    describe('countPendingItems()', () => {
        test('should return 0 when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = countPendingItems('/path/to/file.md');

            expect(result).toBe(0);
        });

        test('should return 0 when file has no pending items', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Tasks\n- [x] Done task\n- [x] Another done');

            const result = countPendingItems('/path/to/file.md');

            expect(result).toBe(0);
        });

        test('should count pending items correctly', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Tasks\n- [ ] Task 1\n- [x] Done\n- [ ] Task 2\n- [ ] Task 3');

            const result = countPendingItems('/path/to/file.md');

            expect(result).toBe(3);
        });

        test('should return 0 when read fails', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const result = countPendingItems('/path/to/file.md');

            expect(result).toBe(0);
            expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Could not read'));
        });
    });

    describe('countCompletedItems()', () => {
        test('should return 0 when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = countCompletedItems('/path/to/file.md');

            expect(result).toBe(0);
        });

        test('should return 0 when file has no completed items', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Tasks\n- [ ] Task 1\n- [ ] Task 2');

            const result = countCompletedItems('/path/to/file.md');

            expect(result).toBe(0);
        });

        test('should count completed items correctly (lowercase x)', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Tasks\n- [x] Done 1\n- [ ] Pending\n- [x] Done 2');

            const result = countCompletedItems('/path/to/file.md');

            expect(result).toBe(2);
        });

        test('should count completed items correctly (uppercase X)', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Tasks\n- [X] Done 1\n- [X] Done 2');

            const result = countCompletedItems('/path/to/file.md');

            expect(result).toBe(2);
        });

        test('should return 0 when read fails', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const result = countCompletedItems('/path/to/file.md');

            expect(result).toBe(0);
            expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Could not read'));
        });
    });

    describe('getLoopFixesFolder()', () => {
        test('should return loop-fixes folder path', () => {
            state.claudiomiroRoot = '/project/.claudiomiro';

            const result = getLoopFixesFolder();

            expect(result).toBe('/project/.claudiomiro/loop-fixes');
        });

        test('should set folder when claudiomiroRoot is null', () => {
            state.claudiomiroRoot = null;

            getLoopFixesFolder();

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });
    });

    describe('initializeFolder()', () => {
        test('should set folder when claudiomiroRoot is null', () => {
            state.claudiomiroRoot = null;
            fs.existsSync.mockReturnValue(false);

            initializeFolder();

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should create claudiomiro root if it does not exist', () => {
            state.claudiomiroRoot = claudiomiroRoot;
            fs.existsSync.mockReturnValue(false);

            initializeFolder();

            expect(fs.mkdirSync).toHaveBeenCalledWith(claudiomiroRoot, { recursive: true });
        });

        test('should create loop-fixes folder if it does not exist', () => {
            state.claudiomiroRoot = claudiomiroRoot;
            fs.existsSync.mockImplementation((p) => p === claudiomiroRoot);

            initializeFolder();

            expect(fs.mkdirSync).toHaveBeenCalledWith(loopFixesFolder, { recursive: true });
        });

        test('should clear loop-fixes folder when clearFolder is true', () => {
            state.claudiomiroRoot = claudiomiroRoot;
            fs.existsSync.mockReturnValue(true);

            initializeFolder(true);

            expect(fs.rmSync).toHaveBeenCalledWith(loopFixesFolder, { recursive: true });
        });

        test('should not clear folder when clearFolder is false', () => {
            state.claudiomiroRoot = claudiomiroRoot;
            fs.existsSync.mockReturnValue(true);

            initializeFolder(false);

            expect(fs.rmSync).not.toHaveBeenCalled();
        });
    });

    describe('loopFixes()', () => {
        const promptPath = path.join(__dirname, 'prompt.md');
        const verificationPromptPath = path.join(__dirname, 'verification-prompt.md');
        const shellCommandRulePath = path.join(__dirname, '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md');

        beforeEach(() => {
            state.claudiomiroRoot = claudiomiroRoot;

            // Mock prompt files exist
            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((p) => {
                if (p === promptPath) return 'Prompt template {{iteration}} {{maxIterations}} {{userPrompt}} {{bugsPath}} {{overviewPath}} {{claudiomiroFolder}}';
                if (p === verificationPromptPath) return 'Verification template {{userPrompt}} {{bugsPath}} {{passedPath}} {{failedPath}} {{claudiomiroFolder}}';
                if (p === shellCommandRulePath) return 'Shell command rule';
                return '';
            });
        });

        test('should throw error when prompt is empty', async () => {
            await expect(loopFixes('')).rejects.toThrow('A prompt is required');
            await expect(loopFixes('   ')).rejects.toThrow('A prompt is required');
        });

        test('should throw error when prompt is null', async () => {
            await expect(loopFixes(null)).rejects.toThrow('A prompt is required');
        });

        test('should throw error when prompt.md is missing', async () => {
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;

            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return false;
                if (p === passedPath) return false;  // Must be false to not exit early
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                return false;
            });

            await expect(loopFixes('Test prompt')).rejects.toThrow('prompt.md not found');
        });

        test('should throw error when verification-prompt.md is missing', async () => {
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;

            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return false;
                if (p === passedPath) return false;  // Must be false to not exit early
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                return false;
            });

            await expect(loopFixes('Test prompt')).rejects.toThrow('verification-prompt.md not found');
        });

        test('should exit early when CRITICAL_REVIEW_PASSED.md exists', async () => {
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;

            fs.existsSync.mockImplementation((p) => {
                if (p === passedPath) return true;
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                return false;
            });

            await loopFixes('Test prompt');

            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('already completed'));
            expect(executeClaude).not.toHaveBeenCalled();
        });

        test('should execute claude and complete when PASSED file is created', async () => {
            const _bugsPath = `${loopFixesFolder}/CRITICAL_REVIEW_TODO.md`;
            const overviewPath = `${loopFixesFolder}/CRITICAL_REVIEW_OVERVIEW.md`;
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;

            let iterationCount = 0;

            // First iteration: no files exist, executeClaude creates overview
            // Second iteration: overview exists (verification mode), executeClaude creates passed
            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                // After first executeClaude call, overview exists
                if (p === overviewPath) return iterationCount >= 1;
                // After second executeClaude call, passed exists
                if (p === passedPath) return iterationCount >= 2;
                return false;
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 5);

            expect(executeClaude).toHaveBeenCalledTimes(2);
            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Verification passed'));
        });

        test('should throw error when max iterations reached', async () => {
            // Always return that files don't exist to force max iterations
            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                return false;
            });

            await expect(loopFixes('Test prompt', 2)).rejects.toThrow('did not complete after 2 iterations');

            expect(executeClaude).toHaveBeenCalledTimes(2);
        });

        test('should throw error when executeClaude fails', async () => {
            executeClaude.mockRejectedValue(new Error('Claude failed'));

            await expect(loopFixes('Test prompt', 3)).rejects.toThrow('Loop-fixes failed during iteration 1');

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Claude execution failed'));
        });

        test('should handle freshStart option by deleting existing files', async () => {
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;
            const bugsPath = `${loopFixesFolder}/CRITICAL_REVIEW_TODO.md`;
            const overviewPath = `${loopFixesFolder}/CRITICAL_REVIEW_OVERVIEW.md`;

            // Track iteration and file state
            let iterationCount = 0;
            let passedDeleted = false;

            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                // PASSED file only exists after files are supposedly deleted (freshStart)
                // then gets created by Claude in iteration 2
                if (p === passedPath) return passedDeleted && iterationCount >= 2;
                if (p === bugsPath) return passedDeleted;
                if (p === overviewPath) return passedDeleted && iterationCount >= 1;
                return false;
            });

            fs.unlinkSync.mockImplementation((_p) => {
                passedDeleted = true;  // Mark that freshStart deletion happened
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            // With freshStart, it should try to delete files then complete
            await loopFixes('Test prompt', 5, { freshStart: true });

            expect(fs.unlinkSync).toHaveBeenCalled();
        });

        test('should auto-create PASSED file when no pending items after verification', async () => {
            const overviewPath = `${loopFixesFolder}/CRITICAL_REVIEW_OVERVIEW.md`;
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;
            const bugsPath = `${loopFixesFolder}/CRITICAL_REVIEW_TODO.md`;

            let iterationCount = 0;

            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                // Overview exists from start (verification mode)
                if (p === overviewPath) return true;
                // Bugs file exists
                if (p === bugsPath) return iterationCount >= 1;
                // PASSED file never created by Claude
                if (p === passedPath) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((p) => {
                if (p === promptPath) return 'Prompt {{iteration}} {{maxIterations}} {{userPrompt}} {{bugsPath}} {{overviewPath}} {{claudiomiroFolder}}';
                if (p === verificationPromptPath) return 'Verification {{userPrompt}} {{bugsPath}} {{passedPath}} {{failedPath}} {{claudiomiroFolder}}';
                if (p === shellCommandRulePath) return 'Shell rule';
                // No pending items (all completed)
                if (p === bugsPath) return '- [x] Done task';
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 5);

            // Should auto-create PASSED file
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                passedPath,
                expect.stringContaining('Critical Review Passed'),
                'utf-8',
            );
            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Loop completed'));
        });

        test('should continue fixing when verification finds new tasks', async () => {
            const overviewPath = `${loopFixesFolder}/CRITICAL_REVIEW_OVERVIEW.md`;
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;
            const bugsPath = `${loopFixesFolder}/CRITICAL_REVIEW_TODO.md`;

            let iterationCount = 0;
            let overviewExists = true;
            let overviewDeletedOnce = false;

            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                // Overview exists initially, deleted after verification, recreated later
                if (p === overviewPath) {
                    // After being deleted once, it comes back on iteration 3
                    if (overviewDeletedOnce && iterationCount >= 3) return true;
                    return overviewExists;
                }
                // Passed created after iteration 4
                if (p === passedPath) return iterationCount >= 4;
                if (p === bugsPath) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((p) => {
                if (p === promptPath) return 'Prompt {{iteration}} {{maxIterations}} {{userPrompt}} {{bugsPath}} {{overviewPath}} {{claudiomiroFolder}}';
                if (p === verificationPromptPath) return 'Verification {{userPrompt}} {{bugsPath}} {{passedPath}} {{failedPath}} {{claudiomiroFolder}}';
                if (p === shellCommandRulePath) return 'Shell rule';
                // First verification (iter 1): has pending items (triggers exit verification)
                // After fixing (iter 2-3): no pending items
                if (p === bugsPath) {
                    return iterationCount < 2 ? '- [ ] Pending task' : '- [x] Done';
                }
                return '';
            });

            // Track unlinkSync calls to simulate file deletion
            fs.unlinkSync.mockImplementation((p) => {
                if (p === overviewPath) {
                    overviewExists = false;
                    overviewDeletedOnce = true;
                }
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            // Should have run multiple iterations and unlinkSync should have been called for overview
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.unlinkSync).toHaveBeenCalledWith(overviewPath);
        });

        test('should use local LLM analysis when available and stuck', async () => {
            const mockLLM = createMockLLMService({
                available: true,
                validateFixResult: {
                    issues: ['Issue 1', 'Issue 2'],
                    recommendation: 'Try a different approach',
                },
            });
            getLocalLLMService.mockReturnValue(mockLLM);

            let iterationCount = 0;
            const passedPath = `${loopFixesFolder}/CRITICAL_REVIEW_PASSED.md`;
            const bugsPath = `${loopFixesFolder}/CRITICAL_REVIEW_TODO.md`;
            const overviewPath = `${loopFixesFolder}/CRITICAL_REVIEW_OVERVIEW.md`;

            fs.existsSync.mockImplementation((p) => {
                if (p === promptPath) return true;
                if (p === verificationPromptPath) return true;
                if (p === shellCommandRulePath) return true;
                if (p === claudiomiroRoot) return true;
                if (p === loopFixesFolder) return true;
                // Overview created on iteration 2, triggers verification
                if (p === overviewPath) return iterationCount >= 2;
                // Pass on iteration 3
                if (p === passedPath) return iterationCount >= 3;
                if (p === bugsPath) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((p) => {
                if (p === promptPath) return 'Prompt {{iteration}} {{maxIterations}} {{userPrompt}} {{bugsPath}} {{overviewPath}} {{claudiomiroFolder}}';
                if (p === verificationPromptPath) return 'Verification {{userPrompt}} {{bugsPath}} {{passedPath}} {{failedPath}} {{claudiomiroFolder}}';
                if (p === shellCommandRulePath) return 'Shell rule';
                // Same pending count (stuck) until verification
                if (p === bugsPath) return iterationCount < 3 ? '- [ ] Task' : '- [x] Done';
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 5);

            // LLM should be called on iterations after the first when stuck
            expect(mockLLM.initialize).toHaveBeenCalled();
        });
    });

    describe('exports', () => {
        test('should export loopFixes function', () => {
            expect(loopFixes).toBeDefined();
            expect(typeof loopFixes).toBe('function');
        });

        test('should export countPendingItems function', () => {
            expect(countPendingItems).toBeDefined();
            expect(typeof countPendingItems).toBe('function');
        });

        test('should export countCompletedItems function', () => {
            expect(countCompletedItems).toBeDefined();
            expect(typeof countCompletedItems).toBe('function');
        });

        test('should export initializeFolder function', () => {
            expect(initializeFolder).toBeDefined();
            expect(typeof initializeFolder).toBe('function');
        });

        test('should export getLoopFixesFolder function', () => {
            expect(getLoopFixesFolder).toBeDefined();
            expect(typeof getLoopFixesFolder).toBe('function');
        });
    });
});
