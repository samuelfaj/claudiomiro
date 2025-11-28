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

module.exports = { parseTaskScope, validateScope };
