const fs = require('fs');
const path = require('path');

const SMART_DEFAULTS = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.env*',
    '*.log',
    '.DS_Store',
    'coverage/',
    '.nyc_output/',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.idea/',
    '.vscode/',
];

/**
 * Matches a file path against a single pattern
 * @param {string} filePath - Path to check (normalized with forward slashes)
 * @param {string} pattern - Pattern to match against
 * @returns {boolean} - true if pattern matches
 */
const matchesPattern = (filePath, pattern) => {
    const baseName = path.basename(filePath);

    // Directory pattern (ends with /)
    if (pattern.endsWith('/')) {
        const dirName = pattern.slice(0, -1);
        return (
            filePath.startsWith(dirName + '/') ||
            filePath.includes('/' + dirName + '/')
        );
    }

    // Glob prefix pattern (e.g., .env*)
    if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return baseName.startsWith(prefix);
    }

    // Glob suffix pattern (e.g., *.log)
    if (pattern.startsWith('*')) {
        const suffix = pattern.slice(1);
        return baseName.endsWith(suffix);
    }

    // Exact match
    return baseName === pattern || filePath === pattern;
};

/**
 * Determines if a file should be included based on filtering rules
 * @param {string} filePath - Path to check (relative or absolute)
 * @param {string[]} gitignoreRules - Parsed gitignore patterns
 * @param {string[]} smartDefaults - Default exclusion patterns
 * @returns {boolean} - true if file should be included
 */
const shouldIncludeFile = (
    filePath,
    gitignoreRules = [],
    smartDefaults = SMART_DEFAULTS,
) => {
    // Normalize path (replace backslashes with forward slashes)
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check smart defaults first
    for (const pattern of smartDefaults) {
        if (matchesPattern(normalizedPath, pattern)) {
            return false;
        }
    }

    // Check gitignore rules
    for (const pattern of gitignoreRules) {
        if (matchesPattern(normalizedPath, pattern)) {
            return false;
        }
    }

    return true;
};

/**
 * Parses a .gitignore file and returns array of patterns
 * @param {string} gitignorePath - Absolute path to .gitignore file
 * @returns {string[]} - Array of gitignore patterns (empty if file missing)
 */
const parseGitignore = (gitignorePath) => {
    try {
        if (!fs.existsSync(gitignorePath)) {
            return [];
        }

        const content = fs.readFileSync(gitignorePath, 'utf-8');
        return content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
    } catch {
        return [];
    }
};

/**
 * Recursively lists all files in a directory
 * @param {string} dirPath - Directory path to scan
 * @param {string} basePath - Base path for relative paths
 * @returns {string[]} - Array of relative file paths
 */
const listFilesRecursively = (dirPath, basePath = dirPath) => {
    const files = [];

    try {
        const entries = fs.readdirSync(dirPath);

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const relativePath = path.relative(basePath, fullPath);

            try {
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    files.push(...listFilesRecursively(fullPath, basePath));
                } else {
                    files.push(relativePath.replace(/\\/g, '/'));
                }
            } catch (error) {
                // Permission error - log warning and skip
                console.warn(
                    `Warning: Cannot access ${fullPath}: ${error.message}`,
                );
            }
        }
    } catch (error) {
        // Permission error on directory - log warning
        console.warn(`Warning: Cannot read directory ${dirPath}: ${error.message}`);
    }

    return files;
};

/**
 * Gets filtered list of files from a directory
 * @param {string} directoryPath - Directory to scan recursively
 * @returns {string[]} - Array of relative file paths that pass filters
 */
const getFilteredFiles = (directoryPath) => {
    // Validate directory exists
    try {
        if (!fs.existsSync(directoryPath)) {
            return [];
        }

        const stat = fs.statSync(directoryPath);
        if (!stat.isDirectory()) {
            return [];
        }
    } catch {
        return [];
    }

    // Parse .gitignore if exists
    const gitignorePath = path.join(directoryPath, '.gitignore');
    const gitignoreRules = parseGitignore(gitignorePath);

    // Get all files recursively
    const allFiles = listFilesRecursively(directoryPath);

    // Apply filters
    return allFiles.filter((file) => shouldIncludeFile(file, gitignoreRules));
};

module.exports = {
    SMART_DEFAULTS,
    shouldIncludeFile,
    parseGitignore,
    getFilteredFiles,
};
