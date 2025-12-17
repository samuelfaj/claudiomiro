/**
 * Artifact Existence Validator
 *
 * Validates that artifacts declared in execution.json actually exist on the filesystem.
 * This catches "hallucinations" where the AI claims to have created files but didn't.
 *
 * CRITICAL: This validation runs BEFORE other validations to detect ghost artifacts early.
 */

const fs = require('fs');
const path = require('path');

/**
 * Validates that all declared artifacts exist on the filesystem
 * @param {Object} execution - execution.json content
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory (project root)
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Object} Validation result with missing files and recovery actions
 */
const validateArtifactsExist = (execution, { cwd }) => {
    const logger = require('../../../../../shared/utils/logger');

    const artifacts = execution.artifacts || [];

    // Only validate created/modified artifacts (not deleted)
    const toValidate = artifacts.filter(a =>
        a.type === 'created' || a.type === 'modified' || a.action === 'created' || a.action === 'modified',
    );

    if (toValidate.length === 0) {
        return { valid: true, missing: [], existingCount: 0, totalCount: 0 };
    }

    const missing = [];
    const existing = [];

    for (const artifact of toValidate) {
        const artifactPath = artifact.path;

        // Resolve the full path
        let fullPath;
        if (path.isAbsolute(artifactPath)) {
            fullPath = artifactPath;
        } else {
            fullPath = path.join(cwd, artifactPath);
        }

        const exists = fs.existsSync(fullPath);

        if (!exists) {
            logger.warning(`[Artifact Hallucination] File declared but not found: ${artifactPath}`);
            missing.push({
                path: artifactPath,
                fullPath,
                artifact,
                reason: 'File does not exist on filesystem despite being declared in execution.json',
            });
        } else {
            existing.push({
                path: artifactPath,
                fullPath,
                artifact,
            });
        }
    }

    const valid = missing.length === 0;

    if (!valid) {
        logger.error(`[Artifact Validation] ${missing.length}/${toValidate.length} declared files are missing from filesystem`);
        logger.error('[Artifact Validation] This indicates the AI claimed to create files but never actually wrote them (hallucination)');

        missing.forEach((m, idx) => {
            logger.error(`   ${idx + 1}. ${m.path}`);
        });
    } else if (toValidate.length > 0) {
        logger.info(`[Artifact Validation] All ${toValidate.length} declared files exist on filesystem`);
    }

    return {
        valid,
        missing,
        existing,
        existingCount: existing.length,
        totalCount: toValidate.length,
        missingCount: missing.length,
    };
};

/**
 * Marks missing artifacts for re-creation and resets related phases
 * @param {Object} execution - execution.json content (will be mutated)
 * @param {Array} missingArtifacts - Array of missing artifact info from validateArtifactsExist
 * @returns {Object} Recovery actions taken
 */
const markArtifactsForRecreation = (execution, missingArtifacts) => {
    const logger = require('../../../../../shared/utils/logger');

    if (missingArtifacts.length === 0) {
        return { actionsTaken: 0, resetPhases: [] };
    }

    const missingPaths = missingArtifacts.map(m => m.path);
    const resetPhases = [];

    // Mark artifacts as needing creation
    for (const artifact of execution.artifacts || []) {
        if (missingPaths.includes(artifact.path)) {
            artifact.verified = false;
            artifact.needsCreation = true;
            artifact.hallucinationDetected = true;
            logger.info(`[Recovery] Marked artifact for re-creation: ${artifact.path}`);
        }
    }

    // Find phases that claimed to create these files and reset them
    for (const phase of execution.phases || []) {
        let phaseNeedsReset = false;

        for (const item of phase.items || []) {
            // Check if this item's evidence mentions any missing file
            const evidence = item.evidence || '';
            const description = item.description || '';

            for (const missingPath of missingPaths) {
                // Check if file name appears in evidence or description
                const fileName = path.basename(missingPath);
                if (evidence.includes(fileName) || evidence.includes(missingPath) ||
                    description.includes(fileName) || description.includes(missingPath)) {

                    if (item.completed === true) {
                        item.completed = false;
                        item.hallucinationDetected = true;
                        item.resetReason = `File ${missingPath} was not actually created`;
                        phaseNeedsReset = true;
                        logger.info(`[Recovery] Reset item in phase ${phase.id}: ${item.description?.substring(0, 50)}...`);
                    }
                }
            }
        }

        // If any items were reset, mark phase as needing re-execution
        if (phaseNeedsReset && phase.status === 'completed') {
            phase.status = 'in_progress';
            phase.hallucinationRecovery = true;
            resetPhases.push(phase.id);
            logger.info(`[Recovery] Reset phase ${phase.id} (${phase.name}) to in_progress`);
        }
    }

    // Reset completion status
    if (execution.completion) {
        execution.completion.status = 'pending_recovery';
        execution.completion.hallucinationDetected = true;
        execution.completion.missingArtifacts = missingPaths;
    }

    // Reset overall status
    execution.status = 'in_progress';

    // Add to error history
    if (!execution.errorHistory) {
        execution.errorHistory = [];
    }
    execution.errorHistory.push({
        timestamp: new Date().toISOString(),
        phase: 'artifact-validation',
        severity: 'CRITICAL',
        message: `Hallucination detected: ${missingArtifacts.length} files claimed but not created: ${missingPaths.join(', ')}`,
    });

    return {
        actionsTaken: missingArtifacts.length,
        resetPhases,
        markedForRecreation: missingPaths,
    };
};

/**
 * Checks if review-checklist.json indicates blocked status due to missing files
 * @param {string} task - Task name
 * @param {Object} options - Options
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Object} Check result
 */
const checkReviewChecklistBlocked = (task, { claudiomiroFolder }) => {
    const checklistPath = path.join(claudiomiroFolder, task, 'review-checklist.json');

    if (!fs.existsSync(checklistPath)) {
        return { blocked: false, reason: null };
    }

    try {
        const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8'));

        // Check for blocked status
        if (checklist.status === 'blocked') {
            return {
                blocked: true,
                reason: checklist.summary?.critical_issue || 'Review checklist is blocked',
                missingFiles: checklist.summary?.findings?.directory_contents ? true : false,
            };
        }

        // Check for items with FILE NOT FOUND failure reasons
        const fileNotFoundItems = (checklist.items || []).filter(item =>
            item.failureReason && item.failureReason.includes('FILE NOT FOUND'),
        );

        if (fileNotFoundItems.length > 0) {
            return {
                blocked: true,
                reason: `${fileNotFoundItems.length} review items failed due to missing files`,
                missingFiles: fileNotFoundItems.map(item => item.file),
            };
        }

        return { blocked: false, reason: null };
    } catch {
        return { blocked: false, reason: 'Could not parse review-checklist.json' };
    }
};

module.exports = {
    validateArtifactsExist,
    markArtifactsForRecreation,
    checkReviewChecklistBlocked,
};
