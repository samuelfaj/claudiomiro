/**
 * Completion validator for step5
 * Validates that all phases, items, artifacts, and cleanup are completed
 */

/**
 * Validate completion rules
 * @param {Object} execution - execution.json content
 * @returns {boolean} true if all validation rules pass
 */
const validateCompletion = (execution) => {
    const logger = require('../../../../../shared/utils/logger');

    // Check all phases completed
    for (const phase of execution.phases || []) {
        if (phase.status !== 'completed') {
            logger.info(`Completion validation: failed - Phase ${phase.id} (${phase.name}) not completed (status: ${phase.status})`);
            return false;
        }

        // Check all items in phase completed (if items exist)
        for (const item of phase.items || []) {
            if (item.completed !== true) {
                logger.info(`Completion validation: failed - Phase ${phase.id} item not completed: ${item.description}`);
                return false;
            }
        }

        // Check all pre-conditions passed
        for (const pc of phase.preConditions || []) {
            if (pc.passed !== true) {
                logger.info(`Completion validation: failed - Phase ${phase.id} pre-condition not passed: ${pc.check}`);
                return false;
            }
        }
    }

    // Check all artifacts verified
    for (const artifact of execution.artifacts || []) {
        if (artifact.verified !== true) {
            logger.info(`Completion validation: failed - artifact not verified: ${artifact.path}`);
            return false;
        }
    }

    // Check all success criteria passed (if they exist)
    for (const criterion of execution.successCriteria || []) {
        if (criterion.passed !== true) {
            logger.info(`Completion validation: failed - success criterion not passed: ${criterion.criterion}`);
            return false;
        }
    }

    // Check beyondTheBasics cleanup flags
    const cleanup = execution.beyondTheBasics?.cleanup;
    if (cleanup) {
        if (cleanup.debugLogsRemoved === false ||
            cleanup.formattingConsistent === false ||
            cleanup.deadCodeRemoved === false) {
            logger.info('Completion validation: failed - cleanup not complete');
            return false;
        }
    }

    logger.info('Completion validation: passed');
    return true;
};

module.exports = {
    validateCompletion,
};
