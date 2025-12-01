const { execSync } = require('child_process');
const state = require('../config/state');
const logger = require('../utils/logger');

/**
 * Generates a branch name from task description
 * @param {string} task - Task description
 * @returns {string} Branch name
 */
const generateBranchName = (task) => {
    // Extract first meaningful words from task to create branch name
    const slug = task
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join('-')
        .substring(0, 50);
    return `claudiomiro/${slug || 'task'}`;
};

/**
 * Creates git branches in appropriate repositories based on multi-repo configuration
 * @param {string} branchName - Name of the branch to create
 */
const createBranches = (branchName) => {
    const gitMode = state.getGitMode();

    const createBranchInRepo = (repoPath, repoName) => {
        try {
            execSync(`git checkout -b ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
            logger.info(`Created branch ${branchName} in ${repoName}`);
        } catch (error) {
            const errorMsg = error.stderr ? error.stderr.toString() : error.message;
            if (errorMsg.includes('already exists')) {
                execSync(`git checkout ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
                logger.info(`Branch ${branchName} already exists in ${repoName}, switched to it`);
            } else {
                throw new Error(`Failed to create branch in ${repoName}: ${errorMsg}`);
            }
        }
    };

    if (gitMode === 'monorepo') {
        // Monorepo: create branch once (same git root for both)
        createBranchInRepo(state.folder, 'monorepo');
    } else if (gitMode === 'separate') {
        // Separate repos: create branch in both
        createBranchInRepo(state.getRepository('backend'), 'backend repo');
        createBranchInRepo(state.getRepository('frontend'), 'frontend repo');
    } else {
        // Single repo (standard mode)
        createBranchInRepo(state.folder, 'repository');
    }
};

/**
 * Gets the current git branch name
 * @returns {string} Current branch name
 */
const getCurrentBranch = () => {
    try {
        const branch = execSync('git branch --show-current', { cwd: state.folder, stdio: 'pipe' })
            .toString()
            .trim();
        return branch;
    } catch (error) {
        logger.warning('Could not detect current branch');
        return '';
    }
};

module.exports = { generateBranchName, createBranches, getCurrentBranch };
