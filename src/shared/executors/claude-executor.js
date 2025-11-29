const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processClaudeMessage } = require('./claude-logger');
// ParallelStateManager is optional - only available when running within task-executor context
let ParallelStateManager = { getInstance: () => null };
try {
    const psm = require('./parallel-state-manager');
    ParallelStateManager = psm.ParallelStateManager || ParallelStateManager;
} catch (e) {
    // ParallelStateManager not available in shared context - this is expected
}

const overwriteBlock = (lines) => {
    // Move cursor up N lines and clear each one
    process.stdout.write(`\x1b[${lines}A`);
    for (let i = 0; i < lines; i++) {
        process.stdout.write('\x1b[2K'); // clear line
        process.stdout.write('\x1b[1B'); // move down one line
    }
    // Return to the top of the block
    process.stdout.write(`\x1b[${lines}A`);
};

const runClaude = (text, taskName = null, options = {}) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? ParallelStateManager.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();
        // Create temporary file for the prompt
        const tmpFile = path.join(os.tmpdir(), `claudiomiro-prompt-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, text, 'utf-8');

        // Use sh to execute command with cat substitution
        const command = `claude --dangerously-skip-permissions -p "$(cat '${tmpFile}')" --output-format stream-json --verbose`;

        if (!suppressStreamingLogs) {
            logger.stopSpinner();
            logger.command('claude --dangerously-skip-permissions ...');
            logger.separator();
            logger.newline();
        }

        const claude = spawn('sh', ['-c', command], {
            cwd: options.cwd || state.folder,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const logFilePath = path.join(state.claudiomiroFolder, 'log.txt');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

        // Log separator with timestamp
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Claude execution started\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);

        let buffer = '';

        let overwriteBlockLines = 0;

        // Timeout to detect stuck process (15 minutes)
        let inactivityTimer = null;
        const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

        // Function to reset the inactivity timer
        const resetInactivityTimer = () => {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }

            inactivityTimer = setTimeout(() => {
                console.log('\n⚠️ Claude has been inactive for 15 minutes, terminating process...');
                logStream.write(`\n\n[${new Date().toISOString()}] Claude timeout after 15 minutes of inactivity - killing process\n`);

                // Kill the Claude process
                claude.kill('SIGKILL');

                // Force the Promise to reject with timeout error
                reject(new Error('Claude stuck - timeout after 15 minutes of inactivity'));
            }, INACTIVITY_TIMEOUT);
        };

        // Start the inactivity timer when the process begins
        resetInactivityTimer();

        // Captura stdout e processa JSON streaming
        claude.stdout.on('data', (data) => {
            const output = data.toString();
            // Adiciona ao buffer
            buffer += output;

            // Reset the inactivity timer when data is received
            resetInactivityTimer();

            // Processa linhas completas
            const lines = buffer.split('\n');

            // A última linha pode estar incompleta, então mantém no buffer
            buffer = lines.pop() || '';

            const log = (text) => {
                // Sobrescreve o bloco anterior se existir
                if (!suppressStreamingLogs && overwriteBlockLines > 0) {
                    overwriteBlock(overwriteBlockLines);
                }

                const max = process.stdout.columns || 80;
                let lineCount = 0;

                if (suppressStreamingLogs) {
                    overwriteBlockLines = 0;
                    return;
                }

                // Imprime cabeçalho
                console.log('💬 Claude:');
                lineCount++;

                // Processa e imprime o texto linha por linha
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.length > max) {
                        // Quebra linha longa em múltiplas linhas
                        for (let i = 0; i < line.length; i += max) {
                            console.log(line.substring(i, i + max));
                            lineCount++;
                        }
                    } else {
                        console.log(line);
                        lineCount++;
                    }
                }

                // Atualiza contador para próximo overwrite
                overwriteBlockLines = lineCount;
            };

            for (const line of lines) {
                const text = processClaudeMessage(line);
                if (text) {
                    log(text);
                    // Update state manager with Claude message if taskName provided
                    if (stateManager && taskName) {
                        stateManager.updateClaudeMessage(taskName, text);
                    }
                }
            }

            // Log to file
            logStream.write(output);
        });

        // Captura stderr
        claude.stderr.on('data', (data) => {
            const output = data.toString();
            // process.stderr.write(output);
            logStream.write('[STDERR] ' + output);
        });

        // Quando o processo terminar
        claude.on('close', (code) => {
            // Clear the inactivity timer
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }

            // Clean up temporary file
            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            } catch (err) {
                logger.error(`Failed to cleanup temp file: ${err.message}`);
            }

            logger.newline();
            logger.newline();

            logStream.write(`\n\n[${new Date().toISOString()}] Claude execution completed with code ${code}\n`);
            logStream.end();

            logger.newline();
            logger.separator();

            if (code !== 0) {
                logger.error(`Claude exited with code ${code}`);
                reject(new Error(`Claude exited with code ${code}`));
            } else {
                logger.success('Claude execution completed');
                resolve();
            }
        });

        // Tratamento de erro
        claude.on('error', (error) => {
            // Clear the inactivity timer
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }

            // Clean up temporary file on error
            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            } catch (err) {
                logger.error(`Failed to cleanup temp file: ${err.message}`);
            }

            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger.error(`Failed to execute Claude: ${error.message}`);
            reject(error);
        });
    });
};

const executeClaude = (text, taskName = null, options = {}) => {
    // Validate input before dispatching to any executor
    if (!text) {
        return Promise.reject(new Error('no prompt'));
    }

    if (state.executorType === 'codex') {
        const { executeCodex } = require('./codex-executor');
        return executeCodex(text, taskName);
    }

    if (state.executorType === 'deep-seek') {
        const { executeDeepSeek } = require('./deep-seek-executor');
        return executeDeepSeek(text, taskName);
    }

    if (state.executorType === 'gemini') {
        const { executeGemini } = require('./gemini-executor');
        return executeGemini(text, taskName);
    }

    if (state.executorType === 'glm') {
        const { executeGlm } = require('./glm-executor');
        return executeGlm(text, taskName);
    }

    return runClaude(text, taskName, options);
};

module.exports = { executeClaude };
