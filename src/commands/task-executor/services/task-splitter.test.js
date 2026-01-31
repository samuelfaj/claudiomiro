const fs = require('fs');
const {
    SplitTrigger,
    SPLIT_THRESHOLDS,
    shouldSplitTask,
    generateSplitPlan,
    splitTaskMidExecution,
    generateSubtaskBlueprint,
    generateSubtaskTaskMd,
    generateSubtaskExecution,
    preserveProgressToSubtasks,
    hasBeenSplit,
    getSubtaskNames,
    groupPhasesIntoSubtasks,
    getCompletedArtifacts,
} = require('./task-splitter');

// Mock fs module
jest.mock('fs');

describe('task-splitter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockReturnValue(undefined);
        fs.writeFileSync.mockReturnValue(undefined);
    });

    describe('SplitTrigger', () => {
        test('should have all required triggers', () => {
            expect(SplitTrigger.SAME_PHASE_STUCK).toBe('same-phase-stuck');
            expect(SplitTrigger.PARTIAL_PROGRESS).toBe('partial-progress');
            expect(SplitTrigger.EXPLICIT_SUGGESTION).toBe('explicit-suggestion');
            expect(SplitTrigger.SCOPE_TOO_LARGE).toBe('scope-too-large');
        });
    });

    describe('shouldSplitTask', () => {
        test('should return false for null execution', () => {
            const result = shouldSplitTask(null);
            expect(result.shouldSplit).toBe(false);
        });

        test('should return false for execution without phases', () => {
            const result = shouldSplitTask({});
            expect(result.shouldSplit).toBe(false);
        });

        test('should return false for single phase', () => {
            const execution = {
                phases: [{ id: 'p1', status: 'in_progress' }],
            };
            const result = shouldSplitTask(execution);
            expect(result.shouldSplit).toBe(false);
            expect(result.reason).toContain('minimum');
        });

        test('should return true when stuck on same phase', () => {
            const execution = {
                taskId: 'TASK1',
                phases: [
                    { id: 'p1', status: 'in_progress' },
                    { id: 'p2', status: 'pending' },
                ],
            };
            const result = shouldSplitTask(execution, {
                samePhaseAttempts: SPLIT_THRESHOLDS.SAME_PHASE_STUCK_COUNT,
            });
            expect(result.shouldSplit).toBe(true);
            expect(result.trigger).toBe(SplitTrigger.SAME_PHASE_STUCK);
        });

        test('should return true for partial progress', () => {
            const execution = {
                taskId: 'TASK1',
                phases: [
                    { id: 'p1', status: 'completed' },
                    { id: 'p2', status: 'in_progress' },
                    { id: 'p3', status: 'in_progress' },
                ],
            };
            const result = shouldSplitTask(execution);
            expect(result.shouldSplit).toBe(true);
            expect(result.trigger).toBe(SplitTrigger.PARTIAL_PROGRESS);
        });

        test('should return true for scope too large', () => {
            const phases = Array.from({ length: 10 }, (_, i) => ({
                id: `p${i + 1}`,
                status: 'pending',
            }));
            const execution = { taskId: 'TASK1', phases };
            const result = shouldSplitTask(execution);
            expect(result.shouldSplit).toBe(true);
            expect(result.trigger).toBe(SplitTrigger.SCOPE_TOO_LARGE);
        });

        test('should return false when no split needed', () => {
            const execution = {
                taskId: 'TASK1',
                phases: [
                    { id: 'p1', status: 'in_progress' },
                    { id: 'p2', status: 'pending' },
                ],
            };
            const result = shouldSplitTask(execution);
            expect(result.shouldSplit).toBe(false);
        });
    });

    describe('generateSplitPlan', () => {
        test('should generate plan with subtasks', () => {
            const execution = {
                taskId: 'TASK1',
                phases: [
                    { id: 'p1', name: 'Phase 1', status: 'completed' },
                    { id: 'p2', name: 'Phase 2', status: 'in_progress' },
                    { id: 'p3', name: 'Phase 3', status: 'pending' },
                ],
                artifacts: [],
            };

            const plan = generateSplitPlan(execution, SplitTrigger.PARTIAL_PROGRESS);

            expect(plan.originalTaskId).toBe('TASK1');
            expect(plan.trigger).toBe(SplitTrigger.PARTIAL_PROGRESS);
            expect(plan.preservedProgress.completedPhases).toBe(1);
            expect(plan.subtasks.length).toBeGreaterThan(0);
        });

        test('should create individual subtasks for same phase stuck', () => {
            const execution = {
                taskId: 'TASK1',
                phases: [
                    { id: 'p1', status: 'in_progress' },
                    { id: 'p2', status: 'pending' },
                ],
                artifacts: [],
            };

            const plan = generateSplitPlan(execution, SplitTrigger.SAME_PHASE_STUCK);

            expect(plan.subtasks).toHaveLength(2);
            expect(plan.subtasks[0].phases).toHaveLength(1);
            expect(plan.subtasks[1].phases).toHaveLength(1);
        });
    });

    describe('groupPhasesIntoSubtasks', () => {
        test('should return empty array for empty phases', () => {
            expect(groupPhasesIntoSubtasks([], SplitTrigger.PARTIAL_PROGRESS)).toEqual([]);
        });

        test('should create individual groups for same phase stuck', () => {
            const phases = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
            const result = groupPhasesIntoSubtasks(phases, SplitTrigger.SAME_PHASE_STUCK);
            expect(result).toHaveLength(3);
            expect(result[0]).toHaveLength(1);
        });

        test('should group phases up to max per subtask', () => {
            const phases = Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}` }));
            const result = groupPhasesIntoSubtasks(phases, SplitTrigger.PARTIAL_PROGRESS);

            const maxPerSubtask = SPLIT_THRESHOLDS.MAX_PHASES_PER_SUBTASK;
            expect(result.length).toBe(Math.ceil(7 / maxPerSubtask));
            expect(result[0].length).toBeLessThanOrEqual(maxPerSubtask);
        });
    });

    describe('getCompletedArtifacts', () => {
        test('should return empty array for null execution', () => {
            expect(getCompletedArtifacts(null)).toEqual([]);
        });

        test('should filter completed artifacts', () => {
            const execution = {
                artifacts: [
                    { path: 'file1.js', verified: true },
                    { path: 'file2.js', verified: false },
                    { path: 'file3.js', created: true },
                    { path: 'file4.js', status: 'completed' },
                ],
            };
            const result = getCompletedArtifacts(execution);
            expect(result).toHaveLength(3);
        });
    });

    describe('splitTaskMidExecution', () => {
        test('should fail without claudiomiroFolder', () => {
            const result = splitTaskMidExecution('TASK1', {}, { subtasks: [{}] });
            expect(result.success).toBe(false);
            expect(result.error).toContain('claudiomiroFolder');
        });

        test('should fail with invalid split plan', () => {
            const result = splitTaskMidExecution('TASK1', {}, null, {
                claudiomiroFolder: '/tmp/test',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid split plan');
        });

        test('should create subtask folders and files', () => {
            const execution = {
                taskId: 'TASK1',
                phases: [
                    { id: 'p1', name: 'Phase 1', status: 'completed' },
                    { id: 'p2', name: 'Phase 2', status: 'in_progress' },
                ],
                artifacts: [],
            };

            const splitPlan = {
                trigger: SplitTrigger.PARTIAL_PROGRESS,
                preservedProgress: { completedPhases: 1, completedArtifacts: [] },
                subtasks: [
                    { index: 1, suffix: '.2', phases: [{ id: 'p2', name: 'Phase 2' }], dependsOn: null },
                ],
            };

            const result = splitTaskMidExecution('TASK1', execution, splitPlan, {
                claudiomiroFolder: '/tmp/test',
            });

            expect(result.success).toBe(true);
            expect(result.subtasks).toContain('TASK1.2');
            expect(fs.mkdirSync).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should handle fs errors gracefully', () => {
            fs.mkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const splitPlan = {
                subtasks: [{ index: 1, suffix: '.1', phases: [] }],
                preservedProgress: { completedPhases: 0 },
            };

            const result = splitTaskMidExecution('TASK1', {}, splitPlan, {
                claudiomiroFolder: '/tmp/test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
        });
    });

    describe('generateSubtaskBlueprint', () => {
        test('should generate blueprint with parent reference', () => {
            const subtask = {
                suffix: '.2',
                phases: [{ id: 'p2', name: 'Phase 2', items: [{ description: 'Item 1' }] }],
                dependsOn: 'TASK1.1',
            };
            const parentExecution = {
                phases: [{ status: 'completed' }],
            };

            const blueprint = generateSubtaskBlueprint('TASK1', subtask, parentExecution);

            expect(blueprint).toContain('TASK1.2');
            expect(blueprint).toContain('Parent Task:');
            expect(blueprint).toContain('Phase 2');
            expect(blueprint).toContain('TASK1.1');
        });
    });

    describe('generateSubtaskTaskMd', () => {
        test('should generate TASK.md with dependencies', () => {
            const subtask = {
                suffix: '.2',
                index: 2,
                dependsOn: 'TASK1.1',
            };
            const parentExecution = {};

            const taskMd = generateSubtaskTaskMd('TASK1', subtask, parentExecution);

            expect(taskMd).toContain('TASK1.2');
            expect(taskMd).toContain('@dependencies [TASK1.1]');
            expect(taskMd).toContain('Subtask index: 2');
        });

        test('should generate TASK.md without dependencies for first subtask', () => {
            const subtask = {
                suffix: '.1',
                index: 1,
                dependsOn: null,
            };

            const taskMd = generateSubtaskTaskMd('TASK1', subtask, {});

            expect(taskMd).toContain('@dependencies []');
        });
    });

    describe('generateSubtaskExecution', () => {
        test('should generate execution.json with inherited progress', () => {
            const subtask = {
                suffix: '.2',
                phases: [{ id: 'p2', name: 'Phase 2', items: [{ description: 'Item 1' }] }],
            };
            const parentExecution = {
                phases: [{ status: 'completed' }],
                artifacts: [{ path: 'file.js', verified: true }],
            };

            const execution = generateSubtaskExecution('TASK1', subtask, parentExecution);

            expect(execution.taskId).toBe('TASK1.2');
            expect(execution.parentTask).toBe('TASK1');
            expect(execution.status).toBe('pending');
            expect(execution.inheritedProgress.completedPhases).toBe(1);
            expect(execution.phases).toHaveLength(1);
            expect(execution.phases[0].status).toBe('pending');
        });
    });

    describe('preserveProgressToSubtasks', () => {
        test('should preserve completed phases and artifacts', () => {
            const parentExecution = {
                phases: [
                    { id: 'p1', name: 'Phase 1', status: 'completed' },
                    { id: 'p2', name: 'Phase 2', status: 'in_progress' },
                ],
                artifacts: [
                    { path: 'file1.js', verified: true },
                    { path: 'file2.js', verified: false },
                ],
            };

            const result = preserveProgressToSubtasks(parentExecution, ['TASK1.2', 'TASK1.3']);

            expect(result.completedPhases).toBe(1);
            expect(result.completedArtifacts).toBe(1);
            expect(result.subtasks).toEqual(['TASK1.2', 'TASK1.3']);
            expect(result.details.phases).toContain('Phase 1');
        });
    });

    describe('hasBeenSplit', () => {
        test('should return false for null execution', () => {
            expect(hasBeenSplit(null)).toBe(false);
        });

        test('should return false for non-split execution', () => {
            expect(hasBeenSplit({ status: 'in_progress' })).toBe(false);
        });

        test('should return true for split execution', () => {
            const execution = {
                status: 'split',
                splitInfo: { subtasks: ['TASK1.1'] },
            };
            expect(hasBeenSplit(execution)).toBe(true);
        });
    });

    describe('getSubtaskNames', () => {
        test('should return empty array for non-split execution', () => {
            expect(getSubtaskNames({ status: 'in_progress' })).toEqual([]);
        });

        test('should return subtask names for split execution', () => {
            const execution = {
                status: 'split',
                splitInfo: { subtasks: ['TASK1.1', 'TASK1.2'] },
            };
            expect(getSubtaskNames(execution)).toEqual(['TASK1.1', 'TASK1.2']);
        });
    });

    describe('SPLIT_THRESHOLDS', () => {
        test('should have reasonable values', () => {
            expect(SPLIT_THRESHOLDS.MIN_PHASES_FOR_SPLIT).toBeGreaterThanOrEqual(2);
            expect(SPLIT_THRESHOLDS.MAX_PHASES_PER_SUBTASK).toBeGreaterThanOrEqual(1);
            expect(SPLIT_THRESHOLDS.SAME_PHASE_STUCK_COUNT).toBeGreaterThanOrEqual(3);
            expect(SPLIT_THRESHOLDS.PARTIAL_PROGRESS_THRESHOLD).toBeGreaterThan(0);
            expect(SPLIT_THRESHOLDS.PARTIAL_PROGRESS_THRESHOLD).toBeLessThan(1);
        });
    });
});
