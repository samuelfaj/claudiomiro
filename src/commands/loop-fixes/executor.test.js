// Mock all dependencies BEFORE requiring the module
jest.mock('fs');
jest.mock('../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn()
}));
jest.mock('../../shared/config/state', () => ({
    setFolder: jest.fn(),
    folder: '/test/folder',
    claudiomiroFolder: '/test/folder/.claudiomiro'
}));
jest.mock('../../shared/executors/claude-executor', () => ({
    executeClaude: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { executeClaude } = require('../../shared/executors/claude-executor');
const { loopFixes, countPendingItems, countCompletedItems, initializeFolder } = require('./executor');

describe('src/commands/loop-fixes/executor.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue('');
        fs.mkdirSync.mockReturnValue(undefined);
        executeClaude.mockResolvedValue(undefined);
    });

    describe('countPendingItems()', () => {
        test('should return 0 when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const count = countPendingItems('/path/to/BUGS.md');

            expect(count).toBe(0);
        });

        test('should return 0 when file is empty', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('');

            const count = countPendingItems('/path/to/BUGS.md');

            expect(count).toBe(0);
        });

        test('should count pending items correctly', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BUGS

- [ ] Issue 1
- [ ] Issue 2
- [x] Fixed issue
- [ ] Issue 3
            `);

            const count = countPendingItems('/path/to/BUGS.md');

            expect(count).toBe(3);
        });

        test('should return 0 when all items are completed', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BUGS

- [x] Fixed issue 1
- [x] Fixed issue 2
            `);

            const count = countPendingItems('/path/to/BUGS.md');

            expect(count).toBe(0);
        });

        test('should handle read errors gracefully', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const count = countPendingItems('/path/to/BUGS.md');

            expect(count).toBe(0);
            expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Could not read BUGS.md'));
        });
    });

    describe('countCompletedItems()', () => {
        test('should return 0 when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const count = countCompletedItems('/path/to/BUGS.md');

            expect(count).toBe(0);
        });

        test('should count completed items correctly', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BUGS

- [ ] Issue 1
- [x] Fixed issue 1
- [x] Fixed issue 2
- [ ] Issue 2
            `);

            const count = countCompletedItems('/path/to/BUGS.md');

            expect(count).toBe(2);
        });

        test('should handle case-insensitive [X] markers', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
- [x] lowercase
- [X] uppercase
            `);

            const count = countCompletedItems('/path/to/BUGS.md');

            expect(count).toBe(2);
        });
    });

    describe('initializeFolder()', () => {
        test('should create .claudiomiro folder if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            initializeFolder();

            expect(fs.mkdirSync).toHaveBeenCalledWith(state.claudiomiroFolder, { recursive: true });
        });

        test('should not create folder if it already exists', () => {
            fs.existsSync.mockReturnValue(true);

            initializeFolder();

            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });

        test('should call state.setFolder if claudiomiroFolder is not defined', () => {
            const originalFolder = state.claudiomiroFolder;
            Object.defineProperty(state, 'claudiomiroFolder', {
                get: jest.fn().mockReturnValueOnce(null).mockReturnValue('/test/folder/.claudiomiro'),
                configurable: true
            });
            fs.existsSync.mockReturnValue(false);

            initializeFolder();

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());

            // Restore
            Object.defineProperty(state, 'claudiomiroFolder', {
                value: originalFolder,
                configurable: true
            });
        });
    });

    describe('loopFixes()', () => {
        beforeEach(() => {
            // Setup prompt.md and verification-prompt.md to exist
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                return false;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test prompt {{iteration}} {{maxIterations}} {{userPrompt}} {{bugsPath}} {{overviewPath}} {{claudiomiroFolder}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification {{userPrompt}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}}';
                }
                return '';
            });
            fs.unlinkSync.mockReturnValue(undefined);
        });

        test('should throw error when prompt is empty', async () => {
            await expect(loopFixes('', 10)).rejects.toThrow('A prompt is required');
        });

        test('should throw error when prompt is null', async () => {
            await expect(loopFixes(null, 10)).rejects.toThrow('A prompt is required');
        });

        test('should throw error when prompt is only whitespace', async () => {
            await expect(loopFixes('   ', 10)).rejects.toThrow('A prompt is required');
        });

        test('should throw error when prompt.md is not found', async () => {
            fs.existsSync.mockReturnValue(false);

            await expect(loopFixes('Test prompt', 10)).rejects.toThrow('prompt.md not found');
        });

        test('should throw error when verification-prompt.md is not found', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') && !filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return false; // verification-prompt.md not found
                }
                return false;
            });

            await expect(loopFixes('Test prompt', 10)).rejects.toThrow('verification-prompt.md not found');
        });

        test('should complete successfully after verification passes (CRITICAL_REVIEW_OVERVIEW.md + CRITICAL_REVIEW_PASSED.md)', async () => {
            let iterationCount = 0;
            let overviewDeleted = false;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    // CRITICAL_REVIEW_OVERVIEW.md exists after iteration 1, then deleted, not recreated
                    if (overviewDeleted) return false;
                    return iterationCount >= 1;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    // CRITICAL_REVIEW_PASSED.md created in verification (iteration 2)
                    return iterationCount >= 2;
                }
                return false;
            });

            fs.unlinkSync.mockImplementation((filePath) => {
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    overviewDeleted = true;
                }
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            // 2 iterations: 1 main + 1 verification
            expect(executeClaude).toHaveBeenCalledTimes(2);
            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Verification passed'));
            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Loop completed'));
        });

        test('should continue loop when verification finds new tasks', async () => {
            let iterationCount = 0;
            let verificationRound = 0;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    // CRITICAL_REVIEW_OVERVIEW.md created on iterations 1 and 3
                    return iterationCount === 1 || iterationCount === 3;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    // CRITICAL_REVIEW_PASSED.md only created on 2nd verification (iteration 4)
                    return iterationCount >= 4;
                }
                if (filePath.endsWith('BUGS.md')) {
                    return iterationCount > 0;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test {{iteration}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification {{userPrompt}}';
                }
                if (filePath.endsWith('BUGS.md')) {
                    return '- [x] Fixed issue';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            // 4 iterations: main(1) -> verify(2, fails) -> main(3) -> verify(4, pass)
            expect(executeClaude).toHaveBeenCalledTimes(4);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Verification found new tasks'));
        });

        test('should iterate multiple times until CRITICAL_REVIEW_OVERVIEW.md is created then verify', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    // CRITICAL_REVIEW_OVERVIEW.md exists after 3rd iteration
                    return iterationCount === 3;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    // Verification passes on iteration 4
                    return iterationCount >= 4;
                }
                if (filePath.endsWith('BUGS.md')) {
                    return iterationCount > 0;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test prompt {{iteration}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                if (filePath.endsWith('BUGS.md')) {
                    if (iterationCount < 3) {
                        return '- [ ] Issue 1\n- [ ] Issue 2';
                    }
                    return '- [x] Issue 1\n- [x] Issue 2';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            // 4 iterations: 3 main + 1 verification
            expect(executeClaude).toHaveBeenCalledTimes(4);
            expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Loop completed'));
        });

        test('should throw error when max iterations reached without completion', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return false; // Never created
                }
                if (filePath.endsWith('BUGS.md')) {
                    return true;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test prompt {{iteration}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                if (filePath.endsWith('BUGS.md')) {
                    return '- [ ] Unresolved issue';
                }
                return '';
            });

            await expect(loopFixes('Test prompt', 3)).rejects.toThrow('did not complete after 3 iterations');

            expect(executeClaude).toHaveBeenCalledTimes(3);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Max iterations'));
        });

        test('should throw error when max iterations reached during verification', async () => {
            let iterationCount = 0;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    // CRITICAL_REVIEW_OVERVIEW.md created on iteration 2 (enters verification on 3)
                    return iterationCount === 2;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return false; // Never created - verification keeps finding tasks
                }
                if (filePath.endsWith('BUGS.md')) {
                    return true;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test {{iteration}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                if (filePath.endsWith('BUGS.md')) {
                    return '- [ ] Issue';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await expect(loopFixes('Test prompt', 3)).rejects.toThrow('did not complete after 3 iterations');

            expect(executeClaude).toHaveBeenCalledTimes(3);
        });

        test('should handle Claude execution failure', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                return false;
            });

            executeClaude.mockRejectedValue(new Error('Claude failed'));

            await expect(loopFixes('Test prompt', 10)).rejects.toThrow('Loop-fixes failed during iteration 1');

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Claude execution failed'));
        });

        test('should replace placeholders in prompt template', async () => {
            let capturedPrompt = '';
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 1; // Created on iteration 1
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 2; // Verification passes on iteration 2
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return 'Iteration: {{iteration}}, Max: {{maxIterations}}, Prompt: {{userPrompt}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                return '';
            });

            executeClaude.mockImplementation(async (prompt) => {
                iterationCount++;
                if (iterationCount === 1) {
                    capturedPrompt = prompt;
                }
            });

            await loopFixes('My test prompt', 5);

            expect(capturedPrompt).toContain('Iteration: 1');
            expect(capturedPrompt).toContain('Max: 5');
            expect(capturedPrompt).toContain('Prompt: My test prompt');
        });

        test('should replace placeholders in verification prompt template', async () => {
            let capturedVerificationPrompt = '';
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') && !filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 1;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 2;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('verification-prompt.md')) {
                    return 'Verify: {{userPrompt}}, Bugs: {{bugsPath}}, Passed: {{passedPath}}';
                }
                if (filePath.endsWith('prompt.md')) {
                    return '# Main prompt';
                }
                return '';
            });

            executeClaude.mockImplementation(async (prompt) => {
                iterationCount++;
                if (iterationCount === 2) {
                    capturedVerificationPrompt = prompt;
                }
            });

            await loopFixes('Check all types', 10);

            expect(capturedVerificationPrompt).toContain('Verify: Check all types');
            expect(capturedVerificationPrompt).toContain('Bugs:');
            expect(capturedVerificationPrompt).toContain('Passed:');
        });

        test('should handle unlimited iterations (Infinity)', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 2;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 3;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return 'Max: {{maxIterations}}';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                return '';
            });

            let mainPromptCaptured = '';
            executeClaude.mockImplementation(async (prompt) => {
                iterationCount++;
                if (iterationCount === 1) {
                    mainPromptCaptured = prompt;
                }
            });

            await loopFixes('Test prompt', Infinity);

            expect(mainPromptCaptured).toContain('Max: unlimited');
            expect(executeClaude).toHaveBeenCalledTimes(3);
        });

        test('should log iteration progress', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 1;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 2;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('🔄 Starting loop-fixes'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Iteration 1/10'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('🔍 Verification Iteration'));
        });

        test('should log summary when issues were fixed', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 1;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 2;
                }
                if (filePath.endsWith('BUGS.md')) {
                    return true;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                if (filePath.endsWith('BUGS.md')) {
                    return '- [x] Fixed 1\n- [x] Fixed 2\n- [x] Fixed 3';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('3 issue(s) fixed'));
        });

        test('should truncate long prompts in log output', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 1;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 2;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            const longPrompt = 'A'.repeat(200);
            await loopFixes(longPrompt, 10);

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('📝 Prompt: "'));
            const promptLogCall = logger.info.mock.calls.find(call => call[0].includes('📝 Prompt'));
            expect(promptLogCall[0]).toContain('...');
        });

        test('should display pending and completed counts during iteration', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 2;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 3;
                }
                if (filePath.endsWith('BUGS.md')) {
                    return iterationCount > 0;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                if (filePath.endsWith('BUGS.md')) {
                    return '- [x] Fixed\n- [ ] Pending';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 fixed, 1 pending'));
        });

        test('should delete CRITICAL_REVIEW_OVERVIEW.md when entering verification mode', async () => {
            let iterationCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md') || filePath.endsWith('verification-prompt.md')) {
                    return true;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_OVERVIEW.md')) {
                    return iterationCount === 1;
                }
                if (filePath.endsWith('CRITICAL_REVIEW_PASSED.md')) {
                    return iterationCount >= 2;
                }
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('prompt.md')) {
                    return '# Test';
                }
                if (filePath.endsWith('verification-prompt.md')) {
                    return '# Verification';
                }
                return '';
            });

            executeClaude.mockImplementation(async () => {
                iterationCount++;
            });

            await loopFixes('Test prompt', 10);

            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('CRITICAL_REVIEW_OVERVIEW.md'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Starting verification'));
        });
    });
});
