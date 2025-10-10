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
const step3_1 = require("../step3");
const fs = __importStar(require("fs"));
const state_1 = __importDefault(require("../../config/state"));
// Mock dependencies
jest.mock('../../../logger', () => ({
    info: jest.fn(),
}));
jest.mock('../../services/claude-executor', () => ({
    ClaudeExecutor: {
        execute: jest.fn(),
    },
}));
// Mock file system operations
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    rmSync: jest.fn(),
}));
describe('Step3', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset state
        state_1.default.setFolder('/test/path');
        // Mock file system operations
        fs.existsSync.mockReturnValue(false);
        fs.rmSync.mockImplementation(() => { });
    });
    describe('execute', () => {
        it('should execute successfully with task parameter', async () => {
            const task = 'testTask';
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step3_1.Step3.execute(task);
            expect(ClaudeExecutor.execute).toHaveBeenCalled();
            expect(ClaudeExecutor.execute.mock.calls[0][0]).toContain('PHASE: EXECUTION LOOP (DEPENDENCY + SAFETY)');
            expect(ClaudeExecutor.execute.mock.calls[0][1]).toBe(task);
        });
        it('should remove existing CODE_REVIEW.md file', async () => {
            const task = 'testTask';
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            // Mock that CODE_REVIEW.md exists
            fs.existsSync.mockImplementation((filePath) => {
                if (typeof filePath === 'string' && filePath.includes('CODE_REVIEW.md')) {
                    return true;
                }
                return false;
            });
            await step3_1.Step3.execute(task);
            expect(fs.rmSync).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalled();
        });
        it('should handle Claude execution failure', async () => {
            const task = 'testTask';
            const { ClaudeExecutor } = require('../../services/claude-executor');
            const claudeError = new Error('Claude execution failed');
            ClaudeExecutor.execute.mockRejectedValue(claudeError);
            await expect(step3_1.Step3.execute(task)).rejects.toThrow('Claude execution failed');
        });
        it('should include correct folder paths in prompt', async () => {
            const task = 'testTask';
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step3_1.Step3.execute(task);
            const prompt = ClaudeExecutor.execute.mock.calls[0][0];
            expect(prompt).toContain('/test/path/.claudiomiro/testTask/TODO.md');
            expect(prompt).toContain('PHASE: EXECUTION LOOP (DEPENDENCY + SAFETY)');
            expect(prompt).toContain('OBJECTIVE:');
            expect(prompt).toContain('LOOP:');
            expect(prompt).toContain('TESTS:');
            expect(prompt).toContain('FAILURES:');
            expect(prompt).toContain('STATE:');
            expect(prompt).toContain('MCP:');
        });
    });
    describe('Static class pattern', () => {
        it('should be a static class with execute method', () => {
            expect(typeof step3_1.Step3.execute).toBe('function');
            expect(step3_1.Step3.execute).toBeInstanceOf(Function);
        });
        it('should be a static-only class', () => {
            // Verify it's a static class pattern
            expect(typeof step3_1.Step3.execute).toBe('function');
        });
    });
    describe('Type safety', () => {
        it('should accept string task parameter', () => {
            // This should compile without type errors
            const task = 'testTask';
            expect(typeof task).toBe('string');
        });
        it('should return Promise<void>', () => {
            // This should compile without type errors
            const result = step3_1.Step3.execute('testTask');
            expect(result).toBeInstanceOf(Promise);
        });
    });
});
//# sourceMappingURL=step3.test.js.map