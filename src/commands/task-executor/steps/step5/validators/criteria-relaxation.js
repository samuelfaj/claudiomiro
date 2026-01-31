/**
 * Criteria Relaxation Module
 *
 * Handles the logic for relaxing success criteria when they cannot be met.
 * Allows marking criteria as "blocked" with proper documentation,
 * enabling task completion even when some criteria are unachievable.
 */

/**
 * Possible criterion status values
 */
const CriterionStatus = {
    PASSED: 'passed',           // Validation passed
    FAILED: 'failed',           // Validation failed (retryable)
    BLOCKED: 'blocked',         // Cannot be achieved (documented)
    RELAXED: 'relaxed',         // Modified/simplified criterion
    MANUAL: 'manual',           // Requires manual intervention
};

/**
 * Validates that a blocked criterion has required documentation
 * @param {Object} criterion - The criterion object
 * @returns {{valid: boolean, missing: string[]}} Validation result
 */
const validateBlockedCriterion = (criterion) => {
    const missing = [];

    if (criterion.status !== CriterionStatus.BLOCKED) {
        return { valid: true, missing: [] };
    }

    if (!criterion.blockReason || criterion.blockReason.trim() === '') {
        missing.push('blockReason');
    }

    if (!criterion.workaround || criterion.workaround.trim() === '') {
        missing.push('workaround');
    }

    return {
        valid: missing.length === 0,
        missing,
    };
};

/**
 * Marks a criterion as blocked with documentation
 * @param {Object} criterion - The criterion to mark as blocked
 * @param {string} blockReason - Why the criterion cannot be met
 * @param {string} workaround - Alternative approach or documentation
 * @param {Object} options - Additional options
 * @returns {Object} Updated criterion
 */
const markCriterionAsBlocked = (criterion, blockReason, workaround, options = {}) => {
    const {
        attemptCount = 0,
        forFuture = null,
        lastError = null,
    } = options;

    return {
        ...criterion,
        passed: null,
        status: CriterionStatus.BLOCKED,
        blockReason,
        workaround,
        attemptCount,
        blockedAt: new Date().toISOString(),
        ...(forFuture && { forFuture }),
        ...(lastError && { lastError }),
    };
};

/**
 * Checks if a criterion can be considered "completed" for validation purposes
 * A criterion is considered complete if:
 * - passed === true
 * - OR status === 'blocked' with valid documentation
 * @param {Object} criterion - The criterion to check
 * @returns {{complete: boolean, reason: string}} Completion status
 */
const isCriterionComplete = (criterion) => {
    // Relaxed criteria that passed are complete (check before plain passed)
    if (criterion.status === CriterionStatus.RELAXED && criterion.passed === true) {
        return { complete: true, reason: 'relaxed-and-passed' };
    }

    // Passed criteria are complete
    if (criterion.passed === true) {
        return { complete: true, reason: 'passed' };
    }

    // Blocked criteria with documentation are complete
    if (criterion.status === CriterionStatus.BLOCKED) {
        const validation = validateBlockedCriterion(criterion);
        if (validation.valid) {
            return { complete: true, reason: 'blocked-with-documentation' };
        }
        return {
            complete: false,
            reason: `blocked-missing-fields: ${validation.missing.join(', ')}`,
        };
    }

    // Manual criteria are considered complete (require human action)
    if (criterion.status === CriterionStatus.MANUAL) {
        return { complete: true, reason: 'manual' };
    }

    // Failed or other status means not complete
    return { complete: false, reason: criterion.status || 'not-passed' };
};

/**
 * Filters criteria that can proceed vs those that are blocking
 * @param {Array} criteria - Array of criteria
 * @returns {{canProceed: Array, blocking: Array}} Filtered criteria
 */
const filterCriteria = (criteria) => {
    const canProceed = [];
    const blocking = [];

    for (const criterion of criteria || []) {
        const result = isCriterionComplete(criterion);
        if (result.complete) {
            canProceed.push({ ...criterion, completionReason: result.reason });
        } else {
            blocking.push({ ...criterion, blockingReason: result.reason });
        }
    }

    return { canProceed, blocking };
};

/**
 * Checks if execution can proceed despite some criteria being blocked
 * @param {Object} execution - execution.json content
 * @returns {{canProceed: boolean, blockedCount: number, passedCount: number, summary: string}}
 */
const canProceedWithBlockedCriteria = (execution) => {
    const criteria = execution.successCriteria || [];

    if (criteria.length === 0) {
        return {
            canProceed: true,
            blockedCount: 0,
            passedCount: 0,
            summary: 'No success criteria defined',
        };
    }

    const { canProceed, blocking } = filterCriteria(criteria);

    const passedCount = canProceed.filter(c => c.passed === true).length;
    const blockedCount = canProceed.filter(c => c.status === CriterionStatus.BLOCKED).length;
    const failedCount = blocking.length;

    const result = {
        canProceed: failedCount === 0,
        passedCount,
        blockedCount,
        failedCount,
        total: criteria.length,
    };

    if (result.canProceed) {
        if (blockedCount > 0) {
            result.summary = `${passedCount} passed, ${blockedCount} blocked with workarounds`;
        } else {
            result.summary = `All ${passedCount} criteria passed`;
        }
    } else {
        result.summary = `${failedCount} criteria still failing (not blocked with documentation)`;
        result.failingCriteria = blocking.map(c => ({
            criterion: c.criterion,
            reason: c.blockingReason,
        }));
    }

    return result;
};

/**
 * Suggests a workaround based on error type and criterion
 * @param {Object} criterion - The failing criterion
 * @param {string} errorType - Type of error from analyzeError
 * @returns {string} Suggested workaround
 */
const suggestWorkaround = (criterion, errorType) => {
    const criterionLower = (criterion.criterion || '').toLowerCase();

    const workarounds = {
        'command-not-found': 'Manual verification: Run the equivalent check manually and document result in MANUAL_TESTS.md',
        'network-error': 'Service unavailable: Document expected behavior and add integration test for when service is available',
        'permission-error': 'Permission restricted: Document the required permissions in SETUP.md for manual configuration',
        'dependency-error': 'Missing dependency: Document required dependency installation steps in LIMITATIONS.md',
        'test-failure': 'Test environment issue: Document expected test behavior and conditions for passing',
    };

    // Check for specific criterion types
    if (criterionLower.includes('test')) {
        return workarounds['test-failure'] || 'Document manual testing procedure';
    }

    if (criterionLower.includes('lint') || criterionLower.includes('format')) {
        return 'Run linting/formatting manually and fix any issues';
    }

    if (criterionLower.includes('build') || criterionLower.includes('compile')) {
        return 'Document build requirements and verify build works in clean environment';
    }

    return workarounds[errorType] || 'Document the limitation and provide manual verification steps';
};

/**
 * Generates a block reason based on error history
 * @param {Array} errorHistory - Array of previous errors
 * @param {string} criterion - The criterion description
 * @returns {string} Generated block reason
 */
const generateBlockReason = (errorHistory, criterion) => {
    if (!errorHistory || errorHistory.length === 0) {
        return `Criterion "${criterion}" could not be validated after multiple attempts`;
    }

    const lastError = errorHistory[errorHistory.length - 1];
    const errorMessage = lastError.message || lastError;

    // Extract key information from error
    if (errorMessage.toLowerCase().includes('command not found')) {
        return `Required tool/command not available in environment: ${errorMessage}`;
    }

    if (errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('timeout')) {
        return `External service unavailable: ${errorMessage}`;
    }

    if (errorMessage.toLowerCase().includes('permission')) {
        return `Insufficient permissions: ${errorMessage}`;
    }

    return `Validation failed after ${errorHistory.length} attempts. Last error: ${errorMessage}`;
};

module.exports = {
    CriterionStatus,
    validateBlockedCriterion,
    markCriterionAsBlocked,
    isCriterionComplete,
    filterCriteria,
    canProceedWithBlockedCriteria,
    suggestWorkaround,
    generateBlockReason,
};
