const { generateExecution } = require('./generate-execution');
const { analyzeSplit } = require('./analyze-split');

/**
 * Step 4: Generate execution.json and analyze FAST model viability
 *
 * This step performs two main actions:
 * 1. Generates execution.json with task tracking structure
 * 2. Analyzes whether the task can be split into subtasks that use FAST model
 *
 * The split analysis only creates subtasks if ALL parts can use FAST model.
 * If any part requires medium/hard, the task is kept intact.
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2')
 * @returns {Promise} Result of the FAST viability analysis
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
