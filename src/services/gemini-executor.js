const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../../logger');
const state = require('../config/state');
const { processGeminiMessage } = require('./gemini-logger');
const { ParallelStateManager } = require('./parallel-state-manager');

const overwriteBlock = (lines) => {
    // Move o cursor para cima N linhas e limpa cada uma
    process.stdout.write(`\x1b[${lines}A`);
    for (let i = 0; i < lines; i++) {
      process.stdout.write('\x1b[2K'); // limpa linha
      process.stdout.write('\x1b[1B'); // desce uma linha
    }
    // Volta para o topo do bloco
    process.stdout.write(`\x1b[${lines}A`);
  }

// Helper function for temp file cleanup
const cleanupTempFile = (tmpFile) => {
    try {
        if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
        }
    } catch (err) {
        // Don't throw on cleanup failure, just log
        logger.error(`Failed to cleanup temp file: ${err.message}`);
    }
}

const runGemini = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        // ParallelStateManager integration
        let stateManager = null;
        let suppressStreamingLogs = false;

        if (taskName) {
            try {
                // Validate taskName format
                if (!/^[a-zA-Z0-9_-]+$/.test(taskName)) {
                    logger.warn(`Invalid taskName format: ${taskName}. Must be alphanumeric with dashes/underscores.`);
                } else {
                    stateManager = ParallelStateManager.getInstance();
                    if (stateManager && typeof stateManager.isUIRendererActive === 'function') {
                        suppressStreamingLogs = stateManager.isUIRendererActive();
                        logger.debug(`Using ParallelStateManager for task: ${taskName}, suppressStreamingLogs: ${suppressStreamingLogs}`);
                    }
                }
            } catch (error) {
                logger.warn(`Failed to initialize ParallelStateManager: ${error.message}`);
            }
        }

        // Validate prompt text
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            reject(new Error('Invalid prompt text: must be a non-empty string'));
            return;
        }

        // Create temporary file for the prompt with restricted permissions
        const tmpFile = path.join(os.tmpdir(), `claudiomiro-gemini-prompt-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, text, { encoding: 'utf-8', mode: 0o600 });

        // Use sh to execute command with cat substitution
        const command = `gemini -p "$(cat '${tmpFile}')"`;

        logger.stopSpinner();
        logger.info("Executing Gemini CLI");
        logger.command(`gemini ...`);
        logger.separator();
        logger.newline();

        const gemini = spawn('sh', ['-c', command], {
            cwd: state.folder,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const logFilePath = path.join(state.claudiomiroFolder, 'gemini-log.txt');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

        // Log separator with timestamp
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Gemini execution started\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);

        let buffer = '';
        let overwriteBlockLines = 0;

        // Buffer size limit to prevent memory exhaustion
        const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

        // Captura stdout e processa JSON streaming
        gemini.stdout.on('data', (data) => {
            const output = data.toString();

            // Check buffer size limit
            if (buffer.length + output.length > MAX_BUFFER_SIZE) {
                logger.warn('Gemini output buffer overflow - truncating buffer');
                buffer = ''; // Reset buffer to prevent memory exhaustion
            }

            // Add to buffer
            buffer += output;

            // Process complete lines
            const lines = buffer.split('\n');

            // Last line may be incomplete, keep in buffer
            buffer = lines.pop() || '';

            const log = (text) => {
                // Sobrescreve o bloco anterior se existir
                if (!suppressStreamingLogs && overwriteBlockLines > 0){
                    overwriteBlock(overwriteBlockLines);
                }

                const max = process.stdout.columns || 80;
                let lineCount = 0;

                if (suppressStreamingLogs) {
                    overwriteBlockLines = 0;
                    return;
                }

                // Imprime cabeçalho
                console.log(`💎 Gemini:`);
                lineCount++;

                // Processa e imprime o texto linha por linha
                const lines = text.split("\n");
                for(const line of lines){
                    if(line.length > max){
                        // Quebra linha longa em múltiplas linhas
                        for(let i = 0; i < line.length; i += max){
                            console.log(line.substring(i, i + max));
                            lineCount++;
                        }
                    }else{
                        console.log(line);
                        lineCount++;
                    }
                }

                // Atualiza contador para próximo overwrite
                overwriteBlockLines = lineCount;
            }

            for (const line of lines) {
                // Skip empty lines
                if (!line.trim()) continue;

                const text = processGeminiMessage(line);
                if(text){
                    log(text);
                    // Update state manager with Gemini message if taskName provided
                    if (stateManager && taskName && typeof stateManager.updateClaudeMessage === 'function') {
                        try {
                            stateManager.updateClaudeMessage(taskName, text);
                            logger.debug(`Updated state manager for task ${taskName}: ${text.substring(0, 50)}...`);
                        } catch (error) {
                            logger.warn(`Failed to update state manager: ${error.message}`);
                        }
                    }
                }
            }

            // Log to file
            logStream.write(output);
        });

        // Captura stderr
        gemini.stderr.on('data', (data) => {
            const output = data.toString();
            // process.stderr.write(output);
            logStream.write('[STDERR] ' + output);
        });

        // Quando o processo terminar
        gemini.on('close', (code) => {
            // Clean up temporary file
            cleanupTempFile(tmpFile);

            logger.newline();
            logger.newline();

            logStream.write(`\n\n[${new Date().toISOString()}] Gemini execution completed with code ${code}\n`);
            logStream.end();

            logger.newline();
            logger.separator();

            if (code !== 0) {
                const errorMsg = `Gemini exited with code ${code}`;
                logger.error(errorMsg);
                reject(new Error(errorMsg));
            } else {
                logger.success('Gemini execution completed');
                resolve();
            }
        });

        // Tratamento de erro
        gemini.on('error', (error) => {
            // Clean up temporary file on error
            cleanupTempFile(tmpFile);

            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger.error(`Failed to execute Gemini: ${error.message}`);
            reject(error);
        });
    });
};

const executeGemini = (text, taskName = null) => {
    return runGemini(text, taskName);
};

module.exports = { executeGemini };