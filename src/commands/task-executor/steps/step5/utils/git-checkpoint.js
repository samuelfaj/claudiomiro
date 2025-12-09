/**
 * Git checkpoint utilities for step5
 * Creates git commits after each phase gate for recovery
 */

const { execSync } = require('child_process');

/**
 * Create a git checkpoint commit after a phase completes
 * @param {string} taskId - Task identifier (e.g., 'TASK1')
 * @param {number} phaseNumber - Phase number (1, 2, 3, etc.)
 * @param {string} phaseName - Phase name (e.g., 'Preparation', 'Core Implementation')
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory for git commands
 * @returns {Object} { success: boolean, commitHash: string|null, message: string }
 */
const createCheckpoint = async (taskId, phaseNumber, phaseName, options = {}) => {
    const logger = require('../../../../../shared/utils/logger');
    const cwd = options.cwd || process.cwd();

    const commitMessage = `[${taskId}] Phase ${phaseNumber}: ${phaseName} complete`;

    try {
        // Check if there are changes to commit
        const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });

        if (!status.trim()) {
            logger.info(`[Checkpoint] No changes to commit for ${taskId} Phase ${phaseNumber}`);
            return {
                success: true,
                commitHash: null,
                message: 'No changes to commit',
            };
        }

        // Stage all changes
        execSync('git add -A', { cwd });

        // Create commit
        execSync(`git commit -m "${commitMessage}"`, { cwd });

        // Get commit hash
        const commitHash = execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8' }).trim();

        logger.info(`[Checkpoint] Created: ${commitMessage} (${commitHash.substring(0, 7)})`);

        return {
            success: true,
            commitHash,
            message: commitMessage,
        };
    } catch (error) {
        logger.warning(`[Checkpoint] Failed to create checkpoint: ${error.message}`);
        return {
            success: false,
            commitHash: null,
            message: error.message,
        };
    }
};

/**
 * Get last checkpoint for a task from git history
 * @param {string} taskId - Task identifier (e.g., 'TASK1')
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory for git commands
 * @returns {Object|null} { phaseNumber: number, phaseName: string, commitHash: string } or null
 */
const getLastCheckpoint = (taskId, options = {}) => {
    const cwd = options.cwd || process.cwd();

    try {
        // Search for commits with task ID pattern
        const log = execSync(
            `git log --oneline --grep="\\[${taskId}\\]" -1`,
            { cwd, encoding: 'utf-8' },
        );

        if (!log.trim()) {
            return null;
        }

        // Parse: "abc1234 [TASK1] Phase 2: Core Implementation complete"
        const match = log.match(/^([a-f0-9]+)\s+\[([^\]]+)\]\s+Phase\s+(\d+):\s+(.+)\s+complete/i);

        if (!match) {
            return null;
        }

        return {
            commitHash: match[1],
            taskId: match[2],
            phaseNumber: parseInt(match[3], 10),
            phaseName: match[4],
        };
    } catch (error) {
        return null;
    }
};

/**
 * Get all checkpoints for a task from git history
 * @param {string} taskId - Task identifier (e.g., 'TASK1')
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory for git commands
 * @param {number} options.limit - Max number of checkpoints to return (default: 10)
 * @returns {Array} Array of checkpoint objects
 */
const getAllCheckpoints = (taskId, options = {}) => {
    const cwd = options.cwd || process.cwd();
    const limit = options.limit || 10;

    try {
        const log = execSync(
            `git log --oneline --grep="\\[${taskId}\\]" -${limit}`,
            { cwd, encoding: 'utf-8' },
        );

        if (!log.trim()) {
            return [];
        }

        const checkpoints = [];
        const lines = log.trim().split('\n');

        for (const line of lines) {
            const match = line.match(/^([a-f0-9]+)\s+\[([^\]]+)\]\s+Phase\s+(\d+):\s+(.+)\s+complete/i);
            if (match) {
                checkpoints.push({
                    commitHash: match[1],
                    taskId: match[2],
                    phaseNumber: parseInt(match[3], 10),
                    phaseName: match[4],
                });
            }
        }

        return checkpoints;
    } catch (error) {
        return [];
    }
};

/**
 * Get next phase to resume from based on git checkpoints
 * @param {string} taskId - Task identifier (e.g., 'TASK1')
 * @param {number} totalPhases - Total number of phases in the task
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory for git commands
 * @returns {number} Next phase number to execute (1 if no checkpoints found)
 */
const getNextPhase = (taskId, totalPhases, options = {}) => {
    const lastCheckpoint = getLastCheckpoint(taskId, options);

    if (!lastCheckpoint) {
        return 1; // Start from beginning
    }

    const nextPhase = lastCheckpoint.phaseNumber + 1;

    if (nextPhase > totalPhases) {
        return totalPhases; // Task is complete, return last phase
    }

    return nextPhase;
};

/**
 * Check if a specific phase has been checkpointed
 * @param {string} taskId - Task identifier (e.g., 'TASK1')
 * @param {number} phaseNumber - Phase number to check
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory for git commands
 * @returns {boolean} True if phase has checkpoint
 */
const hasCheckpoint = (taskId, phaseNumber, options = {}) => {
    const checkpoints = getAllCheckpoints(taskId, options);
    return checkpoints.some(cp => cp.phaseNumber === phaseNumber);
};

module.exports = {
    createCheckpoint,
    getLastCheckpoint,
    getAllCheckpoints,
    getNextPhase,
    hasCheckpoint,
};
