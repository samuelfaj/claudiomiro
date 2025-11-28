const logger = require('./shared/utils/logger');
const { checkForUpdatesAsync } = require('./shared/utils/auto-update');

/**
 * Load persisted configuration from ~/.claudiomiro/config.json
 * and apply to environment variables
 */
const loadPersistedConfig = () => {
    try {
        const { loadConfig, applyConfigToEnv } = require('./commands/config');
        const config = loadConfig();
        applyConfigToEnv(config);
    } catch (error) {
        // Config module not available or error loading - ignore
    }
};

const parseArgs = () => {
    const args = process.argv.slice(2);
    const helpArg = args.includes('--help') || args.includes('-h');
    const versionArg = args.includes('--version') || args.includes('-v');
    const fixCommandArg = args.find(arg => arg.startsWith('--fix-command='));
    const loopFixesArg = args.includes('--loop-fixes');
    const fixBranchArg = args.includes('--fix-branch');
    const testLocalLlmArg = args.includes('--test-local-llm');
    const tokenOptimizerArg = args.includes('--token-optimizer');
    const configArg = args.includes('--config');

    if (helpArg || versionArg) {
        return { command: 'help', args };
    }
    if (configArg) {
        return { command: 'config', args };
    }
    if (testLocalLlmArg) {
        return { command: 'test-local-llm', args };
    }
    if (tokenOptimizerArg) {
        return { command: 'token-optimizer', args };
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

    // Load persisted configuration (applies env vars from ~/.claudiomiro/config.json)
    loadPersistedConfig();

    // Skip banner for help/version/config commands
    if (command !== 'help' && command !== 'config') {
        logger.banner();
        checkForUpdatesAsync('claudiomiro');
    }

    switch (command) {
        case 'help': {
            const { run: runHelp } = require('./commands/help');
            await runHelp(args);
            break;
        }
        case 'config': {
            const { run: runConfig } = require('./commands/config');
            await runConfig(args);
            break;
        }
        case 'test-local-llm': {
            const { run: runTestLocalLlm } = require('./commands/test-local-llm');
            await runTestLocalLlm(args);
            break;
        }
        case 'token-optimizer': {
            const { run: runTokenOptimizer } = require('./commands/token-optimizer');
            await runTokenOptimizer(args);
            break;
        }
        case 'task-executor': {
            const { run: runTaskExecutor } = require('./commands/task-executor');
            await runTaskExecutor(args);
            break;
        }
        case 'fix-command': {
            const { run: runFixCommand } = require('./commands/fix-command');
            await runFixCommand(args);
            break;
        }
        case 'loop-fixes': {
            const { run: runLoopFixes } = require('./commands/loop-fixes');
            await runLoopFixes(args);
            break;
        }
        case 'fix-branch': {
            const { run: runFixBranch } = require('./commands/fix-branch');
            await runFixBranch(args);
            break;
        }
        default:
            logger.error(`Unknown command: ${command}`);
            process.exit(1);
    }
};

module.exports = { init };
