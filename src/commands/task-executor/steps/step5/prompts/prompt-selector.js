/**
 * Prompt Selector for Step5
 *
 * Selects the appropriate prompt based on execution state.
 * This makes the AI more focused and objective.
 */

const fs = require('fs');
const path = require('path');

/**
 * Execution state types
 */
const ExecutionState = {
    FIRST_EXECUTION: 'first-execution',
    ERROR_RECOVERY: 'error-recovery',
    BLOCKED_DEPENDENCY: 'blocked-dependency',
    BLOCKED_EXECUTION: 'blocked-execution',
};

/**
 * Determine the execution state from execution.json
 *
 * Priority:
 * 1. status="blocked" → BLOCKED_EXECUTION
 * 2. completion.blockedBy not empty → BLOCKED_DEPENDENCY
 * 3. errorHistory or pendingFixes not empty → ERROR_RECOVERY
 * 4. else → FIRST_EXECUTION
 *
 * @param {Object} execution - execution.json content
 * @returns {string} ExecutionState value
 */
const detectExecutionState = (execution) => {
    // Check if status is blocked
    if (execution.status === 'blocked') {
        return ExecutionState.BLOCKED_EXECUTION;
    }

    // Check if blocked by code review
    const blockedBy = execution.completion?.blockedBy || [];
    if (Array.isArray(blockedBy) && blockedBy.length > 0) {
        return ExecutionState.BLOCKED_DEPENDENCY;
    }

    // Check if there are errors to recover from
    const errorHistory = execution.errorHistory || [];
    const pendingFixes = execution.pendingFixes || [];
    if (errorHistory.length > 0 || pendingFixes.length > 0) {
        return ExecutionState.ERROR_RECOVERY;
    }

    // First execution
    return ExecutionState.FIRST_EXECUTION;
};

/**
 * Load a prompt file
 * @param {string} promptName - Name of the prompt file (without .md)
 * @returns {string} Prompt content
 */
const loadPromptFile = (promptName) => {
    const promptPath = path.join(__dirname, `${promptName}.md`);
    if (!fs.existsSync(promptPath)) {
        throw new Error(`Prompt file not found: ${promptPath}`);
    }
    return fs.readFileSync(promptPath, 'utf-8');
};

/**
 * Build error details for error-recovery prompt
 * @param {Object} execution - execution.json content
 * @returns {string} Formatted error details
 */
const buildErrorDetails = (execution) => {
    const lines = [];

    // Pending fixes
    const pendingFixes = execution.pendingFixes || [];
    if (pendingFixes.length > 0) {
        lines.push('### Pending Fixes (validations that failed):');
        pendingFixes.forEach((fix, i) => {
            lines.push(`${i + 1}. \`${fix}\``);
        });
        lines.push('');
    }

    // Last error
    const lastError = execution.completion?.lastError;
    if (lastError) {
        lines.push('### Last Error:');
        lines.push(`> ${lastError}`);
        lines.push('');
    }

    // Error history (last 3)
    const errorHistory = execution.errorHistory || [];
    if (errorHistory.length > 0) {
        lines.push('### Error History (most recent first):');
        const recentErrors = errorHistory.slice(-3).reverse();
        recentErrors.forEach((err, i) => {
            lines.push(`${i + 1}. **${err.failedValidation || 'unknown'}** - ${err.message}`);
            if (err.timestamp) {
                lines.push(`   - Time: ${err.timestamp}`);
            }
        });
        lines.push('');
    }

    // Current attempts
    lines.push(`### Attempt: ${execution.attempts || 1}`);

    return lines.join('\n');
};

/**
 * Build blocked by details for blocked-dependency prompt
 * @param {Object} execution - execution.json content
 * @returns {string} Formatted blocked by details
 */
const buildBlockedByDetails = (execution) => {
    const lines = [];
    const blockedBy = execution.completion?.blockedBy || [];

    lines.push('### Issues to Fix:');
    blockedBy.forEach((issue, i) => {
        lines.push(`${i + 1}. ${issue}`);
    });
    lines.push('');

    // Check for CODE_REVIEW.md reference
    lines.push('### Additional Context:');
    lines.push('- Check `CODE_REVIEW.md` for detailed analysis');
    lines.push('- Check `errorHistory` for timeline');

    return lines.join('\n');
};

/**
 * Build block reason for blocked-execution prompt
 * @param {Object} execution - execution.json content
 * @returns {string} Formatted block reason
 */
const buildBlockReason = (execution) => {
    const lines = [];

    // Summary
    const summary = execution.completion?.summary || [];
    if (summary.length > 0) {
        lines.push('### Block Summary:');
        summary.forEach(s => lines.push(`- ${s}`));
        lines.push('');
    }

    // Deviations
    const deviations = execution.completion?.deviations || [];
    if (deviations.length > 0) {
        lines.push('### Details:');
        deviations.forEach(d => lines.push(`- ${d}`));
        lines.push('');
    }

    // Current phase when blocked
    if (execution.currentPhase) {
        lines.push(`### Blocked at: Phase ${execution.currentPhase.id} - ${execution.currentPhase.name}`);
        if (execution.currentPhase.lastAction) {
            lines.push(`Last action: ${execution.currentPhase.lastAction}`);
        }
    }

    return lines.join('\n');
};

/**
 * Select and build the appropriate prompt for the execution state
 *
 * @param {Object} execution - execution.json content
 * @param {Object} options - Options
 * @param {string} options.taskFolder - Path to task folder
 * @param {string} options.claudiomiroFolder - Path to claudiomiro folder
 * @returns {Object} { state, prompt, basePrompt }
 */
const selectPrompt = (execution, options = {}) => {
    const { taskFolder = '', claudiomiroFolder = '' } = options;

    // Detect state
    const state = detectExecutionState(execution);

    // Load base prompt
    let basePrompt = loadPromptFile('base');
    basePrompt = basePrompt
        .replace(/\{\{taskFolder\}\}/g, taskFolder)
        .replace(/\{\{claudiomiroFolder\}\}/g, claudiomiroFolder);

    // Load specific prompt
    let specificPrompt = loadPromptFile(state);
    specificPrompt = specificPrompt
        .replace(/\{\{taskFolder\}\}/g, taskFolder)
        .replace(/\{\{claudiomiroFolder\}\}/g, claudiomiroFolder);

    // Add state-specific details
    switch (state) {
        case ExecutionState.ERROR_RECOVERY:
            specificPrompt = specificPrompt.replace(
                '{{errorDetails}}',
                buildErrorDetails(execution),
            );
            break;

        case ExecutionState.BLOCKED_DEPENDENCY:
            specificPrompt = specificPrompt.replace(
                '{{blockedByDetails}}',
                buildBlockedByDetails(execution),
            );
            break;

        case ExecutionState.BLOCKED_EXECUTION:
            specificPrompt = specificPrompt.replace(
                '{{blockReason}}',
                buildBlockReason(execution),
            );
            break;

        case ExecutionState.FIRST_EXECUTION:
        default:
            // No additional replacements needed
            break;
    }

    // Combine prompts
    const prompt = `${basePrompt}\n\n---\n\n${specificPrompt}`;

    return {
        state,
        prompt,
        basePrompt,
        specificPrompt,
    };
};

module.exports = {
    ExecutionState,
    detectExecutionState,
    selectPrompt,
    loadPromptFile,
    buildErrorDetails,
    buildBlockedByDetails,
    buildBlockReason,
};
