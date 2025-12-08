const fs = require('fs');
const path = require('path');
const state = require('../../shared/config/state');
const { executeClaude } = require('../../shared/executors/claude-executor');
const logger = require('../../shared/utils/logger');
const { getLocalLLMService } = require('../../shared/services/local-llm');

/**
 * Pre-analyzes the fix context using Local LLM to provide hints
 * @param {string} userPrompt - The user's prompt
 * @param {number} pendingBefore - Pending items before this iteration
 * @param {number} pendingAfter - Pending items after last iteration (if available)
 * @param {string} lastError - Last error encountered (if any)
 * @returns {Promise<string>} Analysis context for this iteration
 */
const preAnalyzeFixContext = async (userPrompt, pendingBefore, pendingAfter, lastError) => {
    const llm = getLocalLLMService();
    if (!llm) return '';

    try {
        await llm.initialize();
        if (!llm.isAvailable()) return '';

        // Only analyze if we're not making progress (stuck)
        if (pendingAfter !== null && pendingBefore <= pendingAfter && lastError) {
            const validation = await llm.validateFix(
                userPrompt,
                `${pendingBefore} pending items before, ${pendingAfter} after`,
                lastError,
            );

            if (validation && validation.issues && validation.issues.length > 0) {
                let analysis = '\n\n## Progress Analysis (Local LLM)\n';
                analysis += '*Detected potential issues with previous fix approach:*\n';
                analysis += validation.issues.map(i => `- ${i}`).join('\n') + '\n';
                if (validation.recommendation) {
                    analysis += `**Recommendation:** ${validation.recommendation}\n`;
                }

                logger.debug('[LoopFixes] Local LLM analysis provided');
                return analysis;
            }
        }
    } catch (error) {
        logger.debug(`[LoopFixes] Local LLM analysis failed: ${error.message}`);
    }

    return '';
};

/**
 * Count pending items in CRITICAL_REVIEW_TODO.md
 * Counts lines that match `- [ ]` pattern (unchecked items)
 *
 * @param {string} bugsPath - Path to CRITICAL_REVIEW_TODO.md file
 * @returns {number} Count of pending items
 */
const countPendingItems = (bugsPath) => {
    if (!fs.existsSync(bugsPath)) {
        return 0;
    }

    try {
        const content = fs.readFileSync(bugsPath, 'utf-8');
        const matches = content.match(/- \[ \]/g);
        return matches ? matches.length : 0;
    } catch (error) {
        logger.warning(`Could not read CRITICAL_REVIEW_TODO.md: ${error.message}`);
        return 0;
    }
};

/**
 * Count completed items in CRITICAL_REVIEW_TODO.md
 * Counts lines that match `- [x]` pattern (checked items)
 *
 * @param {string} bugsPath - Path to CRITICAL_REVIEW_TODO.md file
 * @returns {number} Count of completed items
 */
const countCompletedItems = (bugsPath) => {
    if (!fs.existsSync(bugsPath)) {
        return 0;
    }

    try {
        const content = fs.readFileSync(bugsPath, 'utf-8');
        const matches = content.match(/- \[x\]/gi);
        return matches ? matches.length : 0;
    } catch (error) {
        logger.warning(`Could not read CRITICAL_REVIEW_TODO.md: ${error.message}`);
        return 0;
    }
};

/**
 * Get the loop-fixes working folder path
 * @returns {string} Path to .claudiomiro/loop-fixes
 */
const getLoopFixesFolder = () => {
    if (!state.claudiomiroRoot) {
        state.setFolder(process.cwd());
    }
    return path.join(state.claudiomiroRoot, 'loop-fixes');
};

/**
 * Initialize the .claudiomiro/loop-fixes folder
 * Only clears the loop-fixes subfolder, not the entire .claudiomiro folder
 */
const initializeFolder = (clearFolder = false) => {
    if (!state.claudiomiroRoot) {
        state.setFolder(process.cwd());
    }

    const loopFixesFolder = getLoopFixesFolder();

    if (clearFolder) {
        // Only clear the loop-fixes subfolder, not the entire .claudiomiro folder
        if (fs.existsSync(loopFixesFolder)) {
            fs.rmSync(loopFixesFolder, { recursive: true });
        }
    }

    // Ensure .claudiomiro parent folder exists
    if (!fs.existsSync(state.claudiomiroRoot)) {
        fs.mkdirSync(state.claudiomiroRoot, { recursive: true });
    }

    // Ensure loop-fixes subfolder exists
    if (!fs.existsSync(loopFixesFolder)) {
        fs.mkdirSync(loopFixesFolder, { recursive: true });
    }
};

/**
 * Loop Fixes Command
 *
 * Executes a self-correcting loop that:
 * 1. Takes a user prompt describing what to check/fix
 * 2. Creates/updates CRITICAL_REVIEW_TODO.md with findings
 * 3. Fixes issues found
 * 4. When Claude creates CRITICAL_REVIEW_OVERVIEW.md, enters verification mode
 * 5. Verification checks if there are new issues missed
 * 6. Only completes when verification confirms no new tasks (CRITICAL_REVIEW_PASSED.md)
 *
 * @param {string} userPrompt - The user's prompt describing what to check/fix
 * @param {number} maxIterations - Maximum number of iterations (default: 20)
 * @param {Object} options - Optional settings
 * @param {boolean} options.clearFolder - Whether to clear .claudiomiro folder before starting (default: true)
 * @param {string} options.model - Model to use ('fast', 'medium', 'hard')
 * @returns {Promise<void>}
 */
const loopFixes = async (userPrompt, maxIterations = 20, options = { freshStart: false }) => {
    const { clearFolder = true, model } = options;

    // Validate inputs
    if (!userPrompt || !userPrompt.trim()) {
        throw new Error('A prompt is required for loop-fixes command.');
    }

    // Initialize folder
    initializeFolder(clearFolder);

    // Get the loop-fixes working folder
    const loopFixesFolder = getLoopFixesFolder();

    // Define paths (all files go into .claudiomiro/loop-fixes/)
    const bugsPath = path.join(loopFixesFolder, 'CRITICAL_REVIEW_TODO.md');
    const overviewPath = path.join(loopFixesFolder, 'CRITICAL_REVIEW_OVERVIEW.md');
    const passedPath = path.join(loopFixesFolder, 'CRITICAL_REVIEW_PASSED.md');
    const failedPath = path.join(loopFixesFolder, 'CRITICAL_REVIEW_FAILED.md');

    if (options.freshStart) {
        try {
            fs.unlinkSync(bugsPath);
        } catch (error) {
            logger.warning(`Could not delete CRITICAL_REVIEW_TODO.md: ${error.message}`);
        }

        try {
            fs.unlinkSync(overviewPath);
        } catch (error) {
            logger.warning(`Could not delete CRITICAL_REVIEW_OVERVIEW.md: ${error.message}`);
        }

        try {
            fs.unlinkSync(passedPath);
        } catch (error) {
            logger.warning(`Could not delete CRITICAL_REVIEW_PASSED.md: ${error.message}`);
        }
    }

    logger.info('🔄 Starting loop-fixes...');
    logger.info(`📝 Prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}"`);

    // Early exit: Check if work is already complete
    // If CRITICAL_REVIEW_PASSED.md exists AND no pending items, skip entire loop
    if (fs.existsSync(passedPath)) {
        logger.success('✅ Loop-fixes already completed - CRITICAL_REVIEW_PASSED.md exists with no pending issues');
        logger.info('💡 Skipping loop - previous verification already passed');

        // Log summary if available
        if (fs.existsSync(bugsPath)) {
            try {
                const completedCount = countCompletedItems(bugsPath);
                if (completedCount > 0) {
                    logger.info(`📊 Previous summary: ${completedCount} issue(s) already fixed`);
                }
            } catch (error) {
                logger.debug(`Could not read CRITICAL_REVIEW_TODO.md summary: ${error.message}`);
            }
        }

        return; // Exit early - work is done
    }

    // Show max iterations info
    if (maxIterations === Infinity) {
        logger.info('🔄 Max iterations: unlimited (--no-limit)');
    } else {
        logger.info(`🔄 Max iterations: ${maxIterations}`);
    }

    // Load prompt templates
    const promptPath = path.join(__dirname, 'prompt.md');
    if (!fs.existsSync(promptPath)) {
        throw new Error('Loop-fixes prompt.md not found');
    }

    const verificationPromptPath = path.join(__dirname, 'verification-prompt.md');
    if (!fs.existsSync(verificationPromptPath)) {
        throw new Error('Loop-fixes verification-prompt.md not found');
    }

    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    const verificationPromptTemplate = fs.readFileSync(verificationPromptPath, 'utf-8');
    const shellCommandRule = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'), 'utf-8');

    // Track progress for Local LLM analysis
    let previousPendingCount = null;
    let lastIterationError = '';

    // Self-correction loop
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        // Verification state
        let isVerificationPhase = fs.existsSync(overviewPath);

        const iterationDisplay = maxIterations === Infinity ? `${iteration}` : `${iteration}/${maxIterations}`;

        // Choose prompt based on mode
        let prompt;
        if (isVerificationPhase) {
            logger.info(`\n🔍 Verification Iteration ${iterationDisplay} - ${isVerificationPhase ? 'Verification' : 'Fixing'}`);

            prompt = verificationPromptTemplate
                .replace(/\{\{userPrompt\}\}/g, userPrompt)
                .replace(/\{\{bugsPath\}\}/g, bugsPath)
                .replace(/\{\{passedPath\}\}/g, passedPath)
                .replace(/\{\{failedPath\}\}/g, failedPath)
                .replace(/\{\{claudiomiroFolder\}\}/g, loopFixesFolder);

            logger.startSpinner('Verifying if there are new tasks...');
        } else {
            logger.info(`\n🔄 Iteration ${iterationDisplay}`);

            // Count pending items before execution
            const pendingBefore = countPendingItems(bugsPath);

            // Get Local LLM analysis if we're not making progress
            let analysisContext = '';
            if (iteration > 1 && previousPendingCount !== null) {
                analysisContext = await preAnalyzeFixContext(
                    userPrompt,
                    previousPendingCount,
                    pendingBefore,
                    lastIterationError,
                );
            }

            prompt = promptTemplate
                .replace(/\{\{iteration\}\}/g, iteration)
                .replace(/\{\{maxIterations\}\}/g, maxIterations === Infinity ? 'unlimited' : maxIterations)
                .replace(/\{\{userPrompt\}\}/g, userPrompt)
                .replace(/\{\{bugsPath\}\}/g, bugsPath)
                .replace(/\{\{overviewPath\}\}/g, overviewPath)
                .replace(/\{\{claudiomiroFolder\}\}/g, loopFixesFolder);

            // Append analysis context if available
            if (analysisContext) {
                prompt += analysisContext;
            }

            // Update tracking for next iteration
            previousPendingCount = pendingBefore;

            logger.startSpinner('Analyzing and fixing issues...');
        }

        try {
            // Pass model option if specified
            const claudeOptions = model ? { model } : undefined;
            await executeClaude(prompt + '\n\n' + shellCommandRule, null, claudeOptions);
            lastIterationError = ''; // Clear error on success
        } catch (error) {
            logger.stopSpinner();
            lastIterationError = error.message;
            logger.error(`Claude execution failed on iteration ${iteration}: ${error.message}`);
            throw new Error(`Loop-fixes failed during iteration ${iteration}: ${error.message}`);
        }
        logger.stopSpinner();

        // Check results based on mode
        if (isVerificationPhase) {
            // Verification mode - check for CRITICAL_REVIEW_PASSED.md
            if (fs.existsSync(passedPath)) {
                // Verification passed - no new tasks found!
                logger.success('✅ Verification passed! No new tasks found.');
                logger.success('✅ Loop completed!');

                // Log summary
                if (fs.existsSync(bugsPath)) {
                    try {
                        const completedCount = countCompletedItems(bugsPath);
                        if (completedCount > 0) {
                            logger.info(`📊 Summary: ${completedCount} issue(s) fixed across ${iteration} iteration(s)`);
                        }
                    } catch (error) {
                        logger.warning(`Could not read CRITICAL_REVIEW_TODO.md for summary: ${error.message}`);
                    }
                }

                return;
            }

            // Check if there are actually new pending items
            const pendingAfterVerification = countPendingItems(bugsPath);

            if (pendingAfterVerification > 0) {
                // Verification found new tasks - exit verification mode, continue loop
                logger.info(`🔧 Verification found ${pendingAfterVerification} new task(s). Continuing fixes...`);
                isVerificationPhase = false;

                // Delete CRITICAL_REVIEW_OVERVIEW.md to exit verification mode
                try {
                    fs.unlinkSync(overviewPath);
                } catch (error) {
                    logger.warning(`Could not delete CRITICAL_REVIEW_OVERVIEW.md: ${error.message}`);
                }
            } else {
                // No pending items but CRITICAL_REVIEW_PASSED.md was not created
                // This means Claude didn't create the file - create it to finalize the loop
                logger.warning('⚠️ No pending items found but CRITICAL_REVIEW_PASSED.md was not created.');
                logger.info('📝 Creating CRITICAL_REVIEW_PASSED.md to finalize loop...');

                const completedCount = countCompletedItems(bugsPath);
                const passedContent = `# Critical Review Passed

**Verification Date**: ${new Date().toISOString()}
**User Request**: ${userPrompt}

## Result

✅ **No new tasks found.**

All issues matching the user's request have been identified and addressed in previous iterations.

## Verification Summary

- Total issues in CRITICAL_REVIEW_TODO.md: ${completedCount}
- Completed issues: ${completedCount}

## Conclusion

The codebase has been thoroughly analyzed. No additional issues matching the user's request were found.

*Note: This file was auto-generated because Claude did not create it despite no pending items.*
`;
                fs.writeFileSync(passedPath, passedContent, 'utf-8');

                logger.success('✅ Loop completed!');
                logger.info(`📊 Summary: ${completedCount} issue(s) fixed across ${iteration} iteration(s)`);
                return;
            }
        }

        // Check CRITICAL_REVIEW_TODO.md status
        const pendingAfter = countPendingItems(bugsPath);
        const completedCount = countCompletedItems(bugsPath);

        logger.info(`📋 Issues tracked: ${completedCount} fixed, ${pendingAfter} pending`);

        // Continue to next iteration
        logger.info('🔧 Continuing to next iteration...');
    }

    // Max iterations reached - still have issues
    const maxIterDisplay = maxIterations === Infinity ? 'unlimited' : maxIterations;
    logger.error(`❌ Max iterations (${maxIterDisplay}) reached`);

    if (fs.existsSync(bugsPath)) {
        logger.error('📋 See CRITICAL_REVIEW_TODO.md for details on remaining issues');
        try {
            const bugsContent = fs.readFileSync(bugsPath, 'utf-8');
            logger.error(`\n${bugsContent}`);
        } catch (error) {
            logger.error(`Could not read CRITICAL_REVIEW_TODO.md: ${error.message}`);
        }
    }

    throw new Error(`Loop-fixes did not complete after ${maxIterDisplay} iterations. Check CRITICAL_REVIEW_TODO.md for remaining issues.`);
};

module.exports = { loopFixes, countPendingItems, countCompletedItems, initializeFolder, getLoopFixesFolder };
