const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require("./claude-executor");
const { log } = require('console');

const executeCommand = async (command) => {
    return new Promise((resolve) => {
        logger.stopSpinner();
        logger.command(command);
        logger.separator();
        logger.newline();

        // Determine the appropriate shell to use
        const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
        const shellArgs = process.platform === 'win32' ? ['/c'] : ['-c'];

        const child = spawn(shell, [...shellArgs, command], {
            cwd: state.folder,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false
        });

        // Ensure state is properly initialized and claudiomiro folder exists
        if (!state.claudiomiroFolder) {
            state.setFolder(process.cwd());
        }

        // Ensure the claudiomiro folder exists
        if (!fs.existsSync(state.claudiomiroFolder)) {
            fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
        }

        const logFilePath = path.join(state.claudiomiroFolder, 'log.txt');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

        // Log separator with timestamp
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Command execution started: ${command}\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);

        let outputBuffer = '';
        let overwriteBlockLines = 0;

        const log = (text) => {
            // Overwrite previous block if it exists
            if (overwriteBlockLines > 0) {
                // overwriteBlock(overwriteBlockLines);
            }

            const max = process.stdout.columns || 80;
            let lineCount = 0;

            // Process and print text line by line
            const lines = text.split("\n");
            for (const line of lines) {
                if (line.length > max) {
                    // Break long line into multiple lines
                    for (let i = 0; i < line.length; i += max) {
                        console.log(line.substring(i, i + max));
                        lineCount++;
                    }
                } else {
                    console.log(line);
                    lineCount++;
                }
            }

            // Update counter for next overwrite
            overwriteBlockLines = lineCount;
        };

        // Capture stdout
        child.stdout.on('data', (data) => {
            const output = data.toString();
            outputBuffer += output;
            log(output);
            logStream.write('[STDOUT] ' + output);
        });

        // Capture stderr
        child.stderr.on('data', (data) => {
            const output = data.toString();
            outputBuffer += output;
            log(output, true);
            logStream.write('[STDERR] ' + output);
        });

        // When process finishes
        child.on('close', (code) => {
            logger.newline();
            logger.newline();

            logStream.write(`\n\n[${new Date().toISOString()}] Command execution completed with code ${code}\n`);
            logStream.end();

            logger.newline();
            logger.separator();

            const success = code === 0;

            if (success) {
                logger.success(`Command executed successfully (exit code: ${code})`);
            } else {
                logger.error(`Command failed with exit code: ${code}`);
            }

            resolve({
                success,
                exitCode: code,
                output: outputBuffer
            });
        });

        // Error handling
        child.on('error', (error) => {
            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger.error(`Failed to execute command: ${error.message}`);

            resolve({
                success: false,
                exitCode: -1,
                output: error.message,
                error: error.message
            });
        });
    });
};

const fixCommand = async (command, maxAttempts) => {
    if(!fs.existsSync(state.claudiomiroFolder)){
        fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
    }

    let i = 0;
    while (i < maxAttempts) {
        i++;

        const execution = await executeCommand(command);

        if (execution.success) {
            process.exit(0);
        }

        try {
            logger.info(`fix command "${command}"`);
            await executeClaude(`fix command "${command}"`);
        } catch (error) {
            console.log(`Attempt ${i} failed: ${error.message}`);
        }
    }

    throw new Error(`All ${maxAttempts} attempts to fix the command "${command}" have failed. Please check the command and try again.`);
}


module.exports = { fixCommand, executeCommand };