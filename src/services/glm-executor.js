const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../../logger');
const state = require('../config/state');
const { processGlmMessage } = require('./glm-logger');
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

const runGlm = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? ParallelStateManager.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();

        if(!text){
            throw new Error('no prompt');
        }

        // Create temporary file for the prompt
        const tmpFile = path.join(os.tmpdir(), `claudiomiro-codex-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, text, 'utf-8');

        // Use sh to execute command with cat substitution
        const command = `glm --dangerously-skip-permissions -p "$(cat '${tmpFile}')" --output-format stream-json --verbose`;

        logger.stopSpinner();
        logger.command(command);
        logger.separator();
        logger.newline();

        const deepSeek = spawn('sh', ['-c', command], {
            cwd: state.folder,
            stdio: ['ignore', 'pipe', 'pipe']
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

        // Captura stdout e processa JSON streaming
        deepSeek.stdout.on('data', (data) => {
            const output = data.toString();
            // Adiciona ao buffer
            buffer += output;

            // Processa linhas completas
            const lines = buffer.split('\n');

            // A última linha pode estar incompleta, então mantém no buffer
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
                console.log(`💬 Glm:`);
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
                const text = processGlmMessage(line);
                if(text){
                    log(text);
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
        deepSeek.stderr.on('data', (data) => {
            const output = data.toString();
            // process.stderr.write(output);
            logStream.write('[STDERR] ' + output);
        });

        // Quando o processo terminar
        deepSeek.on('close', (code) => {
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
        deepSeek.on('error', (error) => {
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
    if (state.executorType === 'codex') {
        const { executeCodex } = require('./codex-executor');
        return executeCodex(text, taskName);
    }

    return runGlm(text, taskName);
};

module.exports = { executeGlm };
