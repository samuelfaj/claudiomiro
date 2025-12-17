/**
 * Step5 Validators Index
 * Re-exports all validator modules for easy importing
 */

const { validateImplementationStrategy, parseImplementationStrategy } = require('./implementation-strategy');
const { validateSuccessCriteria, parseSuccessCriteriaTable } = require('./success-criteria');
const { validateReviewChecklist } = require('./review-checklist');
const { verifyChanges, getGitModifiedFiles } = require('./git-changes');
const { validateCompletion } = require('./completion');
const { verifyPreConditions } = require('./pre-conditions');
const {
    validateArtifactsExist,
    markArtifactsForRecreation,
    checkReviewChecklistBlocked,
} = require('./artifacts-exist');

module.exports = {
    // Artifact Existence (Hallucination Detection)
    validateArtifactsExist,
    markArtifactsForRecreation,
    checkReviewChecklistBlocked,

    // Implementation Strategy
    validateImplementationStrategy,
    parseImplementationStrategy,

    // Success Criteria
    validateSuccessCriteria,
    parseSuccessCriteriaTable,

    // Review Checklist
    validateReviewChecklist,

    // Git Changes
    verifyChanges,
    getGitModifiedFiles,

    // Completion
    validateCompletion,

    // Pre-conditions
    verifyPreConditions,
};
