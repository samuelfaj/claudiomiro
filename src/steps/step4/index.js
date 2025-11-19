const path = require('path');
const { generateTodo } = require('./generate-todo');
const { analyzeSplit } = require('./analyze-split');
const { validateTodoQuality } = require('./utils');

/**
 * Step 4: Generate TODO.md and analyze task complexity
 *
 * This step performs two main actions:
 * 1. Generates a comprehensive TODO.md file with implementation instructions
 * 2. Analyzes whether the task should be split into subtasks for parallelism
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2')
 * @returns {Promise} Result of the split analysis
 */
const step4 = async (task) => {
  const logger = require('../../utils/logger');
  const state = require('../../config/state');
  const folder = (file) => path.join(state.claudiomiroFolder, task, file);

  // Generate TODO.md
  await generateTodo(task);

  // Validate TODO.md quality
  const validation = validateTodoQuality(folder('TODO.md'));

  if(!validation.valid){
    logger.warn('TODO.md quality issues detected:');
    validation.errors.forEach(error => logger.warn(`  - ${error}`));
    logger.info(`Context reference score: ${validation.contextScore}/3`);
    logger.newline();
    logger.info('TODO.md was created but may need manual review for completeness.');
  } else {
    logger.success(`TODO.md validated successfully (context reference score: ${validation.contextScore}/3)`);
  }

  // Continue with split analysis
  return analyzeSplit(task);
};

module.exports = { step4 };
