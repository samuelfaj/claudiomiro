const fs = require('fs');
const path = require('path');
const state = require('../../config/state');
const { executeClaude } = require('../../services/claude-executor');

/**
 * Analyzes whether a task should be split into subtasks
 * Evaluates task complexity and determines if splitting would enable
 * meaningful parallelism or reduce cognitive load
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
  if(fs.existsSync(folder('split.txt'))){
    return;
  }

  // Load prompt template
  let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-split.md'), 'utf-8');

  // Replace placeholders
  const taskFolder = path.join(state.claudiomiroFolder, task);
  promptTemplate = promptTemplate
    .replace(/\{\{taskFolder\}\}/g, taskFolder)
    .replace(/\{\{claudiomiroFolder\}\}/g, state.claudiomiroFolder);

  const execution = await executeClaude(promptTemplate, task);

  // Only write split.txt if the original folder still exists (task was not split)
  if(fs.existsSync(folder('TASK.md'))){
    fs.writeFileSync(folder('split.txt'), '1');
  }

  return execution;
};

module.exports = { analyzeSplit };
