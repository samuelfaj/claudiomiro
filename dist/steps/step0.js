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
exports.Step0 = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const state_1 = __importDefault(require("../config/state"));
const logger = __importStar(require("../../logger"));
const index_1 = require("../services/index");
const step1_1 = require("./step1");
class Step0 {
    /**
     * Execute step0 - Initialize task and create tasks structure
     * @param options Step0 configuration options
     * @returns Promise resolving to step execution result
     */
    static async execute(options = {}) {
        const { sameBranch = false, promptText = null } = options;
        try {
            const task = promptText || await index_1.PromptReader.getMultilineInput();
            const folder = (file) => path.join(state_1.default.claudiomiroFolder, file);
            if (!task || task.trim().length < 10) {
                logger.error('Please provide more details (at least 10 characters)');
                process.exit(0);
            }
            logger.newline();
            logger.startSpinner('Initializing task...');
            index_1.FileManager.startFresh(true);
            // Ensure the claudiomiro folder exists before writing
            if (!fs.existsSync(state_1.default.claudiomiroFolder)) {
                fs.mkdirSync(state_1.default.claudiomiroFolder, { recursive: true });
            }
            fs.writeFileSync(folder('INITIAL_PROMPT.md'), task);
            const branchStep = sameBranch
                ? ''
                : '0 - Create a git branch for this task\n\n';
            const md = fs.readFileSync(path.join(__dirname, 'step0.md'), 'utf-8');
            const prompt = md.replace('{{TASK}}', task).replace(new RegExp(`{{claudiomiroFolder}}`, 'g'), `${state_1.default.claudiomiroFolder}`);
            await index_1.ClaudeExecutor.execute(branchStep + prompt);
            logger.stopSpinner();
            logger.success('Tasks created successfully');
            // Check if tasks were created, but only in non-test environment
            if (process.env.NODE_ENV !== 'test') {
                if (!fs.existsSync(path.join(state_1.default.claudiomiroFolder, 'TASK0')) &&
                    !fs.existsSync(path.join(state_1.default.claudiomiroFolder, 'TASK1'))) {
                    throw new Error('Error creating tasks');
                }
            }
            await step1_1.Step1.execute();
            return {
                success: true,
                message: 'Tasks created successfully'
            };
        }
        catch (error) {
            logger.stopSpinner();
            return {
                success: false,
                message: 'Failed to create tasks',
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
}
exports.Step0 = Step0;
exports.default = Step0;
//# sourceMappingURL=step0.js.map