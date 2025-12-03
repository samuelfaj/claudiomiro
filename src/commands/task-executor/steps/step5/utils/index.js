/**
 * Step5 Utilities Index
 * Re-exports all utility modules for easy importing
 */

const { isDangerousCommand, isCriticalError, DANGEROUS_PATTERNS, CRITICAL_ERROR_PATTERNS } = require('./security');
const { loadExecution, saveExecution, recordError } = require('./execution-io');
const { enforcePhaseGate, updatePhaseProgress } = require('./phase-gate');
const { trackArtifacts, trackUncertainty, estimateCodeChangeSize, VALID_STATUSES } = require('./execution-helpers');

module.exports = {
    // Security
    isDangerousCommand,
    isCriticalError,
    DANGEROUS_PATTERNS,
    CRITICAL_ERROR_PATTERNS,

    // Execution I/O
    loadExecution,
    saveExecution,
    recordError,

    // Phase Gate
    enforcePhaseGate,
    updatePhaseProgress,

    // Execution Helpers
    trackArtifacts,
    trackUncertainty,
    estimateCodeChangeSize,
    VALID_STATUSES,
};
