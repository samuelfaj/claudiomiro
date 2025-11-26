const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const state = require('../../config/state');
const { executeClaude } = require('../../services/claude-executor');
const logger = require('../../utils/logger');

/**
 * Step 7: Global Critical Bug Sweep
 *
 * Performs a final critical analysis of ALL code changes in the branch:
 * 1. Analyzes git diff between current branch and base branch
 * 2. Hunts for CRITICAL severity bugs only (security, production-breaking issues)
 * 3. Self-corrects bugs in a loop until 0 critical bugs remain
 * 4. Generates BUGS.md to track progress and prevent infinite loops
 * 5. Creates CRITICAL_REVIEW_PASSED.md when complete
 *
 * This step runs ONCE after ALL tasks are completed, before step8 (final commit/PR).
 * It acts as a final safety net to catch critical bugs introduced across all tasks.
 *
 * @param {number} maxIterations - Maximum number of iterations (from --limit or --no-limit flags)
 * @returns {Promise<void>}
 */
const step7 = async (maxIterations = 20) => {
    // Validate state
    if (!state.claudiomiroFolder) {
        throw new Error('state.claudiomiroFolder is not defined. Cannot run step7.');
    }

    const bugsPath = path.join(state.claudiomiroFolder, 'BUGS.md');
    const passedPath = path.join(state.claudiomiroFolder, 'CRITICAL_REVIEW_PASSED.md');

    // CRITICAL: Verify this is a Claudiomiro-managed session on a NEW branch
    // Step7 should only analyze changes made by Claudiomiro in THIS session

    // Check 1: Already passed? (fast check, avoids other validations)
    if (fs.existsSync(passedPath)) {
        logger.info('✅ Critical review already passed (CRITICAL_REVIEW_PASSED.md exists)');
        return;
    }

    // Check 2: This branch was created by Claudiomiro? (CRITICAL - fail fast)
    // newbranch.txt is created by step0 when sameBranch=false
    const newBranchMarkerPath = path.join(state.claudiomiroFolder, 'newbranch.txt');
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
    const aiPromptPath = path.join(state.claudiomiroFolder, 'AI_PROMPT.md');
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

    // Show max iterations info
    if (maxIterations === Infinity) {
        logger.info('🔄 Max iterations: unlimited (--no-limit)');
    } else {
        logger.info(`🔄 Max iterations: ${maxIterations}`);
    }

    // Load prompt template
    const promptPath = path.join(__dirname, 'prompt.md');
    if (!fs.existsSync(promptPath)) {
        throw new Error('Step 7 prompt.md not found');
    }

    let promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Self-correction loop
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        const iterationDisplay = maxIterations === Infinity ? `${iteration}` : `${iteration}/${maxIterations}`;
        logger.info(`\n🔄 Iteration ${iterationDisplay}`);

        // Replace placeholders
        const prompt = promptTemplate
            .replace(/\{\{iteration\}\}/g, iteration)
            .replace(/\{\{maxIterations\}\}/g, maxIterations === Infinity ? 'unlimited' : maxIterations)
            .replace(/\{\{bugsPath\}\}/g, bugsPath)
            .replace(/\{\{passedPath\}\}/g, passedPath)
            .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder)
            .replace(/\{\{branch\}\}/g, state.branch || 'HEAD');

        logger.startSpinner(`Analyzing code changes for critical bugs...`);
        try {
            await executeClaude(prompt);
        } catch (error) {
            logger.stopSpinner();
            logger.error(`⚠️  Claude execution failed on iteration ${iteration}: ${error.message}`);
            throw new Error(`Step 7 failed during iteration ${iteration}: ${error.message}`);
        }
        logger.stopSpinner();

        // Check if CRITICAL_REVIEW_PASSED.md was created
        if (fs.existsSync(passedPath)) {
            logger.success('✅ No critical bugs found - Review passed!');

            // Log summary
            if (fs.existsSync(bugsPath)) {
                try {
                    const bugsContent = fs.readFileSync(bugsPath, 'utf-8');
                    const fixedCount = (bugsContent.match(/Status: FIXED/gi) || []).length;
                    if (fixedCount > 0) {
                        logger.info(`📊 Summary: ${fixedCount} critical bug(s) fixed across ${iteration} iteration(s)`);
                    }
                } catch (error) {
                    logger.warning(`⚠️  Could not read BUGS.md for summary: ${error.message}`);
                }
            }

            return;
        }

        // Check if BUGS.md was updated
        if (!fs.existsSync(bugsPath)) {
            logger.warning('⚠️  BUGS.md not found - Claude may not have detected or documented bugs properly');
        } else {
            try {
                const bugsContent = fs.readFileSync(bugsPath, 'utf-8');
                const pendingCount = (bugsContent.match(/Status: PENDING/gi) || []).length;
                const fixedCount = (bugsContent.match(/Status: FIXED/gi) || []).length;

                logger.info(`📋 Bugs tracked: ${fixedCount} fixed, ${pendingCount} pending`);

                if (pendingCount === 0 && fixedCount === 0) {
                    logger.warning('⚠️  BUGS.md exists but has no bugs listed - unexpected state');
                }
            } catch (error) {
                logger.warning(`⚠️  Could not read BUGS.md: ${error.message}`);
            }
        }

        // Continue to next iteration
        logger.info('🔧 Continuing to next iteration for bug fixes...');
    }

    // Max iterations reached - still have bugs
    const maxIterDisplay = maxIterations === Infinity ? 'unlimited' : maxIterations;
    logger.error(`❌ Max iterations (${maxIterDisplay}) reached with critical bugs remaining`);

    if (fs.existsSync(bugsPath)) {
        logger.error('📋 See BUGS.md for details on remaining critical bugs');
        try {
            const bugsContent = fs.readFileSync(bugsPath, 'utf-8');
            logger.error(`\n${bugsContent}`);
        } catch (error) {
            logger.error(`⚠️  Could not read BUGS.md: ${error.message}`);
        }
    }

    throw new Error(`Critical bugs still present after ${maxIterDisplay} iterations. Manual intervention required.`);
};

module.exports = { step7 };
