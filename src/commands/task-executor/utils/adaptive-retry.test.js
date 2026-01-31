const {
    AUTO_ADJUST_THRESHOLD,
    StrategyPhase,
    getStrategyPhase,
    shouldEnableAutoAdjust,
    getStrategyGuidance,
    analyzeError,
    detectErrorRepetition,
    prepareExecutionForAutoAdjust,
} = require('./adaptive-retry');

describe('adaptive-retry', () => {
    describe('AUTO_ADJUST_THRESHOLD', () => {
        test('should be 5', () => {
            expect(AUTO_ADJUST_THRESHOLD).toBe(5);
        });
    });

    describe('getStrategyPhase', () => {
        test('should return NORMAL for attempts 1-3', () => {
            expect(getStrategyPhase(1)).toBe(StrategyPhase.NORMAL);
            expect(getStrategyPhase(2)).toBe(StrategyPhase.NORMAL);
            expect(getStrategyPhase(3)).toBe(StrategyPhase.NORMAL);
        });

        test('should return ANALYZE for attempts 4-5', () => {
            expect(getStrategyPhase(4)).toBe(StrategyPhase.ANALYZE);
            expect(getStrategyPhase(5)).toBe(StrategyPhase.ANALYZE);
        });

        test('should return AUTO_ADJUST for attempts 6+', () => {
            expect(getStrategyPhase(6)).toBe(StrategyPhase.AUTO_ADJUST);
            expect(getStrategyPhase(10)).toBe(StrategyPhase.AUTO_ADJUST);
            expect(getStrategyPhase(20)).toBe(StrategyPhase.AUTO_ADJUST);
        });
    });

    describe('shouldEnableAutoAdjust', () => {
        test('should return false for attempts <= threshold', () => {
            expect(shouldEnableAutoAdjust(1)).toBe(false);
            expect(shouldEnableAutoAdjust(3)).toBe(false);
            expect(shouldEnableAutoAdjust(5)).toBe(false);
        });

        test('should return true for attempts > threshold', () => {
            expect(shouldEnableAutoAdjust(6)).toBe(true);
            expect(shouldEnableAutoAdjust(10)).toBe(true);
            expect(shouldEnableAutoAdjust(20)).toBe(true);
        });
    });

    describe('getStrategyGuidance', () => {
        test('should return NORMAL phase guidance for early attempts', () => {
            const guidance = getStrategyGuidance(2);

            expect(guidance.phase).toBe(StrategyPhase.NORMAL);
            expect(guidance.attempts).toBe(2);
            expect(guidance.autoAdjustEnabled).toBe(false);
            expect(guidance.recommendations).toContain('Review error message carefully');
        });

        test('should return ANALYZE phase guidance for middle attempts', () => {
            const guidance = getStrategyGuidance(4);

            expect(guidance.phase).toBe(StrategyPhase.ANALYZE);
            expect(guidance.autoAdjustEnabled).toBe(false);
            expect(guidance.recommendations.some(r => r.includes('Analyze pattern'))).toBe(true);
        });

        test('should return AUTO_ADJUST phase guidance after threshold', () => {
            const guidance = getStrategyGuidance(6);

            expect(guidance.phase).toBe(StrategyPhase.AUTO_ADJUST);
            expect(guidance.autoAdjustEnabled).toBe(true);
            expect(guidance.canBlockCriteria).toBe(true);
            expect(guidance.recommendations).toContain('AUTO-ADJUST MODE ENABLED');
        });

        test('should include error analysis when lastError provided', () => {
            const guidance = getStrategyGuidance(3, 'Command not found: npm');

            expect(guidance.lastError).toBe('Command not found: npm');
            expect(guidance.errorAnalysis).toBeDefined();
            expect(guidance.errorAnalysis.type).toBe('command-not-found');
        });
    });

    describe('analyzeError', () => {
        test('should detect command not found errors', () => {
            const analysis = analyzeError('bash: npm: command not found');

            expect(analysis.type).toBe('command-not-found');
            expect(analysis.possibleBlockCandidate).toBe(true);
            expect(analysis.hints.some(h => h.includes('installed'))).toBe(true);
        });

        test('should detect network errors', () => {
            const analysis = analyzeError('Error: connect ECONNREFUSED 127.0.0.1:3000');

            expect(analysis.type).toBe('network-error');
            expect(analysis.possibleBlockCandidate).toBe(true);
        });

        test('should detect permission errors', () => {
            const analysis = analyzeError('Error: EACCES: permission denied, open "/etc/config"');

            expect(analysis.type).toBe('permission-error');
            expect(analysis.possibleBlockCandidate).toBe(true);
        });

        test('should detect file not found errors', () => {
            const analysis = analyzeError('Error: ENOENT: no such file or directory');

            expect(analysis.type).toBe('file-not-found');
            expect(analysis.possibleBlockCandidate).toBe(false);
        });

        test('should detect test failures', () => {
            const analysis = analyzeError('Test failed: Expected true but got false');

            expect(analysis.type).toBe('test-failure');
            expect(analysis.possibleBlockCandidate).toBe(false);
        });

        test('should detect dependency errors', () => {
            const analysis = analyzeError('Error: Cannot find module "lodash"');

            expect(analysis.type).toBe('dependency-error');
            expect(analysis.possibleBlockCandidate).toBe(true);
        });

        test('should return unknown for unrecognized errors', () => {
            const analysis = analyzeError('Some random error message');

            expect(analysis.type).toBe('unknown');
            expect(analysis.hints).toHaveLength(0);
        });
    });

    describe('detectErrorRepetition', () => {
        test('should detect no repetition with empty history', () => {
            const result = detectErrorRepetition([], 'Error message');

            expect(result.isRepeating).toBe(false);
            expect(result.count).toBe(1);
        });

        test('should detect repetition of same error', () => {
            const history = [
                { message: 'Error message' },
                { message: 'Error message' },
            ];
            const result = detectErrorRepetition(history, 'Error message');

            expect(result.isRepeating).toBe(true);
            expect(result.count).toBe(3);
        });

        test('should handle mixed error history', () => {
            const history = [
                { message: 'Error A' },
                { message: 'Error B' },
                { message: 'Error A' },
            ];
            const result = detectErrorRepetition(history, 'Error A');

            expect(result.isRepeating).toBe(true);
            expect(result.count).toBe(3);
        });

        test('should recommend blocking after 3+ repetitions', () => {
            const history = [
                { message: 'Same error' },
                { message: 'Same error' },
            ];
            const result = detectErrorRepetition(history, 'Same error');

            expect(result.shouldConsiderBlocking).toBe(true);
        });

        test('should handle null history', () => {
            const result = detectErrorRepetition(null, 'Error');

            expect(result.isRepeating).toBe(false);
            expect(result.count).toBe(1);
        });

        test('should handle string errors in history', () => {
            const history = ['Error message', 'Error message'];
            const result = detectErrorRepetition(history, 'Error message');

            expect(result.isRepeating).toBe(true);
            expect(result.count).toBe(3);
        });
    });

    describe('prepareExecutionForAutoAdjust', () => {
        test('should not modify execution when below threshold', () => {
            const execution = { status: 'in_progress' };
            const result = prepareExecutionForAutoAdjust(execution, 3);

            expect(result.autoAdjustMode).toBeUndefined();
            expect(result.status).toBe('in_progress');
        });

        test('should add auto-adjust fields when above threshold', () => {
            const execution = { status: 'in_progress' };
            const result = prepareExecutionForAutoAdjust(execution, 6);

            expect(result.autoAdjustMode).toBe(true);
            expect(result.autoAdjustReason).toContain('6 failed attempts');
            expect(result.autoAdjustEnabledAt).toBeDefined();
        });

        test('should preserve existing execution fields', () => {
            const execution = {
                status: 'in_progress',
                phases: [{ id: 'test' }],
                customField: 'value',
            };
            const result = prepareExecutionForAutoAdjust(execution, 7);

            expect(result.status).toBe('in_progress');
            expect(result.phases).toEqual([{ id: 'test' }]);
            expect(result.customField).toBe('value');
            expect(result.autoAdjustMode).toBe(true);
        });
    });
});
