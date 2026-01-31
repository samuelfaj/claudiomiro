/**
 * Conflict Analyzer
 *
 * Detects conflicting requirements BEFORE task execution begins.
 * Prevents wasting 20+ attempts on tasks that have fundamental
 * issues that should be resolved upfront.
 */

/**
 * Types of conflicts that can be detected
 */
const ConflictType = {
    MUTUALLY_EXCLUSIVE: 'mutually-exclusive',     // Two requirements cannot coexist
    CIRCULAR_DEPENDENCY: 'circular-dependency',    // Tasks depend on each other
    IMPOSSIBLE_SCOPE: 'impossible-scope',          // Task scope too large/complex
    MISSING_PREREQUISITE: 'missing-prerequisite',  // Required resource not available
    VERSION_CONFLICT: 'version-conflict',          // Incompatible version requirements
    AMBIGUOUS_REQUIREMENT: 'ambiguous-requirement', // Requirement is unclear
};

/**
 * Conflict severity levels
 */
const ConflictSeverity = {
    BLOCKING: 'blocking',   // Must be resolved before continuing
    WARNING: 'warning',     // Should be addressed but can proceed
    INFO: 'info',           // Informational, no action required
};

/**
 * Known mutually exclusive patterns
 */
const EXCLUSIVE_PATTERNS = [
    // Node version conflicts
    { pattern1: /node\s*(?:>=?\s*)?14/i, pattern2: /node\s*(?:>=?\s*)?18/i, type: 'node-version' },
    { pattern1: /commonjs/i, pattern2: /esm|es\s*modules?/i, type: 'module-system' },
    // Database conflicts
    { pattern1: /mongodb/i, pattern2: /postgresql|mysql|sqlite/i, type: 'database-type' },
    // Testing framework conflicts
    { pattern1: /jest/i, pattern2: /mocha|vitest/i, type: 'test-framework' },
    // Package manager conflicts
    { pattern1: /npm\s+install/i, pattern2: /yarn\s+add/i, type: 'package-manager' },
];

/**
 * Scope complexity indicators
 */
const SCOPE_INDICATORS = {
    HIGH_COMPLEXITY: [
        /refactor.*entire/i,
        /rewrite.*from\s*scratch/i,
        /migrate.*all/i,
        /complete\s*redesign/i,
        /overhaul/i,
    ],
    MULTIPLE_SYSTEMS: [
        /frontend\s*and\s*backend/i,
        /client\s*and\s*server/i,
        /multiple\s*services/i,
        /across.*repositories/i,
    ],
    LARGE_SCOPE: [
        /all\s*files/i,
        /every\s*component/i,
        /entire\s*codebase/i,
        /whole\s*application/i,
    ],
};

/**
 * Analyzes AI_PROMPT.md content for conflicting requirements
 * @param {string} content - AI_PROMPT.md content
 * @returns {{hasConflicts: boolean, hasBlockingConflicts: boolean, conflicts: Object[], suggestions: string[]}}
 */
const analyzeRequirementConflicts = (content) => {
    if (!content || typeof content !== 'string') {
        return {
            hasConflicts: false,
            hasBlockingConflicts: false,
            conflicts: [],
            suggestions: [],
        };
    }

    const conflicts = [];

    // Check for mutually exclusive patterns
    for (const exclusive of EXCLUSIVE_PATTERNS) {
        const match1 = exclusive.pattern1.test(content);
        const match2 = exclusive.pattern2.test(content);

        if (match1 && match2) {
            conflicts.push({
                type: ConflictType.MUTUALLY_EXCLUSIVE,
                severity: ConflictSeverity.BLOCKING,
                description: `Conflicting requirements detected: ${exclusive.type}`,
                details: {
                    pattern1: exclusive.pattern1.toString(),
                    pattern2: exclusive.pattern2.toString(),
                    conflictType: exclusive.type,
                },
                suggestion: `Choose one approach for ${exclusive.type} and remove conflicting requirement`,
            });
        }
    }

    // Check for scope complexity
    const scopeIssues = analyzeScopeComplexity(content);
    conflicts.push(...scopeIssues);

    // Check for ambiguous requirements
    const ambiguousIssues = detectAmbiguousRequirements(content);
    conflicts.push(...ambiguousIssues);

    return {
        hasConflicts: conflicts.length > 0,
        hasBlockingConflicts: conflicts.some(c => c.severity === ConflictSeverity.BLOCKING),
        conflicts,
        suggestions: generateSuggestions(conflicts),
    };
};

/**
 * Analyzes scope complexity indicators
 * @param {string} content - Content to analyze
 * @returns {Object[]} Array of scope-related conflicts
 */
const analyzeScopeComplexity = (content) => {
    const conflicts = [];

    // Check high complexity indicators
    for (const pattern of SCOPE_INDICATORS.HIGH_COMPLEXITY) {
        if (pattern.test(content)) {
            conflicts.push({
                type: ConflictType.IMPOSSIBLE_SCOPE,
                severity: ConflictSeverity.WARNING,
                description: 'High complexity indicator detected',
                details: { pattern: pattern.toString(), category: 'high-complexity' },
                suggestion: 'Consider breaking this task into smaller, incremental changes',
            });
        }
    }

    // Check multiple systems indicators
    let multiSystemCount = 0;
    for (const pattern of SCOPE_INDICATORS.MULTIPLE_SYSTEMS) {
        if (pattern.test(content)) {
            multiSystemCount++;
        }
    }

    if (multiSystemCount >= 2) {
        conflicts.push({
            type: ConflictType.IMPOSSIBLE_SCOPE,
            severity: ConflictSeverity.BLOCKING,
            description: 'Task spans multiple systems/components',
            details: { matchCount: multiSystemCount, category: 'multiple-systems' },
            suggestion: 'Split into separate tasks for each system/component',
        });
    }

    // Check large scope indicators
    for (const pattern of SCOPE_INDICATORS.LARGE_SCOPE) {
        if (pattern.test(content)) {
            conflicts.push({
                type: ConflictType.IMPOSSIBLE_SCOPE,
                severity: ConflictSeverity.WARNING,
                description: 'Large scope indicator detected',
                details: { pattern: pattern.toString(), category: 'large-scope' },
                suggestion: 'Limit scope to specific files or components',
            });
        }
    }

    return conflicts;
};

/**
 * Detects ambiguous requirements
 * @param {string} content - Content to analyze
 * @returns {Object[]} Array of ambiguity conflicts
 */
const detectAmbiguousRequirements = (content) => {
    const conflicts = [];

    const ambiguousPatterns = [
        { pattern: /make\s*it\s*better/i, issue: 'Vague improvement request' },
        { pattern: /fix\s*all\s*(?:the\s*)?bugs/i, issue: 'Undefined bug scope' },
        { pattern: /improve\s*performance/i, issue: 'No performance metrics defined' },
        { pattern: /as\s*needed/i, issue: 'Undefined decision criteria' },
        { pattern: /etc\.?$/im, issue: 'Incomplete list of requirements' },
        { pattern: /and\s*so\s*on/i, issue: 'Incomplete list of requirements' },
    ];

    for (const { pattern, issue } of ambiguousPatterns) {
        if (pattern.test(content)) {
            conflicts.push({
                type: ConflictType.AMBIGUOUS_REQUIREMENT,
                severity: ConflictSeverity.WARNING,
                description: `Ambiguous requirement: ${issue}`,
                details: { pattern: pattern.toString(), issue },
                suggestion: 'Provide specific, measurable requirements',
            });
        }
    }

    return conflicts;
};

/**
 * Detects impossible combinations in acceptance criteria
 * @param {Object[]} criteria - Array of acceptance criteria objects
 * @returns {Object[]} Array of impossible combination conflicts
 */
const detectImpossibleCombinations = (criteria) => {
    if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
        return [];
    }

    const conflicts = [];
    const criteriaTexts = criteria.map(c => c.criterion || c.description || String(c)).join('\n');

    // Check for known impossible combinations
    const impossibleCombos = [
        {
            patterns: [/100%\s*test\s*coverage/i, /no\s*tests?\s*required/i],
            description: 'Cannot have 100% coverage and no tests simultaneously',
        },
        {
            patterns: [/backwards?\s*compatible/i, /breaking\s*change/i],
            description: 'Cannot be both backwards compatible and introduce breaking changes',
        },
        {
            patterns: [/no\s*dependencies/i, /use\s*(?:npm|yarn|pip)\s*package/i],
            description: 'Cannot have no dependencies and use external packages',
        },
    ];

    for (const combo of impossibleCombos) {
        const matches = combo.patterns.every(p => p.test(criteriaTexts));
        if (matches) {
            conflicts.push({
                type: ConflictType.MUTUALLY_EXCLUSIVE,
                severity: ConflictSeverity.BLOCKING,
                description: combo.description,
                details: { patterns: combo.patterns.map(p => p.toString()) },
                suggestion: 'Review and reconcile conflicting criteria',
            });
        }
    }

    return conflicts;
};

/**
 * Detects scope conflicts between multiple tasks
 * @param {Object[]} tasks - Array of task blueprints
 * @returns {Object[]} Array of scope conflicts
 */
const detectScopeConflicts = (tasks) => {
    if (!tasks || !Array.isArray(tasks) || tasks.length < 2) {
        return [];
    }

    const conflicts = [];

    // Check for overlapping files
    for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
            const task1 = tasks[i];
            const task2 = tasks[j];

            const files1 = task1.files || [];
            const files2 = task2.files || [];

            const overlapping = files1.filter(f => files2.includes(f));

            if (overlapping.length > 0) {
                conflicts.push({
                    type: ConflictType.MUTUALLY_EXCLUSIVE,
                    severity: ConflictSeverity.WARNING,
                    description: `Tasks modify same files: ${task1.name} and ${task2.name}`,
                    details: {
                        task1: task1.name,
                        task2: task2.name,
                        overlappingFiles: overlapping,
                    },
                    suggestion: 'Add dependency between tasks or merge them',
                });
            }
        }
    }

    return conflicts;
};

/**
 * Detects dependency conflicts between tasks
 * @param {Object[]} tasks - Array of task objects with dependencies
 * @returns {Object[]} Array of dependency conflicts
 */
const detectDependencyConflicts = (tasks) => {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return [];
    }

    const conflicts = [];
    const taskMap = new Map(tasks.map(t => [t.name || t.id, t]));

    // Check for circular dependencies (only if 2+ tasks exist)
    if (tasks.length >= 2) {
        for (const task of tasks) {
            const visited = new Set();
            const path = [];
            const cycle = findCycle(task.name || task.id, task.dependencies || [], taskMap, visited, path);

            if (cycle) {
                conflicts.push({
                    type: ConflictType.CIRCULAR_DEPENDENCY,
                    severity: ConflictSeverity.BLOCKING,
                    description: `Circular dependency detected: ${cycle.join(' -> ')}`,
                    details: { cycle, startTask: task.name || task.id },
                    suggestion: 'Break the circular dependency by reordering or restructuring tasks',
                });
            }
        }
    }

    // Check for missing dependencies (even single tasks can have missing deps)
    for (const task of tasks) {
        const deps = task.dependencies || [];
        for (const dep of deps) {
            if (!taskMap.has(dep)) {
                conflicts.push({
                    type: ConflictType.MISSING_PREREQUISITE,
                    severity: ConflictSeverity.BLOCKING,
                    description: `Task "${task.name || task.id}" depends on non-existent task "${dep}"`,
                    details: { task: task.name || task.id, missingDep: dep },
                    suggestion: `Create task "${dep}" or remove the dependency`,
                });
            }
        }
    }

    return conflicts;
};

/**
 * Finds a cycle in the dependency graph
 * @param {string} start - Starting task name
 * @param {string[]} deps - Dependencies of current task
 * @param {Map} taskMap - Map of task names to tasks
 * @param {Set} visited - Set of visited nodes
 * @param {string[]} path - Current path
 * @returns {string[]|null} Cycle path or null
 */
const findCycle = (start, deps, taskMap, visited, path) => {
    if (path.includes(start)) {
        return [...path, start];
    }

    if (visited.has(start)) {
        return null;
    }

    visited.add(start);
    path.push(start);

    for (const dep of deps) {
        const depTask = taskMap.get(dep);
        if (depTask) {
            const cycle = findCycle(dep, depTask.dependencies || [], taskMap, visited, path);
            if (cycle) {
                return cycle;
            }
        }
    }

    path.pop();
    return null;
};

/**
 * Generates suggestions based on detected conflicts
 * @param {Object[]} conflicts - Array of conflict objects
 * @returns {string[]} Array of suggestions
 */
const generateSuggestions = (conflicts) => {
    if (!conflicts || conflicts.length === 0) {
        return [];
    }

    const suggestions = new Set();

    for (const conflict of conflicts) {
        if (conflict.suggestion) {
            suggestions.add(conflict.suggestion);
        }

        // Add type-specific general suggestions
        switch (conflict.type) {
            case ConflictType.IMPOSSIBLE_SCOPE:
                suggestions.add('Consider breaking the task into smaller, focused subtasks');
                break;
            case ConflictType.CIRCULAR_DEPENDENCY:
                suggestions.add('Review task dependencies and establish a clear execution order');
                break;
            case ConflictType.AMBIGUOUS_REQUIREMENT:
                suggestions.add('Clarify requirements with specific, measurable criteria');
                break;
        }
    }

    return Array.from(suggestions);
};

/**
 * Validates requirement feasibility against codebase
 * @param {Object} requirement - Single requirement object
 * @param {string} cwd - Working directory
 * @returns {{feasible: boolean, reason: string|null, alternative: string|null}}
 */
const validateRequirementFeasibility = (requirement, _cwd) => {
    // This is a simplified implementation
    // In a full implementation, this would analyze the codebase
    const reqText = requirement.description || requirement.criterion || String(requirement);

    // Check for obviously infeasible requirements
    const infeasiblePatterns = [
        { pattern: /without\s*changing\s*any\s*code/i, reason: 'Cannot implement feature without code changes' },
        { pattern: /zero\s*downtime.*database\s*migration/i, reason: 'Zero-downtime migrations require careful planning' },
        { pattern: /instant(?:ly)?\s*migrate/i, reason: 'Migrations typically require time and testing' },
    ];

    for (const { pattern, reason } of infeasiblePatterns) {
        if (pattern.test(reqText)) {
            return {
                feasible: false,
                reason,
                alternative: 'Consider a phased approach with acceptable trade-offs',
            };
        }
    }

    return {
        feasible: true,
        reason: null,
        alternative: null,
    };
};

/**
 * Creates a conflict report for logging/display
 * @param {Object} analysis - Result from analyzeRequirementConflicts
 * @returns {string} Formatted conflict report
 */
const createConflictReport = (analysis) => {
    if (!analysis.hasConflicts) {
        return 'No conflicts detected.';
    }

    const lines = ['# Conflict Analysis Report', ''];

    const blocking = analysis.conflicts.filter(c => c.severity === ConflictSeverity.BLOCKING);
    const warnings = analysis.conflicts.filter(c => c.severity === ConflictSeverity.WARNING);

    if (blocking.length > 0) {
        lines.push('## Blocking Issues (Must Resolve)', '');
        for (const conflict of blocking) {
            lines.push(`- **${conflict.type}**: ${conflict.description}`);
            lines.push(`  - Suggestion: ${conflict.suggestion}`);
        }
        lines.push('');
    }

    if (warnings.length > 0) {
        lines.push('## Warnings (Should Address)', '');
        for (const conflict of warnings) {
            lines.push(`- **${conflict.type}**: ${conflict.description}`);
            lines.push(`  - Suggestion: ${conflict.suggestion}`);
        }
        lines.push('');
    }

    if (analysis.suggestions.length > 0) {
        lines.push('## Recommendations', '');
        for (const suggestion of analysis.suggestions) {
            lines.push(`- ${suggestion}`);
        }
    }

    return lines.join('\n');
};

module.exports = {
    ConflictType,
    ConflictSeverity,
    analyzeRequirementConflicts,
    detectImpossibleCombinations,
    detectScopeConflicts,
    detectDependencyConflicts,
    validateRequirementFeasibility,
    createConflictReport,
    generateSuggestions,
    // Exported for testing
    analyzeScopeComplexity,
    detectAmbiguousRequirements,
    findCycle,
    EXCLUSIVE_PATTERNS,
    SCOPE_INDICATORS,
};
