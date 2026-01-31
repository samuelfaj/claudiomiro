const fs = require('fs');

/**
 * Checks if a task is completed based on execution.json
 * @param {string} executionPath - Path to execution.json file
 * @returns {{completed: boolean, confidence: number, reason: string}}
 */
const isCompletedFromExecution = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        return {
            completed: false,
            confidence: 1.0,
            reason: 'execution.json not found',
        };
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

        // Check completion status
        if (execution.completion?.status === 'completed') {
            return {
                completed: true,
                confidence: 1.0,
                reason: 'completion.status is completed',
            };
        }

        // Check overall status
        if (execution.status === 'completed') {
            return {
                completed: true,
                confidence: 0.9,
                reason: 'status is completed',
            };
        }

        // Check if blocked
        if (execution.status === 'blocked') {
            return {
                completed: false,
                confidence: 1.0,
                reason: 'status is blocked',
            };
        }

        // Check all phases completed
        const phases = execution.phases || [];
        const allPhasesCompleted = phases.length > 0 && phases.every(p => p.status === 'completed');
        if (allPhasesCompleted) {
            return {
                completed: true,
                confidence: 0.85,
                reason: 'all phases completed',
            };
        }

        return {
            completed: false,
            confidence: 0.8,
            reason: 'task still in progress',
        };
    } catch (error) {
        return {
            completed: false,
            confidence: 0.5,
            reason: `Failed to parse execution.json: ${error.message}`,
        };
    }
};

/**
 * Checks if a task is effectively blocked even if status is not "blocked"
 * Detects scenarios where Claude identified a blocker but didn't update status correctly
 * @param {string} executionPath - Path to execution.json file
 * @returns {{blocked: boolean, reason: string|null}}
 */
const isEffectivelyBlocked = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        return { blocked: false, reason: null };
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

        // Check if status is explicitly blocked
        if (execution.status === 'blocked') {
            return { blocked: true, reason: 'status is blocked' };
        }

        // Check if completion summary indicates BLOCKED
        const summary = execution.completion?.summary || [];
        const blockedSummary = summary.find(s =>
            typeof s === 'string' && s.toUpperCase().includes('BLOCKED'),
        );
        if (blockedSummary) {
            return { blocked: true, reason: `completion summary: ${blockedSummary}` };
        }

        // Check if there's a high-confidence uncertainty about repository mismatch
        const uncertainties = execution.uncertainties || [];
        const repoMismatch = uncertainties.find(u => {
            const topicLower = u.topic?.toLowerCase() || '';
            const assumptionLower = u.assumption?.toLowerCase() || '';
            // Check if topic or assumption mentions repository mismatch
            return (topicLower.includes('repository') || assumptionLower.includes('repository')) &&
                   (topicLower.includes('mismatch') || assumptionLower.includes('mismatch'));
        });
        if (repoMismatch && repoMismatch.confidence === 'HIGH') {
            return { blocked: true, reason: `repository mismatch: ${repoMismatch.assumption}` };
        }

        // Check if all phase items have "Skipped" evidence (no real work done)
        const phases = execution.phases || [];
        if (phases.length > 0) {
            const allSkipped = phases.every(phase => {
                const items = phase.items || [];
                return items.length > 0 && items.every(item =>
                    item.evidence?.toLowerCase().includes('skipped'),
                );
            });

            if (allSkipped) {
                return { blocked: true, reason: 'all phase items were skipped - no real implementation' };
            }
        }

        return { blocked: false, reason: null };
    } catch {
        return { blocked: false, reason: null };
    }
};

const hasApprovedCodeReview = (file) => {
    if (!fs.existsSync(file)) {
        return false;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const statusIndex = lines.findIndex(line => line.trim().toLowerCase() === '## status');

    if (statusIndex === -1) {
        return false;
    }

    for (let i = statusIndex + 1; i < lines.length; i++) {
        const value = lines[i].trim();
        if (value === '') {
            continue;
        }

        return value.toLowerCase().includes('approved');
    }

    return false;
};

/**
 * Checks if execution can proceed despite some blocked criteria
 * Uses the criteria-relaxation module to determine if blocked criteria
 * have proper documentation (blockReason + workaround)
 * @param {string} executionPath - Path to execution.json file
 * @returns {{canProceed: boolean, blockedCount: number, passedCount: number, summary: string}}
 */
const canProceedWithBlockedCriteria = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        return {
            canProceed: false,
            blockedCount: 0,
            passedCount: 0,
            summary: 'execution.json not found',
        };
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

        // Import the criteria relaxation module dynamically to avoid circular dependencies
        const { canProceedWithBlockedCriteria: checkCriteria } = require('../steps/step5/validators/criteria-relaxation');

        return checkCriteria(execution);
    } catch (error) {
        return {
            canProceed: false,
            blockedCount: 0,
            passedCount: 0,
            summary: `Failed to check criteria: ${error.message}`,
        };
    }
};

/**
 * Checks if auto-adjust mode should be enabled based on attempt count
 * @param {number} attempts - Current attempt number
 * @param {number} threshold - Threshold for enabling auto-adjust (default: 5)
 * @returns {boolean}
 */
const shouldEnableAutoAdjustMode = (attempts, threshold = 5) => {
    return attempts > threshold;
};

module.exports = {
    isCompletedFromExecution,
    isEffectivelyBlocked,
    hasApprovedCodeReview,
    canProceedWithBlockedCriteria,
    shouldEnableAutoAdjustMode,
};
