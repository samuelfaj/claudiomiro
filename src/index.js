const logger = require('./shared/utils/logger');
const state = require('./shared/config/state');
const { checkForUpdatesAsync } = require('./shared/utils/auto-update');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const helpArg = args.includes('--help') || args.includes('-h');
    const versionArg = args.includes('--version') || args.includes('-v');
    const fixCommandArg = args.find(arg => arg.startsWith('--fix-command='));
    const loopFixesArg = args.includes('--loop-fixes');
    const fixBranchArg = args.includes('--fix-branch');

    if (helpArg || versionArg) {
        return { command: 'help', args };
    }
    if (fixCommandArg) {
        return { command: 'fix-command', args };
    }
    if (loopFixesArg) {
        return { command: 'loop-fixes', args };
    }
    if (fixBranchArg) {
        return { command: 'fix-branch', args };
    }
    return { command: 'task-executor', args };
};

const init = async () => {
    const { command, args } = parseArgs();

    // Skip banner for help/version commands
    if (command !== 'help') {
        logger.banner();
        checkForUpdatesAsync('claudiomiro');
    }

    switch (command) {
        case 'help':
            const { run: runHelp } = require('./commands/help');
            await runHelp(args);
            break;
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
        case 'fix-branch':
            const { run: runFixBranch } = require('./commands/fix-branch');
            await runFixBranch(args);
            break;
        default:
            logger.error(`Unknown command: ${command}`);
            process.exit(1);
    }
};

module.exports = { init };
