const { promisify } = require('util');
const { exec: execCallback } = require('child_process');

const exec = promisify(execCallback);

/**
 * Normalizes file path for comparison
 * @param {string} filePath - File path
 * @returns {string} Normalized path
 */
const normalizePath = (filePath) => {
    return filePath
        .replace(/^\.\//, '')  // Remove leading ./
        .replace(/\\/g, '/')   // Convert backslashes to forward slashes
        .trim();
};

/**
 * Gets list of modified files from git
 * @param {string} cwd - Working directory
 * @returns {Promise<Array<string>>} Array of modified file paths
 */
const getGitModifiedFiles = async (cwd) => {
    try {
        // Get both staged and unstaged changes
        const { stdout: staged } = await exec('git diff --name-only --cached', { cwd });
        const { stdout: unstaged } = await exec('git diff --name-only', { cwd });

        const stagedFiles = staged.trim().split('\n').filter(Boolean).map(normalizePath);
        const unstagedFiles = unstaged.trim().split('\n').filter(Boolean).map(normalizePath);

        // Combine and deduplicate
        const allFiles = [...new Set([...stagedFiles, ...unstagedFiles])];

        return allFiles;
    } catch (error) {
        // If git command fails (e.g., not a git repo), return empty array
        return [];
    }
};

/**
 * Verifies that git changes match declared artifacts in execution.json
 * @param {Object} execution - execution.json content
 * @param {string} cwd - Working directory
 * @returns {Promise<Object>} Verification result
 */
const verifyChanges = async (execution, cwd) => {
    const logger = require('../../../../../shared/utils/logger');

    // Get actual changed files from git
    const actualChanges = await getGitModifiedFiles(cwd);

    // Get declared artifacts from execution.json
    const declaredChanges = (execution.artifacts || [])
        .filter(a => a.type === 'modified' || a.type === 'created')
        .map(a => normalizePath(a.path));

    logger.info(`Git shows ${actualChanges.length} modified files`);
    logger.info(`execution.json declares ${declaredChanges.length} artifacts`);

    // Find discrepancies
    const undeclared = actualChanges.filter(f => !declaredChanges.includes(f));
    const missing = declaredChanges.filter(f => !actualChanges.includes(f));

    if (undeclared.length > 0) {
        logger.warning('⚠️  Files modified but NOT declared in artifacts:');
        undeclared.forEach(file => logger.warning(`   - ${file}`));
    }

    if (missing.length > 0) {
        logger.warning('⚠️  Files declared in artifacts but NOT actually modified:');
        missing.forEach(file => logger.warning(`   - ${file}`));
    }

    const valid = undeclared.length === 0 && missing.length === 0;

    if (valid) {
        logger.info('✅ Git changes match declared artifacts');
    } else {
        logger.warning('⚠️  Discrepancies found between git changes and declared artifacts');
    }

    return {
        valid,
        actualChanges,
        declaredChanges,
        undeclared,
        missing,
    };
};

module.exports = {
    verifyChanges,
    getGitModifiedFiles,
    normalizePath,
};
