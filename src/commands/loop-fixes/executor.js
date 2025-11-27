const fs = require('fs');
const path = require('path');
const state = require('../../shared/config/state');
const { executeClaude } = require('../../shared/executors/claude-executor');
const logger = require('../../shared/utils/logger');

/**
 * Count pending items in TODO.md
 * Counts lines that match `- [ ]` pattern (unchecked items)
 *
 * @param {string} todoPath - Path to TODO.md file
 * @returns {number} Count of pending items
 */
const countPendingItems = (todoPath) => {
    if (!fs.existsSync(todoPath)) {
        return 0;
    }

    try {
        const content = fs.readFileSync(todoPath, 'utf-8');
        const matches = content.match(/- \[ \]/g);
        return matches ? matches.length : 0;
    } catch (error) {
        logger.warning(`Could not read TODO.md: ${error.message}`);
        return 0;
    }
};

/**
 * Count completed items in TODO.md
 * Counts lines that match `- [x]` pattern (checked items)
 *
 * @param {string} todoPath - Path to TODO.md file
 * @returns {number} Count of completed items
 */
const countCompletedItems = (todoPath) => {
    if (!fs.existsSync(todoPath)) {
        return 0;
    }

    try {
        const content = fs.readFileSync(todoPath, 'utf-8');
        const matches = content.match(/- \[x\]/gi);
        return matches ? matches.length : 0;
    } catch (error) {
        logger.warning(`Could not read TODO.md: ${error.message}`);
        return 0;
    }
};

/**
 * Initialize the .claudiomiro folder
 */
const initializeFolder = (clearFolder = false) => {
    if (!state.claudiomiroFolder) {
        state.setFolder(process.cwd());
    }

    if (clearFolder) {
        if (fs.existsSync(state.claudiomiroFolder)) {
            fs.rmSync(state.claudiomiroFolder, { recursive: true });
        }
    }

    if (!fs.existsSync(state.claudiomiroFolder)) {
        fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
    }
};

/**
 * Loop Fixes Command
 *
 * Executes a self-correcting loop that:
 * 1. Takes a user prompt describing what to check/fix
 * 2. Creates/updates TODO.md with findings
 * 3. Fixes issues found
 * 4. When Claude creates OVERVIEW.md, enters verification mode
 * 5. Verification checks if there are new issues missed
 * 6. Only completes when verification confirms no new tasks
 *
 * @param {string} userPrompt - The user's prompt describing what to check/fix
 * @param {number} maxIterations - Maximum number of iterations (default: 20)
 * @returns {Promise<void>}
 */
const loopFixes = async (userPrompt, maxIterations = 20) => {
    // Validate inputs
    if (!userPrompt || !userPrompt.trim()) {
        throw new Error('A prompt is required for loop-fixes command.');
    }

    // Initialize folder
    initializeFolder(true);

    // Define paths
    const todoPath = path.join(state.claudiomiroFolder, 'TODO.md');
    const overviewPath = path.join(state.claudiomiroFolder, 'OVERVIEW.md');
    const noNewTasksPath = path.join(state.claudiomiroFolder, 'NO_NEW_TASKS.md');

    logger.info('🔄 Starting loop-fixes...');
    logger.info(`📝 Prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}"`);

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

    // Verification state
    let isVerificationPhase = false;

    // Self-correction loop
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        const iterationDisplay = maxIterations === Infinity ? `${iteration}` : `${iteration}/${maxIterations}`;

        // Delete NO_NEW_TASKS.md if exists from previous verification
        if (fs.existsSync(noNewTasksPath)) {
            try {
                fs.unlinkSync(noNewTasksPath);
            } catch (error) {
                logger.warning(`Could not delete NO_NEW_TASKS.md: ${error.message}`);
            }
        }

        // Choose prompt based on mode
        let prompt;
        if (isVerificationPhase) {
            logger.info(`\n🔍 Verification Iteration ${iterationDisplay}`);

            prompt = verificationPromptTemplate
                .replace(/\{\{userPrompt\}\}/g, userPrompt)
                .replace(/\{\{todoPath\}\}/g, todoPath)
                .replace(/\{\{noNewTasksPath\}\}/g, noNewTasksPath)
                .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder);

            logger.startSpinner('Verifying if there are new tasks...');
        } else {
            logger.info(`\n🔄 Iteration ${iterationDisplay}`);

            // Count pending items before execution
            const pendingBefore = countPendingItems(todoPath);

            prompt = promptTemplate
                .replace(/\{\{iteration\}\}/g, iteration)
                .replace(/\{\{maxIterations\}\}/g, maxIterations === Infinity ? 'unlimited' : maxIterations)
                .replace(/\{\{userPrompt\}\}/g, userPrompt)
                .replace(/\{\{todoPath\}\}/g, todoPath)
                .replace(/\{\{overviewPath\}\}/g, overviewPath)
                .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder);

            logger.startSpinner('Analyzing and fixing issues...');
        }

        try {
            await executeClaude(prompt);
        } catch (error) {
            logger.stopSpinner();
            logger.error(`Claude execution failed on iteration ${iteration}: ${error.message}`);
            throw new Error(`Loop-fixes failed during iteration ${iteration}: ${error.message}`);
        }
        logger.stopSpinner();

        // Check results based on mode
        if (isVerificationPhase) {
            // Verification mode - check for NO_NEW_TASKS.md
            if (fs.existsSync(noNewTasksPath)) {
                // Verification passed - no new tasks found!
                logger.success('✅ Verification passed! No new tasks found.');
                logger.success('✅ Loop completed!');

                // Log summary
                if (fs.existsSync(todoPath)) {
                    try {
                        const completedCount = countCompletedItems(todoPath);
                        if (completedCount > 0) {
                            logger.info(`📊 Summary: ${completedCount} issue(s) fixed across ${iteration} iteration(s)`);
                        }
                    } catch (error) {
                        logger.warning(`Could not read TODO.md for summary: ${error.message}`);
                    }
                }

                return;
            } else {
                // Verification found new tasks - exit verification mode, continue loop
                logger.info('🔧 Verification found new tasks. Continuing fixes...');
                isVerificationPhase = false;
                // Continue to next iteration (normal fix mode)
            }
        } else {
            // Normal mode - check for OVERVIEW.md
            if (fs.existsSync(overviewPath)) {
                logger.info('📋 OVERVIEW.md created. Starting verification...');

                // Delete OVERVIEW.md and enter verification mode
                try {
                    fs.unlinkSync(overviewPath);
                } catch (error) {
                    logger.warning(`Could not delete OVERVIEW.md: ${error.message}`);
                }

                isVerificationPhase = true;
                // Continue to verification iteration
            } else {
                // Check TODO.md status
                const pendingAfter = countPendingItems(todoPath);
                const completedCount = countCompletedItems(todoPath);

                logger.info(`📋 Issues tracked: ${completedCount} fixed, ${pendingAfter} pending`);

                // Continue to next iteration
                logger.info('🔧 Continuing to next iteration...');
            }
        }
    }

    // Max iterations reached - still have issues
    const maxIterDisplay = maxIterations === Infinity ? 'unlimited' : maxIterations;
    logger.error(`❌ Max iterations (${maxIterDisplay}) reached`);

    if (fs.existsSync(todoPath)) {
        logger.error('📋 See TODO.md for details on remaining issues');
        try {
            const todoContent = fs.readFileSync(todoPath, 'utf-8');
            logger.error(`\n${todoContent}`);
        } catch (error) {
            logger.error(`Could not read TODO.md: ${error.message}`);
        }
    }

    throw new Error(`Loop-fixes did not complete after ${maxIterDisplay} iterations. Check TODO.md for remaining issues.`);
};

module.exports = { loopFixes, countPendingItems, countCompletedItems, initializeFolder };
