const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { validateExecutionJson } = require('../../utils/schema-validator');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');

/**
 * Extracts the task ID from task folder or task identifier
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2.1')
 * @returns {string} - Task ID in format TASK# (e.g., 'TASK1', 'TASK2')
 */
const extractTaskId = (task) => {
    // Handle subtask format (e.g., 'TASK2.1' -> 'TASK2')
    const match = task.match(/^(TASK\d+)/);
    return match ? match[1] : task;
};

/**
 * Extracts task title from BLUEPRINT.md or TASK.md content
 * @param {string} content - File content
 * @returns {string} - Extracted title or default
 */
const extractTaskTitle = (content) => {
    if (!content) return 'Untitled Task';

    // Try to extract from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
        return headingMatch[1].trim();
    }

    // Try to extract from IDENTITY section (BLUEPRINT.md)
    const identityMatch = content.match(/## 1\. IDENTITY[^\n]*\n+(?:\*\*Task ID:\*\*[^\n]*\n+)?\*\*Title:\*\*\s*(.+)/i);
    if (identityMatch) {
        return identityMatch[1].trim();
    }

    // Fallback to first non-empty line
    const lines = content.split('\n').filter(line => line.trim());
    return lines[0] ? lines[0].slice(0, 100).trim() : 'Untitled Task';
};

/**
 * Extracts phases from BLUEPRINT.md content or returns default phases
 * @param {string} content - BLUEPRINT.md content
 * @returns {Array} - Array of phase objects
 */
const extractPhasesFromBlueprint = (content) => {
    const defaultPhases = [
        { id: 1, name: 'Preparation', status: 'pending' },
        { id: 2, name: 'Core Implementation', status: 'pending' },
        { id: 3, name: 'Testing', status: 'pending' },
        { id: 4, name: 'Verification', status: 'pending' },
    ];

    if (!content) return defaultPhases;

    // Try to extract phases from IMPLEMENTATION STRATEGY section
    const strategyMatch = content.match(/## 4\. IMPLEMENTATION STRATEGY\s*\n([\s\S]*?)(?=## \d|$)/i);
    if (!strategyMatch) return defaultPhases;

    const strategySection = strategyMatch[1];
    const phases = [];
    let phaseId = 1;

    // Look for phase patterns like "### Phase 1: ..." or "**Phase 1:**"
    const phasePattern = /(?:###\s*Phase\s*\d+[:\s]*|\*\*Phase\s*\d+[:\s]*\*\*[:\s]*)([^\n]+)/gi;
    let match;

    while ((match = phasePattern.exec(strategySection)) !== null) {
        phases.push({
            id: phaseId++,
            name: match[1].trim(),
            status: 'pending',
        });
    }

    return phases.length > 0 ? phases : defaultPhases;
};

/**
 * Generates a comprehensive execution.json file for a task
 * This file tracks execution state, phases, artifacts, and completion status
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2.1')
 * @returns {Promise<void>}
 */
const generateExecution = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    // Read BLUEPRINT.md if exists, otherwise fall back to TASK.md
    const blueprintPath = folder('BLUEPRINT.md');
    const taskMdPath = folder('TASK.md');

    let content = '';
    if (fs.existsSync(blueprintPath)) {
        content = fs.readFileSync(blueprintPath, 'utf-8');
    } else if (fs.existsSync(taskMdPath)) {
        content = fs.readFileSync(taskMdPath, 'utf-8');
    }

    // Determine working directory based on scope (multi-repo support)
    const scope = parseTaskScope(content);
    validateScope(scope, state.isMultiRepo()); // Throws if scope missing in multi-repo mode

    // Extract task information
    const taskId = extractTaskId(task);
    const title = extractTaskTitle(content);
    const phases = extractPhasesFromBlueprint(content);

    // Build execution.json structure
    const executionData = {
        $schema: 'execution-schema-v1',
        version: '1.0',
        task: taskId,
        title: title,
        status: 'pending',
        started: new Date().toISOString(),
        attempts: 0,
        currentPhase: {
            id: 1,
            name: phases[0]?.name || 'Not Started',
            lastAction: 'Initialized',
        },
        phases: phases,
        uncertainties: [],
        artifacts: [],
        beyondTheBasics: {
            extras: [],
            edgeCases: [],
            downstreamImpact: {},
            cleanup: {
                debugLogsRemoved: false,
                formattingConsistent: false,
                deadCodeRemoved: false,
            },
        },
        completion: {
            status: 'pending_validation',
            summary: [],
            deviations: [],
            forFutureTasks: [],
        },
    };

    // Validate against schema before writing
    const validation = validateExecutionJson(executionData);
    if (!validation.valid) {
        const errorMsg = `execution.json validation failed:\n${validation.errors.join('\n')}`;
        throw new Error(errorMsg);
    }

    // Write execution.json with 2-space indentation
    const executionPath = folder('execution.json');
    fs.writeFileSync(executionPath, JSON.stringify(executionData, null, 2), 'utf-8');

    logger.debug(`[Step4] Generated execution.json for ${task}`);
};

module.exports = { generateExecution };
