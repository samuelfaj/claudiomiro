/**
 * Progress Guardian
 *
 * Guarantees that task execution ALWAYS makes forward progress
 * or escalates intelligently. Prevents the AI from getting stuck
 * in infinite retry loops with the same failing approach.
 */

/**
 * Types of progress that can be detected between attempts
 */
const ProgressType = {
    PHASE_COMPLETED: 'phase-completed',
    CRITERION_PASSED: 'criterion-passed',
    ARTIFACT_CREATED: 'artifact-created',
    STRATEGY_SWITCHED: 'strategy-switched',
    BLOCKED_DOCUMENTED: 'blocked-documented',
    PHASE_ITEM_COMPLETED: 'phase-item-completed',
    ERROR_RESOLVED: 'error-resolved',
};

/**
 * Actions the guardian can recommend when no progress is detected
 */
const GuardianAction = {
    CONTINUE: 'continue',
    SWITCH_STRATEGY: 'switch',
    SPLIT_TASK: 'split',
    PARTIAL_COMPLETE: 'partial',
    NOTIFY_USER: 'notify',
};

/**
 * Thresholds for determining actions
 */
const THRESHOLDS = {
    SWITCH_STRATEGY: 3,      // Stuck count to trigger strategy switch
    SPLIT_TASK: 6,           // Stuck count to trigger task split
    PARTIAL_COMPLETE: 9,     // Stuck count to trigger partial completion
    NOTIFY_USER: 12,         // Stuck count to notify user
};

/**
 * Counts completed phases in execution
 * @param {Object} execution - execution.json content
 * @returns {number} Number of completed phases
 */
const countCompletedPhases = (execution) => {
    if (!execution || !execution.phases) return 0;
    return execution.phases.filter(p => p.status === 'completed').length;
};

/**
 * Counts passed criteria in execution
 * @param {Object} execution - execution.json content
 * @returns {number} Number of passed criteria
 */
const countPassedCriteria = (execution) => {
    if (!execution || !execution.successCriteria) return 0;
    return execution.successCriteria.filter(c => c.passed === true).length;
};

/**
 * Counts blocked criteria with documentation in execution
 * @param {Object} execution - execution.json content
 * @returns {number} Number of properly blocked criteria
 */
const countBlockedCriteria = (execution) => {
    if (!execution || !execution.successCriteria) return 0;
    return execution.successCriteria.filter(c =>
        c.status === 'blocked' && c.blockReason && c.workaround,
    ).length;
};

/**
 * Counts artifacts in execution
 * @param {Object} execution - execution.json content
 * @returns {number} Number of artifacts
 */
const countArtifacts = (execution) => {
    if (!execution || !execution.artifacts) return 0;
    return execution.artifacts.length;
};

/**
 * Counts completed phase items across all phases
 * @param {Object} execution - execution.json content
 * @returns {number} Number of completed phase items
 */
const countCompletedPhaseItems = (execution) => {
    if (!execution || !execution.phases) return 0;
    let count = 0;
    for (const phase of execution.phases) {
        if (phase.items && Array.isArray(phase.items)) {
            count += phase.items.filter(item => item.completed === true || item.status === 'completed').length;
        }
    }
    return count;
};

/**
 * Gets the current error signature for comparison
 * @param {Object} execution - execution.json content
 * @returns {string|null} Error signature or null
 */
const getCurrentErrorSignature = (execution) => {
    if (!execution || !execution.errorHistory || execution.errorHistory.length === 0) {
        return null;
    }
    const lastError = execution.errorHistory[execution.errorHistory.length - 1];
    const message = lastError.message || lastError;
    // Normalize error for comparison
    return String(message).toLowerCase().trim().substring(0, 200);
};

/**
 * Checks if progress was made between two execution states
 * @param {Object|null} prevExecution - Previous execution state
 * @param {Object} currExecution - Current execution state
 * @returns {{madeProgress: boolean, progressTypes: string[], details: Object}}
 */
const checkProgress = (prevExecution, currExecution) => {
    const result = {
        madeProgress: false,
        progressTypes: [],
        details: {},
    };

    // First execution - consider it progress
    if (!prevExecution) {
        result.madeProgress = true;
        result.progressTypes.push('first-execution');
        return result;
    }

    // Check completed phases
    const prevPhases = countCompletedPhases(prevExecution);
    const currPhases = countCompletedPhases(currExecution);
    if (currPhases > prevPhases) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.PHASE_COMPLETED);
        result.details.phasesCompleted = currPhases - prevPhases;
    }

    // Check passed criteria
    const prevCriteria = countPassedCriteria(prevExecution);
    const currCriteria = countPassedCriteria(currExecution);
    if (currCriteria > prevCriteria) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.CRITERION_PASSED);
        result.details.criteriaPassedCount = currCriteria - prevCriteria;
    }

    // Check blocked criteria (properly documented blocks count as progress)
    const prevBlocked = countBlockedCriteria(prevExecution);
    const currBlocked = countBlockedCriteria(currExecution);
    if (currBlocked > prevBlocked) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.BLOCKED_DOCUMENTED);
        result.details.criteriaBlockedCount = currBlocked - prevBlocked;
    }

    // Check artifacts
    const prevArtifacts = countArtifacts(prevExecution);
    const currArtifacts = countArtifacts(currExecution);
    if (currArtifacts > prevArtifacts) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.ARTIFACT_CREATED);
        result.details.artifactsCreated = currArtifacts - prevArtifacts;
    }

    // Check phase items
    const prevItems = countCompletedPhaseItems(prevExecution);
    const currItems = countCompletedPhaseItems(currExecution);
    if (currItems > prevItems) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.PHASE_ITEM_COMPLETED);
        result.details.phaseItemsCompleted = currItems - prevItems;
    }

    // Check if strategy was switched
    const prevStrategy = prevExecution.currentStrategy || 'original';
    const currStrategy = currExecution.currentStrategy || 'original';
    if (currStrategy !== prevStrategy) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.STRATEGY_SWITCHED);
        result.details.strategyChange = { from: prevStrategy, to: currStrategy };
    }

    // Check if error was resolved (different error or no error)
    const prevError = getCurrentErrorSignature(prevExecution);
    const currError = getCurrentErrorSignature(currExecution);
    if (prevError && (!currError || currError !== prevError)) {
        result.madeProgress = true;
        result.progressTypes.push(ProgressType.ERROR_RESOLVED);
        result.details.errorResolved = true;
    }

    return result;
};

/**
 * Determines what action to take when no progress is made
 * @param {Object} execution - Current execution state
 * @param {number} stuckCount - Number of consecutive attempts without progress
 * @param {Object} options - Additional options
 * @returns {{type: string, reason: string, data: Object}}
 */
const determineAction = (execution, stuckCount, options = {}) => {
    const { currentStrategy = 'original', canSplit = true } = options;

    // Low stuck count - keep trying
    if (stuckCount < THRESHOLDS.SWITCH_STRATEGY) {
        return {
            type: GuardianAction.CONTINUE,
            reason: `Stuck count (${stuckCount}) below threshold (${THRESHOLDS.SWITCH_STRATEGY})`,
            data: { stuckCount, threshold: THRESHOLDS.SWITCH_STRATEGY },
        };
    }

    // Medium stuck count - switch strategy
    if (stuckCount < THRESHOLDS.SPLIT_TASK) {
        // Check if we can still switch strategies
        if (currentStrategy === 'original') {
            return {
                type: GuardianAction.SWITCH_STRATEGY,
                reason: `Stuck ${stuckCount} times, switching from ORIGINAL to SIMPLIFIED`,
                data: { stuckCount, fromStrategy: 'original', toStrategy: 'simplified' },
            };
        }
        if (currentStrategy === 'simplified') {
            return {
                type: GuardianAction.SWITCH_STRATEGY,
                reason: `Stuck ${stuckCount} times, switching from SIMPLIFIED to MINIMAL`,
                data: { stuckCount, fromStrategy: 'simplified', toStrategy: 'minimal' },
            };
        }
        // Already on minimal, continue for now
        return {
            type: GuardianAction.CONTINUE,
            reason: 'Already on MINIMAL strategy, continuing attempts',
            data: { stuckCount, currentStrategy },
        };
    }

    // High stuck count - split task if possible
    if (stuckCount < THRESHOLDS.PARTIAL_COMPLETE) {
        if (canSplit && hasMultiplePhases(execution)) {
            return {
                type: GuardianAction.SPLIT_TASK,
                reason: `Stuck ${stuckCount} times on MINIMAL strategy, splitting task`,
                data: { stuckCount, phases: execution.phases?.length || 0 },
            };
        }
        // Can't split, try partial completion
        return {
            type: GuardianAction.PARTIAL_COMPLETE,
            reason: `Stuck ${stuckCount} times, cannot split, trying partial completion`,
            data: { stuckCount, canSplit: false },
        };
    }

    // Very high stuck count - partial completion or notify user
    if (stuckCount < THRESHOLDS.NOTIFY_USER) {
        return {
            type: GuardianAction.PARTIAL_COMPLETE,
            reason: `Stuck ${stuckCount} times, completing what is possible`,
            data: { stuckCount },
        };
    }

    // Maximum stuck - notify user for manual intervention
    return {
        type: GuardianAction.NOTIFY_USER,
        reason: `Stuck ${stuckCount} times, requires manual intervention`,
        data: { stuckCount, threshold: THRESHOLDS.NOTIFY_USER },
    };
};

/**
 * Checks if execution has multiple phases that could be split
 * @param {Object} execution - execution.json content
 * @returns {boolean} True if has 2+ phases
 */
const hasMultiplePhases = (execution) => {
    if (!execution || !execution.phases) return false;
    return execution.phases.length >= 2;
};

/**
 * Identifies which phases are completable (already done or nearly done)
 * @param {Object} execution - execution.json content
 * @returns {Object[]} Array of completable phases
 */
const identifyCompletablePhases = (execution) => {
    if (!execution || !execution.phases) return [];

    return execution.phases.filter(phase => {
        // Already completed
        if (phase.status === 'completed') return true;

        // Check if most items are done
        if (phase.items && phase.items.length > 0) {
            const completedItems = phase.items.filter(
                item => item.completed === true || item.status === 'completed',
            ).length;
            const completionRate = completedItems / phase.items.length;
            // Consider phase completable if 80%+ items are done
            return completionRate >= 0.8;
        }

        return false;
    });
};

/**
 * Generates a progress report for logging/user notification
 * @param {Object} execution - execution.json content
 * @param {number} stuckCount - Current stuck count
 * @param {{madeProgress: boolean, progressTypes: string[]}} progressCheck - Result from checkProgress
 * @returns {{summary: string, details: Object}}
 */
const generateProgressReport = (execution, stuckCount, progressCheck) => {
    const phasesTotal = execution?.phases?.length || 0;
    const phasesCompleted = countCompletedPhases(execution);
    const criteriaTotal = execution?.successCriteria?.length || 0;
    const criteriaPassed = countPassedCriteria(execution);
    const criteriaBlocked = countBlockedCriteria(execution);
    const artifacts = countArtifacts(execution);
    const currentStrategy = execution?.currentStrategy || 'original';

    const summary = progressCheck.madeProgress
        ? `Progress made: ${progressCheck.progressTypes.join(', ')}`
        : `No progress for ${stuckCount} consecutive attempt(s)`;

    return {
        summary,
        details: {
            stuckCount,
            madeProgress: progressCheck.madeProgress,
            progressTypes: progressCheck.progressTypes,
            phases: { completed: phasesCompleted, total: phasesTotal },
            criteria: { passed: criteriaPassed, blocked: criteriaBlocked, total: criteriaTotal },
            artifacts,
            currentStrategy,
        },
    };
};

/**
 * Creates a snapshot of execution state for comparison
 * @param {Object} execution - execution.json content
 * @returns {Object} Snapshot with key metrics
 */
const createSnapshot = (execution) => {
    if (!execution) return null;

    return {
        completedPhases: countCompletedPhases(execution),
        passedCriteria: countPassedCriteria(execution),
        blockedCriteria: countBlockedCriteria(execution),
        artifacts: countArtifacts(execution),
        completedItems: countCompletedPhaseItems(execution),
        currentStrategy: execution.currentStrategy || 'original',
        errorSignature: getCurrentErrorSignature(execution),
        timestamp: Date.now(),
    };
};

module.exports = {
    ProgressType,
    GuardianAction,
    THRESHOLDS,
    checkProgress,
    determineAction,
    hasMultiplePhases,
    identifyCompletablePhases,
    generateProgressReport,
    createSnapshot,
    // Exported for testing
    countCompletedPhases,
    countPassedCriteria,
    countBlockedCriteria,
    countArtifacts,
    countCompletedPhaseItems,
    getCurrentErrorSignature,
};
