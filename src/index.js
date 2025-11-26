const logger = require('./shared/utils/logger');
const state = require('./shared/config/state');
const { checkForUpdatesAsync } = require('./shared/utils/auto-update');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const fixCommandArg = args.find(arg => arg.startsWith('--fix-command='));
    const loopFixesArg = args.includes('--loop-fixes');

    if (fixCommandArg) {
        return { command: 'fix-command', args };
    }
    if (loopFixesArg) {
        return { command: 'loop-fixes', args };
    }
    return { command: 'task-executor', args };
};

const init = async () => {
    logger.banner();
    checkForUpdatesAsync('claudiomiro');

    const { command, args } = parseArgs();

    switch (command) {
        case 'task-executor':
            const { run: runTaskExecutor } = require('./commands/task-executor');
            await runTaskExecutor(args);
            break;
        case 'fix-command':
            const { run: runFixCommand } = require('./commands/fix-command');
            await runFixCommand(args);
            break;
        case 'loop-fixes':
            const { run: runLoopFixes } = require('./commands/loop-fixes');
            await runLoopFixes(args);
            break;
        default:
            logger.error(`Unknown command: ${command}`);
            process.exit(1);
    }
};

module.exports = { init };
