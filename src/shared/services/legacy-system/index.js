const fs = require('fs');
const path = require('path');
const state = require('../../config/state');
const { getFilteredFiles } = require('./file-filter');
const { generateLegacySystemContext } = require('./context-generator');

/**
 * Reads content of a specific file from a legacy system
 * @param {string} type - 'system' | 'backend' | 'frontend'
 * @param {string} filePath - Relative path within the legacy system
 * @returns {string|null} File content as string, or null if not found/readable
 */
const getLegacyFileContent = (type, filePath) => {
    const basePath = state.getLegacySystem(type);
    if (!basePath) {
        return null;
    }

    const fullPath = path.join(basePath, filePath);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    try {
        return fs.readFileSync(fullPath, 'utf-8');
    } catch {
        return null;
    }
};

/**
 * Gets filtered file tree for a legacy system
 * @param {string} type - 'system' | 'backend' | 'frontend'
 * @returns {string[]} Array of relative file paths passing filter
 */
const getLegacyStructure = (type) => {
    const basePath = state.getLegacySystem(type);
    if (!basePath) {
        return [];
    }

    return getFilteredFiles(basePath);
};

module.exports = {
    generateLegacySystemContext,
    getLegacyFileContent,
    getLegacyStructure,
};
