/**
 * Execution helper utilities for step5
 * Handles artifact tracking, uncertainty tracking, and metrics
 */

const fs = require('fs');

/**
 * Track artifacts in execution.json
 * @param {Object} execution - execution.json content
 * @param {string[]} createdFiles - Paths of created files
 * @param {string[]} modifiedFiles - Paths of modified files
 */
const trackArtifacts = (execution, createdFiles = [], modifiedFiles = []) => {
    const logger = require('../../../../../shared/utils/logger');

    if (!execution.artifacts) {
        execution.artifacts = [];
    }

    for (const filePath of createdFiles) {
        execution.artifacts.push({
            type: 'created',
            path: filePath,
            verified: false,
        });
        logger.info(`Tracked artifact: created ${filePath}`);
    }

    for (const filePath of modifiedFiles) {
        execution.artifacts.push({
            type: 'modified',
            path: filePath,
            verified: false,
        });
        logger.info(`Tracked artifact: modified ${filePath}`);
    }
};

/**
 * Track uncertainty in execution.json
 * @param {Object} execution - execution.json content
 * @param {string} topic - Uncertainty topic
 * @param {string} assumption - Assumption made
 * @param {string} confidence - "LOW"|"MEDIUM"|"HIGH"
 */
const trackUncertainty = (execution, topic, assumption, confidence) => {
    const logger = require('../../../../../shared/utils/logger');

    if (!execution.uncertainties) {
        execution.uncertainties = [];
    }

    const id = `U${execution.uncertainties.length + 1}`;
    execution.uncertainties.push({
        id,
        topic,
        assumption,
        confidence,
        resolution: null,
        resolvedConfidence: null,
    });

    logger.info(`Tracked uncertainty: ${id} - ${topic} (${confidence} confidence)`);
};

/**
 * Estimates the code change size from BLUEPRINT.md content
 * @param {string} blueprintPath - Path to BLUEPRINT.md
 * @returns {number} Estimated line count
 */
const estimateCodeChangeSize = (blueprintPath) => {
    if (!fs.existsSync(blueprintPath)) return 0;
    const content = fs.readFileSync(blueprintPath, 'utf8');
    return content.split('\n').length;
};

// Valid execution statuses
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];

module.exports = {
    trackArtifacts,
    trackUncertainty,
    estimateCodeChangeSize,
    VALID_STATUSES,
};
