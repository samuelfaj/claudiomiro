const { spawn } = require('child_process');
const logger = require('../../shared/utils/logger');
const { getLocalLLMService } = require('../../shared/services/local-llm');

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
 * @returns {Promise<{filteredOutput: string, exitCode: number, fallback?: boolean}>}
 */
const executeTokenOptimizer = async (command, filterInstruction) => {
    if (!command) {
        throw new Error('Command is required');
    }
    if (!filterInstruction) {
        throw new Error('Filter instruction is required');
    }

    logger.info(`Running: ${command}`);

    const result = await runCommand(command);
    const combinedOutput = result.stdout + result.stderr;

    if (!combinedOutput.trim()) {
        logger.info('Command produced no output.');
        return { filteredOutput: '', exitCode: result.exitCode };
    }

    logger.info('Filtering output with Local LLM...');

    try {
        const filteredOutput = await filterWithLLM(combinedOutput, filterInstruction);

        if (filteredOutput) {
            return { filteredOutput, exitCode: result.exitCode };
        }

        // Fallback: return original output when LLM is not available
        logger.warning('Local LLM not available. Returning original output.');
        return { filteredOutput: combinedOutput, exitCode: result.exitCode, fallback: true };
    } catch (err) {
        // Fallback: return original output when LLM fails
        logger.warning(`LLM filtering failed: ${err.message}`);
        logger.info('Falling back to original output.');
        return { filteredOutput: combinedOutput, exitCode: result.exitCode, fallback: true };
    }
};

module.exports = {
    runCommand,
    buildFilterPrompt,
    filterWithLLM,
    executeTokenOptimizer,
};
