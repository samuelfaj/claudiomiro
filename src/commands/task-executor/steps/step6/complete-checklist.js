const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { parseTaskScope } = require('../../utils/scope-parser');

/**
 * Complete Review Checklist
 *
 * Verifies each item in review-checklist.json by reading the actual code
 * and updating the reviewed status for each item.
 *
 * This is the FIRST step of code review, before the main review process.
 */

/**
 * Load review checklist from file
 * @param {string} checklistPath - Path to review-checklist.json
 * @returns {Object|null} Parsed checklist or null if not found/invalid
 */
const loadChecklist = (checklistPath) => {
    if (!fs.existsSync(checklistPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
    } catch {
        return null;
    }
};

/**
 * Save updated checklist to file
 * @param {string} checklistPath - Path to review-checklist.json
 * @param {Object} checklist - Updated checklist object
 */
const saveChecklist = (checklistPath, checklist) => {
    fs.writeFileSync(checklistPath, JSON.stringify(checklist, null, 2), 'utf8');
};

/**
 * Build prompt for Claude to complete the checklist
 * @param {Object} checklist - Review checklist object
 * @param {string} checklistPath - Path to save the updated checklist
 * @returns {string} Complete prompt
 */
const buildCompleteChecklistPrompt = (checklist, checklistPath) => {
    const promptTemplatePath = path.join(__dirname, 'prompt-complete-checklist.md');
    const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf-8');

    const itemsList = checklist.items.map(item =>
        `- **[${item.id}]** (${item.category}) ${item.file}${item.lines?.length ? `:${item.lines.join(',')}` : ''}\n  Question: ${item.description}`,
    ).join('\n\n');

    return promptTemplate
        .replace(/\{\{task\}\}/g, checklist.task)
        .replace(/\{\{itemsList\}\}/g, itemsList)
        .replace(/\{\{itemCount\}\}/g, String(checklist.items.length))
        .replace(/\{\{checklistPath\}\}/g, checklistPath)
        .replace(/\{\{checklistJson\}\}/g, JSON.stringify(checklist, null, 2));
};

/**
 * Complete the review checklist for a task
 * Verifies each item by reading the actual code and updating reviewed status
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @param {Object} options - Options object
 * @param {string} options.cwd - Working directory for Claude execution
 * @returns {Promise<{success: boolean, completedCount: number, totalCount: number}>}
 */
const completeChecklist = async (task, options = {}) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    const checklistPath = folder('review-checklist.json');

    // Load checklist
    const checklist = loadChecklist(checklistPath);

    if (!checklist) {
        logger.debug('[Step6] No review checklist found, skipping checklist completion');
        return { success: true, completedCount: 0, totalCount: 0 };
    }

    if (!checklist.items || checklist.items.length === 0) {
        logger.debug('[Step6] Review checklist has no items, skipping');
        return { success: true, completedCount: 0, totalCount: 0 };
    }

    // Determine working directory
    let cwd = options.cwd;
    if (!cwd) {
        const blueprintPath = folder('BLUEPRINT.md');
        if (fs.existsSync(blueprintPath)) {
            const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
            const scope = parseTaskScope(blueprintContent);
            cwd = state.isMultiRepo() && scope
                ? state.getRepository(scope)
                : state.folder;
        } else {
            cwd = state.folder;
        }
    }

    logger.info(`[Step6] Completing review checklist with ${checklist.items.length} items`);

    // Build and execute prompt
    const prompt = buildCompleteChecklistPrompt(checklist, checklistPath);

    // Checklist completion uses fast model (simpler verification task)
    const claudeOptions = { model: 'fast' };
    if (cwd !== state.folder) {
        claudeOptions.cwd = cwd;
    }
    await executeClaude(prompt, task, claudeOptions);

    // Load updated checklist to count completed items
    const updatedChecklist = loadChecklist(checklistPath);
    if (!updatedChecklist) {
        return { success: false, completedCount: 0, totalCount: checklist.items.length };
    }

    const completedCount = updatedChecklist.items.filter(item => item.reviewed === true).length;

    logger.info(`[Step6] Checklist completed: ${completedCount}/${updatedChecklist.items.length} items verified`);

    return {
        success: true,
        completedCount,
        totalCount: updatedChecklist.items.length,
    };
};

module.exports = {
    completeChecklist,
    // Export for testing
    loadChecklist,
    saveChecklist,
    buildCompleteChecklistPrompt,
};
