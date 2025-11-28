const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { getLocalLLMService } = require('../../shared/services/local-llm');

/**
 * Initialize the .claudiomiro/token-optimizer folder
 * @returns {string} Path to the token-optimizer folder
 */
const initializeTokenOptimizerFolder = () => {
    if (!state.claudiomiroFolder) {
        state.setFolder(process.cwd());
    }

    const tokenOptimizerFolder = path.join(state.claudiomiroFolder, 'token-optimizer');

    if (!fs.existsSync(tokenOptimizerFolder)) {
        fs.mkdirSync(tokenOptimizerFolder, { recursive: true });
    }

    return tokenOptimizerFolder;
};

/**
 * Generate a timestamp-based filename
 * @returns {string} Filename with timestamp
 */
const generateOutputFilename = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    return `output-${timestamp}.txt`;
};

/**
 * Save output to the token-optimizer folder
 * @param {string} content - The content to save
 * @param {string} command - The command that was executed
 * @returns {string} Path to the saved file
 */
const saveOutput = (content, command) => {
    const folder = initializeTokenOptimizerFolder();
    const filename = generateOutputFilename();
    const filePath = path.join(folder, filename);

    const fileContent = `# Token Optimizer Output
## Command
\`\`\`
${command}
\`\`\`

## Output
${content}
`;

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    return filePath;
};

/**
 * Run a shell command and capture stdout/stderr
 * @param {string} command - Shell command to execute
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
const runCommand = (command) => {
    return new Promise((resolve) => {
        const child = spawn(command, {
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code ?? 1,
            });
        });

        child.on('error', (err) => {
            stderr += err.message;
            resolve({
                stdout,
                stderr,
                exitCode: 1,
            });
        });
    });
};

/**
 * Build the prompt for filtering command output
 * @param {string} commandOutput - The raw command output
 * @param {string} filterInstruction - Instructions for filtering
 * @returns {string} - The prompt
 */
const buildFilterPrompt = (commandOutput, filterInstruction) => {
    return `You are a CLI output filter. Given the following command output, ${filterInstruction}.

Be concise and only output the filtered result. Do not add explanations or commentary.

Command output:
${commandOutput}`;
};

/**
 * Filter command output using LocalLLM service
 * @param {string} commandOutput - The raw command output
 * @param {string} filterInstruction - Instructions for filtering
 * @returns {Promise<string|null>} - Filtered output or null if unavailable
 */
const filterWithLLM = async (commandOutput, filterInstruction) => {
    const llmService = getLocalLLMService();
    await llmService.initialize();

    if (!llmService.isAvailable()) {
        return null;
    }

    const prompt = buildFilterPrompt(commandOutput, filterInstruction);
    return await llmService.generate(prompt, { maxTokens: 2000 });
};

/**
 * Execute token optimization: run command and filter output with LLM
 * @param {string} command - Shell command to execute
 * @param {string} filterInstruction - Instructions for filtering the output
 * @param {Object} options - Optional settings
 * @param {boolean} options.verbose - Whether to show detailed logs (default: false)
 * @returns {Promise<{filteredOutput: string, exitCode: number, fallback?: boolean, outputPath: string}>}
 */
const executeTokenOptimizer = async (command, filterInstruction, options = {}) => {
    const { verbose = false } = options;

    if (!command) {
        throw new Error('Command is required');
    }
    if (!filterInstruction) {
        throw new Error('Filter instruction is required');
    }

    if (verbose) {
        logger.info(`Running: ${command}`);
    }

    const result = await runCommand(command);
    const combinedOutput = result.stdout + result.stderr;

    if (!combinedOutput.trim()) {
        if (verbose) {
            logger.info('Command produced no output.');
        }
        const outputPath = saveOutput('(no output)', command);
        if (verbose) {
            logger.info(`Output saved to: ${outputPath}`);
        }
        return { filteredOutput: '', exitCode: result.exitCode, outputPath };
    }

    if (verbose) {
        logger.info('Filtering output with Local LLM...');
    }

    try {
        const filteredOutput = await filterWithLLM(combinedOutput, filterInstruction);

        if (filteredOutput) {
            const outputPath = saveOutput(combinedOutput, command);
            return { filteredOutput, exitCode: result.exitCode, outputPath };
        }

        // Fallback: return original output when LLM is not available
        if (verbose) {
            logger.warning('Local LLM not available. Returning original output.');
        }
        const outputPath = saveOutput(combinedOutput, command);
        if (verbose) {
            logger.info(`Full output saved to: ${outputPath}`);
        }
        return { filteredOutput: combinedOutput, exitCode: result.exitCode, fallback: true, outputPath };
    } catch (err) {
        // Fallback: return original output when LLM fails
        if (verbose) {
            logger.warning(`LLM filtering failed: ${err.message}`);
            logger.info('Falling back to original output.');
        }
        const outputPath = saveOutput(combinedOutput, command);
        if (verbose) {
            logger.info(`Full output saved to: ${outputPath}`);
        }
        return { filteredOutput: combinedOutput, exitCode: result.exitCode, fallback: true, outputPath };
    }
};

module.exports = {
    runCommand,
    buildFilterPrompt,
    filterWithLLM,
    executeTokenOptimizer,
    initializeTokenOptimizerFolder,
    generateOutputFilename,
    saveOutput,
};
