const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { loopFixes } = require('../loop-fixes/executor');

/**
 * Get the prompt content for a given level
 *
 * Each level has a self-contained prompt:
 * - level1.md: BLOCKERS only
 * - level2.md: BLOCKERS + WARNINGS
 * - level3.md: All issues (BLOCKERS + WARNINGS + SUGGESTIONS)
 *
 * @param {number} level - Correction level (1, 2, or 3)
 * @returns {string} The prompt content for the specified level
 */
const getLevelPrompt = (level) => {
    const promptPath = path.join(__dirname, 'level' + level + '.md');

    if (!fs.existsSync(promptPath)) {
        throw new Error('fix-branch level' + level + '.md not found');
    }

    return fs.readFileSync(promptPath, 'utf-8');
};

/**
 * Get the level name for display
 *
 * @param {number} level - Correction level (1, 2, or 3)
 * @returns {string} Human-readable level name
 */
const getLevelName = (level) => {
    const names = {
        1: 'blockers only',
        2: 'blockers + warnings',
        3: 'all issues',
    };
    return names[level];
};

/**
 * Execute loop-fixes for a single repository
 *
 * @param {string} repoPath - Path to the repository
 * @param {string} repoName - Name of the repository (for logging)
 * @param {string} reviewPrompt - The review prompt content
 * @param {number} maxIterations - Maximum number of iterations
 * @param {boolean} clearFolder - Whether to clear the folder before starting
 * @returns {Promise<void>}
 */
const runForRepository = async (repoPath, repoName, reviewPrompt, maxIterations, clearFolder) => {
    logger.info(`\n📁 Processing ${repoName} repository: ${repoPath}`);
    state.setFolder(repoPath);
    await loopFixes(reviewPrompt, maxIterations, { clearFolder });
    logger.info(`✅ ${repoName} repository review completed`);
};

/**
 * Fix Branch Command Entry Point
 *
 * Runs loop-fixes with a predefined code review prompt.
 * This command performs a comprehensive branch review before PR.
 *
 * In multi-repo mode, it runs the review for both backend and frontend repositories.
 *
 * Usage:
 *   claudiomiro --fix-branch [folder]
 *   claudiomiro --fix-branch --level=2 [folder]
 *   claudiomiro --fix-branch --blockers-only [folder]
 *   claudiomiro --fix-branch --no-suggestions [folder]
 *   claudiomiro --fix-branch --limit=5 [folder]
 *   claudiomiro --fix-branch --no-limit [folder]
 *
 * @param {string[]} args - Command line arguments
 */
const run = async (args) => {
    // Parse iteration limits
    const noLimit = args.includes('--no-limit');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const maxIterations = noLimit ? Infinity : (limitArg ? parseInt(limitArg.split('=')[1], 10) : 20);

    // Parse --no-clear flag (used when running inside step7 to preserve .claudiomiro folder)
    const noClear = args.includes('--no-clear');

    // Parse level argument
    const blockersOnly = args.includes('--blockers-only');
    const noSuggestions = args.includes('--no-suggestions');
    const levelArg = args.find(arg => arg.startsWith('--level='));

    // Determine level (shortcuts take precedence, then --level, then default 1)
    let level = 1; // Default: blockers only
    if (blockersOnly) {
        level = 1;
    } else if (noSuggestions) {
        level = 2;
    } else if (levelArg) {
        level = parseInt(levelArg.split('=')[1], 10);
        if (![1, 2, 3].includes(level)) {
            throw new Error('Invalid level. Use --level=1, --level=2, or --level=3');
        }
    }

    // Parse folder path (positional argument that doesn't start with --)
    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    logger.info('Starting fix-branch (Staff+ Engineer Code Review)...');
    logger.info(`Running fix-branch (level: ${level} - ${getLevelName(level)}, max iterations: ${noLimit ? 'no limit' : maxIterations})`);

    // Get the self-contained prompt content for this level
    const reviewPrompt = getLevelPrompt(level);

    // Check if multi-repo mode is enabled
    if (state.isMultiRepo()) {
        logger.info('🔀 Multi-repo mode detected - reviewing both repositories');

        const backendPath = state.getRepository('backend');
        const frontendPath = state.getRepository('frontend');

        // Run loop-fixes for backend repository
        await runForRepository(backendPath, 'Backend', reviewPrompt, maxIterations, !noClear);

        // Run loop-fixes for frontend repository
        await runForRepository(frontendPath, 'Frontend', reviewPrompt, maxIterations, !noClear);

        logger.info('\n✅ All repositories reviewed successfully');
    } else {
        // Single-repo mode: execute normally
        await loopFixes(reviewPrompt, maxIterations, { clearFolder: !noClear });
    }
};

module.exports = { run, getLevelPrompt, getLevelName };
