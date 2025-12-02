const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { generateLegacySystemContext } = require('../../../../shared/services/legacy-system');
const {
    getStatePaths,
    countPendingItems,
    countCompletedItems,
    isVerificationPassed,
    deleteOverview,
    createPassedFile,
} = require('./state-manager');

/**
 * Generates multi-repository context section for AI_PROMPT.md
 * @returns {string} Multi-repo context markdown or empty string for single-repo mode
 */
const generateMultiRepoContext = () => {
    if (!state.isMultiRepo()) {
        return '';
    }

    return `
## Multi-Repository Context

This project uses multiple repositories:

- **Backend Repository:** \`${state.getRepository('backend')}\`
- **Frontend Repository:** \`${state.getRepository('frontend')}\`
- **Git Mode:** ${state.getGitMode()}

### Task Scope Requirements

**IMPORTANT:** Every task MUST include an \`@scope\` tag on the second line of TASK.md:

\`\`\`markdown
@dependencies [TASK0]
@scope backend

# Task Title
...
\`\`\`

Valid scopes:
- \`@scope backend\` - Task modifies only backend code
- \`@scope frontend\` - Task modifies only frontend code
- \`@scope integration\` - Task requires changes to both repositories or verifies integration

Tasks without @scope will fail validation in multi-repo mode.
`;
};

/**
 * Run refinement loop to ensure AI_PROMPT.md is 100% complete
 * Two-phase loop: Refinement → Verification
 *
 * @param {number} maxIterations - Maximum number of iterations
 * @returns {Promise<void>}
 */
const runRefinementLoop = async (maxIterations) => {
    const { todoPath, overviewPath, passedPath } = getStatePaths();

    // Early exit if already verified
    if (isVerificationPassed()) {
        logger.success('AI_PROMPT.md already verified, skipping refinement');
        return;
    }

    logger.newline();
    logger.info('Starting AI_PROMPT.md refinement loop...');

    if (maxIterations === Infinity) {
        logger.info('Max iterations: unlimited (--no-limit)');
    } else {
        logger.info(`Max iterations: ${maxIterations}`);
    }

    // Load prompt templates
    const refinementPromptPath = path.join(__dirname, 'refinement-prompt.md');
    const verificationPromptPath = path.join(__dirname, 'verification-prompt.md');

    if (!fs.existsSync(refinementPromptPath)) {
        throw new Error('refinement-prompt.md not found');
    }

    if (!fs.existsSync(verificationPromptPath)) {
        throw new Error('verification-prompt.md not found');
    }

    const refinementPromptTemplate = fs.readFileSync(refinementPromptPath, 'utf-8');
    const verificationPromptTemplate = fs.readFileSync(verificationPromptPath, 'utf-8');

    // Main loop
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        const isVerificationPhase = fs.existsSync(overviewPath);
        const iterationDisplay = maxIterations === Infinity ? `${iteration}` : `${iteration}/${maxIterations}`;

        let prompt;
        if (isVerificationPhase) {
            // Phase 2: Verification
            logger.info(`\nVerification iteration ${iterationDisplay}`);

            prompt = verificationPromptTemplate
                .replace(/\{\{todoPath\}\}/g, todoPath)
                .replace(/\{\{passedPath\}\}/g, passedPath)
                .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder);

            logger.startSpinner('Verifying AI_PROMPT.md completeness...');
        } else {
            // Phase 1: Refinement
            logger.info(`\nRefinement iteration ${iterationDisplay}`);

            prompt = refinementPromptTemplate
                .replace(/\{\{iteration\}\}/g, iteration)
                .replace(/\{\{maxIterations\}\}/g, maxIterations === Infinity ? 'unlimited' : maxIterations)
                .replace(/\{\{todoPath\}\}/g, todoPath)
                .replace(/\{\{overviewPath\}\}/g, overviewPath)
                .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder);

            logger.startSpinner('Refining AI_PROMPT.md...');
        }

        try {
            await executeClaude(prompt);
        } catch (error) {
            logger.stopSpinner();
            logger.error(`Refinement failed on iteration ${iteration}: ${error.message}`);
            throw new Error(`AI_PROMPT.md refinement failed: ${error.message}`);
        }

        logger.stopSpinner();

        // Check results based on mode
        if (isVerificationPhase) {
            // Verification mode - check for PASSED file
            if (fs.existsSync(passedPath)) {
                logger.success('Verification passed! AI_PROMPT.md is ready for decomposition.');

                // Log summary
                if (fs.existsSync(todoPath)) {
                    const completedCount = countCompletedItems(todoPath);
                    if (completedCount > 0) {
                        logger.info(`Summary: ${completedCount} refinement(s) made across ${iteration} iteration(s)`);
                    }
                }

                return;
            }

            // Check if new items were found
            const pendingAfterVerification = countPendingItems(todoPath);

            if (pendingAfterVerification > 0) {
                // Verification found new gaps - exit verification mode
                logger.info(`Verification found ${pendingAfterVerification} new gap(s). Continuing refinement...`);
                deleteOverview();
            } else {
                // No pending items but PASSED file not created - create it
                logger.warning('No pending items but PASSED file not created. Auto-creating...');
                const completedCount = countCompletedItems(todoPath);
                createPassedFile(completedCount, iteration);
                logger.success('AI_PROMPT.md refinement complete!');
                return;
            }
        } else {
            // Refinement mode - check progress
            const pendingCount = countPendingItems(todoPath);
            const completedCount = countCompletedItems(todoPath);

            logger.info(`Progress: ${completedCount} completed, ${pendingCount} pending`);
        }
    }

    // Max iterations reached
    const maxIterDisplay = maxIterations === Infinity ? 'unlimited' : maxIterations;
    logger.error(`Max iterations (${maxIterDisplay}) reached`);

    if (fs.existsSync(todoPath)) {
        logger.error('See PROMPT_REFINEMENT_TODO.md for remaining items');
    }

    throw new Error(`AI_PROMPT.md refinement did not complete after ${maxIterDisplay} iterations`);
};

/**
 * Step 1: Generate AI_PROMPT.md
 * Transforms user request + clarification answers into complete AI_PROMPT.md
 * Then runs refinement loop to ensure 100% completeness
 *
 * @param {boolean} sameBranch - Whether to use the same branch
 * @param {number} maxIterations - Maximum refinement iterations (default: 20)
 */
const step1 = async (sameBranch = false, maxIterations = 20) => {
    const folder = (file) => path.join(state.claudiomiroFolder, file);

    const aiPromptPath = folder('AI_PROMPT.md');

    // Generate AI_PROMPT.md if it doesn't exist
    if (!fs.existsSync(aiPromptPath)) {
        logger.newline();
        logger.startSpinner('Generating AI_PROMPT.md with clarifications...');

        // In multi-repo mode, branches are already created programmatically in step0
        const branchStep = (sameBranch || state.isMultiRepo())
            ? ''
            : '## FIRST STEP: \n\nCreate a git branch for this task\n\n';

        const taskContent = fs.existsSync(folder('INITIAL_PROMPT.md'))
            ? fs.readFileSync(folder('INITIAL_PROMPT.md'), 'utf-8')
            : '';

        const replace = (text) => {
            return text.replace('{{TASK}}', taskContent).replaceAll('{{claudiomiroFolder}}', `${state.claudiomiroFolder}`);
        };

        const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
        const multiRepoContext = generateMultiRepoContext();
        const legacyContext = generateLegacySystemContext();

        await executeClaude(replace(branchStep + prompt + multiRepoContext + legacyContext));

        logger.stopSpinner();

        if (!fs.existsSync(aiPromptPath)) {
            logger.error('AI_PROMPT.md was not created');
            throw new Error('Error creating AI_PROMPT.md file');
        }

        logger.success('AI_PROMPT.md created successfully');
    } else {
        logger.success('AI_PROMPT.md already exists, skipping generation');
    }

    // Run refinement loop to ensure AI_PROMPT.md is 100% complete
    await runRefinementLoop(maxIterations);
};

module.exports = { step1, generateMultiRepoContext, runRefinementLoop };
