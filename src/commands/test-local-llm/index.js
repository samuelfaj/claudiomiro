/**
 * Test Local LLM Command
 * Allows users to test if the Ollama integration is working
 */

const chalk = require('chalk');
const readline = require('readline');
const OllamaClient = require('../../shared/services/local-llm/ollama-client');
const { parseLocalLLMConfig } = require('../../shared/config/local-llm');

const printHeader = () => {
    console.log();
    console.log(chalk.bold.cyan('  Local LLM Test'));
    console.log(chalk.gray('  Test your Ollama integration'));
    console.log();
};

const printStatus = (status) => {
    console.log(chalk.bold.yellow('  CONNECTION STATUS'));
    console.log();

    if (status.available) {
        console.log(`    ${chalk.green('*')} Ollama server: ${chalk.green('Connected')}`);
        console.log(`    ${chalk.green('*')} Model: ${chalk.cyan(status.selectedModel)}`);
        console.log(`    ${chalk.green('*')} Model available: ${status.hasModel ? chalk.green('Yes') : chalk.red('No')}`);

        if (status.models && status.models.length > 0) {
            console.log();
            console.log(chalk.gray('    Available models:'));
            status.models.slice(0, 10).forEach(model => {
                const isCurrent = model.startsWith(status.selectedModel?.split(':')[0] || '');
                console.log(`      ${isCurrent ? chalk.cyan('->') : '  '} ${model}`);
            });
            if (status.models.length > 10) {
                console.log(chalk.gray(`      ... and ${status.models.length - 10} more`));
            }
        }
    } else {
        console.log(`    ${chalk.red('*')} Ollama server: ${chalk.red('Not available')}`);
        console.log(`    ${chalk.red('*')} Error: ${chalk.gray(status.error || 'Connection failed')}`);
        console.log();
        console.log(chalk.yellow('    Make sure Ollama is running:'));
        console.log(chalk.gray('      $ ollama serve'));
    }
    console.log();
};

const askForPrompt = () => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(chalk.cyan('  Enter your prompt: '), (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

const generateResponse = async (client, prompt) => {
    console.log();
    console.log(chalk.bold.yellow('  GENERATING RESPONSE'));
    console.log(chalk.gray('  (this may take a few seconds...)'));
    console.log();

    const startTime = Date.now();

    try {
        const response = await client.generate(prompt, {
            maxTokens: 512,
            temperature: 0.7,
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(chalk.bold.green('  RESPONSE'));
        console.log();
        console.log(chalk.white(`  ${response.split('\n').join('\n  ')}`));
        console.log();
        console.log(chalk.gray(`  Generated in ${elapsed}s`));
        console.log();

        return response;
    } catch (error) {
        console.log(chalk.bold.red('  ERROR'));
        console.log();
        console.log(chalk.red(`  ${error.message}`));
        console.log();
        throw error;
    }
};

const run = async (args) => {
    printHeader();

    // Check configuration
    const config = parseLocalLLMConfig();

    if (!config.enabled) {
        console.log(chalk.yellow('  Local LLM is not enabled.'));
        console.log();
        console.log(chalk.gray('  To enable, set the CLAUDIOMIRO_LOCAL_LLM environment variable:'));
        console.log(chalk.cyan('    $ CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b claudiomiro --test-local-llm'));
        console.log();
        console.log(chalk.gray('  Or set it permanently in your shell profile:'));
        console.log(chalk.cyan('    export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b'));
        console.log();
        return;
    }

    // Create client
    const client = new OllamaClient({
        model: config.model,
        host: config.host,
        port: config.port,
        timeout: config.timeout,
    });

    // Check health
    console.log(chalk.gray('  Checking connection...'));
    console.log();

    const status = await client.healthCheck();
    printStatus(status);

    if (!status.available) {
        process.exit(1);
    }

    if (!status.hasModel) {
        console.log(chalk.yellow(`  Model "${config.model}" is not installed.`));
        console.log();
        console.log(chalk.gray('  Install it with:'));
        console.log(chalk.cyan(`    $ ollama pull ${config.model}`));
        console.log();
        process.exit(1);
    }

    // Get prompt from args or ask interactively
    let prompt = null;

    const promptArg = args.find(arg => arg.startsWith('--prompt='));
    if (promptArg) {
        prompt = promptArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    }

    if (!prompt) {
        prompt = await askForPrompt();
    }

    if (!prompt) {
        console.log(chalk.yellow('  No prompt provided.'));
        return;
    }

    // Generate response
    await generateResponse(client, prompt);
};

module.exports = { run, printHeader, printStatus, generateResponse };
