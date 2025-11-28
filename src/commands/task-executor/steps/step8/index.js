const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { smartCommit } = require('../../../../shared/services/git-commit');

/**
 * Step 8: Final Commit and Pull Request
 *
 * Finalizes the entire workflow by:
 * 1. Generating a summary from all task CODE_REVIEW.md files
 * 2. Creating a final commit with all changes (using Ollama for message, shell for git)
 * 3. Creating a pull request (if shouldPush is true, falls back to Claude for PR)
 * 4. Ensuring no traces of automation are visible in commits or PRs
 *
 * Token optimization: Uses shell + Ollama for commits, only falls back to Claude on errors or for PR creation.
 */

const step8 = async (tasks, shouldPush = true) => {
    try {
        // Use smartCommit: tries shell + Ollama first, falls back to Claude on error
        const commitResult = await smartCommit({
            taskName: null, // Final commit, no specific task
            shouldPush,
            createPR: shouldPush, // Create PR if pushing
        });

        if (commitResult.method === 'shell') {
            logger.info('📦 Final commit via shell (saved Claude tokens)');
        } else if (commitResult.method === 'claude') {
            logger.info('📦 Final commit/PR via Claude');
        }

        fs.writeFileSync(path.join(state.claudiomiroFolder, 'done.txt'), '1');
    } catch (error) {
        // Log but don't block execution
        logger.warning('⚠️  Commit/PR failed in step8, continuing anyway:', error.message);
    }

    logger.info(`✅ Claudiomiro has been successfully executed. Check out: ${state.folder}`);
    process.exit(0);
};

module.exports = { step8 };
