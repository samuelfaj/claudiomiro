/**
 * Fallback Completion Detector
 * Heuristic-based task completion detection when LLM is not available
 */

/**
 * Check if execution.json indicates the task is completed
 * @param {string|object} executionData - execution.json content (string or parsed object)
 * @returns {{completed: boolean, confidence: number, reason: string}}
 */
function isCompletedFromExecution(executionData) {
    if (!executionData) {
        return { completed: false, confidence: 0, reason: 'No execution data' };
    }

    try {
        const execution = typeof executionData === 'string'
            ? JSON.parse(executionData)
            : executionData;

        // Check top-level status
        if (execution.status === 'completed') {
            return { completed: true, confidence: 1.0, reason: 'Status is completed' };
        }

        // Check completion.status
        if (execution.completion?.status === 'completed') {
            return { completed: true, confidence: 1.0, reason: 'Completion status is completed' };
        }

        // Check if blocked
        if (execution.status === 'blocked') {
            return { completed: false, confidence: 1.0, reason: 'Task is blocked' };
        }

        return { completed: false, confidence: 0.8, reason: 'Task not marked as completed' };
    } catch (error) {
        return { completed: false, confidence: 0, reason: 'Invalid execution.json format' };
    }
}

/**
 * @deprecated Use isCompletedFromExecution instead
 * Check if a TODO.md indicates the task is fully implemented
 * @param {string} content - TODO.md content
 * @returns {boolean}
 */
function isFullyImplemented(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    const normalizedContent = content.toLowerCase();

    // Check first 20 lines for explicit declaration
    const firstLines = content.split('\n').slice(0, 20).join('\n').toLowerCase();

    // Pattern 1: Explicit "Fully implemented: YES"
    if (/fully\s+implemented\s*:\s*yes/i.test(firstLines)) {
        return true;
    }

    // Pattern 2: "Status: Complete" or "Status: Done"
    if (/status\s*:\s*(complete|done|finished|implemented)/i.test(firstLines)) {
        return true;
    }

    // Pattern 3: "[x] Fully implemented" checkbox
    if (/\[x\]\s*fully\s+implemented/i.test(normalizedContent)) {
        return true;
    }

    // Negative patterns - definitely not complete
    if (/fully\s+implemented\s*:\s*no/i.test(firstLines)) {
        return false;
    }

    if (/status\s*:\s*(pending|incomplete|in\s*progress|todo)/i.test(firstLines)) {
        return false;
    }

    return false;
}

/**
 * Check if a CODE_REVIEW.md has approved status
 * @param {string} content - CODE_REVIEW.md content
 * @returns {boolean}
 */
function hasApprovedCodeReview(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    const normalizedContent = content.toLowerCase();

    // Check for status section
    const statusMatch = normalizedContent.match(/##\s*status[\s\S]*?(?=\n##|$)/i);
    if (statusMatch) {
        const statusSection = statusMatch[0];

        // Look for approved/passed indicators
        if (/approved|passed|✅|lgtm|looks\s+good/i.test(statusSection)) {
            return true;
        }

        // Check for rejection indicators
        if (/rejected|failed|❌|needs\s+changes/i.test(statusSection)) {
            return false;
        }
    }

    // Fallback: check entire document for approval indicators
    if (/verdict\s*:\s*approved/i.test(normalizedContent)) {
        return true;
    }

    if (/##\s*approved/i.test(normalizedContent)) {
        return true;
    }

    return false;
}

/**
 * Calculate completion percentage from checkboxes
 * @param {string} content - Markdown content with checkboxes
 * @returns {{completed: number, total: number, percentage: number}}
 */
function getCheckboxCompletion(content) {
    if (!content || typeof content !== 'string') {
        return { completed: 0, total: 0, percentage: 0 };
    }

    // Count checked boxes
    const checkedPattern = /\[x\]/gi;
    const checkedMatches = content.match(checkedPattern) || [];
    const completed = checkedMatches.length;

    // Count unchecked boxes
    const uncheckedPattern = /\[\s\]/g;
    const uncheckedMatches = content.match(uncheckedPattern) || [];
    const unchecked = uncheckedMatches.length;

    const total = completed + unchecked;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
}

/**
 * Check if content has any TODO markers
 * @param {string} content - Content to check
 * @returns {boolean}
 */
function hasPendingTodos(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    // Patterns that indicate pending work
    const pendingPatterns = [
        /TODO(?:\s*:|\s+\w)/i,
        /FIXME/i,
        /HACK/i,
        /XXX/i,
        /\[\s\]/,  // Unchecked checkbox
        /pending/i,
        /not\s+implemented/i,
        /needs?\s+to\s+be/i,
        /will\s+be\s+added/i,
    ];

    for (const pattern of pendingPatterns) {
        if (pattern.test(content)) {
            return true;
        }
    }

    return false;
}

/**
 * @deprecated Use isCompletedFromExecution for execution.json analysis
 * Get detailed completion analysis from legacy TODO.md content
 * @param {string} content - TODO.md or similar content
 * @returns {Object}
 */
function analyzeCompletion(content) {
    const isComplete = isFullyImplemented(content);
    const checkboxes = getCheckboxCompletion(content);
    const hasPending = hasPendingTodos(content);

    // Calculate confidence based on signals
    let confidence = 0.5;

    if (isComplete) {
        confidence += 0.3;
    }

    if (checkboxes.percentage === 100 && checkboxes.total > 0) {
        confidence += 0.1;
    }

    if (!hasPending) {
        confidence += 0.1;
    }

    // Cap confidence
    confidence = Math.min(confidence, 1.0);

    return {
        completed: isComplete,
        confidence,
        checkboxes,
        hasPendingTodos: hasPending,
        reason: isComplete
            ? 'Explicit completion marker found'
            : hasPending
                ? 'Pending items detected'
                : 'No completion marker found',
    };
}

module.exports = {
    // New execution.json-based detection
    isCompletedFromExecution,
    // Legacy TODO.md-based detection (deprecated)
    isFullyImplemented,
    hasApprovedCodeReview,
    getCheckboxCompletion,
    hasPendingTodos,
    analyzeCompletion,
};
