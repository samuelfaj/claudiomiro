const {
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
    countSameConsecutiveErrors,
} = require('./strategy-manager');

describe('strategy-manager', () => {
    describe('StrategyType', () => {
        test('should have all required strategy types', () => {
            expect(StrategyType.ORIGINAL).toBe('original');
            expect(StrategyType.SIMPLIFIED).toBe('simplified');
            expect(StrategyType.MINIMAL).toBe('minimal');
            expect(StrategyType.SPLIT).toBe('split');
        });
    });

    describe('STRATEGY_ORDER', () => {
        test('should have correct order', () => {
            expect(STRATEGY_ORDER).toEqual([
                'original',
                'simplified',
                'minimal',
                'split',
            ]);
        });
    });

    describe('getCurrentStrategy', () => {
        test('should return ORIGINAL for null execution', () => {
            expect(getCurrentStrategy(null)).toBe(StrategyType.ORIGINAL);
        });

        test('should return ORIGINAL for execution without strategy', () => {
            expect(getCurrentStrategy({})).toBe(StrategyType.ORIGINAL);
        });

        test('should return current strategy from execution', () => {
            const execution = { currentStrategy: StrategyType.SIMPLIFIED };
            expect(getCurrentStrategy(execution)).toBe(StrategyType.SIMPLIFIED);
        });
    });

    describe('getNextStrategy', () => {
        test('should return simplified for original', () => {
            expect(getNextStrategy(StrategyType.ORIGINAL)).toBe(StrategyType.SIMPLIFIED);
        });

        test('should return minimal for simplified', () => {
            expect(getNextStrategy(StrategyType.SIMPLIFIED)).toBe(StrategyType.MINIMAL);
        });

        test('should return split for minimal', () => {
            expect(getNextStrategy(StrategyType.MINIMAL)).toBe(StrategyType.SPLIT);
        });

        test('should return null for split (last strategy)', () => {
            expect(getNextStrategy(StrategyType.SPLIT)).toBeNull();
        });

        test('should return null for unknown strategy', () => {
            expect(getNextStrategy('unknown')).toBeNull();
        });
    });

    describe('countSameConsecutiveErrors', () => {
        test('should return 0 for empty history', () => {
            expect(countSameConsecutiveErrors([])).toBe(0);
            expect(countSameConsecutiveErrors(null)).toBe(0);
        });

        test('should return 0 for single error', () => {
            expect(countSameConsecutiveErrors([{ message: 'error' }])).toBe(0);
        });

        test('should count consecutive same errors', () => {
            const history = [
                { message: 'error A' },
                { message: 'error B' },
                { message: 'error B' },
                { message: 'error B' },
            ];
            expect(countSameConsecutiveErrors(history)).toBe(3);
        });

        test('should handle string errors', () => {
            const history = ['error', 'error', 'error'];
            expect(countSameConsecutiveErrors(history)).toBe(3);
        });

        test('should normalize errors for comparison', () => {
            const history = [
                { message: '  ERROR A  ' },
                { message: 'error a' },
            ];
            expect(countSameConsecutiveErrors(history)).toBe(2);
        });
    });

    describe('shouldSwitchStrategy', () => {
        test('should not switch for null execution', () => {
            const result = shouldSwitchStrategy(null);
            expect(result.shouldSwitch).toBe(false);
        });

        test('should not switch when below threshold', () => {
            const execution = {
                currentStrategy: StrategyType.ORIGINAL,
                attempts: 2,
                errorHistory: [],
            };
            const result = shouldSwitchStrategy(execution);
            expect(result.shouldSwitch).toBe(false);
        });

        test('should switch when same error repeats SAME_ERROR_THRESHOLD times', () => {
            const execution = {
                currentStrategy: StrategyType.ORIGINAL,
                attempts: 3,
                errorHistory: [
                    { message: 'same error' },
                    { message: 'same error' },
                    { message: 'same error' },
                ],
            };
            const result = shouldSwitchStrategy(execution);
            expect(result.shouldSwitch).toBe(true);
            expect(result.toStrategy).toBe(StrategyType.SIMPLIFIED);
            expect(result.reason).toContain('Same error repeated');
        });

        test('should switch when exceeding attempt threshold', () => {
            const execution = {
                currentStrategy: StrategyType.ORIGINAL,
                attempts: 5,
                errorHistory: [],
            };
            const result = shouldSwitchStrategy(execution);
            expect(result.shouldSwitch).toBe(true);
            expect(result.toStrategy).toBe(StrategyType.SIMPLIFIED);
        });

        test('should switch from simplified to minimal', () => {
            const execution = {
                currentStrategy: StrategyType.SIMPLIFIED,
                attempts: 9,
                errorHistory: [],
            };
            const result = shouldSwitchStrategy(execution);
            expect(result.shouldSwitch).toBe(true);
            expect(result.toStrategy).toBe(StrategyType.MINIMAL);
        });

        test('should not switch when already on split strategy', () => {
            const execution = {
                currentStrategy: StrategyType.SPLIT,
                attempts: 20,
                errorHistory: Array(5).fill({ message: 'error' }),
            };
            const result = shouldSwitchStrategy(execution);
            expect(result.shouldSwitch).toBe(false);
        });
    });

    describe('applyStrategySwitch', () => {
        test('should update execution with new strategy', () => {
            const execution = {
                currentStrategy: StrategyType.ORIGINAL,
                attempts: 5,
            };
            const result = applyStrategySwitch(execution, StrategyType.SIMPLIFIED);

            expect(result.currentStrategy).toBe(StrategyType.SIMPLIFIED);
            expect(result.strategyHistory).toHaveLength(1);
            expect(result.strategyHistory[0].from).toBe(StrategyType.ORIGINAL);
            expect(result.strategyHistory[0].to).toBe(StrategyType.SIMPLIFIED);
            expect(result.strategyInfo.previousStrategy).toBe(StrategyType.ORIGINAL);
        });

        test('should append to existing strategy history', () => {
            const execution = {
                currentStrategy: StrategyType.SIMPLIFIED,
                strategyHistory: [{ from: 'original', to: 'simplified' }],
            };
            const result = applyStrategySwitch(execution, StrategyType.MINIMAL);

            expect(result.strategyHistory).toHaveLength(2);
            expect(result.strategyHistory[1].from).toBe(StrategyType.SIMPLIFIED);
            expect(result.strategyHistory[1].to).toBe(StrategyType.MINIMAL);
        });
    });

    describe('getStrategyInstructions', () => {
        test('should return instructions for original strategy', () => {
            const instructions = getStrategyInstructions(StrategyType.ORIGINAL);
            expect(instructions).toContain('ORIGINAL');
            expect(instructions).toContain('Full Implementation');
        });

        test('should return instructions for simplified strategy', () => {
            const instructions = getStrategyInstructions(StrategyType.SIMPLIFIED);
            expect(instructions).toContain('SIMPLIFIED');
            expect(instructions).toContain('CORE functionality');
        });

        test('should return instructions for minimal strategy', () => {
            const instructions = getStrategyInstructions(StrategyType.MINIMAL);
            expect(instructions).toContain('MINIMAL');
            expect(instructions).toContain('essential');
        });

        test('should return instructions for split strategy', () => {
            const instructions = getStrategyInstructions(StrategyType.SPLIT);
            expect(instructions).toContain('SPLIT');
            expect(instructions).toContain('split points');
        });

        test('should return original instructions for unknown strategy', () => {
            const instructions = getStrategyInstructions('unknown');
            expect(instructions).toContain('ORIGINAL');
        });
    });

    describe('generateSimplifications', () => {
        test('should return empty suggestions for empty execution', () => {
            const result = generateSimplifications({}, StrategyType.SIMPLIFIED);
            expect(result.criteria).toHaveLength(0);
            expect(result.general).not.toHaveLength(0); // General suggestions always present
        });

        test('should suggest deferring lint for simplified strategy', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'lint passes', passed: false },
                    { criterion: 'tests pass', passed: true },
                ],
            };
            const result = generateSimplifications(execution, StrategyType.SIMPLIFIED);

            const lintSuggestion = result.criteria.find(s =>
                s.criterion.toLowerCase().includes('lint'),
            );
            expect(lintSuggestion).toBeDefined();
            expect(lintSuggestion.action).toBe('defer');
        });

        test('should suggest blocking tests and lint for minimal strategy', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'tests pass', passed: false },
                    { criterion: 'lint passes', passed: false },
                ],
            };
            const result = generateSimplifications(execution, StrategyType.MINIMAL);

            expect(result.criteria).toHaveLength(2);
            expect(result.criteria.every(s => s.action === 'block')).toBe(true);
        });

        test('should suggest deferring phases in minimal strategy', () => {
            const execution = {
                phases: [
                    { id: 'p1', status: 'in_progress' },
                    { id: 'p2', status: 'pending' },
                    { id: 'p3', status: 'pending' },
                ],
            };
            const result = generateSimplifications(execution, StrategyType.MINIMAL);

            expect(result.phases).toHaveLength(2);
            expect(result.general).toContain('Consider completing only the first incomplete phase');
        });
    });

    describe('recordStrategyOutcome', () => {
        test('should create outcome record', () => {
            const result = recordStrategyOutcome('TASK1', StrategyType.SIMPLIFIED, true, {
                attempts: 5,
            });

            expect(result.taskId).toBe('TASK1');
            expect(result.strategy).toBe(StrategyType.SIMPLIFIED);
            expect(result.success).toBe(true);
            expect(result.timestamp).toBeDefined();
            expect(result.details.attempts).toBe(5);
        });
    });

    describe('getStrategyForAttempt', () => {
        test('should return original for early attempts', () => {
            expect(getStrategyForAttempt(1)).toBe(StrategyType.ORIGINAL);
            expect(getStrategyForAttempt(4)).toBe(StrategyType.ORIGINAL);
        });

        test('should return simplified for mid attempts', () => {
            expect(getStrategyForAttempt(5)).toBe(StrategyType.SIMPLIFIED);
            expect(getStrategyForAttempt(8)).toBe(StrategyType.SIMPLIFIED);
        });

        test('should return minimal for late attempts', () => {
            expect(getStrategyForAttempt(9)).toBe(StrategyType.MINIMAL);
            expect(getStrategyForAttempt(12)).toBe(StrategyType.MINIMAL);
        });

        test('should return split for very late attempts', () => {
            expect(getStrategyForAttempt(13)).toBe(StrategyType.SPLIT);
            expect(getStrategyForAttempt(20)).toBe(StrategyType.SPLIT);
        });
    });

    describe('canBlockCriteria', () => {
        test('should return false for original strategy', () => {
            expect(canBlockCriteria(StrategyType.ORIGINAL)).toBe(false);
        });

        test('should return false for simplified strategy', () => {
            expect(canBlockCriteria(StrategyType.SIMPLIFIED)).toBe(false);
        });

        test('should return true for minimal strategy', () => {
            expect(canBlockCriteria(StrategyType.MINIMAL)).toBe(true);
        });

        test('should return true for split strategy', () => {
            expect(canBlockCriteria(StrategyType.SPLIT)).toBe(true);
        });
    });

    describe('canDeferCriteria', () => {
        test('should return false for original strategy', () => {
            expect(canDeferCriteria(StrategyType.ORIGINAL)).toBe(false);
        });

        test('should return true for simplified strategy', () => {
            expect(canDeferCriteria(StrategyType.SIMPLIFIED)).toBe(true);
        });

        test('should return true for minimal strategy', () => {
            expect(canDeferCriteria(StrategyType.MINIMAL)).toBe(true);
        });

        test('should return true for split strategy', () => {
            expect(canDeferCriteria(StrategyType.SPLIT)).toBe(true);
        });
    });

    describe('getStrategySummary', () => {
        test('should return summary with all fields', () => {
            const execution = {
                currentStrategy: StrategyType.SIMPLIFIED,
                attempts: 6,
                errorHistory: [
                    { message: 'error' },
                    { message: 'error' },
                ],
                strategyHistory: [
                    { from: 'original', to: 'simplified' },
                ],
            };

            const summary = getStrategySummary(execution);

            expect(summary.currentStrategy).toBe(StrategyType.SIMPLIFIED);
            expect(summary.attempts).toBe(6);
            expect(summary.sameErrorCount).toBe(2);
            expect(summary.switchCount).toBe(1);
            expect(summary.canBlockCriteria).toBe(false);
            expect(summary.canDeferCriteria).toBe(true);
            expect(summary.nextStrategy).toBe(StrategyType.MINIMAL);
        });

        test('should handle null execution', () => {
            const summary = getStrategySummary(null);

            expect(summary.currentStrategy).toBe(StrategyType.ORIGINAL);
            expect(summary.attempts).toBe(0);
            expect(summary.sameErrorCount).toBe(0);
            expect(summary.switchCount).toBe(0);
        });
    });

    describe('SAME_ERROR_THRESHOLD', () => {
        test('should be a reasonable value', () => {
            expect(SAME_ERROR_THRESHOLD).toBeGreaterThanOrEqual(2);
            expect(SAME_ERROR_THRESHOLD).toBeLessThanOrEqual(5);
        });
    });

    describe('STRATEGY_THRESHOLDS', () => {
        test('should have non-overlapping ranges', () => {
            const original = STRATEGY_THRESHOLDS[StrategyType.ORIGINAL];
            const simplified = STRATEGY_THRESHOLDS[StrategyType.SIMPLIFIED];
            const minimal = STRATEGY_THRESHOLDS[StrategyType.MINIMAL];
            const split = STRATEGY_THRESHOLDS[StrategyType.SPLIT];

            expect(original.maxAttempt).toBeLessThan(simplified.minAttempt);
            expect(simplified.maxAttempt).toBeLessThan(minimal.minAttempt);
            expect(minimal.maxAttempt).toBeLessThan(split.minAttempt);
        });
    });
});
