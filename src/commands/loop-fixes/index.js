const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { getMultilineInput } = require('../../shared/services/prompt-reader');
const { loopFixes } = require('./executor');

/**
 * Parse the --prompt= argument from args
 * Handles quotes and equals signs in the prompt value
 *
 * @param {string[]} args - Command line arguments
 * @returns {string|null} The parsed prompt or null if not provided
 */
const parsePromptArg = (args) => {
    const promptArg = args.find(arg => arg.startsWith('--prompt='));
    if (!promptArg) {
        return null;
    }

    // Extract everything after --prompt=
    // Handle case where prompt contains = signs
    const prompt = promptArg
        .split('=')
        .slice(1)
        .join('=')
        .replace(/^["']|["']$/g, ''); // Remove surrounding quotes

    return prompt || null;
};

/**
 * Loop Fixes Command Entry Point
 *
 * Parses command line arguments and delegates to executor.
 *
 * Usage:
 *   claudiomiro --loop-fixes --prompt="Check for inconsistencies" [folder]
 *   claudiomiro --loop-fixes --limit=5 [folder]
 *   claudiomiro --loop-fixes --no-limit [folder]
 *
 * @param {string[]} args - Command line arguments
 */
const run = async (args) => {
    // Parse iteration limits
    const noLimit = args.includes('--no-limit');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const maxIterations = noLimit ? Infinity : (limitArg ? parseInt(limitArg.split('=')[1], 10) : 20);

    // Parse folder path (positional argument that doesn't start with --)
    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    // Parse prompt from args or get interactively
    let userPrompt = parsePromptArg(args);

    if (!userPrompt) {
        logger.info('No --prompt= provided. Please enter your prompt:');
        userPrompt = await getMultilineInput();
    }

    if (!userPrompt || !userPrompt.trim()) {
        logger.error('A prompt is required. Use --prompt="your prompt" or enter interactively.');
        throw new Error('A prompt is required for loop-fixes command.');
    }

    logger.info(`Running loop-fixes (max iterations: ${noLimit ? 'no limit' : maxIterations})`);

    // Execute the loop
    await loopFixes(userPrompt, maxIterations);
};

module.exports = { run, parsePromptArg };
