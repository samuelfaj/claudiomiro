const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

jest.mock('fs');
jest.mock('path');
jest.mock('child_process');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro',
    folder: '/test',
    branch: 'test-branch',
}));
jest.mock('../../../../shared/utils/logger', () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
}));
jest.mock('../../../fix-branch', () => ({
    run: jest.fn(),
}));

// Import after mocks
const { step7 } = require('./index');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { run: runFixBranch } = require('../../../fix-branch');

describe('step7', () => {
    const passedPath = '/test/.claudiomiro/CRITICAL_REVIEW_PASSED.md';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default path.join mock
        path.join.mockImplementation((...args) => args.join('/'));

        // Default state
        state.claudiomiroFolder = '/test/.claudiomiro';
        state.folder = '/test';
        state.branch = 'test-branch';

        // Default file mocks - nothing exists initially
        fs.existsSync.mockReturnValue(false);
        fs.writeFileSync.mockReturnValue(undefined);

        // Default git mocks
        execSync.mockReturnValue('M src/test.js\nA src/new.js');

        // Default fix-branch mock
        runFixBranch.mockResolvedValue();
    });

    describe('Skip Conditions', () => {
        test('should skip if CRITICAL_REVIEW_PASSED.md already exists', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return true;
                return false;
            });

            await step7();

            expect(logger.info).toHaveBeenCalledWith('✅ Critical review already passed (CRITICAL_REVIEW_PASSED.md exists)');
            expect(runFixBranch).not.toHaveBeenCalled();
        });

        test('should skip if newbranch.txt does not exist (not Claudiomiro branch)', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('newbranch.txt')) return false;
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                return true;
            });

            await step7();

            expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Not running on a new branch created by Claudiomiro');
            expect(logger.info).toHaveBeenCalledWith('💡 Step 7 only runs on branches created with Claudiomiro (without --same-branch flag)');
            expect(runFixBranch).not.toHaveBeenCalled();

            // Verify CRITICAL_REVIEW_PASSED.md is created to allow step8
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                passedPath,
                expect.stringContaining('Critical Review Skipped'),
            );
            expect(logger.info).toHaveBeenCalledWith('✅ Created CRITICAL_REVIEW_PASSED.md (step7 not required for same-branch workflow)');
        });

        test('should skip if AI_PROMPT.md does not exist (incomplete session)', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return false;
                return false;
            });

            await step7();

            expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Incomplete Claudiomiro session');
            expect(logger.info).toHaveBeenCalledWith('💡 AI_PROMPT.md not found - session may be corrupted or step1 not executed');
            expect(runFixBranch).not.toHaveBeenCalled();

            // Verify CRITICAL_REVIEW_PASSED.md is created to allow step8
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                passedPath,
                expect.stringContaining('Critical Review Skipped'),
            );
            expect(logger.info).toHaveBeenCalledWith('✅ Created CRITICAL_REVIEW_PASSED.md (step7 not required for incomplete session)');
        });

        test('should skip if no code changes detected (git status clean + no commits)', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            // Git status returns empty (no changes)
            execSync.mockImplementation((command) => {
                if (command.includes('git status --porcelain')) return '';
                if (command.includes('git rev-parse HEAD')) throw new Error('fatal: not a git repository');
                return '';
            });

            await step7();

            expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: No code changes detected');
            expect(runFixBranch).not.toHaveBeenCalled();

            // Verify CRITICAL_REVIEW_PASSED.md is created to allow step8
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                passedPath,
                expect.stringContaining('Critical Review Skipped'),
            );
            expect(logger.info).toHaveBeenCalledWith('✅ Created CRITICAL_REVIEW_PASSED.md (no changes to review)');
        });

        test('should skip if not a git repository (git commands fail)', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockImplementation(() => {
                throw new Error('not a git repository');
            });

            await step7();

            expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Not a git repository or git is not available');
            expect(logger.info).toHaveBeenCalledWith('💡 Step 7 requires git to analyze code changes');
            expect(runFixBranch).not.toHaveBeenCalled();

            // Verify CRITICAL_REVIEW_PASSED.md is created to allow step8
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                passedPath,
                expect.stringContaining('Critical Review Skipped'),
            );
            expect(logger.info).toHaveBeenCalledWith('✅ Created CRITICAL_REVIEW_PASSED.md (git not available)');
        });
    });

    describe('Git Operations', () => {
        test('should proceed when git status shows uncommitted changes', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js\nA src/new.js'); // Has changes

            await step7();

            expect(runFixBranch).toHaveBeenCalledTimes(1);
            expect(logger.success).toHaveBeenCalledWith('✅ Step 7 completed - Critical review passed!');
        });

        test('should proceed when git status is clean but commits exist', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockImplementation((command) => {
                if (command.includes('git status --porcelain')) return ''; // No uncommitted changes
                if (command.includes('git rev-parse HEAD')) return 'commit-hash'; // Has commits
                return '';
            });

            await step7();

            expect(runFixBranch).toHaveBeenCalledTimes(1);
            expect(logger.success).toHaveBeenCalledWith('✅ Step 7 completed - Critical review passed!');
        });

        test('should handle repository with no commits correctly', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockImplementation((command) => {
                if (command.includes('git status --porcelain')) return ''; // No uncommitted changes
                if (command.includes('git rev-parse HEAD')) throw new Error('fatal: not a git repository'); // No commits
                return '';
            });

            await step7();

            expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: No code changes detected');
            expect(runFixBranch).not.toHaveBeenCalled();
        });

        test('should handle git command failures gracefully', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockImplementation(() => {
                throw new Error('git command failed');
            });

            await step7();

            expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Not a git repository or git is not available');
            expect(runFixBranch).not.toHaveBeenCalled();
        });
    });

    describe('fix-branch Delegation', () => {
        test('should call fix-branch with default iterations (20) and level 2', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7();

            expect(runFixBranch).toHaveBeenCalledWith([
                '--limit=20',
                '--level=2',
                '--no-clear',
                '/test',
            ]);
            expect(logger.info).toHaveBeenCalledWith('🔧 Using fix-branch (level: 2 - blockers + warnings)');
        });

        test('should call fix-branch with custom max iterations', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7(10);

            expect(runFixBranch).toHaveBeenCalledWith([
                '--limit=10',
                '--level=2',
                '--no-clear',
                '/test',
            ]);
        });

        test('should call fix-branch with --no-limit when maxIterations is Infinity', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7(Infinity);

            expect(runFixBranch).toHaveBeenCalledWith([
                '--no-limit',
                '--level=2',
                '--no-clear',
                '/test',
            ]);
        });

        test('should always pass --no-clear to fix-branch', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7();

            const args = runFixBranch.mock.calls[0][0];
            expect(args).toContain('--no-clear');
        });

        test('should log starting message with branch info', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7();

            expect(logger.info).toHaveBeenCalledWith('🔍 Starting global critical bug sweep...');
            expect(logger.info).toHaveBeenCalledWith('📍 Analyzing branch: test-branch');
        });

        test('should log success when fix-branch completes', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7();

            expect(logger.success).toHaveBeenCalledWith('✅ Step 7 completed - Critical review passed!');
        });
    });

    describe('Error Handling', () => {
        test('should throw error when state.claudiomiroFolder is undefined', async () => {
            state.claudiomiroFolder = undefined;

            await expect(step7()).rejects.toThrow('state.claudiomiroFolder is not defined. Cannot run step7.');
        });

        test('should propagate fix-branch errors', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            const error = new Error('fix-branch failed');
            runFixBranch.mockRejectedValue(error);

            await expect(step7()).rejects.toThrow('fix-branch failed');
            expect(logger.error).toHaveBeenCalledWith('❌ Step 7 failed: fix-branch failed');
        });
    });

    describe('Edge Cases', () => {
        test('should handle branch name being undefined', async () => {
            state.branch = undefined;

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7();

            expect(logger.info).toHaveBeenCalledWith('📍 Analyzing branch: current branch');
            expect(runFixBranch).toHaveBeenCalled();
        });

        test('should use default maxIterations (20) when not provided', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');

            await step7(); // No maxIterations provided

            expect(runFixBranch).toHaveBeenCalledWith([
                '--limit=20',
                '--level=2',
                '--no-clear',
                '/test',
            ]);
        });
    });
});
