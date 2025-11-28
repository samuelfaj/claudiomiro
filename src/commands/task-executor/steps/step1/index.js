const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

/**
 * Step 1: Generate AI_PROMPT.md
 * Transforms user request + clarification answers into complete AI_PROMPT.md
 */
const step1 = async (sameBranch = false) => {
    const folder = (file) => path.join(state.claudiomiroFolder, file);

    const aiPromptPath = folder('AI_PROMPT.md');

    // Skip if AI_PROMPT.md already exists
    if (fs.existsSync(aiPromptPath)) {
        logger.success('AI_PROMPT.md already exists, skipping generation');
        return;
    }

    logger.newline();
    logger.startSpinner('Generating AI_PROMPT.md with clarifications...');

    const branchStep = sameBranch
        ? ''
        : '## FIRST STEP: \n\nCreate a git branch for this task\n\n';

    const taskContent = fs.existsSync(folder('INITIAL_PROMPT.md'))
        ? fs.readFileSync(folder('INITIAL_PROMPT.md'), 'utf-8')
        : '';

    const replace = (text) => {
        return text.replace('{{TASK}}', taskContent).replaceAll('{{claudiomiroFolder}}', `${state.claudiomiroFolder}`);
    };

    const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');

    await executeClaude(replace(branchStep + prompt));

    logger.stopSpinner();

    if (!fs.existsSync(aiPromptPath)) {
        logger.error('AI_PROMPT.md was not created');
        throw new Error('Error creating AI_PROMPT.md file');
    }

    logger.success('AI_PROMPT.md created successfully');
};

module.exports = { step1 };
