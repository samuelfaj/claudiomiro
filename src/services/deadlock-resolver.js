const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('./claude-executor');

/**
 * Analyzes and resolves circular dependencies in task graph
 * Uses AI to intelligently break cycles while preserving logical task order
 * @returns {boolean} true if deadlock was successfully resolved, false otherwise
 */
const resolveDeadlock = async (tasks, pendingTasks) => {
    logger.info('🤖 Attempting to resolve deadlock with AI...');
    logger.newline();

    // Build context about the deadlock
    const deadlockInfo = buildDeadlockContext(tasks, pendingTasks);

    // Read TASK.md files for context
    const taskContents = await readTaskFiles(pendingTasks);

    // Build the prompt
    const prompt = buildResolverPrompt(deadlockInfo, taskContents);

    logger.startSpinner('Analyzing circular dependencies...');

    try {
        await executeClaude(prompt);
        logger.stopSpinner();

        // Verify that cycles were actually broken by re-reading TASK.md files
        logger.startSpinner('Verifying deadlock resolution...');

        const updatedTasks = await rebuildTaskGraphFromFiles(pendingTasks);
        const remainingCycles = detectCycles(updatedTasks);

        logger.stopSpinner();

        if (remainingCycles.length > 0) {
            logger.warning('⚠️ Cycles still detected after AI resolution:');
            for (const cycle of remainingCycles) {
                logger.warning(`   ${cycle.join(' → ')}`);
            }
            return false;
        }

        logger.success('✅ Deadlock resolution verified - no cycles remaining');
        return true;
    } catch (error) {
        logger.stopSpinner();
        logger.error(`❌ Failed to resolve deadlock: ${error.message}`);
        return false;
    }
};

/**
 * Rebuilds task graph from TASK.md files to get updated dependencies
 */
const rebuildTaskGraphFromFiles = async (pendingTasks) => {
    const tasks = {};

    for (const [taskName] of pendingTasks) {
        const taskMdPath = path.join(state.claudiomiroFolder, taskName, 'TASK.md');
        if (fs.existsSync(taskMdPath)) {
            const content = fs.readFileSync(taskMdPath, 'utf-8');
            const deps = parseDependencies(content);
            tasks[taskName] = { deps, status: 'pending' };
        }
    }

    return tasks;
};

/**
 * Parses @dependencies from TASK.md content
 */
const parseDependencies = (content) => {
    // Match @dependencies [TASK1, TASK2] or @dependencies TASK1, TASK2
    const match = content.match(/@dependencies\s*\[?([^\]\n]*)\]?/i);
    if (!match) return [];

    const depsStr = match[1].trim();
    if (!depsStr || depsStr.toLowerCase() === 'none') return [];

    return depsStr
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);
};

/**
 * Builds context about the deadlock for the AI
 */
const buildDeadlockContext = (tasks, pendingTasks) => {
    const cycles = detectCycles(tasks);

    const context = {
        pendingTasks: pendingTasks.map(([name, task]) => ({
            name,
            deps: task.deps,
            waitingFor: task.deps.filter(d => !tasks[d] || tasks[d].status !== 'completed')
        })),
        completedTasks: Object.entries(tasks)
            .filter(([, t]) => t.status === 'completed')
            .map(([name]) => name),
        cycles
    };

    return context;
};

/**
 * Detects circular dependencies in the task graph
 * Returns array of cycles found
 */
const detectCycles = (tasks) => {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    const dfs = (taskName) => {
        if (recursionStack.has(taskName)) {
            // Found a cycle - extract it
            const cycleStart = path.indexOf(taskName);
            if (cycleStart !== -1) {
                const cycle = path.slice(cycleStart).concat(taskName);
                cycles.push(cycle);
            }
            return;
        }

        if (visited.has(taskName)) return;

        visited.add(taskName);
        recursionStack.add(taskName);
        path.push(taskName);

        const task = tasks[taskName];
        if (task && task.deps) {
            for (const dep of task.deps) {
                if (tasks[dep]) {
                    dfs(dep);
                }
            }
        }

        path.pop();
        recursionStack.delete(taskName);
    };

    for (const taskName of Object.keys(tasks)) {
        if (!visited.has(taskName)) {
            dfs(taskName);
        }
    }

    return cycles;
};

/**
 * Reads TASK.md files for the pending tasks
 */
const readTaskFiles = async (pendingTasks) => {
    const contents = {};

    for (const [taskName] of pendingTasks) {
        const taskMdPath = path.join(state.claudiomiroFolder, taskName, 'TASK.md');
        if (fs.existsSync(taskMdPath)) {
            contents[taskName] = fs.readFileSync(taskMdPath, 'utf-8');
        }
    }

    return contents;
};

/**
 * Builds the prompt for the AI to resolve the deadlock
 */
const buildResolverPrompt = (deadlockInfo, taskContents) => {
    const cyclesText = deadlockInfo.cycles.length > 0
        ? deadlockInfo.cycles.map(c => `  - ${c.join(' → ')}`).join('\n')
        : '  (Unable to detect specific cycles, but tasks are blocked)';

    const pendingTasksText = deadlockInfo.pendingTasks
        .map(t => `  - ${t.name}: depends on [${t.deps.join(', ')}], waiting for [${t.waitingFor.join(', ')}]`)
        .join('\n');

    const completedTasksText = deadlockInfo.completedTasks.length > 0
        ? deadlockInfo.completedTasks.join(', ')
        : '(none)';

    const taskContentsText = Object.entries(taskContents)
        .map(([name, content]) => `\n### ${name}/TASK.md\n\`\`\`\n${content}\n\`\`\``)
        .join('\n');

    return `# CRITICAL: Resolve Circular Dependency Deadlock

## 🎯 YOUR MISSION

You are a dependency resolution expert. A deadlock has been detected in the task execution graph due to circular dependencies. Your job is to analyze the situation and fix the @dependencies in the TASK.md files to break the cycles while preserving the logical execution order.

## 📊 DEADLOCK ANALYSIS

### Circular Dependencies Detected:
${cyclesText}

### Pending Tasks (Blocked):
${pendingTasksText}

### Completed Tasks:
${completedTasksText}

## 📄 TASK.md CONTENTS
${taskContentsText}

## 🔧 YOUR TASK

1. **Analyze** each circular dependency cycle
2. **Understand** the actual logical dependencies between tasks by reading their descriptions
3. **Determine** which dependency in each cycle should be removed or modified
4. **Edit** the TASK.md files to fix the @dependencies lines

## 📋 RESOLUTION STRATEGY

When breaking cycles, consider:

1. **Temporal Logic**: Which task logically needs to happen first based on the task description?
2. **Data Dependencies**: Does Task A actually need output from Task B, or is it just a suggested order?
3. **Minimal Changes**: Remove the fewest dependencies necessary to break all cycles
4. **Preserve Intent**: Keep dependencies that represent real requirements

### Common Patterns:

- If TASK_A and TASK_B both depend on each other, one dependency is usually wrong
- If TASK_A "sets up" something and TASK_B "uses" it, TASK_B should depend on TASK_A (not vice versa)
- If tasks are independent features, they might not need to depend on each other at all
- Look for tasks that could run in parallel but were incorrectly made sequential

## ⚠️ RULES

1. **MUST** edit the actual TASK.md files in ${state.claudiomiroFolder}
2. **MUST** preserve the @dependencies line format: \`@dependencies [TASK1, TASK2]\` or \`@dependencies TASK1, TASK2\`
3. **MUST** ensure no cycles remain after your edits
4. **MUST NOT** remove ALL dependencies - only those causing cycles
5. **MUST NOT** change task descriptions or other content - only @dependencies lines
6. If a task has no dependencies after fixing, use: \`@dependencies []\` or \`@dependencies none\`

## 📝 OUTPUT

After editing the files, briefly explain:
1. Which cycles you found
2. Which dependencies you removed/changed
3. Why you chose to break the cycle that way

## 🚀 BEGIN

Analyze the circular dependencies and edit the TASK.md files to resolve the deadlock.
`;
};

module.exports = { resolveDeadlock, detectCycles, parseDependencies, rebuildTaskGraphFromFiles };
