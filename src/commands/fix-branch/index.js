const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { loopFixes } = require('../loop-fixes/executor');

/**
 * Get the level instructions based on correction level
 *
 * @param {number} level - Correction level (1, 2, or 3)
 * @returns {string} The level instructions to append to prompt
 */
const getLevelInstructions = (level) => {
    const promptPath = path.join(__dirname, 'level' + level + '.md');

    if (!fs.existsSync(promptPath)) {
        throw new Error('fix-branch level' + level + '.md not found');
    }

    return promptPath;
};

/**
 * Get the fixed prompt from prompt.md with level instructions
 *
 * @param {number} level - Correction level (1, 2, or 3)
 * @returns {string} The fixed prompt content with level instructions
 */
const getFixedPrompt = (level = 1) => {
    const promptPath = path.join(__dirname, 'prompt.md');

    if (!fs.existsSync(promptPath)) {
        throw new Error('fix-branch prompt.md not found');
    }

    const basePrompt = fs.readFileSync(promptPath, 'utf-8');
    return basePrompt + '\n' + getLevelInstructions(level);
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
 * Fix Branch Command Entry Point
 *
 * Runs loop-fixes with a predefined code review prompt.
 * This command performs a comprehensive branch review before PR.
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

    // Get the fixed prompt with level instructions
    const fixedPrompt = getFixedPrompt(level);

    // Execute the loop with the fixed prompt
    await loopFixes(fixedPrompt, maxIterations, { clearFolder: !noClear });
};

module.exports = { run, getFixedPrompt, getLevelInstructions, getLevelName };
