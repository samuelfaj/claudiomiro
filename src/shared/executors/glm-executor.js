const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processGlmMessage } = require('./glm-logger');
// ParallelStateManager is optional - only available when running within task-executor context
let ParallelStateManager = { getInstance: () => null };
try {
    const psm = require('./parallel-state-manager');
    ParallelStateManager = psm.ParallelStateManager || ParallelStateManager;
} catch (e) {
    // ParallelStateManager not available in shared context - this is expected
}

const overwriteBlock = (lines) => {
    // Move o cursor para cima N linhas e limpa cada uma
    process.stdout.write(`\x1b[${lines}A`);
    for (let i = 0; i < lines; i++) {
        process.stdout.write('\x1b[2K'); // limpa linha
        process.stdout.write('\x1b[1B'); // desce uma linha
    }
    // Volta para o topo do bloco
    process.stdout.write(`\x1b[${lines}A`);
};

const runGlm = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? ParallelStateManager.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();

        // Create temporary file for the prompt
        const tmpFile = path.join(os.tmpdir(), `claudiomiro-glm-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, text, 'utf-8');

        // Use sh to execute command with cat substitution
        const command = `glm --dangerously-skip-permissions -p "$(cat '${tmpFile}')" --output-format stream-json --verbose`;

        if (!suppressStreamingLogs) {
            logger.stopSpinner();
            logger.command(command);
            logger.separator();
            logger.newline();
        }

        const glm = spawn('sh', ['-c', command], {
            cwd: state.folder,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const logFilePath = path.join(state.claudiomiroFolder, 'log.txt');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

        // Log separator with timestamp
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Glm execution started\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);

        let buffer = '';

        let overwriteBlockLines = 0;

        // Timeout to detect stuck process (10 minutes)
        let inactivityTimer = null;
        const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 10 minutes in milliseconds

        // Function to reset the inactivity timer
        const resetInactivityTimer = () => {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }

            inactivityTimer = setTimeout(() => {
                console.log('\n⚠️ Glm has been inactive for 10 minutes, terminating process...');
                logStream.write(`\n\n[${new Date().toISOString()}] Glm timeout after 10 minutes of inactivity - killing process\n`);

                // Kill the Glm process
                glm.kill('SIGKILL');

                // Force the Promise to reject with timeout error
                reject(new Error('Glm stuck - timeout after 10 minutes of inactivity'));
            }, INACTIVITY_TIMEOUT);
            inactivityTimer.unref();
        };

        // Start the inactivity timer when the process begins
        resetInactivityTimer();

        // Captura stdout e processa JSON streaming
        glm.stdout.on('data', (data) => {
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
                console.log('💬 Glm:');
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
                const text = processGlmMessage(line);
                if (text) {
                    if (!suppressStreamingLogs) {
                        log(text);
                    }
                    // Update state manager with Glm message if taskName provided
                    if (stateManager && taskName) {
                        stateManager.updateClaudeMessage(taskName, text);
                    }
                }
            }

            // Log to file
            logStream.write(output);
        });

        // Captura stderr
        glm.stderr.on('data', (data) => {
            const output = data.toString();
            // process.stderr.write(output);
            logStream.write('[STDERR] ' + output);
        });

        // Quando o processo terminar
        glm.on('close', (code) => {
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

            logStream.write(`\n\n[${new Date().toISOString()}] Glm execution completed with code ${code}\n`);
            logStream.end();

            logger.newline();
            logger.separator();

            if (code !== 0) {
                logger.error(`Glm exited with code ${code}`);
                reject(new Error(`Glm exited with code ${code}`));
            } else {
                logger.success('Glm execution completed');
                resolve();
            }
        });

        // Tratamento de erro
        glm.on('error', (error) => {
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
            logger.error(`Failed to execute Glm: ${error.message}`);
            reject(error);
        });
    });
};

const executeGlm = (text, taskName = null) => {
    // Validate input before dispatching to any executor
    if (!text) {
        return Promise.reject(new Error('no prompt'));
    }

    return runGlm(text, taskName);
};

module.exports = { executeGlm };
