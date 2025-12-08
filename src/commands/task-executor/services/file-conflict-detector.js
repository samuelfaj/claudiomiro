/**
 * File Conflict Detector
 *
 * Detects and auto-resolves file conflicts between parallel tasks.
 * Prevents multiple tasks from modifying the same file simultaneously.
 */

/**
 * Parses @files tag from BLUEPRINT.md content
 * @param {string} blueprintContent - Content of BLUEPRINT.md
 * @returns {string[]} Array of file paths declared in @files tag
 */
const parseFilesTag = (blueprintContent) => {
    if (!blueprintContent) return [];

    const match = blueprintContent.match(/@files\s*\[([^\]]*)\]/i);
    if (!match) return [];

    return match[1]
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0);
};

/**
 * Checks if two tasks can run in parallel (no dependency relationship)
 * @param {Object} taskGraph - Task graph with deps
 * @param {string} task1 - First task name
 * @param {string} task2 - Second task name
 * @returns {boolean} True if tasks can run in parallel
 */
const canRunInParallel = (taskGraph, task1, task2) => {
    const task1Data = taskGraph[task1];
    const task2Data = taskGraph[task2];

    if (!task1Data || !task2Data) return false;

    // If one depends on the other, they will run sequentially
    if (task1Data.deps.includes(task2) || task2Data.deps.includes(task1)) {
        return false;
    }

    // Check transitive dependencies
    const getDepsRecursive = (taskName, visited = new Set()) => {
        if (visited.has(taskName)) return visited;
        visited.add(taskName);

        const task = taskGraph[taskName];
        if (!task || !task.deps) return visited;

        for (const dep of task.deps) {
            getDepsRecursive(dep, visited);
        }
        return visited;
    };

    const task1Deps = getDepsRecursive(task1);
    const task2Deps = getDepsRecursive(task2);

    // If task1 is in task2's transitive deps or vice versa, they run sequentially
    if (task1Deps.has(task2) || task2Deps.has(task1)) {
        return false;
    }

    return true;
};

/**
 * Detects file conflicts between tasks that could run in parallel
 * @param {Object} taskGraph - Task graph { TASK1: { deps: [], files: [], status: 'pending' }, ... }
 * @returns {Object[]} Array of conflicts: [{ task1, task2, files: [] }]
 */
const detectFileConflicts = (taskGraph) => {
    const conflicts = [];
    const tasks = Object.keys(taskGraph);

    for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
            const task1 = tasks[i];
            const task2 = tasks[j];

            // Skip if tasks won't run in parallel
            if (!canRunInParallel(taskGraph, task1, task2)) {
                continue;
            }

            // Check file overlap
            const files1 = taskGraph[task1].files || [];
            const files2 = taskGraph[task2].files || [];

            // Normalize paths for comparison
            const normalizedFiles1 = files1.map(f => f.toLowerCase().replace(/\\/g, '/'));
            const normalizedFiles2 = files2.map(f => f.toLowerCase().replace(/\\/g, '/'));

            const overlap = files1.filter((f, idx) =>
                normalizedFiles2.includes(normalizedFiles1[idx]),
            );

            if (overlap.length > 0) {
                conflicts.push({
                    task1,
                    task2,
                    files: overlap,
                });
            }
        }
    }

    return conflicts;
};

/**
 * Auto-resolve conflicts by adding dependencies to serialize conflicting tasks
 * Strategy: Alphabetically earlier task runs first, later task depends on it
 * @param {Object} taskGraph - Task graph (will be mutated)
 * @param {Object[]} conflicts - Array of conflicts from detectFileConflicts
 * @returns {Object[]} Array of resolutions applied
 */
const autoResolveConflicts = (taskGraph, conflicts) => {
    const resolutions = [];

    for (const conflict of conflicts) {
        // Sort alphabetically for consistent ordering
        const [first, second] = [conflict.task1, conflict.task2].sort();

        // Add dependency: second depends on first
        if (!taskGraph[second].deps.includes(first)) {
            taskGraph[second].deps.push(first);
            resolutions.push({
                task1: first,
                task2: second,
                files: conflict.files,
                resolution: `${second} now depends on ${first}`,
            });
        }
    }

    return resolutions;
};

/**
 * Suggests dependency additions to resolve conflicts (without mutating)
 * @param {Object[]} conflicts - Array of conflicts from detectFileConflicts
 * @returns {Object[]} Array of suggestions
 */
const suggestDependencyFixes = (conflicts) => {
    return conflicts.map(c => {
        const [first, second] = [c.task1, c.task2].sort();
        return {
            ...c,
            suggestion: `Add @dependencies [${first}] to ${second}'s BLUEPRINT.md`,
        };
    });
};

/**
 * Validates that all tasks have @files declarations
 * @param {Object} taskGraph - Task graph
 * @returns {string[]} Array of task names missing @files
 */
const findTasksMissingFiles = (taskGraph) => {
    return Object.entries(taskGraph)
        .filter(([, task]) => !task.files || task.files.length === 0)
        .map(([name]) => name);
};

module.exports = {
    parseFilesTag,
    canRunInParallel,
    detectFileConflicts,
    autoResolveConflicts,
    suggestDependencyFixes,
    findTasksMissingFiles,
};
