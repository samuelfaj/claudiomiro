const { generateExecution } = require('./generate-execution');
const { analyzeSplit } = require('./analyze-split');

/**
 * Step 4: Generate execution.json and analyze task complexity
 *
 * This step performs two main actions:
 * 1. Generates execution.json with task tracking structure
 * 2. Analyzes whether the task should be split into subtasks for parallelism
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2')
 * @returns {Promise} Result of the split analysis
 */
const step4 = async (task) => {
    const logger = require('../../../../shared/utils/logger');

    // Generate execution.json
    await generateExecution(task);

    logger.success('execution.json generated successfully');

    // Continue with split analysis
    return analyzeSplit(task);
};

module.exports = { step4 };
