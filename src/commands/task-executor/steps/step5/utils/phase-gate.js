/**
 * Phase gate enforcement for step5
 * Ensures phases are completed in order
 */

/**
 * Enforce phase gate - Phase N requires Phase N-1 completed
 * If previous phase is not completed, resets currentPhase to the incomplete phase
 *
 * @param {Object} execution - execution.json content (will be mutated if reset needed)
 * @returns {boolean} true if phase gate passed, false if currentPhase was reset
 */
const enforcePhaseGate = (execution) => {
    const logger = require('../../../../../shared/utils/logger');
    const currentPhaseId = execution.currentPhase?.id;

    if (!currentPhaseId || currentPhaseId <= 1) {
        return true; // Phase 1 or no phase, no gate check needed
    }

    const prevPhase = (execution.phases || []).find(p => p.id === currentPhaseId - 1);

    if (!prevPhase) {
        return true; // Single-phase task or phases not sequential
    }

    logger.info(`Phase gate check: Phase ${currentPhaseId - 1} status is ${prevPhase.status}`);

    if (prevPhase.status !== 'completed') {
        logger.warning(`Phase gate: Phase ${currentPhaseId - 1} not completed, resetting currentPhase`);

        // Find the first incomplete phase
        const firstIncompletePhase = (execution.phases || [])
            .filter(p => p.status !== 'completed')
            .sort((a, b) => a.id - b.id)[0];

        if (firstIncompletePhase) {
            execution.currentPhase = {
                id: firstIncompletePhase.id,
                name: firstIncompletePhase.name || `Phase ${firstIncompletePhase.id}`,
            };
            logger.info(`Phase gate: Reset currentPhase to Phase ${firstIncompletePhase.id}`);
        } else {
            execution.currentPhase = {
                id: currentPhaseId - 1,
                name: prevPhase.name || `Phase ${currentPhaseId - 1}`,
            };
        }

        return false;
    }

    return true;
};

/**
 * Update phase progress
 * @param {Object} execution - execution.json content
 * @param {number} phaseId - Phase ID to update
 * @param {string} status - New status
 */
const updatePhaseProgress = (execution, phaseId, status) => {
    const phase = (execution.phases || []).find(p => p.id === phaseId);
    if (phase) {
        phase.status = status;
    }

    if (execution.currentPhase && execution.currentPhase.id < phaseId) {
        execution.currentPhase.id = phaseId;
        execution.currentPhase.name = phase?.name || `Phase ${phaseId}`;
    }
};

module.exports = {
    enforcePhaseGate,
    updatePhaseProgress,
};
