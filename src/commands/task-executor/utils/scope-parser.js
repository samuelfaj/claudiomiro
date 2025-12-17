/**
 * Extracts scope from TASK.md content
 * @param {string} taskMdContent - Content of TASK.md file
 * @returns {string|null} - 'backend', 'frontend', 'integration', or null
 */
const parseTaskScope = (taskMdContent) => {
    const match = taskMdContent.match(/^@scope\s+(backend|frontend|integration)\s*$/mi);
    return match ? match[1].toLowerCase() : null;
};

/**
 * Validates scope requirements based on mode
 * @param {string|null} scope - Extracted scope or null
 * @param {boolean} isMultiRepo - Whether in multi-repo mode
 * @returns {boolean} - true if valid
 * @throws {Error} - When scope missing in multi-repo mode
 */
const validateScope = (scope, isMultiRepo) => {
    if (!isMultiRepo) return true;
    if (!scope) {
        throw new Error(
            '@scope tag is required in multi-repo mode. ' +
            'Add "@scope backend", "@scope frontend", or "@scope integration" to TASK.md',
        );
    }
    return true;
};

/**
 * Validates scope with auto-fix capability
 * If scope is missing in multi-repo mode, attempts to auto-fix using AI
 * @param {string|null} scope - Extracted scope or null
 * @param {boolean} isMultiRepo - Whether in multi-repo mode
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @returns {Promise<{valid: boolean, scope: string|null, autoFixed: boolean}>}
 */
const validateScopeWithAutoFix = async (scope, isMultiRepo, task) => {
    // Non multi-repo mode - always valid
    if (!isMultiRepo) {
        return { valid: true, scope, autoFixed: false };
    }

    // Scope already exists - valid
    if (scope) {
        return { valid: true, scope, autoFixed: false };
    }

    // Attempt auto-fix
    const { autoFixScope } = require('./scope-fixer');
    const fixedScope = await autoFixScope(task);

    if (fixedScope) {
        return { valid: true, scope: fixedScope, autoFixed: true };
    }

    // Auto-fix failed
    return { valid: false, scope: null, autoFixed: false };
};

module.exports = { parseTaskScope, validateScope, validateScopeWithAutoFix };
