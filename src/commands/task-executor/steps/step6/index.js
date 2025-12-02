const fs = require('fs');
const path = require('path');
const { reviewCode } = require('./review-code');
const { reanalyzeBlocked } = require('./reanalyze-blocked');
const { smartCommit } = require('../../../../shared/services/git-commit');
const { isCompletedFromExecution } = require('../../utils/validation');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const { curateInsights } = require('./curate-insights');

/**
 * Commits changes based on task scope for multi-repo support
 * @param {string} task - Task identifier
 * @param {string|null} scope - Task scope ('backend', 'frontend', 'integration', or null)
 * @param {string} commitMessage - Commit message (taskName)
 * @param {boolean} shouldPush - Whether to push changes to remote
 */
const commitForScope = async (task, scope, commitMessage, shouldPush) => {
    if (!state.isMultiRepo()) {
        // Single-repo mode: commit to default folder
        await smartCommit({ taskName: task, shouldPush, createPR: false });
        return;
    }

    const gitMode = state.getGitMode();

    const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
    const stateManager = ParallelStateManager.getInstance();
    const isUIActive = stateManager && stateManager.isUIRendererActive();

    if (gitMode === 'monorepo') {
        // Monorepo: single commit covers both repos
        await smartCommit({ taskName: task, shouldPush, createPR: false });
        if (!isUIActive) logger.info(`Committed ${task} to monorepo`);
        return;
    }

    // Separate repos: commit based on scope
    switch (scope) {
        case 'backend':
            await smartCommit({
                cwd: state.getRepository('backend'),
                taskName: task,
                shouldPush,
                createPR: false,
            });
            if (!isUIActive) logger.info(`Committed ${task} to backend repo`);
            break;

        case 'frontend':
            await smartCommit({
                cwd: state.getRepository('frontend'),
                taskName: task,
                shouldPush,
                createPR: false,
            });
            if (!isUIActive) logger.info(`Committed ${task} to frontend repo`);
            break;

        case 'integration':
            // Integration: commit to both (backend first per clarification)
            await smartCommit({
                cwd: state.getRepository('backend'),
                taskName: task,
                shouldPush,
                createPR: false,
            });
            if (!isUIActive) logger.info(`Committed ${task} to backend repo`);

            await smartCommit({
                cwd: state.getRepository('frontend'),
                taskName: task,
                shouldPush,
                createPR: false,
            });
            if (!isUIActive) logger.info(`Committed ${task} to frontend repo`);
            break;
    }
};

/**
 * Step 6: Code Review
 *
 * Performs comprehensive code review of implemented tasks:
 * 1. Reviews code for completeness, correctness, and quality
 * 2. If task is blocked multiple times, performs deep re-analysis
 * 3. Commits approved changes to version control
 *
 * Uses BLUEPRINT.md + execution.json flow
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @param {boolean} shouldPush - Whether to push changes to remote
 * @returns {Promise} Result of the review process
 */
const step6 = async (task, shouldPush = true) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    // Require execution.json to exist
    const executionPath = folder('execution.json');
    if (!fs.existsSync(executionPath)) {
        throw new Error(`execution.json not found for task ${task}. Step 4 must generate execution.json.`);
    }

    // Perform main code review
    const reviewResult = await reviewCode(task);

    // Check if implementation is complete from execution.json
    const completionResult = isCompletedFromExecution(executionPath);
    if (completionResult.completed) {
        try {
            // Parse scope for multi-repo commit routing from BLUEPRINT.md
            const blueprintPath = folder('BLUEPRINT.md');
            const blueprintContent = fs.existsSync(blueprintPath) ? fs.readFileSync(blueprintPath, 'utf-8') : '';
            const scope = parseTaskScope(blueprintContent);

            // Validate scope in multi-repo mode
            if (state.isMultiRepo()) {
                validateScope(scope, true);
            }

            // Use scope-aware commit
            await commitForScope(task, scope, task, shouldPush);

            const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
            const stateManager = ParallelStateManager.getInstance();
            const isUIActive = stateManager && stateManager.isUIRendererActive();

            if (!isUIActive) {
                logger.debug('[Step6] Commit completed');
            }
            try {
                await curateInsights(task, {
                    executionPath: executionPath,
                    blueprintPath: folder('BLUEPRINT.md'),
                    codeReviewPath: folder('CODE_REVIEW.md'),
                    reflectionPath: folder('REFLECTION.md'),
                });
            } catch (curationError) {
                if (!isUIActive) {
                    logger.warning(`[Step6] Insight curation skipped: ${curationError.message}`);
                }
            }
        } catch (error) {
            // Log but don't block execution
            const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
            const stateManager = ParallelStateManager.getInstance();
            if (!stateManager || !stateManager.isUIRendererActive()) {
                logger.warning('⚠️  Commit failed in step6, continuing anyway:', error.message);
            }
        }
    } else {
        // If task is blocked, check if we need deep re-analysis
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
        const attempts = execution.attempts || 0;
        // Every 3 attempts, perform re-analysis
        if (attempts > 0 && attempts % 3 === 0) {
            await reanalyzeBlocked(task);
        }
    }

    return reviewResult;
};

module.exports = { step6 };
