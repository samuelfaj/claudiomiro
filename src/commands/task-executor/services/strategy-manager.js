/**
 * Strategy Manager
 *
 * Manages intelligent strategy switching for task execution.
 * Instead of just retrying with the same approach, switches
 * to progressively simpler strategies when the current one fails.
 */

/**
 * Available execution strategies in order of simplicity
 */
const StrategyType = {
    ORIGINAL: 'original',       // Full implementation as specified
    SIMPLIFIED: 'simplified',   // Reduced scope, core functionality only
    MINIMAL: 'minimal',         // Bare minimum implementation
    SPLIT: 'split',            // Task should be split into subtasks
};

/**
 * Strategy order for escalation
 */
const STRATEGY_ORDER = [
    StrategyType.ORIGINAL,
    StrategyType.SIMPLIFIED,
    StrategyType.MINIMAL,
    StrategyType.SPLIT,
];

/**
 * Attempt thresholds for strategy switching
 */
const STRATEGY_THRESHOLDS = {
    [StrategyType.ORIGINAL]: { minAttempt: 1, maxAttempt: 4 },
    [StrategyType.SIMPLIFIED]: { minAttempt: 5, maxAttempt: 8 },
    [StrategyType.MINIMAL]: { minAttempt: 9, maxAttempt: 12 },
    [StrategyType.SPLIT]: { minAttempt: 13, maxAttempt: Infinity },
};

/**
 * Same error threshold to trigger strategy switch
 */
const SAME_ERROR_THRESHOLD = 3;

/**
 * Gets the current strategy based on execution state
 * @param {Object} execution - execution.json content
 * @returns {string} Current strategy type
 */
const getCurrentStrategy = (execution) => {
    if (!execution) return StrategyType.ORIGINAL;
    return execution.currentStrategy || StrategyType.ORIGINAL;
};

/**
 * Gets the next strategy in the escalation order
 * @param {string} currentStrategy - Current strategy type
 * @returns {string|null} Next strategy or null if at end
 */
const getNextStrategy = (currentStrategy) => {
    const currentIndex = STRATEGY_ORDER.indexOf(currentStrategy);
    if (currentIndex === -1 || currentIndex >= STRATEGY_ORDER.length - 1) {
        return null;
    }
    return STRATEGY_ORDER[currentIndex + 1];
};

/**
 * Counts consecutive occurrences of the same error
 * @param {Array} errorHistory - Array of error objects
 * @returns {number} Count of same consecutive errors
 */
const countSameConsecutiveErrors = (errorHistory) => {
    if (!errorHistory || errorHistory.length < 2) return 0;

    const normalize = (err) => {
        const msg = typeof err === 'string' ? err : (err.message || '');
        return msg.toLowerCase().trim().substring(0, 200);
    };

    const lastError = normalize(errorHistory[errorHistory.length - 1]);
    let count = 1;

    for (let i = errorHistory.length - 2; i >= 0; i--) {
        if (normalize(errorHistory[i]) === lastError) {
            count++;
        } else {
            break;
        }
    }

    return count;
};

/**
 * Determines if strategy should be switched based on error patterns
 * @param {Object} execution - execution.json content
 * @param {string|null} lastError - Last error message
 * @returns {{shouldSwitch: boolean, reason: string, toStrategy: string|null}}
 */
const shouldSwitchStrategy = (execution, _lastError = null) => {
    if (!execution) {
        return { shouldSwitch: false, reason: 'No execution state', toStrategy: null };
    }

    const currentStrategy = getCurrentStrategy(execution);
    const attempts = execution.attempts || 0;
    const errorHistory = execution.errorHistory || [];

    // Check if same error is repeating
    const sameErrorCount = countSameConsecutiveErrors(errorHistory);
    if (sameErrorCount >= SAME_ERROR_THRESHOLD) {
        const nextStrategy = getNextStrategy(currentStrategy);
        if (nextStrategy) {
            return {
                shouldSwitch: true,
                reason: `Same error repeated ${sameErrorCount} times`,
                toStrategy: nextStrategy,
                errorCount: sameErrorCount,
            };
        }
    }

    // Check attempt threshold
    const thresholds = STRATEGY_THRESHOLDS[currentStrategy];
    if (thresholds && attempts > thresholds.maxAttempt) {
        const nextStrategy = getNextStrategy(currentStrategy);
        if (nextStrategy) {
            return {
                shouldSwitch: true,
                reason: `Exceeded ${thresholds.maxAttempt} attempts on ${currentStrategy} strategy`,
                toStrategy: nextStrategy,
                attempts,
            };
        }
    }

    return {
        shouldSwitch: false,
        reason: 'No strategy switch needed',
        toStrategy: null,
    };
};

/**
 * Applies strategy switch to execution state
 * @param {Object} execution - execution.json content
 * @param {string} newStrategy - New strategy to apply
 * @returns {Object} Updated execution object
 */
const applyStrategySwitch = (execution, newStrategy) => {
    const previousStrategy = getCurrentStrategy(execution);

    return {
        ...execution,
        currentStrategy: newStrategy,
        strategyHistory: [
            ...(execution.strategyHistory || []),
            {
                from: previousStrategy,
                to: newStrategy,
                attempt: execution.attempts || 0,
                timestamp: new Date().toISOString(),
            },
        ],
        strategyInfo: {
            switchedAt: new Date().toISOString(),
            previousStrategy,
            reason: `Switched from ${previousStrategy} to ${newStrategy}`,
        },
    };
};

/**
 * Generates strategy-specific instructions for the AI
 * @param {string} strategy - Strategy type
 * @returns {string} Instructions for the AI
 */
const getStrategyInstructions = (strategy) => {
    const instructions = {
        [StrategyType.ORIGINAL]: `
STRATEGY: ORIGINAL (Full Implementation)
- Implement ALL requirements as specified in BLUEPRINT.md
- Follow all acceptance criteria
- Create all specified artifacts
- No scope reduction allowed`,

        [StrategyType.SIMPLIFIED]: `
STRATEGY: SIMPLIFIED (Reduced Scope)
- Focus on CORE functionality only
- Skip nice-to-have features
- Implement minimum viable version of each requirement
- Document skipped features for future work
- Mark non-critical criteria as "deferred" if blocking`,

        [StrategyType.MINIMAL]: `
STRATEGY: MINIMAL (Bare Minimum)
- Implement ONLY the essential core feature
- Skip ALL optional functionality
- Use simplest possible implementation
- Accept technical debt for now
- Mark ALL non-essential criteria as "blocked" with documentation
- Focus on making ONE thing work correctly`,

        [StrategyType.SPLIT]: `
STRATEGY: SPLIT (Task Decomposition Required)
- This task is too complex for single execution
- Analyze and identify natural split points
- Document how task should be divided
- Mark current task as "needs-split"
- Do NOT attempt full implementation`,
    };

    return instructions[strategy] || instructions[StrategyType.ORIGINAL];
};

/**
 * Generates simplification suggestions based on execution state
 * @param {Object} execution - execution.json content
 * @param {string} targetStrategy - Target strategy
 * @returns {Object} Simplification suggestions
 */
const generateSimplifications = (execution, targetStrategy) => {
    const suggestions = {
        criteria: [],
        phases: [],
        artifacts: [],
        general: [],
    };

    // Analyze criteria for simplification
    if (execution.successCriteria) {
        for (const criterion of execution.successCriteria) {
            if (criterion.passed === false) {
                const isTestRelated = (criterion.criterion || '').toLowerCase().includes('test');
                const isLintRelated = (criterion.criterion || '').toLowerCase().includes('lint');
                const _isBuildRelated = (criterion.criterion || '').toLowerCase().includes('build');

                if (targetStrategy === StrategyType.SIMPLIFIED) {
                    if (isLintRelated) {
                        suggestions.criteria.push({
                            criterion: criterion.criterion,
                            action: 'defer',
                            reason: 'Linting can be addressed after core functionality',
                        });
                    }
                } else if (targetStrategy === StrategyType.MINIMAL) {
                    if (isTestRelated || isLintRelated) {
                        suggestions.criteria.push({
                            criterion: criterion.criterion,
                            action: 'block',
                            reason: 'Focus on core implementation first',
                        });
                    }
                }
            }
        }
    }

    // Analyze phases for simplification
    if (execution.phases) {
        const incompletePhases = execution.phases.filter(p => p.status !== 'completed');

        if (targetStrategy === StrategyType.MINIMAL && incompletePhases.length > 1) {
            suggestions.general.push('Consider completing only the first incomplete phase');
            suggestions.phases = incompletePhases.slice(1).map(p => ({
                phase: p.name || p.id,
                action: 'defer',
                reason: 'Focus on one phase at a time in MINIMAL strategy',
            }));
        }
    }

    // General suggestions by strategy
    if (targetStrategy === StrategyType.SIMPLIFIED) {
        suggestions.general.push('Remove nice-to-have features');
        suggestions.general.push('Use simpler implementations where possible');
        suggestions.general.push('Skip extensive error handling for edge cases');
    } else if (targetStrategy === StrategyType.MINIMAL) {
        suggestions.general.push('Implement only the happy path');
        suggestions.general.push('Use hard-coded values where acceptable');
        suggestions.general.push('Skip all non-essential validation');
        suggestions.general.push('Document technical debt for future');
    }

    return suggestions;
};

/**
 * Records strategy outcome for learning (future use)
 * @param {string} taskId - Task identifier
 * @param {string} strategy - Strategy used
 * @param {boolean} success - Whether strategy succeeded
 * @param {Object} details - Additional details
 * @returns {Object} Outcome record
 */
const recordStrategyOutcome = (taskId, strategy, success, details = {}) => {
    return {
        taskId,
        strategy,
        success,
        timestamp: new Date().toISOString(),
        details,
    };
};

/**
 * Gets strategy for attempt number
 * @param {number} attempts - Current attempt number
 * @returns {string} Recommended strategy
 */
const getStrategyForAttempt = (attempts) => {
    for (const [strategy, thresholds] of Object.entries(STRATEGY_THRESHOLDS)) {
        if (attempts >= thresholds.minAttempt && attempts <= thresholds.maxAttempt) {
            return strategy;
        }
    }
    return StrategyType.SPLIT;
};

/**
 * Checks if current strategy allows blocking criteria
 * @param {string} strategy - Current strategy
 * @returns {boolean} True if blocking is allowed
 */
const canBlockCriteria = (strategy) => {
    return strategy === StrategyType.MINIMAL || strategy === StrategyType.SPLIT;
};

/**
 * Checks if current strategy allows deferring criteria
 * @param {string} strategy - Current strategy
 * @returns {boolean} True if deferring is allowed
 */
const canDeferCriteria = (strategy) => {
    return strategy !== StrategyType.ORIGINAL;
};

/**
 * Gets a summary of strategy state for logging
 * @param {Object} execution - execution.json content
 * @returns {Object} Strategy summary
 */
const getStrategySummary = (execution) => {
    const currentStrategy = getCurrentStrategy(execution);
    const attempts = execution?.attempts || 0;
    const errorHistory = execution?.errorHistory || [];
    const sameErrorCount = countSameConsecutiveErrors(errorHistory);
    const strategyHistory = execution?.strategyHistory || [];

    return {
        currentStrategy,
        attempts,
        sameErrorCount,
        switchCount: strategyHistory.length,
        canBlockCriteria: canBlockCriteria(currentStrategy),
        canDeferCriteria: canDeferCriteria(currentStrategy),
        nextStrategy: getNextStrategy(currentStrategy),
    };
};

module.exports = {
    StrategyType,
    STRATEGY_ORDER,
    STRATEGY_THRESHOLDS,
    SAME_ERROR_THRESHOLD,
    getCurrentStrategy,
    getNextStrategy,
    shouldSwitchStrategy,
    applyStrategySwitch,
    getStrategyInstructions,
    generateSimplifications,
    recordStrategyOutcome,
    getStrategyForAttempt,
    canBlockCriteria,
    canDeferCriteria,
    getStrategySummary,
    // Exported for testing
    countSameConsecutiveErrors,
};
