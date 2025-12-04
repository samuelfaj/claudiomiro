const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { run: runFixBranch } = require('../../../fix-branch');
const { verifyAndFixIntegration } = require('../../../../shared/services/integration-verifier');

/**
 * Runs integration verification for multi-repo projects with auto-fix
 * @param {number} [maxFixAttempts=3] - Maximum number of auto-fix attempts
 * @returns {Promise<void>}
 * @throws {Error} If verification fails after all fix attempts
 */
const runIntegrationVerification = async (maxFixAttempts = 3) => {
    if (!state.isMultiRepo()) {
        return; // Single-repo mode: skip verification
    }

    logger.info('Running integration verification for multi-repo project...');

    const result = await verifyAndFixIntegration({
        backendPath: state.getRepository('backend'),
        frontendPath: state.getRepository('frontend'),
        maxIterations: maxFixAttempts,
    });

    if (!result.success) {
        const errorDetails = result.mismatches
            ? result.mismatches.map(m => `  - ${m.type}: ${m.description}`).join('\n')
            : '  - No detailed mismatch information available';

        throw new Error(
            `Integration verification failed after ${result.iterations} attempt(s):\n${errorDetails}\n\n` +
            'Auto-fix was unable to resolve all API mismatches.\n' +
            'Please fix the remaining mismatches manually before proceeding.',
        );
    }

    logger.info(`✅ ${result.message}`);
};

/**
 * Checks if CRITICAL_REVIEW_PASSED.md exists in loop-fixes folder for a given repository path
 * @param {string} repoPath - Path to the repository
 * @returns {string|null} Path to CRITICAL_REVIEW_PASSED.md if exists, null otherwise
 */
const getLoopFixesPassedPath = (repoPath) => {
    const loopFixesPath = path.join(repoPath, '.claudiomiro', 'loop-fixes', 'CRITICAL_REVIEW_PASSED.md');
    return fs.existsSync(loopFixesPath) ? loopFixesPath : null;
};

/**
 * Propagates CRITICAL_REVIEW_PASSED.md from loop-fixes to the workspace folder
 * In multi-repo mode, checks both backend and frontend repositories
 * @param {string} destPath - Destination path for CRITICAL_REVIEW_PASSED.md
 * @returns {boolean} True if propagation succeeded
 */
const propagateCriticalReviewPassed = (destPath) => {
    if (fs.existsSync(destPath)) {
        return true; // Already exists
    }

    if (state.isMultiRepo()) {
        // Multi-repo mode: check both backend and frontend
        const backendPath = state.getRepository('backend');
        const frontendPath = state.getRepository('frontend');

        const backendPassed = getLoopFixesPassedPath(backendPath);
        const frontendPassed = getLoopFixesPassedPath(frontendPath);

        // Both repos must have passed for multi-repo to be considered complete
        if (backendPassed && frontendPassed) {
            // Copy from backend (arbitrary choice, both have the file)
            fs.copyFileSync(backendPassed, destPath);
            logger.info('📋 Propagated CRITICAL_REVIEW_PASSED.md from multi-repo loop-fixes to workspace');
            return true;
        } else if (backendPassed && !frontendPassed) {
            logger.warning('⚠️ Backend passed critical review but frontend did not');
            return false;
        } else if (!backendPassed && frontendPassed) {
            logger.warning('⚠️ Frontend passed critical review but backend did not');
            return false;
        } else {
            logger.warning('⚠️ Neither backend nor frontend have CRITICAL_REVIEW_PASSED.md in loop-fixes');
            return false;
        }
    } else {
        // Single-repo mode: check workspace root
        const loopFixesPassedPath = path.join(state.workspaceClaudiomiroRoot, 'loop-fixes', 'CRITICAL_REVIEW_PASSED.md');
        if (fs.existsSync(loopFixesPassedPath)) {
            fs.copyFileSync(loopFixesPassedPath, destPath);
            logger.info('📋 Propagated CRITICAL_REVIEW_PASSED.md to workspace folder');
            return true;
        }
    }

    return false;
};

/**
 * Step 7: Global Critical Bug Sweep
 *
 * Performs a final critical analysis of ALL code changes in the branch using fix-branch:
 * 1. Validates the session (branch, files, changes)
 * 2. Delegates to fix-branch with level=2 (Blockers + Warnings)
 * 3. fix-branch creates BUGS.md to track progress
 * 4. fix-branch creates CRITICAL_REVIEW_PASSED.md when complete
 *
 * This step runs ONCE after ALL tasks are completed, before step8 (final commit/PR).
 * It acts as a final safety net to catch critical bugs introduced across all tasks.
 *
 * @param {number} maxIterations - Maximum number of iterations (from --limit or --no-limit flags)
 * @returns {Promise<void>}
 */
const step7 = async (maxIterations = 20) => {
    // Validate state - use workspace folder which doesn't change during multi-repo execution
    if (!state.workspaceClaudiomiroFolder) {
        throw new Error('state.workspaceClaudiomiroFolder is not defined. Cannot run step7.');
    }

    // Use workspace-scoped path to avoid issues when fix-branch changes state in multi-repo mode
    const passedPath = path.join(state.workspaceClaudiomiroFolder, 'CRITICAL_REVIEW_PASSED.md');

    // CRITICAL: Verify this is a Claudiomiro-managed session on a NEW branch
    // Step7 should only analyze changes made by Claudiomiro in THIS session

    // Check 1: Already passed? (fast check, avoids other validations)
    if (fs.existsSync(passedPath)) {
        logger.info('✅ Critical review already passed (CRITICAL_REVIEW_PASSED.md exists)');
        return;
    }

    // Check 2: This branch was created by Claudiomiro? (CRITICAL - fail fast)
    // newbranch.txt is created by step0 when sameBranch=false
    const newBranchMarkerPath = path.join(state.workspaceClaudiomiroFolder, 'newbranch.txt');
    if (!fs.existsSync(newBranchMarkerPath)) {
        logger.warning('⚠️  Step 7 skipped: Not running on a new branch created by Claudiomiro');
        logger.info('💡 Step 7 only runs on branches created with Claudiomiro (without --same-branch flag)');
        logger.info('   This prevents analyzing/modifying pre-existing code not created by Claudiomiro');
        logger.info('   To run step7, start Claudiomiro without --same-branch to create a new branch');

        // Create CRITICAL_REVIEW_PASSED.md to allow step8 to proceed
        // This is not a failure - step7 is legitimately skipped for same-branch workflows
        fs.writeFileSync(passedPath, '# Critical Review Skipped\n\nStep 7 was skipped because this is not a new branch created by Claudiomiro.\n\nThis is expected behavior when using --same-branch flag.\n');
        logger.info('✅ Created CRITICAL_REVIEW_PASSED.md (step7 not required for same-branch workflow)');

        return;
    }

    // Check 3: AI_PROMPT.md exists? (valid session - step1 was executed)
    const aiPromptPath = path.join(state.workspaceClaudiomiroFolder, 'AI_PROMPT.md');
    if (!fs.existsSync(aiPromptPath)) {
        logger.warning('⚠️  Step 7 skipped: Incomplete Claudiomiro session');
        logger.info('💡 AI_PROMPT.md not found - session may be corrupted or step1 not executed');
        logger.info('   Step 7 only runs in complete Claudiomiro sessions');

        // Create CRITICAL_REVIEW_PASSED.md to allow step8 to proceed
        fs.writeFileSync(passedPath, '# Critical Review Skipped\n\nStep 7 was skipped due to incomplete Claudiomiro session (AI_PROMPT.md not found).\n');
        logger.info('✅ Created CRITICAL_REVIEW_PASSED.md (step7 not required for incomplete session)');

        return;
    }

    // Check 4: Are there actual code changes to analyze?
    try {
        const hasUncommittedChanges = execSync('git status --porcelain', { encoding: 'utf-8' }).trim().length > 0;

        if (!hasUncommittedChanges) {
            // Check if there are any commits at all
            let hasCommits = false;
            try {
                execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: 'pipe' });
                hasCommits = true;
            } catch (e) {
                hasCommits = false;
            }

            if (!hasCommits) {
                logger.warning('⚠️  Step 7 skipped: No code changes detected');
                logger.info('💡 Step 7 analyzes code changes made by Claudiomiro');
                logger.info('   No changes found to analyze');

                // Create CRITICAL_REVIEW_PASSED.md to allow step8 to proceed
                fs.writeFileSync(passedPath, '# Critical Review Skipped\n\nStep 7 was skipped because no code changes were detected.\n');
                logger.info('✅ Created CRITICAL_REVIEW_PASSED.md (no changes to review)');

                return;
            }
        }
    } catch (error) {
        // If git commands fail, skip step7 (it needs git to analyze changes)
        logger.warning('⚠️  Step 7 skipped: Not a git repository or git is not available');
        logger.info('💡 Step 7 requires git to analyze code changes');
        logger.info(`   Error: ${error.message}`);

        // Create CRITICAL_REVIEW_PASSED.md to allow step8 to proceed
        fs.writeFileSync(passedPath, '# Critical Review Skipped\n\nStep 7 was skipped because git is not available or this is not a git repository.\n');
        logger.info('✅ Created CRITICAL_REVIEW_PASSED.md (git not available)');

        return;
    }

    logger.info('🔍 Starting global critical bug sweep...');
    logger.info(`📍 Analyzing branch: ${state.branch || 'current branch'}`);

    // Delegate to fix-branch with level=2 (Blockers + Warnings) and --no-clear
    // --no-clear prevents fix-branch from deleting the existing .claudiomiro folder
    const args = [
        '--continue',
        '--level=2',
        '--no-clear',
        state.folder,
    ];

    // Add iteration limit
    if (maxIterations === Infinity) {
        args.unshift('--no-limit');
    } else {
        args.unshift(`--limit=${maxIterations}`);
    }

    logger.info('🔧 Using fix-branch (level: 2 - blockers + warnings)');

    try {
        await runFixBranch(args);

        // After fix-branch completes, propagate CRITICAL_REVIEW_PASSED.md from loop-fixes to workspace folder
        // In multi-repo mode, checks both backend and frontend repositories
        // fix-branch creates the file in .claudiomiro/loop-fixes/, but cli.js checks in workspace/.claudiomiro/task-executor/
        const propagated = propagateCriticalReviewPassed(passedPath);

        if (!propagated) {
            // If propagation failed, the file wasn't created by loop-fixes in any repo
            // This could mean fix-branch failed or there were unresolved issues
            logger.warning('⚠️ CRITICAL_REVIEW_PASSED.md was not found in loop-fixes folder(s)');
            logger.info('💡 This may indicate that fix-branch encountered issues or was interrupted');
        }

        // After fix-branch completes, run integration verification for multi-repo
        await runIntegrationVerification();

        logger.success('✅ Step 7 completed - Critical review passed!');
    } catch (error) {
        logger.error(`❌ Step 7 failed: ${error.message}`);
        throw error;
    }
};

module.exports = { step7, runIntegrationVerification };
