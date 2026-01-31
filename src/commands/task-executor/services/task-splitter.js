/**
 * Task Splitter
 *
 * Handles mid-execution task splitting when a task is too complex
 * to complete in a single execution cycle. Preserves progress from
 * the parent task and creates smaller, manageable subtasks.
 */

const fs = require('fs');
const path = require('path');

/**
 * Triggers that indicate a task should be split
 */
const SplitTrigger = {
    SAME_PHASE_STUCK: 'same-phase-stuck',       // 5+ attempts on same phase
    PARTIAL_PROGRESS: 'partial-progress',        // Some phases done, rest failing
    EXPLICIT_SUGGESTION: 'explicit-suggestion',  // AI explicitly suggests split
    SCOPE_TOO_LARGE: 'scope-too-large',         // Too many phases/artifacts
};

/**
 * Thresholds for split detection
 */
const SPLIT_THRESHOLDS = {
    MIN_PHASES_FOR_SPLIT: 2,          // Minimum phases to consider splitting
    MAX_PHASES_PER_SUBTASK: 3,        // Maximum phases per subtask
    SAME_PHASE_STUCK_COUNT: 5,        // Attempts stuck on same phase
    PARTIAL_PROGRESS_THRESHOLD: 0.3,  // 30% progress with 70% failing
    MAX_ARTIFACTS_PER_SUBTASK: 5,     // Maximum artifacts per subtask
};

/**
 * Checks if a task should be split based on execution state
 * @param {Object} execution - execution.json content
 * @param {Object} options - Additional options
 * @returns {{shouldSplit: boolean, trigger: string|null, reason: string, splitPlan: Object|null}}
 */
const shouldSplitTask = (execution, options = {}) => {
    if (!execution || !execution.phases) {
        return {
            shouldSplit: false,
            trigger: null,
            reason: 'No phases to split',
            splitPlan: null,
        };
    }

    const { stuckCount: _stuckCount = 0, samePhaseAttempts = 0 } = options;
    const phases = execution.phases;
    const totalPhases = phases.length;

    // Not enough phases to split
    if (totalPhases < SPLIT_THRESHOLDS.MIN_PHASES_FOR_SPLIT) {
        return {
            shouldSplit: false,
            trigger: null,
            reason: `Only ${totalPhases} phase(s), minimum ${SPLIT_THRESHOLDS.MIN_PHASES_FOR_SPLIT} required`,
            splitPlan: null,
        };
    }

    // Check for same phase stuck
    if (samePhaseAttempts >= SPLIT_THRESHOLDS.SAME_PHASE_STUCK_COUNT) {
        return {
            shouldSplit: true,
            trigger: SplitTrigger.SAME_PHASE_STUCK,
            reason: `Stuck on same phase for ${samePhaseAttempts} attempts`,
            splitPlan: generateSplitPlan(execution, SplitTrigger.SAME_PHASE_STUCK),
        };
    }

    // Check for partial progress
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const failingPhases = phases.filter(p => p.status !== 'completed' && p.status !== 'pending').length;

    if (completedPhases > 0 && failingPhases > 0) {
        const progressRatio = completedPhases / totalPhases;
        if (progressRatio >= SPLIT_THRESHOLDS.PARTIAL_PROGRESS_THRESHOLD) {
            return {
                shouldSplit: true,
                trigger: SplitTrigger.PARTIAL_PROGRESS,
                reason: `${completedPhases}/${totalPhases} phases completed, rest failing`,
                splitPlan: generateSplitPlan(execution, SplitTrigger.PARTIAL_PROGRESS),
            };
        }
    }

    // Check for scope too large
    if (totalPhases > SPLIT_THRESHOLDS.MAX_PHASES_PER_SUBTASK * 2) {
        return {
            shouldSplit: true,
            trigger: SplitTrigger.SCOPE_TOO_LARGE,
            reason: `Task has ${totalPhases} phases, exceeds recommended ${SPLIT_THRESHOLDS.MAX_PHASES_PER_SUBTASK * 2}`,
            splitPlan: generateSplitPlan(execution, SplitTrigger.SCOPE_TOO_LARGE),
        };
    }

    return {
        shouldSplit: false,
        trigger: null,
        reason: 'No split needed',
        splitPlan: null,
    };
};

/**
 * Generates a split plan based on trigger type
 * @param {Object} execution - execution.json content
 * @param {string} trigger - Split trigger type
 * @returns {Object} Split plan with subtasks
 */
const generateSplitPlan = (execution, trigger) => {
    const phases = execution.phases || [];
    const completedPhases = phases.filter(p => p.status === 'completed');
    const remainingPhases = phases.filter(p => p.status !== 'completed');

    const plan = {
        trigger,
        originalTaskId: execution.taskId,
        preservedProgress: {
            completedPhases: completedPhases.length,
            completedArtifacts: getCompletedArtifacts(execution),
        },
        subtasks: [],
    };

    // Group remaining phases into subtasks
    const subtasks = groupPhasesIntoSubtasks(remainingPhases, trigger);

    for (let i = 0; i < subtasks.length; i++) {
        plan.subtasks.push({
            index: i + 1,
            suffix: `.${completedPhases.length + i + 1}`,
            phases: subtasks[i],
            dependsOn: i === 0 ? null : `${execution.taskId}.${completedPhases.length + i}`,
        });
    }

    return plan;
};

/**
 * Groups phases into subtasks based on trigger type
 * @param {Object[]} phases - Array of phase objects
 * @param {string} trigger - Split trigger type
 * @returns {Object[][]} Array of phase groups
 */
const groupPhasesIntoSubtasks = (phases, trigger) => {
    if (phases.length === 0) return [];

    const maxPerSubtask = SPLIT_THRESHOLDS.MAX_PHASES_PER_SUBTASK;
    const subtasks = [];

    // For same phase stuck, create individual subtasks for each phase
    if (trigger === SplitTrigger.SAME_PHASE_STUCK) {
        for (const phase of phases) {
            subtasks.push([phase]);
        }
        return subtasks;
    }

    // For other triggers, group phases up to max per subtask
    let currentGroup = [];
    for (const phase of phases) {
        currentGroup.push(phase);
        if (currentGroup.length >= maxPerSubtask) {
            subtasks.push(currentGroup);
            currentGroup = [];
        }
    }

    // Add remaining phases
    if (currentGroup.length > 0) {
        subtasks.push(currentGroup);
    }

    return subtasks;
};

/**
 * Gets list of completed artifacts from execution
 * @param {Object} execution - execution.json content
 * @returns {Object[]} Array of completed artifacts
 */
const getCompletedArtifacts = (execution) => {
    if (!execution || !execution.artifacts) return [];

    return execution.artifacts.filter(artifact =>
        artifact.verified === true ||
        artifact.created === true ||
        artifact.status === 'completed',
    );
};

/**
 * Executes a mid-execution task split
 * @param {string} taskName - Original task name
 * @param {Object} execution - Current execution state
 * @param {Object} splitPlan - Split plan from shouldSplitTask
 * @param {Object} options - Additional options
 * @returns {{success: boolean, parentTask: string, subtasks: string[], error: string|null}}
 */
const splitTaskMidExecution = (taskName, execution, splitPlan, options = {}) => {
    const { claudiomiroFolder } = options;

    if (!claudiomiroFolder) {
        return {
            success: false,
            parentTask: taskName,
            subtasks: [],
            error: 'claudiomiroFolder is required',
        };
    }

    if (!splitPlan || !splitPlan.subtasks || splitPlan.subtasks.length === 0) {
        return {
            success: false,
            parentTask: taskName,
            subtasks: [],
            error: 'Invalid split plan',
        };
    }

    const taskFolder = path.join(claudiomiroFolder, taskName);
    const createdSubtasks = [];

    try {
        // Create subtask folders and files
        for (const subtask of splitPlan.subtasks) {
            const subtaskName = `${taskName}${subtask.suffix}`;
            const subtaskFolder = path.join(claudiomiroFolder, subtaskName);

            // Create folder
            if (!fs.existsSync(subtaskFolder)) {
                fs.mkdirSync(subtaskFolder, { recursive: true });
            }

            // Generate and write BLUEPRINT.md
            const blueprint = generateSubtaskBlueprint(taskName, subtask, execution, options);
            fs.writeFileSync(path.join(subtaskFolder, 'BLUEPRINT.md'), blueprint);

            // Generate and write TASK.md with dependencies
            const taskMd = generateSubtaskTaskMd(taskName, subtask, execution);
            fs.writeFileSync(path.join(subtaskFolder, 'TASK.md'), taskMd);

            // Generate initial execution.json
            const subtaskExecution = generateSubtaskExecution(taskName, subtask, execution);
            fs.writeFileSync(
                path.join(subtaskFolder, 'execution.json'),
                JSON.stringify(subtaskExecution, null, 2),
            );

            createdSubtasks.push(subtaskName);
        }

        // Update parent task as split
        const updatedParentExecution = {
            ...execution,
            status: 'split',
            splitInfo: {
                splitAt: new Date().toISOString(),
                trigger: splitPlan.trigger,
                subtasks: createdSubtasks,
                completedPhasesPreserved: splitPlan.preservedProgress.completedPhases,
            },
        };

        fs.writeFileSync(
            path.join(taskFolder, 'execution.json'),
            JSON.stringify(updatedParentExecution, null, 2),
        );

        return {
            success: true,
            parentTask: taskName,
            subtasks: createdSubtasks,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            parentTask: taskName,
            subtasks: createdSubtasks,
            error: error.message,
        };
    }
};

/**
 * Generates BLUEPRINT.md content for a subtask
 * @param {string} parentTaskName - Parent task name
 * @param {Object} subtask - Subtask definition
 * @param {Object} parentExecution - Parent execution state
 * @param {Object} options - Additional options
 * @returns {string} BLUEPRINT.md content
 */
const generateSubtaskBlueprint = (parentTaskName, subtask, parentExecution, _options = {}) => {
    const phaseNames = subtask.phases.map(p => p.name || p.id).join(', ');

    return `# BLUEPRINT.md - ${parentTaskName}${subtask.suffix}

## Task Identity

- **ID:** ${parentTaskName}${subtask.suffix}
- **Parent Task:** ${parentTaskName}
- **Type:** Subtask (Split from parent)
- **Created:** ${new Date().toISOString()}

## Context Chain

This subtask was created by splitting parent task \`${parentTaskName}\`.

**Split Reason:** Task was too complex for single execution.

**Inherited Progress:**
- Completed phases from parent: ${parentExecution.phases?.filter(p => p.status === 'completed').length || 0}
- This subtask handles: ${phaseNames}

## Scope

### Phases to Complete

${subtask.phases.map((phase, i) => `
#### Phase ${i + 1}: ${phase.name || phase.id}

${phase.items ? phase.items.map(item => `- [ ] ${item.description || item}`).join('\n') : '- [ ] Complete phase items'}
`).join('\n')}

### Dependencies

${subtask.dependsOn ? `This subtask depends on: \`${subtask.dependsOn}\`` : 'No dependencies (first subtask after completed phases)'}

## Success Criteria

${subtask.phases.map(phase => `- [ ] Phase "${phase.name || phase.id}" completed successfully`).join('\n')}

## Notes

- Focus ONLY on the phases listed above
- Do NOT attempt to complete other phases
- Document any blockers for parent task reference
`;
};

/**
 * Generates TASK.md content for a subtask
 * @param {string} parentTaskName - Parent task name
 * @param {Object} subtask - Subtask definition
 * @param {Object} parentExecution - Parent execution state
 * @returns {string} TASK.md content
 */
const generateSubtaskTaskMd = (parentTaskName, subtask, _parentExecution) => {
    const dependencies = subtask.dependsOn ? [subtask.dependsOn] : [];

    return `# Task: ${parentTaskName}${subtask.suffix}

## Description

Subtask split from \`${parentTaskName}\`. This task handles a portion of the original work.

## Dependencies

${dependencies.length > 0
        ? `@dependencies [${dependencies.join(', ')}]`
        : '@dependencies []'}

## Files

@files []

## Priority

Same as parent task.

## Notes

- This is an auto-generated subtask
- Parent task: ${parentTaskName}
- Subtask index: ${subtask.index}
`;
};

/**
 * Generates initial execution.json for a subtask
 * @param {string} parentTaskName - Parent task name
 * @param {Object} subtask - Subtask definition
 * @param {Object} parentExecution - Parent execution state
 * @returns {Object} execution.json content
 */
const generateSubtaskExecution = (parentTaskName, subtask, parentExecution) => {
    return {
        taskId: `${parentTaskName}${subtask.suffix}`,
        parentTask: parentTaskName,
        status: 'pending',
        attempts: 0,
        currentStrategy: 'original',
        inheritedProgress: {
            fromParent: parentTaskName,
            completedPhases: parentExecution.phases?.filter(p => p.status === 'completed').length || 0,
            inheritedArtifacts: getCompletedArtifacts(parentExecution),
        },
        phases: subtask.phases.map(phase => ({
            ...phase,
            status: 'pending',
            items: phase.items?.map(item => ({
                ...item,
                completed: false,
            })),
        })),
        successCriteria: subtask.phases.map(phase => ({
            criterion: `Phase "${phase.name || phase.id}" completed`,
            passed: false,
        })),
        artifacts: [],
        errorHistory: [],
        createdAt: new Date().toISOString(),
    };
};

/**
 * Preserves progress from parent task to subtasks
 * @param {Object} parentExecution - Parent task's execution.json
 * @param {string[]} subtaskNames - Names of new subtasks
 * @returns {Object} Progress preservation info
 */
const preserveProgressToSubtasks = (parentExecution, subtaskNames) => {
    const completedPhases = parentExecution.phases?.filter(p => p.status === 'completed') || [];
    const completedArtifacts = getCompletedArtifacts(parentExecution);

    return {
        completedPhases: completedPhases.length,
        completedArtifacts: completedArtifacts.length,
        subtasks: subtaskNames,
        preservedAt: new Date().toISOString(),
        details: {
            phases: completedPhases.map(p => p.name || p.id),
            artifacts: completedArtifacts.map(a => a.path),
        },
    };
};

/**
 * Checks if task has already been split
 * @param {Object} execution - execution.json content
 * @returns {boolean} True if task has been split
 */
const hasBeenSplit = (execution) => {
    return Boolean(execution && execution.status === 'split' && execution.splitInfo);
};

/**
 * Gets subtask names from split info
 * @param {Object} execution - execution.json content
 * @returns {string[]} Array of subtask names
 */
const getSubtaskNames = (execution) => {
    if (!hasBeenSplit(execution)) return [];
    return execution.splitInfo?.subtasks || [];
};

module.exports = {
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
    // Exported for testing
    groupPhasesIntoSubtasks,
    getCompletedArtifacts,
};
