"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeExecutor = exports.executeClaude = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const logger = __importStar(require("../../logger"));
const state_1 = __importDefault(require("../config/state"));
const claude_logger_1 = require("./claude-logger");
const parallel_state_manager_1 = __importDefault(require("./parallel-state-manager"));
const codex_executor_1 = require("./codex-executor");
const deep_seek_executor_1 = require("./deep-seek-executor");
const gemini_executor_1 = require("./gemini-executor");
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
const runClaude = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? parallel_state_manager_1.default.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();
        // Create temporary file for the prompt
        const tmpFile = path.join(os.tmpdir(), `claudiomiro-prompt-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, text, 'utf-8');
        // Use sh to execute command with cat substitution
        const command = `claude --dangerously-skip-permissions -p "$(cat '${tmpFile}')" --output-format stream-json --verbose`;
        logger.stopSpinner();
        logger.command(`claude --dangerously-skip-permissions ...`);
        logger.separator();
        logger.newline();
        const claude = (0, child_process_1.spawn)('sh', ['-c', command], {
            cwd: state_1.default.folder || process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const logFilePath = path.join(state_1.default.claudiomiroFolder || '/tmp', 'log.txt');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
        // Log separator with timestamp
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Claude execution started\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);
        let buffer = '';
        let overwriteBlockLines = 0;
        // Captura stdout e processa JSON streaming
        claude.stdout.on('data', (data) => {
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
                console.log(`💬 Claude:`);
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
                const text = claude_logger_1.ClaudeLogger.processMessage(line);
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
            // Clean up temporary file
            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            }
            catch (err) {
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
            }
            else {
                logger.success('Claude execution completed');
                resolve();
            }
        });
        // Tratamento de erro
        claude.on('error', (error) => {
            // Clean up temporary file on error
            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            }
            catch (err) {
                logger.error(`Failed to cleanup temp file: ${err.message}`);
            }
            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger.error(`Failed to execute Claude: ${error.message}`);
            reject(error);
        });
    });
};
const executeClaude = (text, taskName = null) => {
    if (state_1.default.executorType === 'codex') {
        return (0, codex_executor_1.executeCodex)(text, taskName);
    }
    if (state_1.default.executorType === 'deep-seek') {
        return (0, deep_seek_executor_1.executeDeepSeek)(text, taskName);
    }
    if (state_1.default.executorType === 'gemini') {
        return (0, gemini_executor_1.executeGemini)(text, taskName);
    }
    return runClaude(text, taskName);
};
exports.executeClaude = executeClaude;
class ClaudeExecutor {
    /**
     * Execute Claude with the given text
     * @param text The text to execute with Claude
     * @param taskName Optional task name for parallel execution
     * @returns Promise resolving when execution completes
     */
    static async execute(text, taskName = null) {
        return executeClaude(text, taskName);
    }
}
exports.ClaudeExecutor = ClaudeExecutor;
//# sourceMappingURL=claude-executor.js.map