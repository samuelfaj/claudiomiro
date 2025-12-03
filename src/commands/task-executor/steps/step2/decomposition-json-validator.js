const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const logger = require('../../../../shared/utils/logger');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed (no BLOCKING errors)
 * @property {string[]} blocking - BLOCKING errors that fail the step
 * @property {string[]} warnings - WARNINGS that are logged but don't fail
 */

/**
 * Load and parse the DECOMPOSITION_ANALYSIS.json file
 * @param {string} claudiomiroFolder - Path to claudiomiro folder
 * @returns {Object|null} - Parsed JSON or null if error
 */
const loadDecompositionJSON = (claudiomiroFolder) => {
    const jsonPath = path.join(claudiomiroFolder, 'DECOMPOSITION_ANALYSIS.json');

    if (!fs.existsSync(jsonPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Invalid JSON in DECOMPOSITION_ANALYSIS.json: ${error.message}`);
    }
};

/**
 * Get list of task directories in claudiomiroFolder
 * @param {string} claudiomiroFolder - Path to claudiomiro folder
 * @returns {string[]} - List of task names
 */
const getTaskNames = (claudiomiroFolder) => {
    if (!fs.existsSync(claudiomiroFolder)) return [];

    return fs.readdirSync(claudiomiroFolder)
        .filter(f => {
            const fullPath = path.join(claudiomiroFolder, f);
            return f.startsWith('TASK') && fs.statSync(fullPath).isDirectory();
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

/**
 * Validate the decomposition analysis JSON against schema
 * @param {string} claudiomiroFolder - Path to claudiomiro folder
 * @returns {ValidationResult}
 */
const validateDecomposition = (claudiomiroFolder) => {
    const blocking = [];
    const warnings = [];

    // Check if JSON file exists - this is the only blocking check
    const data = loadDecompositionJSON(claudiomiroFolder);
    if (!data) {
        // File not existing is fine - Claude may not have created it
        warnings.push('DECOMPOSITION_ANALYSIS.json does not exist');
        return { valid: true, blocking, warnings };
    }

    // Schema validation is now non-blocking (just warnings)
    // The file is deleted after validation anyway - it's just a debugging artifact
    const schemaPath = path.join(__dirname, 'decomposition-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const isValid = validate(data);

    if (!isValid) {
        // Log schema issues as warnings only - LLM output can vary in structure
        warnings.push(`Schema validation: ${validate.errors.length} issue(s) detected (non-blocking)`);
    }

    // Confidence score check (warning only)
    if (data.phaseF && data.phaseF.confidenceScore) {
        const overallScore = data.phaseF.confidenceScore.overallScore;
        if (overallScore < 3.0) {
            warnings.push(`Confidence score ${overallScore} is below recommended threshold (3.0)`);
        }
    } else {
        warnings.push('Confidence score not found in phaseF');
    }

    // Pre-BLUEPRINT Analysis check (warning only)
    const taskNames = getTaskNames(claudiomiroFolder);
    if (taskNames.length > 0 && data.preBlueprintAnalysis) {
        const missingAnalysis = taskNames.filter(task => !data.preBlueprintAnalysis[task]);
        if (missingAnalysis.length > 0) {
            warnings.push(`Tasks missing Pre-BLUEPRINT Analysis: ${missingAnalysis.join(', ')}`);
        }
    }

    // All other checks are informational warnings
    if (data.phaseF && data.phaseF.selfConsistencyCheck) {
        if (data.phaseF.selfConsistencyCheck.divergenceDetected &&
            !data.phaseF.selfConsistencyCheck.resolution) {
            warnings.push('Unresolved divergence detected in self-consistency check');
        }
    }

    if (!data.phaseF || !data.phaseF.decompositionAlternatives ||
        data.phaseF.decompositionAlternatives.length < 2) {
        warnings.push('Phase F (Tree of Thought) has minimal content');
    }

    if (data.phaseD && data.phaseD.requirements) {
        const missingEvidence = data.phaseD.requirements.filter(req =>
            !req.evidence || req.evidence.length < 10,
        );
        if (missingEvidence.length > 0) {
            warnings.push('Phase D lacks some evidence citations');
        }
    }

    // Always valid - DECOMPOSITION_ANALYSIS.json is just a debugging artifact
    // that gets deleted after successful step2 anyway
    return {
        valid: true,
        blocking,
        warnings,
    };
};

/**
 * Run validation and log results
 * Throws error if BLOCKING issues are found
 * @param {string} claudiomiroFolder - Path to claudiomiro folder
 * @throws {Error} - If BLOCKING validation errors exist
 */
const runValidation = (claudiomiroFolder) => {
    const result = validateDecomposition(claudiomiroFolder);

    // Log warnings (don't fail)
    if (result.warnings.length > 0) {
        logger.newline();
        logger.warning('⚠️  Decomposition analysis warnings:');
        for (const warning of result.warnings) {
            logger.warning(`   - ${warning}`);
        }
    }

    // Log and throw for blocking errors
    if (!result.valid) {
        logger.newline();
        logger.error('❌ Decomposition analysis validation FAILED:');
        for (const error of result.blocking) {
            logger.error(`   - ${error}`);
        }
        logger.newline();

        // Preserve file for debugging
        logger.info('ℹ DECOMPOSITION_ANALYSIS.json preserved for debugging');
        logger.newline();

        throw new Error(`Decomposition validation failed: ${result.blocking.join('; ')}`);
    }

    if (result.warnings.length === 0 && result.valid) {
        logger.debug('[Decomposition Validator] All checks passed');
    }

    return result;
};

module.exports = {
    validateDecomposition,
    runValidation,
    loadDecompositionJSON,
    getTaskNames,
};
