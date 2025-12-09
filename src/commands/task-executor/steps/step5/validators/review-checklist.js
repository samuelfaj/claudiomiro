const fs = require('fs');
const path = require('path');

/**
 * Validates item format for v2 schema (real-time generation)
 * @param {Object} item - Checklist item
 * @returns {string[]} Array of validation issues
 */
const validateItemFormat = (item) => {
    const issues = [];

    // Check context exists and has required fields
    if (!item.context) {
        issues.push(`Item ${item.id} missing context object`);
    } else {
        if (!item.context.action || item.context.action.length < 5) {
            issues.push(`Item ${item.id} missing or too short context.action (min 5 chars)`);
        }
        if (!item.context.why || item.context.why.length < 5) {
            issues.push(`Item ${item.id} missing or too short context.why (min 5 chars)`);
        }
    }

    // Check no inline code in description (backticks)
    if (item.description && item.description.includes('`')) {
        issues.push(`Item ${item.id} contains inline code (backticks) - use file:line references only`);
    }

    // Check lines array is present and non-empty
    if (!item.lines || !Array.isArray(item.lines) || item.lines.length === 0) {
        issues.push(`Item ${item.id} missing line number references (lines array empty or missing)`);
    }

    // Check description minimum length
    if (item.description && item.description.length < 20) {
        issues.push(`Item ${item.id} description too short (min 20 chars)`);
    }

    return issues;
};

/**
 * Validates that review-checklist.json exists and has items for all artifacts
 * Supports both v1 (legacy) and v2 (real-time generation) schemas
 * @param {string} task - Task identifier
 * @param {Object} options - Options
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Promise<Object>} Validation result
 */
const validateReviewChecklist = async (task, { claudiomiroFolder }) => {
    const logger = require('../../../../../shared/utils/logger');

    const executionPath = path.join(claudiomiroFolder, task, 'execution.json');
    const checklistPath = path.join(claudiomiroFolder, task, 'review-checklist.json');

    // If no execution.json, skip validation
    if (!fs.existsSync(executionPath)) {
        logger.warning('execution.json not found, skipping review checklist validation');
        return { valid: true, missing: [], formatIssues: [] };
    }

    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
    const artifacts = execution.artifacts || [];

    // If no artifacts, no checklist needed
    if (artifacts.length === 0) {
        logger.info('No artifacts to review, checklist validation skipped');
        return { valid: true, missing: [], formatIssues: [] };
    }

    // Check if review-checklist.json exists
    if (!fs.existsSync(checklistPath)) {
        logger.warning(`review-checklist.json not found but ${artifacts.length} artifacts exist`);
        return {
            valid: false,
            missing: artifacts.map(a => ({
                artifact: a.path,
                reason: 'No review checklist entry for this artifact',
            })),
            formatIssues: [],
        };
    }

    // Load and validate checklist
    let checklist;
    try {
        checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8'));
    } catch (error) {
        logger.error(`review-checklist.json is invalid JSON: ${error.message}`);
        return {
            valid: false,
            missing: [{ artifact: 'review-checklist.json', reason: 'Invalid JSON format' }],
            formatIssues: [],
        };
    }

    const checklistItems = checklist.items || [];

    // Detect schema version
    const isV2 = checklist.$schema === 'review-checklist-schema-v2';

    // Get artifact paths from checklist items (v2 uses 'file', v1 uses 'artifact')
    const checklistArtifacts = checklistItems.map(item => item.file || item.artifact);

    logger.info(`Review checklist: ${checklistItems.length} items for ${artifacts.length} artifacts (schema: ${isV2 ? 'v2' : 'v1'})`);

    const missing = [];
    const formatIssues = [];

    // Validate v2 format for each item
    if (isV2) {
        for (const item of checklistItems) {
            const itemIssues = validateItemFormat(item);
            if (itemIssues.length > 0) {
                formatIssues.push(...itemIssues);
            }
        }

        if (formatIssues.length > 0) {
            logger.warning(`v2 format issues found: ${formatIssues.length}`);
            formatIssues.forEach((issue, idx) => {
                logger.warning(`   ${idx + 1}. ${issue}`);
            });
        }
    }

    // Check each artifact has a checklist entry
    for (const artifact of artifacts) {
        // Skip deleted artifacts (no review needed)
        if (artifact.type === 'deleted') {
            continue;
        }

        const hasChecklistEntry = checklistArtifacts.includes(artifact.path);

        if (!hasChecklistEntry) {
            logger.warning(`No review checklist entry for artifact: ${artifact.path}`);
            missing.push({
                artifact: artifact.path,
                reason: 'Missing from review-checklist.json',
            });
            continue;
        }

        // For v1 schema, check that checklist item has questions array
        if (!isV2) {
            const checklistItem = checklistItems.find(item => item.artifact === artifact.path);
            if (!checklistItem.questions || checklistItem.questions.length === 0) {
                logger.warning(`Review checklist for ${artifact.path} has no questions`);
                missing.push({
                    artifact: artifact.path,
                    reason: 'No review questions defined',
                });
            }
        }
    }

    // Count items per artifact for v2
    if (isV2) {
        const itemCountByFile = {};
        for (const item of checklistItems) {
            const file = item.file;
            itemCountByFile[file] = (itemCountByFile[file] || 0) + 1;
        }

        // Warn if any artifact has less than 2 items
        for (const artifact of artifacts) {
            if (artifact.type === 'deleted') continue;
            const count = itemCountByFile[artifact.path] || 0;
            if (count > 0 && count < 2) {
                logger.warning(`Artifact ${artifact.path} has only ${count} review item(s), recommend 2-5`);
            }
        }
    }

    const valid = missing.length === 0 && formatIssues.length === 0;

    if (!valid) {
        if (missing.length > 0) {
            logger.error(`Review checklist validation failed: ${missing.length} artifacts missing checklist entries`);
            missing.forEach((issue, idx) => {
                logger.error(`   ${idx + 1}. ${issue.artifact}: ${issue.reason}`);
            });
        }
        if (formatIssues.length > 0) {
            logger.error(`Review checklist validation failed: ${formatIssues.length} format issues`);
        }
    } else {
        logger.info('Review checklist validated: all artifacts have review questions');
    }

    return {
        valid,
        missing,
        formatIssues,
        totalArtifacts: artifacts.length,
        totalChecklistItems: checklistItems.length,
        schemaVersion: isV2 ? 'v2' : 'v1',
    };
};

module.exports = {
    validateReviewChecklist,
    validateItemFormat,
};
