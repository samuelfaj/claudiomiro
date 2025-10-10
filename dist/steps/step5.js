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
exports.Step5 = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const state_1 = __importDefault(require("../config/state"));
const index_1 = require("../services/index");
const logger = __importStar(require("../../logger"));
/**
 * Step5 - GitHub PR generation and commit step
 */
class Step5 {
    /**
     * Execute git commit with optional push
     * @param text - Commit message
     * @param shouldPush - Whether to push to remote
     * @returns Promise resolving when commit completes
     */
    static gitCommit(text, shouldPush) {
        return new Promise((resolve, reject) => {
            const escapedText = text.replace(/"/g, '\\"');
            const gitProcess = (0, child_process_1.spawn)('sh', ['-c', `git add . && git commit -m "${escapedText}" ${shouldPush ? ` && git push` : ''}`], {
                cwd: process.cwd()
            });
            let stdout = '';
            let stderr = '';
            gitProcess.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                logger.info(text);
            });
            gitProcess.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                logger.info(text);
            });
            gitProcess.on('close', (code) => {
                if (code !== 0) {
                    const errorMessage = `Git command failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`;
                    reject(new Error(errorMessage));
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Execute step5 - Generate GitHub PR and commit changes
     * @param tasks - Array of task names
     * @param shouldPush - Whether to push to remote (default: true)
     * @returns Promise resolving when step completes
     */
    static async execute(tasks, shouldPush = true) {
        const PRS = [];
        for (const task of tasks) {
            const folder = (file) => path.join(state_1.default.claudiomiroFolder, task, file);
            PRS.push(folder('CODE_REVIEW.md'));
        }
        await index_1.ClaudeExecutor.execute(`Read "${PRS.join('" , "')}" and generate a 3 phrase resume of what was done and save in ${path.join(state_1.default.claudiomiroFolder, 'resume.txt')}`);
        if (!fs.existsSync(path.join(state_1.default.claudiomiroFolder, 'resume.txt'))) {
            throw new Error('resume.txt not found');
        }
        const resume = fs.readFileSync(path.join(state_1.default.claudiomiroFolder, 'resume.txt'), 'utf-8');
        const noLimit = process.argv.includes('--no-limit');
        const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
        const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
        const limit = noLimit ? Infinity : maxAttemptsPerTask;
        let i = 0;
        while (i < limit) {
            try {
                await Step5.gitCommit(resume, shouldPush);
                logger.info(`✅ Claudiomiro has been successfully executed. Check out: ${state_1.default.claudiomiroFolder}`);
                process.exit(0);
            }
            catch (e) {
                await index_1.ClaudeExecutor.execute(`fix error ${e.message}`);
            }
            i++;
        }
        throw new Error(`Maximum attempts (${maxAttemptsPerTask}) reached for tasks: ${tasks.join(', ')}`);
    }
}
exports.Step5 = Step5;
exports.default = Step5;
//# sourceMappingURL=step5.js.map