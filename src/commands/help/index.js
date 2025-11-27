const chalk = require('chalk');
const packageJson = require('../../../package.json');

const COMMANDS = [
    {
        name: 'claudiomiro [folder] [options]',
        description: 'Execute autonomous AI-powered task decomposition and implementation',
        options: [
            { flag: '--executor=<name>', description: 'AI executor to use (claude, codex, gemini, deepseek, glm)' },
            { flag: '--model=<name>', description: 'Specific model to use with the executor' },
            { flag: '--skip-research', description: 'Skip the research phase' }
        ]
    },
    {
        name: 'claudiomiro --fix-command="<command>" [folder] [options]',
        description: 'Run a command repeatedly until it succeeds (useful for fixing tests/linting)',
        options: [
            { flag: '--limit=<n>', description: 'Maximum attempts per task (default: 20)' },
            { flag: '--no-limit', description: 'Run without attempt limit' }
        ]
    },
    {
        name: 'claudiomiro --loop-fixes [folder] [options]',
        description: 'Iteratively find and fix issues based on a custom prompt',
        options: [
            { flag: '--prompt="<text>"', description: 'Analysis/fix prompt (or enter interactively)' },
            { flag: '--limit=<n>', description: 'Maximum iterations (default: 10)' },
            { flag: '--no-limit', description: 'Run without iteration limit' }
        ]
    },
    {
        name: 'claudiomiro --fix-branch [folder] [options]',
        description: 'Staff+ Engineer code review - comprehensive branch analysis before PR',
        options: [
            { flag: '--level=<1|2|3>', description: 'Correction level: 1=blockers, 2=+warnings, 3=+suggestions (default: 1)' },
            { flag: '--blockers-only', description: 'Alias for --level=1 (fix only blockers)' },
            { flag: '--no-suggestions', description: 'Alias for --level=2 (fix blockers and warnings)' },
            { flag: '--limit=<n>', description: 'Maximum iterations (default: 20)' },
            { flag: '--no-limit', description: 'Run without iteration limit' }
        ]
    }
];

const GLOBAL_OPTIONS = [
    { flag: '-h, --help', description: 'Show this help message' },
    { flag: '-v, --version', description: 'Show version number' }
];

const formatFlag = (flag) => chalk.cyan(flag);
const formatDescription = (desc) => chalk.gray(desc);

const printHeader = () => {
    console.log();
    console.log(chalk.bold.white(`  Claudiomiro v${packageJson.version}`));
    console.log(chalk.gray('  AI-Powered Development Agent'));
    console.log();
};

const printUsage = () => {
    console.log(chalk.bold.yellow('  USAGE'));
    console.log();
    console.log(chalk.white('    $ claudiomiro [command] [options]'));
    console.log();
};

const printCommands = () => {
    console.log(chalk.bold.yellow('  COMMANDS'));
    console.log();

    for (const cmd of COMMANDS) {
        console.log(`    ${formatFlag(cmd.name)}`);
        console.log(`      ${formatDescription(cmd.description)}`);
        console.log();

        if (cmd.options && cmd.options.length > 0) {
            for (const opt of cmd.options) {
                console.log(`      ${formatFlag(opt.flag.padEnd(25))} ${formatDescription(opt.description)}`);
            }
            console.log();
        }
    }
};

const printGlobalOptions = () => {
    console.log(chalk.bold.yellow('  GLOBAL OPTIONS'));
    console.log();

    for (const opt of GLOBAL_OPTIONS) {
        console.log(`    ${formatFlag(opt.flag.padEnd(25))} ${formatDescription(opt.description)}`);
    }
    console.log();
};

const printExamples = () => {
    console.log(chalk.bold.yellow('  EXAMPLES'));
    console.log();
    console.log(chalk.gray('    # Run task executor in current directory'));
    console.log(chalk.white('    $ claudiomiro'));
    console.log();
    console.log(chalk.gray('    # Run task executor in a specific folder with Claude'));
    console.log(chalk.white('    $ claudiomiro ./my-project --executor=claude'));
    console.log();
    console.log(chalk.gray('    # Fix failing tests automatically'));
    console.log(chalk.white('    $ claudiomiro --fix-command="npm test"'));
    console.log();
    console.log(chalk.gray('    # Loop fixes with custom limit'));
    console.log(chalk.white('    $ claudiomiro --loop-fixes --limit=50'));
    console.log();
    console.log(chalk.gray('    # Staff+ code review - blockers only (default)'));
    console.log(chalk.white('    $ claudiomiro --fix-branch'));
    console.log();
    console.log(chalk.gray('    # Staff+ code review - fix blockers and warnings'));
    console.log(chalk.white('    $ claudiomiro --fix-branch --level=2'));
    console.log();
    console.log(chalk.gray('    # Staff+ code review - fix all issues'));
    console.log(chalk.white('    $ claudiomiro --fix-branch --level=3'));
    console.log();
};

const printFooter = () => {
    console.log(chalk.gray('  For more information, visit:'));
    console.log(chalk.cyan('  https://github.com/samuelfaj/claudiomiro'));
    console.log();
};

const showHelp = () => {
    printHeader();
    printUsage();
    printCommands();
    printGlobalOptions();
    printExamples();
    printFooter();
};

const showVersion = () => {
    console.log(`claudiomiro v${packageJson.version}`);
};

const run = async (args) => {
    const isVersion = args.includes('-v') || args.includes('--version');

    if (isVersion) {
        showVersion();
    } else {
        showHelp();
    }
};

module.exports = {
    run,
    showHelp,
    showVersion,
    COMMANDS,
    GLOBAL_OPTIONS
};
