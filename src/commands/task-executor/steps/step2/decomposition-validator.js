const fs = require('fs');
const path = require('path');
const logger = require('../../../../shared/utils/logger');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed (no BLOCKING errors)
 * @property {string[]} blocking - BLOCKING errors that fail the step
 * @property {string[]} warnings - WARNINGS that are logged but don't fail
 */

/**
 * Extract confidence score from DECOMPOSITION_ANALYSIS.md
 * Looks for patterns like "Overall Confidence: 4.2 / 5" or "**Overall Confidence:** 4.2"
 * @param {string} content - File content
 * @returns {number|null} - Confidence score or null if not found
 */
const extractConfidenceScore = (content) => {
    // Patterns handle markdown bold (**) and various formats
    // Match: "**Overall Confidence:** 4.2 / 5" or "Overall Confidence: 4.2"
    const patterns = [
        /Overall\s+Confidence[:*\s]+(\d+\.?\d*)\s*\/\s*5/i,
        /Confidence\s+Score[:*\s]+(\d+\.?\d*)\s*\/\s*5/i,
        /Overall\s+Confidence[:*\s]+(\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            return parseFloat(match[1]);
        }
    }

    return null;
};

/**
 * Check if a phase exists in the content
 * @param {string} content - File content
 * @param {string} phaseName - Phase name (e.g., "Phase A", "Phase B")
 * @returns {boolean}
 */
const hasPhase = (content, phaseName) => {
    const pattern = new RegExp(`##\\s*${phaseName}`, 'i');
    return pattern.test(content);
};

/**
 * Check if phase has actual content (not just a header)
 * @param {string} content - File content
 * @param {string} phaseName - Phase name
 * @returns {boolean}
 */
const hasPhaseContent = (content, phaseName) => {
    // Match from ## PhaseName until the next ## at line start or end of string
    // Using ^## to match ## only at line start (prevents matching middle of ###)
    // Using [\s\S]*? to match any character including newlines (non-greedy)
    // Using (?=\n##\s|$) lookahead to stop at newline + ## followed by space, or end of string
    // Note: In multiline mode, $ matches end of string (when used in lookahead)
    const pattern = new RegExp(`^##\\s*${phaseName}[\\s\\S]*?(?=\\n##\\s|$)`, 'im');
    const match = content.match(pattern);
    if (!match) return false;

    // Check if there's meaningful content (more than just whitespace and headers)
    const phaseContent = match[0];
    const lines = phaseContent.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---');
    });

    return lines.length >= 2; // At least 2 content lines
};

/**
 * Check for Pre-BLUEPRINT Analysis sections for each task
 * @param {string} content - DECOMPOSITION_ANALYSIS.md content
 * @param {string[]} taskNames - List of task names (TASK0, TASK1, etc.)
 * @returns {string[]} - List of tasks missing Pre-BLUEPRINT Analysis
 */
const getMissingPreBlueprintAnalysis = (content, taskNames) => {
    const missing = [];

    for (const taskName of taskNames) {
        // Look for "Pre-BLUEPRINT Analysis: TASKX" section
        const pattern = new RegExp(`Pre-BLUEPRINT\\s+Analysis[:\\s]*${taskName}`, 'i');
        if (!pattern.test(content)) {
            missing.push(taskName);
        }
    }

    return missing;
};

/**
 * Check for unresolved divergences in self-consistency check
 * @param {string} content - File content
 * @returns {boolean} - True if there are unresolved divergences
 */
const hasUnresolvedDivergence = (content) => {
    // Check for divergence markers without resolution
    const hasDivergence = /divergence\s+detected/i.test(content);
    const hasResolution = /resolution[:\s]/i.test(content) || /resolved[:\s]/i.test(content);

    return hasDivergence && !hasResolution;
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
 * Validate the decomposition analysis document
 * @param {string} claudiomiroFolder - Path to claudiomiro folder
 * @returns {ValidationResult}
 */
const validateDecomposition = (claudiomiroFolder) => {
    const blocking = [];
    const warnings = [];

    const analysisPath = path.join(claudiomiroFolder, 'DECOMPOSITION_ANALYSIS.md');

    // BLOCKING: DECOMPOSITION_ANALYSIS.md must exist
    if (!fs.existsSync(analysisPath)) {
        blocking.push('DECOMPOSITION_ANALYSIS.md does not exist - decomposition reasoning is required');
        return { valid: false, blocking, warnings };
    }

    const content = fs.readFileSync(analysisPath, 'utf-8');

    // BLOCKING: Check for required phases (A-E)
    const requiredPhases = [
        { name: 'Phase A', description: 'Requirements Extraction' },
        { name: 'Phase B', description: 'Complexity Analysis' },
        { name: 'Phase C', description: 'Dependency Analysis' },
        { name: 'Phase D', description: 'Decomposition Strategy' },
        { name: 'Phase E', description: 'Self-Critique' },
    ];

    for (const phase of requiredPhases) {
        if (!hasPhase(content, phase.name)) {
            blocking.push(`Missing ${phase.name}: ${phase.description}`);
        } else if (!hasPhaseContent(content, phase.name)) {
            blocking.push(`${phase.name} (${phase.description}) has no content`);
        }
    }

    // BLOCKING: Check confidence score
    const confidenceScore = extractConfidenceScore(content);
    if (confidenceScore === null) {
        warnings.push('Confidence score not found in DECOMPOSITION_ANALYSIS.md');
    } else if (confidenceScore < 3.0) {
        blocking.push(`Confidence score ${confidenceScore} is below minimum threshold (3.0)`);
    } else if (confidenceScore < 4.0) {
        warnings.push(`Confidence score ${confidenceScore} is below recommended threshold (4.0)`);
    }

    // Get task names from created directories
    const taskNames = getTaskNames(claudiomiroFolder);

    // BLOCKING: Check for Pre-BLUEPRINT Analysis for each task
    if (taskNames.length > 0) {
        const missingAnalysis = getMissingPreBlueprintAnalysis(content, taskNames);
        if (missingAnalysis.length > 0) {
            blocking.push(`Tasks missing Pre-BLUEPRINT Analysis: ${missingAnalysis.join(', ')}`);
        }
    }

    // WARNING: Check for Phase F (Tree of Thought)
    if (!hasPhase(content, 'Phase F')) {
        warnings.push('Phase F (Tree of Thought) not found - alternative exploration recommended');
    } else if (!hasPhaseContent(content, 'Phase F')) {
        warnings.push('Phase F (Tree of Thought) has minimal content');
    }

    // WARNING: Check for unresolved divergences
    if (hasUnresolvedDivergence(content)) {
        warnings.push('Unresolved divergence detected in self-consistency check');
    }

    // WARNING: Check for evidence in Phase D
    if (hasPhase(content, 'Phase D')) {
        const phaseD = content.match(/##\s*Phase D[^#]*/i);
        if (phaseD && !/Evidence[:\s]/i.test(phaseD[0])) {
            warnings.push('Phase D (Decomposition Strategy) lacks evidence citations');
        }
    }

    return {
        valid: blocking.length === 0,
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
    extractConfidenceScore,
    hasPhase,
    hasPhaseContent,
    getMissingPreBlueprintAnalysis,
    hasUnresolvedDivergence,
    getTaskNames,
};
