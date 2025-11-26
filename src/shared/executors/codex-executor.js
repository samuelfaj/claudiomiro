const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { processCodexEvent } = require('./codex-logger');
const { ParallelStateManager } = require('./parallel-state-manager');

const overwriteBlock = (lines) => {
    process.stdout.write(`\x1b[${lines}A`);
    for (let i = 0; i < lines; i++) {
        process.stdout.write('\x1b[2K');
        process.stdout.write('\x1b[1B');
    }
    process.stdout.write(`\x1b[${lines}A`);
};

const executeCodex = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? ParallelStateManager.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();

        if (!text) {
            throw new Error('no prompt');
        }
        const tmpFile = path.join(os.tmpdir(), `claudiomiro-codex-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, text, 'utf-8');

        const command = `codex exec --json --full-auto --sandbox danger-full-access "$(cat '${tmpFile}')"`;

        logger.stopSpinner();
        logger.command('codex exec --json --full-auto --sandbox danger-full-access ...');
        logger.separator();
        logger.newline();

        const codex = spawn('sh', ['-c', command], {
            cwd: state.folder,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const logFilePath = path.join(state.claudiomiroFolder, 'codex-log.txt');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Codex execution started\n`);
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
                console.log('\n⚠️ Codex has been inactive for 10 minutes, terminating process...');
                logStream.write(`\n\n[${new Date().toISOString()}] Codex timeout after 10 minutes of inactivity - killing process\n`);

                // Kill the Codex process
                codex.kill('SIGKILL');

                // Force the Promise to reject with timeout error
                reject(new Error('Codex stuck - timeout after 10 minutes of inactivity'));
            }, INACTIVITY_TIMEOUT);
            inactivityTimer.unref();
        };

        const logMessage = (content) => {
            if (!suppressStreamingLogs && overwriteBlockLines > 0) {
                overwriteBlock(overwriteBlockLines);
            }

            const max = process.stdout.columns || 80;
            let lineCount = 0;

            if (suppressStreamingLogs) {
                overwriteBlockLines = 0;
                return;
            }

            console.log('💬 Codex:');
            lineCount++;

            const segments = content.split('\n');
            for (const segment of segments) {
                if (segment.length > max) {
                    for (let i = 0; i < segment.length; i += max) {
                        console.log(segment.substring(i, i + max));
                        lineCount++;
                    }
                } else {
                    console.log(segment);
                    lineCount++;
                }
            }

            overwriteBlockLines = lineCount;
        };

        // Start the inactivity timer when the process begins
        resetInactivityTimer();

        codex.stdout.on('data', (data) => {
            const output = data.toString();

            buffer += output;

            // Reset the inactivity timer when data is received
            resetInactivityTimer();

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const formatted = processCodexEvent(line);
                if (formatted) {
                    logMessage(formatted);
                    if (stateManager && taskName) {
                        stateManager.updateClaudeMessage(taskName, formatted);
                    }
                }
            }

            logStream.write(output);
        });

        codex.stderr.on('data', (data) => {
            const output = data.toString();
            logStream.write('[STDERR] ' + output);
        });

        codex.on('close', (code) => {
            // Clear the inactivity timer
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }

            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            } catch (error) {
                logger.error(`Failed to cleanup temp file: ${error.message}`);
            }

            logger.newline();
            logger.newline();

            logStream.write(`\n\n[${new Date().toISOString()}] Codex execution completed with code ${code}\n`);
            logStream.end();

            logger.newline();
            logger.separator();

            if (code !== 0) {
                logger.error(`Codex exited with code ${code}`);
                reject(new Error(`Codex exited with code ${code}`));
            } else {
                logger.success('Codex execution completed');
                resolve();
            }
        });

        codex.on('error', (error) => {
            // Clear the inactivity timer
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }

            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            } catch (cleanupError) {
                logger.error(`Failed to cleanup temp file: ${cleanupError.message}`);
            }

            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger.error(`Failed to execute Codex: ${error.message}`);
            reject(error);
        });
    });
};

module.exports = { executeCodex };
