const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('./claude-executor');

const commitOrFix = async (prompt, taskName = null) => {
    logger.stopSpinner();
    logger.info('Git committing via Claude...');

    try {
        await executeClaude(
            `${prompt}\n\n` +
            `HARD RULES:\n` +
            ` - NEVER mention that you are an AI model\n` +
            ` - NEVER mention Authored or Co-Authored\n` +
            ` - NEVER mention any AI model (example: Claude, ChatGPT, GLM, Deepseek)\n` +
            ` - The Authorship must be the user and only the user\n` +
            ` - NOBODY can know that AI was used\n` +
            ` - If you need to commit, use git commit -m "message"\n` +
            ` - If you need to push, use git push\n` +
            ` - If you need to create a PR, use the available git tools (GitHub, GitLab, etc.)\n`,
            taskName
        );

        logger.newline();
        logger.newline();
        logger.separator();
        logger.success('Git commit/PR process completed');
        return true;
    } catch (e) {
        logger.warning(`⚠️  Git commit/PR process failed: ${e.message}`);
        return true;
    }
}

module.exports = { commitOrFix };