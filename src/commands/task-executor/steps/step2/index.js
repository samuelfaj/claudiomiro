const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

/**
 * Step 2: Task Decomposition
 * Decomposes AI_PROMPT.md into individual tasks (TASK0, TASK1, etc.)
 */
const step2 = async () => {
    const folder = (file) => path.join(state.claudiomiroFolder, file);

    logger.newline();
    logger.startSpinner('Creating tasks...');

    const replace = (text) => {
        return text.replaceAll(`{{claudiomiroFolder}}`, `${state.claudiomiroFolder}`);
    }

    const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
    await executeClaude(replace(prompt));

    logger.stopSpinner();
    logger.success('Tasks created successfully');

    // Check if tasks were created, but only in non-test environment
    if (process.env.NODE_ENV !== 'test') {
        if (
            !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK0')) &&
            !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK1'))
        ) {
            throw new Error('Error creating tasks')
        }
    }
}

module.exports = { step2 };
