/**
 * Security utilities for step5
 * Handles dangerous command detection and critical error identification
 */

// Dangerous command patterns (security)
const DANGEROUS_PATTERNS = [
    /rm\s+-rf/i,
    /sudo\s+/i,
    />\s*\/dev\//i,
    /\|\s*sh\b/i,
    /\|\s*bash\b/i,
    /eval\s+/i,
    /curl.*\|\s*sh/i,
];

// Critical error patterns that should stop execution
const CRITICAL_ERROR_PATTERNS = [
    /\.json not found/i,
    /file not found/i,
    /failed to parse/i,
    /syntax error/i,
    /unexpected token/i,
    /json parse error/i,
    /cannot read/i,
    /permission denied/i,
    /enoent/i,
];

/**
 * Check if command contains dangerous patterns
 * @param {string} command - Command to check
 * @returns {boolean} true if dangerous
 */
const isDangerousCommand = (command) => {
    if (!command || typeof command !== 'string') return false;
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
};

/**
 * Check if an error is critical (should stop execution)
 * @param {string} errorMessage - Error message to check
 * @returns {boolean} true if critical
 */
const isCriticalError = (errorMessage) => {
    if (!errorMessage) return false;
    return CRITICAL_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
};

module.exports = {
    isDangerousCommand,
    isCriticalError,
    DANGEROUS_PATTERNS,
    CRITICAL_ERROR_PATTERNS,
};
