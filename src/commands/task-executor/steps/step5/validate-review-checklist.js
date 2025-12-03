const fs = require('fs');
const path = require('path');

/**
 * Validates that review-checklist.json exists and has items for all artifacts
 * @param {string} task - Task identifier
 * @param {Object} options - Options
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Promise<Object>} Validation result
 */
const validateReviewChecklist = async (task, { claudiomiroFolder }) => {
    const logger = require('../../../../shared/utils/logger');

    const executionPath = path.join(claudiomiroFolder, task, 'execution.json');
    const checklistPath = path.join(claudiomiroFolder, task, 'review-checklist.json');

    // If no execution.json, skip validation
    if (!fs.existsSync(executionPath)) {
        logger.warning('execution.json not found, skipping review checklist validation');
        return { valid: true, missing: [] };
    }

    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
    const artifacts = execution.artifacts || [];

    // If no artifacts, no checklist needed
    if (artifacts.length === 0) {
        logger.info('No artifacts to review, checklist validation skipped');
        return { valid: true, missing: [] };
    }

    // Check if review-checklist.json exists
    if (!fs.existsSync(checklistPath)) {
        logger.warning(`⚠️  review-checklist.json not found but ${artifacts.length} artifacts exist`);
        return {
            valid: false,
            missing: artifacts.map(a => ({
                artifact: a.path,
                reason: 'No review checklist entry for this artifact',
            })),
        };
    }

    // Load and validate checklist
    let checklist;
    try {
        checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8'));
    } catch (error) {
        logger.error(`❌ review-checklist.json is invalid JSON: ${error.message}`);
        return {
            valid: false,
            missing: [{ artifact: 'review-checklist.json', reason: 'Invalid JSON format' }],
        };
    }

    const checklistItems = checklist.items || [];
    const checklistArtifacts = checklistItems.map(item => item.artifact);

    logger.info(`Review checklist: ${checklistItems.length} items for ${artifacts.length} artifacts`);

    const missing = [];

    // Check each artifact has a checklist entry
    for (const artifact of artifacts) {
        // Skip deleted artifacts (no review needed)
        if (artifact.type === 'deleted') {
            continue;
        }

        const hasChecklistEntry = checklistArtifacts.includes(artifact.path);

        if (!hasChecklistEntry) {
            logger.warning(`⚠️  No review checklist entry for artifact: ${artifact.path}`);
            missing.push({
                artifact: artifact.path,
                reason: 'Missing from review-checklist.json',
            });
            continue;
        }

        // Check that checklist item has questions
        const checklistItem = checklistItems.find(item => item.artifact === artifact.path);
        if (!checklistItem.questions || checklistItem.questions.length === 0) {
            logger.warning(`⚠️  Review checklist for ${artifact.path} has no questions`);
            missing.push({
                artifact: artifact.path,
                reason: 'No review questions defined',
            });
        }
    }

    const valid = missing.length === 0;

    if (!valid) {
        logger.error(`❌ Review checklist validation failed: ${missing.length} artifacts missing checklist entries`);
        missing.forEach((issue, idx) => {
            logger.error(`   ${idx + 1}. ${issue.artifact}: ${issue.reason}`);
        });
    } else {
        logger.info('✅ Review checklist validated: all artifacts have review questions');
    }

    return {
        valid,
        missing,
        totalArtifacts: artifacts.length,
        totalChecklistItems: checklistItems.length,
    };
};

module.exports = {
    validateReviewChecklist,
};
