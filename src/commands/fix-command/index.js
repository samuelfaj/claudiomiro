const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { fixCommand } = require('./executor');

const run = async (args) => {
    const fixCommandArg = args.find(arg => arg.startsWith('--fix-command='));
    const fixCommandText = fixCommandArg
        ? fixCommandArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '')
        : null;

    const noLimit = args.includes('--no-limit');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    logger.info(`Fixing command: ${fixCommandText} (max attempts: ${noLimit ? 'no limit' : maxAttemptsPerTask})`);
    await fixCommand(fixCommandText, noLimit ? Infinity : maxAttemptsPerTask);
};

module.exports = { run };
