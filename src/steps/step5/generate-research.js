const fs = require('fs');
const path = require('path');
const state = require('../../config/state');
const { executeClaude } = require('../../services/claude-executor');

/**
 * Generates RESEARCH.md file with deep context analysis
 * Performs comprehensive codebase exploration to find similar patterns,
 * reusable components, and integration points before task execution
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2')
 * @returns {Promise<void>}
 */
const generateResearchFile = async (task) => {
  const folder = (file) => path.join(state.claudiomiroFolder, task, file);

  // Skip if RESEARCH.md already exists (already analyzed)
  if (fs.existsSync(folder('RESEARCH.md'))) {
    return;
  }

  // Skip if TODO.md doesn't exist
  if (!fs.existsSync(folder('TODO.md'))) {
    return;
  }

  const logger = require('../../utils/logger');

  logger.startSpinner('Analyzing task and gathering context...');

  try {
    // Load research prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'research-prompt.md'), 'utf-8');

    // Replace placeholders
    const prompt = promptTemplate
      .replace(/\{\{todoPath\}\}/g, folder('TODO.md'))
      .replace(/\{\{taskPath\}\}/g, folder('TASK.md'))
      .replace(/\{\{promptPath\}\}/g, folder('PROMPT.md'))
      .replace(/\{\{researchPath\}\}/g, folder('RESEARCH.md'))
      .replace(/\{\{researchGuidePath\}\}/g, path.join(__dirname, 'research.md'))
      .replace(/\{\{aiPromptPath\}\}/g, path.join(state.claudiomiroFolder, 'AI_PROMPT.md'))
      .replace(/\{\{task\}\}/g, task);

    await executeClaude(prompt, task);

    logger.stopSpinner();

    // Validate RESEARCH.md was created
    if (!fs.existsSync(folder('RESEARCH.md'))) {
      logger.error('RESEARCH.md was not created. Research phase failed.');
      throw new Error('Research phase failed: RESEARCH.md not generated');
    }

    // Validate RESEARCH.md has minimum content
    const researchContent = fs.readFileSync(folder('RESEARCH.md'), 'utf8');
    if (researchContent.length < 200) {
      logger.error('RESEARCH.md is too short. Research phase incomplete.');
      fs.rmSync(folder('RESEARCH.md'));
      throw new Error('Research phase incomplete: insufficient analysis');
    }

    logger.success('Research completed and saved to RESEARCH.md');
  } catch (error) {
    logger.stopSpinner();
    logger.error('Research phase failed: ' + error.message);
    // Don't block execution if research fails, but warn user
    logger.warn('Continuing without research file - execution may be less informed');
  }
};

module.exports = { generateResearchFile };
