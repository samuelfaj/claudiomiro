/**
 * Completion validator for step5
 * Validates that all phases, items, artifacts, and cleanup are completed
 *
 * Now supports "blocked" criteria with proper documentation:
 * - passed === true: Criterion passed normally
 * - status === 'blocked' with blockReason and workaround: Accepted as complete
 */

const { isCriterionComplete } = require('./criteria-relaxation');

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

    // Check all success criteria passed or properly blocked
    // Accepts: passed === true OR status === 'blocked' with documentation
    let blockedCount = 0;
    for (const criterion of execution.successCriteria || []) {
        const result = isCriterionComplete(criterion);

        if (!result.complete) {
            logger.info(`Completion validation: failed - success criterion not complete: ${criterion.criterion} (reason: ${result.reason})`);
            return false;
        }

        // Track blocked criteria for logging
        if (result.reason === 'blocked-with-documentation') {
            blockedCount++;
            logger.warning(`Criterion blocked with workaround: ${criterion.criterion}`);
        }
    }

    if (blockedCount > 0) {
        logger.info(`Completion validation: ${blockedCount} criteria blocked with documented workarounds`);
    }

    // Check beyondTheBasics cleanup flags (REQUIRED for step6 code review)
    const cleanup = execution.beyondTheBasics?.cleanup;
    if (!cleanup) {
        logger.info('Completion validation: failed - missing beyondTheBasics.cleanup');
        return false;
    }

    if (cleanup.debugLogsRemoved !== true) {
        logger.info('Completion validation: failed - cleanup.debugLogsRemoved is not true');
        return false;
    }
    if (cleanup.formattingConsistent !== true) {
        logger.info('Completion validation: failed - cleanup.formattingConsistent is not true');
        return false;
    }
    if (cleanup.deadCodeRemoved !== true) {
        logger.info('Completion validation: failed - cleanup.deadCodeRemoved is not true');
        return false;
    }

    logger.info('Completion validation: passed');
    return true;
};

module.exports = {
    validateCompletion,
};
