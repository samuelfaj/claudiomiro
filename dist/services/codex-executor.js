"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCodex = exports.CodexExecutor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const logger_1 = __importDefault(require("../../logger"));
const state_1 = __importDefault(require("../config/state"));
const codex_logger_1 = require("./codex-logger");
const parallel_state_manager_1 = __importDefault(require("./parallel-state-manager"));
const overwriteBlock = (lines) => {
    process.stdout.write(`\x1b[${lines}A`);
    for (let i = 0; i < lines; i++) {
        process.stdout.write('\x1b[2K');
        process.stdout.write('\x1b[1B');
    }
    process.stdout.write(`\x1b[${lines}A`);
};
const runCodex = (text, taskName = null) => {
    return executeCodex(text, taskName);
};
const executeCodex = (text, taskName = null) => {
    return new Promise((resolve, reject) => {
        const stateManager = taskName ? parallel_state_manager_1.default.getInstance() : null;
        const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();
        const tmpFile = path_1.default.join(os_1.default.tmpdir(), `claudiomiro-codex-${Date.now()}.txt`);
        fs_1.default.writeFileSync(tmpFile, text, 'utf-8');
        const command = `codex exec --json --full-auto --sandbox danger-full-access "$(cat '${tmpFile}')"`;
        logger_1.default.stopSpinner();
        logger_1.default.command('codex exec --json --full-auto --sandbox danger-full-access ...');
        logger_1.default.separator();
        logger_1.default.newline();
        const codex = (0, child_process_1.spawn)('sh', ['-c', command], {
            cwd: state_1.default.folder,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const logFilePath = path_1.default.join(state_1.default.claudiomiroFolder, 'codex-log.txt');
        const logStream = fs_1.default.createWriteStream(logFilePath, { flags: 'a' });
        const timestamp = new Date().toISOString();
        logStream.write(`\n\n${'='.repeat(80)}\n`);
        logStream.write(`[${timestamp}] Codex execution started\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);
        let buffer = '';
        let overwriteBlockLines = 0;
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
                }
                else {
                    console.log(segment);
                    lineCount++;
                }
            }
            overwriteBlockLines = lineCount;
        };
        codex.stdout.on('data', (data) => {
            const output = data.toString();
            buffer += output;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const formatted = codex_logger_1.CodexLogger.processEvent(line);
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
            try {
                if (fs_1.default.existsSync(tmpFile)) {
                    fs_1.default.unlinkSync(tmpFile);
                }
            }
            catch (error) {
                logger_1.default.error(`Failed to cleanup temp file: ${error.message}`);
            }
            logger_1.default.newline();
            logger_1.default.newline();
            logStream.write(`\n\n[${new Date().toISOString()}] Codex execution completed with code ${code}\n`);
            logStream.end();
            logger_1.default.newline();
            logger_1.default.separator();
            if (code !== 0) {
                logger_1.default.error(`Codex exited with code ${code}`);
                reject(new Error(`Codex exited with code ${code}`));
            }
            else {
                logger_1.default.success('Codex execution completed');
                resolve();
            }
        });
        codex.on('error', (error) => {
            try {
                if (fs_1.default.existsSync(tmpFile)) {
                    fs_1.default.unlinkSync(tmpFile);
                }
            }
            catch (cleanupError) {
                logger_1.default.error(`Failed to cleanup temp file: ${cleanupError.message}`);
            }
            logStream.write(`\n\nERROR: ${error.message}\n`);
            logStream.end();
            logger_1.default.error(`Failed to execute Codex: ${error.message}`);
            reject(error);
        });
    });
};
exports.executeCodex = executeCodex;
class CodexExecutor {
    /**
     * Execute Codex with the given text
     * @param text The text to execute with Codex
     * @returns Promise resolving when execution completes
     */
    static async execute(text) {
        return runCodex(text);
    }
}
exports.CodexExecutor = CodexExecutor;
;
//# sourceMappingURL=codex-executor.js.map