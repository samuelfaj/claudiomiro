const { execSync } = require('child_process');
const state = require('../config/state');
const logger = require('../utils/logger');

/**
 * Creates git branches in appropriate repositories based on multi-repo configuration
 * @param {string} branchName - Name of the branch to create
 * @returns {{ success: boolean, error?: string }} Result object indicating success or failure
 */
const createBranches = (branchName) => {
    const gitMode = state.getGitMode();

    const createBranchInRepo = (repoPath, repoName) => {
        try {
            execSync(`git checkout -b ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
            logger.info(`Created branch ${branchName} in ${repoName}`);
            return { success: true };
        } catch (error) {
            const errorMsg = error.stderr ? error.stderr.toString() : error.message;
            if (errorMsg.includes('already exists')) {
                try {
                    execSync(`git checkout ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
                    logger.info(`Branch ${branchName} already exists in ${repoName}, switched to it`);
                    return { success: true };
                } catch (checkoutError) {
                    return { success: false, error: checkoutError.message };
                }
            } else {
                return { success: false, error: `Failed to create branch in ${repoName}: ${errorMsg}` };
            }
        }
    };

    try {
        if (gitMode === 'monorepo') {
            // Monorepo: create branch once (same git root for both)
            return createBranchInRepo(state.folder, 'monorepo');
        } else if (gitMode === 'separate') {
            // Separate repos: create branch in both
            const backendResult = createBranchInRepo(state.getRepository('backend'), 'backend repo');
            if (!backendResult.success) return backendResult;

            const frontendResult = createBranchInRepo(state.getRepository('frontend'), 'frontend repo');
            return frontendResult;
        } else {
            // Single repo (standard mode)
            return createBranchInRepo(state.folder, 'repository');
        }
    } catch (error) {
        return { success: false, error: error.message };
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

module.exports = { createBranches, getCurrentBranch };
