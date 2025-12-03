/**
 * Execution I/O utilities for step5
 * Handles loading and saving execution.json with validation and repair
 */

const fs = require('fs');
const { validateExecutionJson } = require('../../../utils/schema-validator');
const { isCriticalError } = require('./security');

/**
 * Load execution.json with schema validation and auto-repair
 * Lenient mode: non-critical validation errors are logged but not thrown
 *
 * @param {string} executionPath - Path to execution.json
 * @param {Object} options - Options for loading
 * @param {boolean} options.lenient - If true, ignore non-critical validation errors (default: true)
 * @returns {Object} Parsed and repaired execution object
 * @throws {Error} if file missing or JSON parse fails (critical errors only)
 */
const loadExecution = (executionPath, options = {}) => {
    const { lenient = true } = options;
    const logger = require('../../../../../shared/utils/logger');

    // Critical: file must exist
    if (!fs.existsSync(executionPath)) {
        throw new Error(`execution.json not found at ${executionPath}`);
    }

    let execution;
    try {
        execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
    } catch (err) {
        throw new Error(`Failed to parse execution.json: ${err.message}`);
    }

    // Validate against schema with auto-repair enabled
    const validation = validateExecutionJson(execution, { sanitize: true, repair: true });

    if (!validation.valid) {
        const errorMessage = validation.errors.join('; ');

        if (isCriticalError(errorMessage)) {
            throw new Error(`Invalid execution.json (critical): ${errorMessage}`);
        }

        if (lenient) {
            logger.warning(`[Step5] Non-critical execution.json validation issues (auto-fixed): ${errorMessage}`);
            return validation.repairedData || validation.sanitizedData || execution;
        }

        throw new Error(`Invalid execution.json: ${errorMessage}`);
    }

    return validation.repairedData || validation.sanitizedData || execution;
};

/**
 * Save execution.json with schema validation and auto-repair
 * Lenient mode: saves best-effort repaired data even if validation has non-critical errors
 *
 * @param {string} executionPath - Path to execution.json
 * @param {Object} execution - Execution object to save
 * @param {Object} options - Options for saving
 * @param {boolean} options.lenient - If true, save even with non-critical validation errors (default: true)
 * @throws {Error} only if critical validation errors occur
 */
const saveExecution = (executionPath, execution, options = {}) => {
    const { lenient = true } = options;
    const logger = require('../../../../../shared/utils/logger');

    const validation = validateExecutionJson(execution, { sanitize: true, repair: true });

    if (!validation.valid) {
        const errorMessage = validation.errors.join('; ');

        if (isCriticalError(errorMessage)) {
            throw new Error(`Cannot save execution.json (critical): ${errorMessage}`);
        }

        if (lenient) {
            logger.warning(`[Step5] Saving execution.json with non-critical issues (auto-fixed): ${errorMessage}`);
            const dataToSave = validation.repairedData || validation.sanitizedData || execution;
            fs.writeFileSync(executionPath, JSON.stringify(dataToSave, null, 2), 'utf8');
            return;
        }

        throw new Error(`Cannot save execution.json: ${errorMessage}`);
    }

    const dataToSave = validation.repairedData || validation.sanitizedData || execution;
    fs.writeFileSync(executionPath, JSON.stringify(dataToSave, null, 2), 'utf8');
};

/**
 * Record an error in execution.json without resetting state
 * This is the KEY FIX for the infinite loop - we preserve state and just add error info
 *
 * @param {string} executionPath - Path to execution.json
 * @param {Error} error - The error that occurred
 * @param {Object} options - Options
 * @param {string} options.failedValidation - Which validation failed (for targeted retry)
 */
const recordError = (executionPath, error, options = {}) => {
    const logger = require('../../../../../shared/utils/logger');
    const { failedValidation = 'unknown' } = options;

    if (!fs.existsSync(executionPath)) {
        return; // Nothing to record to
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));

        // Initialize error tracking if needed
        if (!execution.errorHistory) {
            execution.errorHistory = [];
        }

        // Add current error to history
        execution.errorHistory.push({
            timestamp: new Date().toISOString(),
            message: error.message,
            failedValidation,
            stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : null,
        });

        // Mark which validation needs to be fixed
        if (!execution.pendingFixes) {
            execution.pendingFixes = [];
        }

        if (!execution.pendingFixes.includes(failedValidation)) {
            execution.pendingFixes.push(failedValidation);
        }

        // Keep status as in_progress (NOT reset to pending)
        // This is the KEY: don't reset, just mark what needs fixing
        execution.status = 'in_progress';
        execution.completion = execution.completion || {};
        execution.completion.status = 'pending_validation';
        execution.completion.lastError = error.message;
        execution.completion.failedValidation = failedValidation;

        fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf8');
        logger.info(`[Step5] Recorded error for ${failedValidation} - state preserved for retry`);
    } catch (saveErr) {
        logger.warning(`[Step5] Could not record error: ${saveErr.message}`);
    }
};

module.exports = {
    loadExecution,
    saveExecution,
    recordError,
};
