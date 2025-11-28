const logger = require('../../shared/utils/logger');
const { executeTokenOptimizer } = require('./executor');

const printUsage = () => {
    console.log(`
Usage: claudiomiro --token-optimizer --command="<cmd>" --filter="<instruction>"

Arguments:
  --command="<cmd>"     Shell command to execute (e.g., "npx jest")
  --filter="<text>"     Instruction for filtering output (e.g., "return only errors")

Environment variables:
  CLAUDIOMIRO_LOCAL_LLM   Local LLM model to use (e.g., "qwen2.5-coder:7b")
  OLLAMA_HOST             Ollama server URL (default: http://localhost:11434)

Note: Requires CLAUDIOMIRO_LOCAL_LLM to be set. Falls back to original output if unavailable.

Examples:
  claudiomiro --token-optimizer --command="npx jest" --filter="return only errors"
  claudiomiro --token-optimizer --command="npm run build" --filter="show only warnings and errors"
  claudiomiro --token-optimizer --command="cargo test" --filter="summarize test failures"
`);
};

/**
 * Extract a quoted value from an argument like --flag="value" or --flag='value'
 * @param {string} arg - The argument string
 * @returns {string|null} - The extracted value or null
 */
const extractQuotedValue = (arg) => {
    if (!arg) return null;
    const parts = arg.split('=');
    if (parts.length < 2) return null;
    return parts.slice(1).join('=').replace(/^["']|["']$/g, '');
};

const run = async (args) => {
    // Check for help
    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        return;
    }

    // Parse command argument
    const commandArg = args.find(arg => arg.startsWith('--command='));
    const command = extractQuotedValue(commandArg);

    // Parse filter argument
    const filterArg = args.find(arg => arg.startsWith('--filter='));
    const filter = extractQuotedValue(filterArg);

    // Validate required arguments
    if (!command || !filter) {
        logger.error('Missing required arguments.');
        printUsage();
        process.exit(1);
    }

    try {
        const result = await executeTokenOptimizer(command, filter);

        if (result.filteredOutput) {
            console.log('\n' + result.filteredOutput);
        }

        if (result.fallback) {
            logger.warning('Output shown without filtering (Ollama unavailable).');
        }

        process.exit(result.exitCode);
    } catch (err) {
        logger.error(err.message);
        process.exit(1);
    }
};

module.exports = { run, printUsage, extractQuotedValue };
