const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getStepModel } = require('../../utils/model-config');

/**
 * Analyzes whether a task can be split into subtasks that the
 * FAST model (Haiku) can execute with 100% certainty.
 *
 * Purpose: Cost optimization through intelligent model selection.
 *
 * Decision logic:
 * - ONLY splits if ALL subtasks can use FAST model
 * - If ANY subtask requires medium/hard, keeps task intact
 * - Subtasks created by this split will have @difficulty fast
 *
 * Criteria for FAST viability:
 * - Task follows existing patterns in the codebase
 * - Scope is well-defined (1-2 files max)
 * - No architectural decisions needed
 * - No complex integrations or business logic
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2')
 * @returns {Promise} Result of Claude execution
 */
const analyzeSplit = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    // Skip if this is already a subtask (contains a dot)
    if (typeof task === 'string' && task.includes('.')) {
        return;
    }

    // Skip if already analyzed (split.txt marker exists)
    if (fs.existsSync(folder('split.txt'))) {
        return;
    }

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-split.md'), 'utf-8');

    // Replace placeholders
    const taskFolder = path.join(state.claudiomiroFolder, task);
    promptTemplate = promptTemplate
        .replace(/\{\{taskFolder\}\}/g, taskFolder)
        .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder);

    const shellCommandRule = fs.readFileSync(path.join(__dirname, '../', '../', '../', '../', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'), 'utf-8');
    // Split analysis - use step4 model (default: medium)
    const execution = await executeClaude(promptTemplate + '\n\n' + shellCommandRule, task, { model: getStepModel(4) });

    // Only write split.txt if the original folder still exists (task was not split)
    if (fs.existsSync(folder('BLUEPRINT.md'))) {
        fs.writeFileSync(folder('split.txt'), '1');
    }

    return execution;
};

module.exports = { analyzeSplit };
