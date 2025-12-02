const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

jest.mock('fs');
jest.mock('path');
jest.mock('child_process');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test',
    branch: 'test-branch',
    isMultiRepo: jest.fn(() => false),
    getRepository: jest.fn((scope) => scope === 'backend' ? '/backend' : '/frontend'),
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
jest.mock('../../../../shared/services/integration-verifier', () => ({
    verifyIntegration: jest.fn(),
}));

// Import after mocks
const { step7, runIntegrationVerification } = require('./index');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { run: runFixBranch } = require('../../../fix-branch');
const { verifyIntegration } = require('../../../../shared/services/integration-verifier');

describe('step7', () => {
    const passedPath = '/test/.claudiomiro/task-executor/CRITICAL_REVIEW_PASSED.md';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default path.join mock
        path.join.mockImplementation((...args) => args.join('/'));

        // Default state
        state.claudiomiroFolder = '/test/.claudiomiro/task-executor';
        state.folder = '/test';
        state.branch = 'test-branch';
        state.isMultiRepo.mockReturnValue(false);
        state.getRepository.mockImplementation((scope) => scope === 'backend' ? '/backend' : '/frontend');

        // Default file mocks - nothing exists initially
        fs.existsSync.mockReturnValue(false);
        fs.writeFileSync.mockReturnValue(undefined);

        // Default git mocks
        execSync.mockReturnValue('M src/test.js\nA src/new.js');

        // Default fix-branch mock
        runFixBranch.mockResolvedValue();

        // Default integration-verifier mock
        verifyIntegration.mockResolvedValue({ success: true, mismatches: [] });
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
                '--continue',
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
                '--continue',
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
                '--continue',
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

        test('should propagate CRITICAL_REVIEW_PASSED.md from loop-fixes to main folder', async () => {
            const loopFixesPassedPath = '/test/.claudiomiro/task-executor/loop-fixes/CRITICAL_REVIEW_PASSED.md';

            fs.existsSync.mockImplementation((filePath) => {
                // Initial check: no CRITICAL_REVIEW_PASSED.md in main folder
                if (filePath === passedPath) return false;
                // After fix-branch: file exists in loop-fixes folder
                if (filePath === loopFixesPassedPath) return true;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');
            fs.copyFileSync = jest.fn();

            await step7();

            expect(fs.copyFileSync).toHaveBeenCalledWith(loopFixesPassedPath, passedPath);
            expect(logger.info).toHaveBeenCalledWith('📋 Propagated CRITICAL_REVIEW_PASSED.md to main folder');
        });

        test('should not propagate if file already exists in main folder', async () => {
            const loopFixesPassedPath = '/test/.claudiomiro/task-executor/loop-fixes/CRITICAL_REVIEW_PASSED.md';

            // Simulate: file exists in both places (already propagated)
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath === passedPath) return true; // Already exists in main folder
                if (filePath === loopFixesPassedPath) return true;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            await step7();

            // Should skip (already passed) - fix-branch not called
            expect(runFixBranch).not.toHaveBeenCalled();
        });

        test('should not propagate if file does not exist in loop-fixes folder', async () => {
            const loopFixesPassedPath = '/test/.claudiomiro/task-executor/loop-fixes/CRITICAL_REVIEW_PASSED.md';

            fs.existsSync.mockImplementation((filePath) => {
                // File doesn't exist in loop-fixes folder (fix-branch might have failed)
                if (filePath === passedPath) return false;
                if (filePath === loopFixesPassedPath) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });

            execSync.mockReturnValue('M src/test.js');
            fs.copyFileSync = jest.fn();

            await step7();

            expect(fs.copyFileSync).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalledWith('📋 Propagated CRITICAL_REVIEW_PASSED.md to main folder');
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
                '--continue',
                '--level=2',
                '--no-clear',
                '/test',
            ]);
        });
    });

    describe('Integration Verification', () => {
        test('should skip integration verification in single-repo mode', async () => {
            state.isMultiRepo.mockReturnValue(false);

            await runIntegrationVerification();

            expect(verifyIntegration).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalledWith('Running integration verification for multi-repo project...');
        });

        test('should run integration verification in multi-repo mode', async () => {
            state.isMultiRepo.mockReturnValue(true);
            verifyIntegration.mockResolvedValue({ success: true, mismatches: [] });

            await runIntegrationVerification();

            expect(verifyIntegration).toHaveBeenCalledWith({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });
            expect(logger.info).toHaveBeenCalledWith('Running integration verification for multi-repo project...');
            expect(logger.info).toHaveBeenCalledWith('Integration verification passed');
        });

        test('should throw error when integration verification fails', async () => {
            state.isMultiRepo.mockReturnValue(true);
            verifyIntegration.mockResolvedValue({
                success: false,
                mismatches: [
                    {
                        type: 'endpoint_mismatch',
                        description: 'Frontend calls /api/users but backend only has /api/user',
                        backendFile: 'routes.js',
                        frontendFile: 'api.js',
                    },
                ],
            });

            await expect(runIntegrationVerification()).rejects.toThrow('Integration verification failed:');
            await expect(runIntegrationVerification()).rejects.toThrow('endpoint_mismatch: Frontend calls /api/users but backend only has /api/user');
        });

        test('should format multiple mismatches in error message', async () => {
            state.isMultiRepo.mockReturnValue(true);
            verifyIntegration.mockResolvedValue({
                success: false,
                mismatches: [
                    {
                        type: 'endpoint_mismatch',
                        description: 'Endpoint /api/v1/items not found',
                        backendFile: null,
                        frontendFile: 'services/api.ts',
                    },
                    {
                        type: 'payload_mismatch',
                        description: 'Frontend sends { name } but backend expects { title }',
                        backendFile: 'controllers/item.js',
                        frontendFile: 'components/Form.tsx',
                    },
                ],
            });

            await expect(runIntegrationVerification()).rejects.toThrow('endpoint_mismatch: Endpoint /api/v1/items not found');
            await expect(runIntegrationVerification()).rejects.toThrow('payload_mismatch: Frontend sends { name } but backend expects { title }');
        });

        test('should include fix instruction in error message', async () => {
            state.isMultiRepo.mockReturnValue(true);
            verifyIntegration.mockResolvedValue({
                success: false,
                mismatches: [{ type: 'test', description: 'test issue', backendFile: null, frontendFile: null }],
            });

            await expect(runIntegrationVerification()).rejects.toThrow('Please fix the API mismatches before proceeding.');
        });

        test('should call integration verification after fix-branch in step7', async () => {
            state.isMultiRepo.mockReturnValue(true);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });
            execSync.mockReturnValue('M src/test.js');
            verifyIntegration.mockResolvedValue({ success: true, mismatches: [] });

            await step7();

            expect(runFixBranch).toHaveBeenCalled();
            expect(verifyIntegration).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('✅ Step 7 completed - Critical review passed!');
        });

        test('should fail step7 when integration verification fails', async () => {
            state.isMultiRepo.mockReturnValue(true);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
                if (filePath.includes('newbranch.txt')) return true;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return false;
            });
            execSync.mockReturnValue('M src/test.js');
            verifyIntegration.mockResolvedValue({
                success: false,
                mismatches: [{ type: 'test_error', description: 'API mismatch detected', backendFile: null, frontendFile: null }],
            });

            await expect(step7()).rejects.toThrow('Integration verification failed:');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Step 7 failed:'));
        });

        test('should not run integration verification when step7 skips for existing passed file', async () => {
            state.isMultiRepo.mockReturnValue(true);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return true;
                return false;
            });

            await step7();

            expect(verifyIntegration).not.toHaveBeenCalled();
        });

        test('should use state.getRepository to get paths', async () => {
            state.isMultiRepo.mockReturnValue(true);
            state.getRepository.mockImplementation((scope) => {
                if (scope === 'backend') return '/custom/backend/path';
                if (scope === 'frontend') return '/custom/frontend/path';
                return '/default';
            });
            verifyIntegration.mockResolvedValue({ success: true, mismatches: [] });

            await runIntegrationVerification();

            expect(state.getRepository).toHaveBeenCalledWith('backend');
            expect(state.getRepository).toHaveBeenCalledWith('frontend');
            expect(verifyIntegration).toHaveBeenCalledWith({
                backendPath: '/custom/backend/path',
                frontendPath: '/custom/frontend/path',
            });
        });
    });
});
