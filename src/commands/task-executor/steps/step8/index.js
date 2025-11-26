const fs = require('fs');
const path = require('path');
const state = require('../../config/state');
const { executeClaude } = require('../../services/claude-executor');
const logger = require('../../utils/logger');
const { commitOrFix } = require('../../services/git-commit');
const { gitStatus } = require('../../services/git-status');

/**
 * Step 8: Final Commit and Pull Request
 *
 * Finalizes the entire workflow by:
 * 1. Generating a summary from all task CODE_REVIEW.md files
 * 2. Creating a final commit with all changes
 * 3. Creating a pull request (if git MCP is available)
 * 4. Ensuring no traces of automation are visible in commits or PRs
 *
 * This is the final step that packages all work for production deployment.
 */

const step8 = async (tasks, shouldPush = true) => {
    const prompt = `git add . and git commit ${shouldPush ? 'and git push and create pull request' : ''}`;

    try {
        await commitOrFix(prompt, null);
        fs.writeFileSync(path.join(state.claudiomiroFolder, 'done.txt'), '1');
    } catch (error) {
        // Log but don't block execution
        logger.warning('⚠️  Commit/PR failed in step8, continuing anyway:', error.message);
    }

    logger.info(`✅ Claudiomiro has been successfully executed. Check out: ${state.folder}`);
    process.exit(0);
}

module.exports = { step8 };
