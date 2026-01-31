const {
    ProgressType,
    GuardianAction,
    THRESHOLDS,
    checkProgress,
    determineAction,
    hasMultiplePhases,
    identifyCompletablePhases,
    generateProgressReport,
    createSnapshot,
    countCompletedPhases,
    countPassedCriteria,
    countBlockedCriteria,
    countArtifacts,
    countCompletedPhaseItems,
    getCurrentErrorSignature,
} = require('./progress-guardian');

describe('progress-guardian', () => {
    describe('countCompletedPhases', () => {
        test('should return 0 for null execution', () => {
            expect(countCompletedPhases(null)).toBe(0);
        });

        test('should return 0 for execution without phases', () => {
            expect(countCompletedPhases({})).toBe(0);
        });

        test('should count completed phases correctly', () => {
            const execution = {
                phases: [
                    { id: 'p1', status: 'completed' },
                    { id: 'p2', status: 'in_progress' },
                    { id: 'p3', status: 'completed' },
                    { id: 'p4', status: 'pending' },
                ],
            };
            expect(countCompletedPhases(execution)).toBe(2);
        });
    });

    describe('countPassedCriteria', () => {
        test('should return 0 for null execution', () => {
            expect(countPassedCriteria(null)).toBe(0);
        });

        test('should return 0 for execution without criteria', () => {
            expect(countPassedCriteria({})).toBe(0);
        });

        test('should count passed criteria correctly', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'c1', passed: true },
                    { criterion: 'c2', passed: false },
                    { criterion: 'c3', passed: true },
                    { criterion: 'c4', status: 'blocked' },
                ],
            };
            expect(countPassedCriteria(execution)).toBe(2);
        });
    });

    describe('countBlockedCriteria', () => {
        test('should return 0 for null execution', () => {
            expect(countBlockedCriteria(null)).toBe(0);
        });

        test('should only count blocked criteria with proper documentation', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'c1', status: 'blocked', blockReason: 'reason', workaround: 'workaround' },
                    { criterion: 'c2', status: 'blocked' }, // Missing docs
                    { criterion: 'c3', status: 'blocked', blockReason: 'reason' }, // Missing workaround
                    { criterion: 'c4', passed: true },
                ],
            };
            expect(countBlockedCriteria(execution)).toBe(1);
        });
    });

    describe('countArtifacts', () => {
        test('should return 0 for null execution', () => {
            expect(countArtifacts(null)).toBe(0);
        });

        test('should count artifacts correctly', () => {
            const execution = {
                artifacts: [
                    { path: 'file1.js' },
                    { path: 'file2.js' },
                ],
            };
            expect(countArtifacts(execution)).toBe(2);
        });
    });

    describe('countCompletedPhaseItems', () => {
        test('should return 0 for null execution', () => {
            expect(countCompletedPhaseItems(null)).toBe(0);
        });

        test('should count completed items across all phases', () => {
            const execution = {
                phases: [
                    {
                        id: 'p1',
                        items: [
                            { description: 'item1', completed: true },
                            { description: 'item2', completed: false },
                        ],
                    },
                    {
                        id: 'p2',
                        items: [
                            { description: 'item3', status: 'completed' },
                            { description: 'item4', completed: true },
                        ],
                    },
                ],
            };
            expect(countCompletedPhaseItems(execution)).toBe(3);
        });
    });

    describe('getCurrentErrorSignature', () => {
        test('should return null for execution without errors', () => {
            expect(getCurrentErrorSignature({})).toBeNull();
            expect(getCurrentErrorSignature({ errorHistory: [] })).toBeNull();
        });

        test('should return normalized error signature', () => {
            const execution = {
                errorHistory: [
                    { message: 'First error' },
                    { message: '  LAST ERROR  ' },
                ],
            };
            expect(getCurrentErrorSignature(execution)).toBe('last error');
        });

        test('should handle string errors', () => {
            const execution = {
                errorHistory: ['Direct error string'],
            };
            expect(getCurrentErrorSignature(execution)).toBe('direct error string');
        });
    });

    describe('checkProgress', () => {
        test('should consider first execution as progress', () => {
            const result = checkProgress(null, { phases: [] });
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain('first-execution');
        });

        test('should detect phase completion progress', () => {
            const prev = { phases: [{ status: 'in_progress' }] };
            const curr = { phases: [{ status: 'completed' }] };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.PHASE_COMPLETED);
        });

        test('should detect criterion passing progress', () => {
            const prev = { successCriteria: [{ passed: false }] };
            const curr = { successCriteria: [{ passed: true }] };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.CRITERION_PASSED);
        });

        test('should detect blocked criteria with documentation as progress', () => {
            const prev = { successCriteria: [{ passed: false }] };
            const curr = {
                successCriteria: [{
                    status: 'blocked',
                    blockReason: 'Cannot achieve',
                    workaround: 'Manual verification',
                }],
            };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.BLOCKED_DOCUMENTED);
        });

        test('should detect artifact creation progress', () => {
            const prev = { artifacts: [] };
            const curr = { artifacts: [{ path: 'new-file.js' }] };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.ARTIFACT_CREATED);
        });

        test('should detect strategy switch as progress', () => {
            const prev = { currentStrategy: 'original' };
            const curr = { currentStrategy: 'simplified' };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.STRATEGY_SWITCHED);
        });

        test('should detect error resolution as progress', () => {
            const prev = { errorHistory: [{ message: 'some error' }] };
            const curr = { errorHistory: [] };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.ERROR_RESOLVED);
        });

        test('should return no progress when nothing changed', () => {
            const execution = {
                phases: [{ status: 'in_progress' }],
                successCriteria: [{ passed: false }],
                artifacts: [],
                errorHistory: [{ message: 'same error' }],
            };

            const result = checkProgress(execution, { ...execution });
            expect(result.madeProgress).toBe(false);
            expect(result.progressTypes).toHaveLength(0);
        });

        test('should detect multiple progress types', () => {
            const prev = {
                phases: [{ status: 'in_progress' }],
                successCriteria: [{ passed: false }],
                artifacts: [],
            };
            const curr = {
                phases: [{ status: 'completed' }],
                successCriteria: [{ passed: true }],
                artifacts: [{ path: 'file.js' }],
            };

            const result = checkProgress(prev, curr);
            expect(result.madeProgress).toBe(true);
            expect(result.progressTypes).toContain(ProgressType.PHASE_COMPLETED);
            expect(result.progressTypes).toContain(ProgressType.CRITERION_PASSED);
            expect(result.progressTypes).toContain(ProgressType.ARTIFACT_CREATED);
        });
    });

    describe('determineAction', () => {
        test('should return CONTINUE for low stuck count', () => {
            const result = determineAction({}, 1);
            expect(result.type).toBe(GuardianAction.CONTINUE);
        });

        test('should return SWITCH_STRATEGY from original at threshold', () => {
            const result = determineAction({}, THRESHOLDS.SWITCH_STRATEGY, {
                currentStrategy: 'original',
            });
            expect(result.type).toBe(GuardianAction.SWITCH_STRATEGY);
            expect(result.data.toStrategy).toBe('simplified');
        });

        test('should return SWITCH_STRATEGY from simplified to minimal', () => {
            const result = determineAction({}, THRESHOLDS.SWITCH_STRATEGY + 1, {
                currentStrategy: 'simplified',
            });
            expect(result.type).toBe(GuardianAction.SWITCH_STRATEGY);
            expect(result.data.toStrategy).toBe('minimal');
        });

        test('should return CONTINUE when already on minimal but below split threshold', () => {
            const result = determineAction({}, THRESHOLDS.SWITCH_STRATEGY + 1, {
                currentStrategy: 'minimal',
            });
            expect(result.type).toBe(GuardianAction.CONTINUE);
        });

        test('should return SPLIT_TASK at split threshold with multiple phases', () => {
            const execution = {
                phases: [{ id: 'p1' }, { id: 'p2' }],
            };
            const result = determineAction(execution, THRESHOLDS.SPLIT_TASK, {
                currentStrategy: 'minimal',
                canSplit: true,
            });
            expect(result.type).toBe(GuardianAction.SPLIT_TASK);
        });

        test('should return PARTIAL_COMPLETE when cannot split', () => {
            const execution = { phases: [{ id: 'p1' }] };
            const result = determineAction(execution, THRESHOLDS.SPLIT_TASK, {
                currentStrategy: 'minimal',
                canSplit: false,
            });
            expect(result.type).toBe(GuardianAction.PARTIAL_COMPLETE);
        });

        test('should return PARTIAL_COMPLETE at partial threshold', () => {
            const result = determineAction({}, THRESHOLDS.PARTIAL_COMPLETE);
            expect(result.type).toBe(GuardianAction.PARTIAL_COMPLETE);
        });

        test('should return NOTIFY_USER at notify threshold', () => {
            const result = determineAction({}, THRESHOLDS.NOTIFY_USER);
            expect(result.type).toBe(GuardianAction.NOTIFY_USER);
        });
    });

    describe('hasMultiplePhases', () => {
        test('should return false for null execution', () => {
            expect(hasMultiplePhases(null)).toBe(false);
        });

        test('should return false for single phase', () => {
            expect(hasMultiplePhases({ phases: [{ id: 'p1' }] })).toBe(false);
        });

        test('should return true for multiple phases', () => {
            expect(hasMultiplePhases({ phases: [{ id: 'p1' }, { id: 'p2' }] })).toBe(true);
        });
    });

    describe('identifyCompletablePhases', () => {
        test('should return empty array for null execution', () => {
            expect(identifyCompletablePhases(null)).toEqual([]);
        });

        test('should return completed phases', () => {
            const execution = {
                phases: [
                    { id: 'p1', status: 'completed' },
                    { id: 'p2', status: 'in_progress' },
                ],
            };
            const result = identifyCompletablePhases(execution);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('p1');
        });

        test('should return phases with 80%+ items completed', () => {
            const execution = {
                phases: [
                    {
                        id: 'p1',
                        status: 'in_progress',
                        items: [
                            { completed: true },
                            { completed: true },
                            { completed: true },
                            { completed: true },
                            { completed: false },
                        ],
                    },
                    {
                        id: 'p2',
                        status: 'in_progress',
                        items: [
                            { completed: true },
                            { completed: false },
                            { completed: false },
                        ],
                    },
                ],
            };
            const result = identifyCompletablePhases(execution);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('p1');
        });
    });

    describe('generateProgressReport', () => {
        test('should generate progress report with progress', () => {
            const execution = {
                phases: [{ status: 'completed' }, { status: 'in_progress' }],
                successCriteria: [{ passed: true }],
                artifacts: [{ path: 'file.js' }],
                currentStrategy: 'simplified',
            };
            const progressCheck = {
                madeProgress: true,
                progressTypes: [ProgressType.PHASE_COMPLETED],
            };

            const report = generateProgressReport(execution, 0, progressCheck);
            expect(report.summary).toContain('Progress made');
            expect(report.details.madeProgress).toBe(true);
            expect(report.details.phases.completed).toBe(1);
            expect(report.details.phases.total).toBe(2);
            expect(report.details.currentStrategy).toBe('simplified');
        });

        test('should generate report without progress', () => {
            const execution = { phases: [], successCriteria: [] };
            const progressCheck = { madeProgress: false, progressTypes: [] };

            const report = generateProgressReport(execution, 3, progressCheck);
            expect(report.summary).toContain('No progress');
            expect(report.summary).toContain('3');
            expect(report.details.stuckCount).toBe(3);
        });
    });

    describe('createSnapshot', () => {
        test('should return null for null execution', () => {
            expect(createSnapshot(null)).toBeNull();
        });

        test('should create snapshot with all metrics', () => {
            const execution = {
                phases: [
                    { status: 'completed', items: [{ completed: true }] },
                    { status: 'in_progress', items: [{ completed: false }] },
                ],
                successCriteria: [
                    { passed: true },
                    { status: 'blocked', blockReason: 'r', workaround: 'w' },
                ],
                artifacts: [{ path: 'file.js' }],
                currentStrategy: 'simplified',
                errorHistory: [{ message: 'test error' }],
            };

            const snapshot = createSnapshot(execution);
            expect(snapshot.completedPhases).toBe(1);
            expect(snapshot.passedCriteria).toBe(1);
            expect(snapshot.blockedCriteria).toBe(1);
            expect(snapshot.artifacts).toBe(1);
            expect(snapshot.completedItems).toBe(1);
            expect(snapshot.currentStrategy).toBe('simplified');
            expect(snapshot.errorSignature).toBe('test error');
            expect(snapshot.timestamp).toBeDefined();
        });
    });

    describe('constants', () => {
        test('should have correct threshold values', () => {
            expect(THRESHOLDS.SWITCH_STRATEGY).toBeLessThan(THRESHOLDS.SPLIT_TASK);
            expect(THRESHOLDS.SPLIT_TASK).toBeLessThan(THRESHOLDS.PARTIAL_COMPLETE);
            expect(THRESHOLDS.PARTIAL_COMPLETE).toBeLessThan(THRESHOLDS.NOTIFY_USER);
        });

        test('should export all progress types', () => {
            expect(ProgressType.PHASE_COMPLETED).toBeDefined();
            expect(ProgressType.CRITERION_PASSED).toBeDefined();
            expect(ProgressType.ARTIFACT_CREATED).toBeDefined();
            expect(ProgressType.STRATEGY_SWITCHED).toBeDefined();
            expect(ProgressType.BLOCKED_DOCUMENTED).toBeDefined();
        });

        test('should export all guardian actions', () => {
            expect(GuardianAction.CONTINUE).toBeDefined();
            expect(GuardianAction.SWITCH_STRATEGY).toBeDefined();
            expect(GuardianAction.SPLIT_TASK).toBeDefined();
            expect(GuardianAction.PARTIAL_COMPLETE).toBeDefined();
            expect(GuardianAction.NOTIFY_USER).toBeDefined();
        });
    });
});
