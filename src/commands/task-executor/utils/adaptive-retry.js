/**
 * Adaptive Retry System
 *
 * Implements a strategy escalation system that changes approach
 * based on the number of failed attempts. After the threshold,
 * enables auto-adjust mode allowing criteria to be marked as blocked.
 */

const AUTO_ADJUST_THRESHOLD = 5;

/**
 * Strategy phases based on attempt count
 */
const StrategyPhase = {
    NORMAL: 'normal',           // Attempts 1-3: Normal retry with feedback
    ANALYZE: 'analyze',         // Attempts 4-5: Analyze pattern, adjust approach
    AUTO_ADJUST: 'auto-adjust', // Attempts 6+: Enable blocking criteria
};

/**
 * Determines the current strategy phase based on attempt count
 * @param {number} attempts - Current attempt number (1-based)
 * @returns {string} Strategy phase
 */
const getStrategyPhase = (attempts) => {
    if (attempts <= 3) {
        return StrategyPhase.NORMAL;
    }
    if (attempts <= AUTO_ADJUST_THRESHOLD) {
        return StrategyPhase.ANALYZE;
    }
    return StrategyPhase.AUTO_ADJUST;
};

/**
 * Checks if auto-adjust mode should be enabled
 * @param {number} attempts - Current attempt number
 * @returns {boolean} True if auto-adjust should be enabled
 */
const shouldEnableAutoAdjust = (attempts) => {
    return attempts > AUTO_ADJUST_THRESHOLD;
};

/**
 * Gets strategy guidance for the current attempt
 * @param {number} attempts - Current attempt number
 * @param {string} lastError - Last error message (optional)
 * @returns {Object} Strategy guidance
 */
const getStrategyGuidance = (attempts, lastError = null) => {
    const phase = getStrategyPhase(attempts);

    const guidance = {
        phase,
        attempts,
        threshold: AUTO_ADJUST_THRESHOLD,
        autoAdjustEnabled: shouldEnableAutoAdjust(attempts),
        recommendations: [],
    };

    switch (phase) {
        case StrategyPhase.NORMAL:
            guidance.recommendations = [
                'Review error message carefully',
                'Check if all dependencies are available',
                'Verify command syntax is correct',
                'Ensure file paths exist',
            ];
            break;

        case StrategyPhase.ANALYZE:
            guidance.recommendations = [
                'Analyze pattern of repeated failures',
                'Consider if criterion is achievable in this environment',
                'Check for missing environment variables or configuration',
                'Verify external services/dependencies are accessible',
                `Remaining attempts before auto-adjust: ${AUTO_ADJUST_THRESHOLD - attempts + 1}`,
            ];
            break;

        case StrategyPhase.AUTO_ADJUST:
            guidance.recommendations = [
                'AUTO-ADJUST MODE ENABLED',
                'You may now mark unreachable criteria as "blocked"',
                'Document blockReason with specific details',
                'Provide workaround alternative',
                'Continue execution with remaining valid criteria',
            ];
            guidance.canBlockCriteria = true;
            break;
    }

    if (lastError) {
        guidance.lastError = lastError;
        guidance.errorAnalysis = analyzeError(lastError);
    }

    return guidance;
};

/**
 * Analyzes error message to provide hints
 * @param {string} errorMessage - Error message to analyze
 * @returns {Object} Error analysis with hints
 */
const analyzeError = (errorMessage) => {
    const analysis = {
        type: 'unknown',
        hints: [],
        possibleBlockCandidate: false,
    };

    const lowerError = errorMessage.toLowerCase();

    // Command not found (check before generic "not found")
    if (lowerError.includes('command not found') || lowerError.includes('not recognized')) {
        analysis.type = 'command-not-found';
        analysis.hints = [
            'Check if the tool/binary is installed',
            'Verify PATH environment variable',
            'Consider alternative commands',
        ];
        analysis.possibleBlockCandidate = true;
    }
    // Connection/Network errors
    else if (lowerError.includes('econnrefused') || lowerError.includes('timeout') || lowerError.includes('network')) {
        analysis.type = 'network-error';
        analysis.hints = [
            'External service may be unavailable',
            'Check network connectivity',
            'Verify service is running',
        ];
        analysis.possibleBlockCandidate = true;
    }
    // Permission errors
    else if (lowerError.includes('permission denied') || lowerError.includes('eacces')) {
        analysis.type = 'permission-error';
        analysis.hints = [
            'Check file/directory permissions',
            'May need elevated privileges',
            'Verify user has access rights',
        ];
        analysis.possibleBlockCandidate = true;
    }
    // Dependency errors (check before generic "not found")
    else if (lowerError.includes('module not found') || lowerError.includes('cannot find module') || lowerError.includes('dependency')) {
        analysis.type = 'dependency-error';
        analysis.hints = [
            'Run package manager install (npm install, pip install, etc.)',
            'Check if dependency is in package file',
            'Verify compatible version',
        ];
        analysis.possibleBlockCandidate = true;
    }
    // Test failures
    else if (lowerError.includes('test failed') || lowerError.includes('assertion') || lowerError.includes('expect')) {
        analysis.type = 'test-failure';
        analysis.hints = [
            'Review test expectations',
            'Check if test environment is configured',
            'Verify test data is available',
        ];
        analysis.possibleBlockCandidate = false; // Usually fixable
    }
    // File not found (generic, check last)
    else if (lowerError.includes('no such file') || lowerError.includes('enoent') || lowerError.includes('not found')) {
        analysis.type = 'file-not-found';
        analysis.hints = [
            'Verify file path is correct',
            'Check if file was created in previous step',
            'May need to create file first',
        ];
        analysis.possibleBlockCandidate = false; // Usually fixable
    }

    return analysis;
};

/**
 * Detects if the same error is repeating
 * @param {Array} errorHistory - Array of previous errors
 * @param {string} currentError - Current error message
 * @returns {Object} Repetition analysis
 */
const detectErrorRepetition = (errorHistory, currentError) => {
    if (!errorHistory || errorHistory.length === 0) {
        return { isRepeating: false, count: 1 };
    }

    // Normalize error for comparison
    const normalize = (err) => {
        if (typeof err === 'string') return err.toLowerCase().trim();
        if (err && err.message) return err.message.toLowerCase().trim();
        return '';
    };

    const normalizedCurrent = normalize(currentError);
    let count = 1;

    for (const prevError of errorHistory) {
        const normalizedPrev = normalize(prevError.message || prevError);
        if (normalizedPrev === normalizedCurrent) {
            count++;
        }
    }

    return {
        isRepeating: count > 1,
        count,
        shouldConsiderBlocking: count >= 3,
    };
};

/**
 * Prepares execution context with auto-adjust information
 * @param {Object} execution - Current execution.json content
 * @param {number} attempts - Current attempt number
 * @returns {Object} Updated execution object
 */
const prepareExecutionForAutoAdjust = (execution, attempts) => {
    if (shouldEnableAutoAdjust(attempts)) {
        return {
            ...execution,
            autoAdjustMode: true,
            autoAdjustReason: `Enabled after ${attempts} failed attempts (threshold: ${AUTO_ADJUST_THRESHOLD})`,
            autoAdjustEnabledAt: new Date().toISOString(),
        };
    }
    return execution;
};

module.exports = {
    AUTO_ADJUST_THRESHOLD,
    StrategyPhase,
    getStrategyPhase,
    shouldEnableAutoAdjust,
    getStrategyGuidance,
    analyzeError,
    detectErrorRepetition,
    prepareExecutionForAutoAdjust,
};
