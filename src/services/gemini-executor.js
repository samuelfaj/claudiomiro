const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processGeminiMessage } = require('./gemini-logger');
const { ParallelStateManager } = require('./parallel-state-manager');

const overwriteBlock = (lines) => {
    // Move cursor up N lines and clear each one
    process.stdout.write(`\x1b[${lines}A`);
    for (let i = 0; i < lines; i++) {
      process.stdout.write('\x1b[2K'); // clear line
      process.stdout.write('\x1b[1B'); // move down one line
    }
    // Return to top of block
    process.stdout.write(`\x1b[${lines}A`);
  }

const createLoader = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let interval;
    let isLoading = false;

    const start = (message = 'loading...') => {
        if (isLoading) return;
        isLoading = true;
        let i = 0;

        // Write initial message
        process.stdout.write(`\n💎 Gemini is processing ${message}`);

        interval = setInterval(() => {
            // Move cursor to beginning of line and clear
            process.stdout.write('\r\x1b[K');
            // Write animated frame
            process.stdout.write(`${frames[i]} 💎 Gemini is processing ${message}`);
            i = (i + 1) % frames.length;
        }, 100);
    };

    const stop = () => {
        if (!isLoading) return;
        isLoading = false;
        if (interval) {
            clearInterval(interval);
        }
        // Clear loader line
        process.stdout.write('\r\x1b[K');
    };

    return { start, stop };
};

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

        // Create loader instance
        const loader = createLoader();
        let loaderStarted = false;

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

        // Start loader
        loader.start();
        loaderStarted = true;

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
                // Stop loader on first response
                if (loaderStarted) {
                    loader.stop();
                    loaderStarted = false;
                    console.log(); // Add blank line after stopping loader
                }

                // Overwrite previous block if it exists
                if (!suppressStreamingLogs && overwriteBlockLines > 0){
                    overwriteBlock(overwriteBlockLines);
                }

                const max = process.stdout.columns || 80;
                let lineCount = 0;

                if (suppressStreamingLogs) {
                    overwriteBlockLines = 0;
                    return;
                }

                // Print header
                console.log(`💎 Gemini:`);
                lineCount++;

                // Process and print text line by line
                const lines = text.split("\n");
                for(const line of lines){
                    if(line.length > max){
                        // Break long line into multiple lines
                        for(let i = 0; i < line.length; i += max){
                            console.log(line.substring(i, i + max));
                            lineCount++;
                        }
                    }else{
                        console.log(line);
                        lineCount++;
                    }
                }

                // Update counter for next overwrite
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

        // When process finishes
        gemini.on('close', (code) => {
            // Stop loader if still active
            if (loaderStarted) {
                loader.stop();
                loaderStarted = false;
                console.log();
            }

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

        // Error handling
        gemini.on('error', (error) => {
            // Stop loader if still active
            if (loaderStarted) {
                loader.stop();
                loaderStarted = false;
                console.log();
            }

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