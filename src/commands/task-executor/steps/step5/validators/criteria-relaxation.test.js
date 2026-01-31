const {
    CriterionStatus,
    validateBlockedCriterion,
    markCriterionAsBlocked,
    isCriterionComplete,
    filterCriteria,
    canProceedWithBlockedCriteria,
    suggestWorkaround,
    generateBlockReason,
} = require('./criteria-relaxation');

describe('criteria-relaxation', () => {
    describe('CriterionStatus', () => {
        test('should have all expected status values', () => {
            expect(CriterionStatus.PASSED).toBe('passed');
            expect(CriterionStatus.FAILED).toBe('failed');
            expect(CriterionStatus.BLOCKED).toBe('blocked');
            expect(CriterionStatus.RELAXED).toBe('relaxed');
            expect(CriterionStatus.MANUAL).toBe('manual');
        });
    });

    describe('validateBlockedCriterion', () => {
        test('should validate non-blocked criteria as valid', () => {
            const criterion = { status: 'passed', passed: true };
            const result = validateBlockedCriterion(criterion);

            expect(result.valid).toBe(true);
            expect(result.missing).toHaveLength(0);
        });

        test('should validate blocked criterion with all fields', () => {
            const criterion = {
                status: CriterionStatus.BLOCKED,
                blockReason: 'Service unavailable',
                workaround: 'Manual testing documented',
            };
            const result = validateBlockedCriterion(criterion);

            expect(result.valid).toBe(true);
            expect(result.missing).toHaveLength(0);
        });

        test('should fail blocked criterion missing blockReason', () => {
            const criterion = {
                status: CriterionStatus.BLOCKED,
                workaround: 'Manual testing',
            };
            const result = validateBlockedCriterion(criterion);

            expect(result.valid).toBe(false);
            expect(result.missing).toContain('blockReason');
        });

        test('should fail blocked criterion missing workaround', () => {
            const criterion = {
                status: CriterionStatus.BLOCKED,
                blockReason: 'Service down',
            };
            const result = validateBlockedCriterion(criterion);

            expect(result.valid).toBe(false);
            expect(result.missing).toContain('workaround');
        });

        test('should fail blocked criterion with empty strings', () => {
            const criterion = {
                status: CriterionStatus.BLOCKED,
                blockReason: '  ',
                workaround: '',
            };
            const result = validateBlockedCriterion(criterion);

            expect(result.valid).toBe(false);
            expect(result.missing).toContain('blockReason');
            expect(result.missing).toContain('workaround');
        });
    });

    describe('markCriterionAsBlocked', () => {
        test('should mark criterion as blocked with required fields', () => {
            const criterion = { criterion: 'Tests pass', command: 'npm test' };
            const result = markCriterionAsBlocked(
                criterion,
                'Test environment not configured',
                'Document manual test procedure',
            );

            expect(result.passed).toBeNull();
            expect(result.status).toBe(CriterionStatus.BLOCKED);
            expect(result.blockReason).toBe('Test environment not configured');
            expect(result.workaround).toBe('Document manual test procedure');
            expect(result.criterion).toBe('Tests pass');
            expect(result.blockedAt).toBeDefined();
        });

        test('should include optional fields when provided', () => {
            const criterion = { criterion: 'Tests pass' };
            const result = markCriterionAsBlocked(
                criterion,
                'Reason',
                'Workaround',
                {
                    attemptCount: 10,
                    forFuture: 'Set up test environment',
                    lastError: 'ECONNREFUSED',
                },
            );

            expect(result.attemptCount).toBe(10);
            expect(result.forFuture).toBe('Set up test environment');
            expect(result.lastError).toBe('ECONNREFUSED');
        });

        test('should not include optional fields when not provided', () => {
            const criterion = { criterion: 'Tests pass' };
            const result = markCriterionAsBlocked(criterion, 'Reason', 'Workaround');

            expect(result.forFuture).toBeUndefined();
            expect(result.lastError).toBeUndefined();
            expect(result.attemptCount).toBe(0);
        });
    });

    describe('isCriterionComplete', () => {
        test('should mark passed criteria as complete', () => {
            const criterion = { passed: true };
            const result = isCriterionComplete(criterion);

            expect(result.complete).toBe(true);
            expect(result.reason).toBe('passed');
        });

        test('should mark blocked with documentation as complete', () => {
            const criterion = {
                status: CriterionStatus.BLOCKED,
                blockReason: 'Valid reason',
                workaround: 'Valid workaround',
            };
            const result = isCriterionComplete(criterion);

            expect(result.complete).toBe(true);
            expect(result.reason).toBe('blocked-with-documentation');
        });

        test('should mark blocked without documentation as incomplete', () => {
            const criterion = {
                status: CriterionStatus.BLOCKED,
                blockReason: 'Valid reason',
                // missing workaround
            };
            const result = isCriterionComplete(criterion);

            expect(result.complete).toBe(false);
            expect(result.reason).toContain('blocked-missing-fields');
        });

        test('should mark manual criteria as complete', () => {
            const criterion = { status: CriterionStatus.MANUAL };
            const result = isCriterionComplete(criterion);

            expect(result.complete).toBe(true);
            expect(result.reason).toBe('manual');
        });

        test('should mark relaxed and passed as complete', () => {
            const criterion = { status: CriterionStatus.RELAXED, passed: true };
            const result = isCriterionComplete(criterion);

            expect(result.complete).toBe(true);
            expect(result.reason).toBe('relaxed-and-passed');
        });

        test('should mark failed criteria as incomplete', () => {
            const criterion = { status: CriterionStatus.FAILED, passed: false };
            const result = isCriterionComplete(criterion);

            expect(result.complete).toBe(false);
            expect(result.reason).toBe('failed');
        });
    });

    describe('filterCriteria', () => {
        test('should filter criteria into canProceed and blocking', () => {
            const criteria = [
                { criterion: 'Test 1', passed: true },
                { criterion: 'Test 2', passed: false, status: 'failed' },
                {
                    criterion: 'Test 3',
                    status: CriterionStatus.BLOCKED,
                    blockReason: 'Reason',
                    workaround: 'Work',
                },
            ];
            const result = filterCriteria(criteria);

            expect(result.canProceed).toHaveLength(2);
            expect(result.blocking).toHaveLength(1);
        });

        test('should handle empty criteria', () => {
            const result = filterCriteria([]);

            expect(result.canProceed).toHaveLength(0);
            expect(result.blocking).toHaveLength(0);
        });

        test('should handle null/undefined criteria', () => {
            expect(filterCriteria(null).canProceed).toHaveLength(0);
            expect(filterCriteria(undefined).canProceed).toHaveLength(0);
        });
    });

    describe('canProceedWithBlockedCriteria', () => {
        test('should return true when no criteria defined', () => {
            const execution = {};
            const result = canProceedWithBlockedCriteria(execution);

            expect(result.canProceed).toBe(true);
            expect(result.summary).toBe('No success criteria defined');
        });

        test('should return true when all criteria passed', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'Test 1', passed: true },
                    { criterion: 'Test 2', passed: true },
                ],
            };
            const result = canProceedWithBlockedCriteria(execution);

            expect(result.canProceed).toBe(true);
            expect(result.passedCount).toBe(2);
            expect(result.blockedCount).toBe(0);
        });

        test('should return true when some blocked with documentation', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'Test 1', passed: true },
                    {
                        criterion: 'Test 2',
                        status: CriterionStatus.BLOCKED,
                        blockReason: 'Reason',
                        workaround: 'Work',
                    },
                ],
            };
            const result = canProceedWithBlockedCriteria(execution);

            expect(result.canProceed).toBe(true);
            expect(result.passedCount).toBe(1);
            expect(result.blockedCount).toBe(1);
            expect(result.summary).toContain('blocked with workarounds');
        });

        test('should return false when criteria failed without blocking', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'Test 1', passed: true },
                    { criterion: 'Test 2', passed: false, status: 'failed' },
                ],
            };
            const result = canProceedWithBlockedCriteria(execution);

            expect(result.canProceed).toBe(false);
            expect(result.failedCount).toBe(1);
            expect(result.failingCriteria).toHaveLength(1);
        });
    });

    describe('suggestWorkaround', () => {
        test('should suggest workaround for test criteria', () => {
            const criterion = { criterion: 'Unit tests pass' };
            const workaround = suggestWorkaround(criterion, 'test-failure');

            expect(workaround).toContain('test');
        });

        test('should suggest workaround for lint criteria', () => {
            const criterion = { criterion: 'Lint passes' };
            const workaround = suggestWorkaround(criterion, 'command-not-found');

            expect(workaround.toLowerCase()).toContain('lint');
        });

        test('should suggest workaround for build criteria', () => {
            const criterion = { criterion: 'Build succeeds' };
            const workaround = suggestWorkaround(criterion, 'unknown');

            expect(workaround.toLowerCase()).toContain('build');
        });

        test('should suggest workaround based on error type', () => {
            const criterion = { criterion: 'API check' };
            const workaround = suggestWorkaround(criterion, 'network-error');

            expect(workaround).toContain('unavailable');
        });

        test('should return default workaround for unknown types', () => {
            const criterion = { criterion: 'Unknown criterion' };
            const workaround = suggestWorkaround(criterion, 'unknown');

            expect(workaround).toContain('Document');
        });
    });

    describe('generateBlockReason', () => {
        test('should handle empty error history', () => {
            const reason = generateBlockReason([], 'Test criterion');

            expect(reason).toContain('Test criterion');
            expect(reason).toContain('multiple attempts');
        });

        test('should extract command not found reason', () => {
            const errorHistory = [{ message: 'bash: npm: command not found' }];
            const reason = generateBlockReason(errorHistory, 'Test criterion');

            expect(reason).toContain('not available');
        });

        test('should extract network error reason', () => {
            const errorHistory = [{ message: 'Error: connect ECONNREFUSED' }];
            const reason = generateBlockReason(errorHistory, 'Test criterion');

            expect(reason).toContain('unavailable');
        });

        test('should extract permission error reason', () => {
            const errorHistory = [{ message: 'Permission denied' }];
            const reason = generateBlockReason(errorHistory, 'Test criterion');

            expect(reason).toContain('permissions');
        });

        test('should use last error for generic failures', () => {
            const errorHistory = [
                { message: 'Error 1' },
                { message: 'Error 2' },
                { message: 'Final error message' },
            ];
            const reason = generateBlockReason(errorHistory, 'Test criterion');

            expect(reason).toContain('Final error message');
            expect(reason).toContain('3 attempts');
        });

        test('should handle string errors in history', () => {
            const errorHistory = ['Error message'];
            const reason = generateBlockReason(errorHistory, 'Test');

            expect(reason).toContain('Error message');
        });
    });
});
