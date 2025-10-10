"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeDeepSeek = exports.DeepSeekExecutor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const logger_1 = __importDefault(require("../../logger"));
const state_1 = __importDefault(require("../config/state"));
const deep_seek_logger_1 = require("./deep-seek-logger");
const parallel_state_manager_1 = __importDefault(require("./parallel-state-manager"));
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
const runDeepSeek = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? parallel_state_manager_1.default.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();
        if (!text) {
            throw new Error('no prompt');
        }
        // Create temporary file for the prompt
        const tmpFile = path_1.default.join(os_1.default.tmpdir(), `claudiomiro-codex-${Date.now()}.txt`);
        fs_1.default.writeFileSync(tmpFile, text, 'utf-8');
        // Use sh to execute command with cat substitution
        const command = `deepseek --dangerously-skip-permissions -p "$(cat '${tmpFile}')" --output-format stream-json --verbose`;
        logger_1.default.stopSpinner();
        logger_1.default.command(command);
        logger_1.default.separator();
        logger_1.default.newline();
        const deepSeek = (0, child_process_1.spawn)('sh', ['-c', command], {
            cwd: state_1.default.folder || process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const logFilePath = path_1.default.join(state_1.default.claudiomiroFolder || '/tmp', 'log.txt');
        const logStream = fs_1.default.createWriteStream(logFilePath, { flags: 'a' });
        // Log separator with timestamp
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] DeepSeek execution started\n`);
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
                console.log(`💬 DeepSeek:`);
                lineCount++;
                // Processa e imprime o texto linha por linha
                const lines = text.split("\n");
                for (const line of lines) {
                    if (line.length > max) {
                        // Quebra linha longa em múltiplas linhas
                        for (let i = 0; i < line.length; i += max) {
                            console.log(line.substring(i, i + max));
                            lineCount++;
                        }
                    }
                    else {
                        console.log(line);
                        lineCount++;
                    }
                }
                // Atualiza contador para próximo overwrite
                overwriteBlockLines = lineCount;
            };
            for (const line of lines) {
                const text = deep_seek_logger_1.DeepSeekLogger.processMessage(line);
                if (text) {
                    log(text);
                    // Update state manager with DeepSeek message if taskName provided
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
                if (fs_1.default.existsSync(tmpFile)) {
                    fs_1.default.unlinkSync(tmpFile);
                }
            }
            catch (err) {
                logger_1.default.error(`Failed to cleanup temp file: ${err.message}`);
            }
            logger_1.default.newline();
            logger_1.default.newline();
            logStream.write(`\n\n[${new Date().toISOString()}] DeepSeek execution completed with code ${code}\n`);
            logStream.end();
            logger_1.default.newline();
            logger_1.default.separator();
            if (code !== 0) {
                logger_1.default.error(`DeepSeek exited with code ${code}`);
                reject(new Error(`DeepSeek exited with code ${code}`));
            }
            else {
                logger_1.default.success('DeepSeek execution completed');
                resolve();
            }
        });
        // Tratamento de erro
        deepSeek.on('error', (error) => {
            // Clean up temporary file on error
            try {
                if (fs_1.default.existsSync(tmpFile)) {
                    fs_1.default.unlinkSync(tmpFile);
                }
            }
            catch (err) {
                logger_1.default.error(`Failed to cleanup temp file: ${err.message}`);
            }
            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger_1.default.error(`Failed to execute DeepSeek: ${error.message}`);
            reject(error);
        });
    });
};
class DeepSeekExecutor {
    /**
     * Execute DeepSeek with the given text
     * @param text The text to execute with DeepSeek
     * @param taskName Optional task name for parallel execution
     * @returns Promise resolving when execution completes
     */
    static async execute(text, taskName = null) {
        return runDeepSeek(text, taskName);
    }
}
exports.DeepSeekExecutor = DeepSeekExecutor;
;
const executeDeepSeek = runDeepSeek;
exports.executeDeepSeek = executeDeepSeek;
//# sourceMappingURL=deep-seek-executor.js.map