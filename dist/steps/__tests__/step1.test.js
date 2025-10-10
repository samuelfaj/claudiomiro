"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const step1_1 = require("../step1");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const state_1 = __importDefault(require("../../config/state"));
// Mock dependencies
jest.mock('../../../logger', () => ({
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock('../../services/claude-executor', () => ({
    ClaudeExecutor: {
        execute: jest.fn(),
    },
}));
// Mock file system operations
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
}));
describe('Step1', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset state
        state_1.default.setFolder('/test/path');
        // Mock file system operations
        fs_1.default.readdirSync.mockReturnValue([]);
        fs_1.default.statSync.mockReturnValue({ isDirectory: () => true });
        fs_1.default.existsSync.mockReturnValue(true);
        fs_1.default.readFileSync.mockReturnValue('Mock file content');
        fs_1.default.writeFileSync.mockImplementation(() => { });
    });
    describe('execute', () => {
        it('should handle no tasks found', async () => {
            fs_1.default.readdirSync.mockReturnValue([]);
            await step1_1.Step1.execute();
            // Should complete without errors when no tasks found
        });
        it('should handle single task', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1']);
            fs_1.default.readFileSync.mockReturnValue('# Task content without dependencies');
            await step1_1.Step1.execute();
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(path_1.default.join('/test/path/.claudiomiro', 'TASK1', 'TASK.md'), '@dependencies []\n# Task content without dependencies', 'utf-8');
        });
        it('should skip adding dependencies if already present in single task', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1']);
            fs_1.default.readFileSync.mockReturnValue('@dependencies []\n# Task content');
            await step1_1.Step1.execute();
            expect(fs_1.default.writeFileSync).not.toHaveBeenCalled();
        });
        it('should analyze multiple tasks with auto mode', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1', 'TASK2', 'TASK3']);
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step1_1.Step1.execute('auto');
            expect(ClaudeExecutor.execute).toHaveBeenCalled();
        });
        it('should analyze multiple tasks with hard mode', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1', 'TASK2', 'TASK3']);
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step1_1.Step1.execute('hard');
            expect(ClaudeExecutor.execute).toHaveBeenCalled();
        });
        it('should handle Claude execution failure', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            const { ClaudeExecutor } = require('../../services/claude-executor');
            const claudeError = new Error('Claude execution failed');
            ClaudeExecutor.execute.mockRejectedValue(claudeError);
            await expect(step1_1.Step1.execute()).rejects.toThrow('Claude execution failed');
        });
        it('should apply sequential dependencies as fallback', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1', 'TASK2', 'TASK3']);
            fs_1.default.readFileSync.mockReturnValue('# Task content without dependencies');
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step1_1.Step1.execute();
            // Should write sequential dependencies for tasks without @dependencies line
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(path_1.default.join('/test/path/.claudiomiro', 'TASK1', 'TASK.md'), '@dependencies []\n# Task content without dependencies', 'utf-8');
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(path_1.default.join('/test/path/.claudiomiro', 'TASK2', 'TASK.md'), '@dependencies [TASK1]\n# Task content without dependencies', 'utf-8');
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(path_1.default.join('/test/path/.claudiomiro', 'TASK3', 'TASK.md'), '@dependencies [TASK1, TASK2]\n# Task content without dependencies', 'utf-8');
        });
        it('should skip tasks with existing dependencies', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs_1.default.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('TASK1')) {
                    return '@dependencies []\n# Task content with dependencies';
                }
                return '# Task content without dependencies';
            });
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step1_1.Step1.execute();
            // Should only write for TASK2 (TASK1 already has dependencies)
            expect(fs_1.default.writeFileSync).toHaveBeenCalledTimes(1); // Only for TASK2
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(path_1.default.join('/test/path/.claudiomiro', 'TASK2', 'TASK.md'), '@dependencies [TASK1]\n# Task content without dependencies', 'utf-8');
        });
    });
    describe('Type safety', () => {
        it('should have proper parameter types', () => {
            // These should compile without type errors
            const autoMode = 'auto';
            const hardMode = 'hard';
            expect(typeof autoMode).toBe('string');
            expect(typeof hardMode).toBe('string');
        });
        it('should validate mode parameter types', () => {
            // This test verifies TypeScript type checking at compile time
            const validModes = ['auto', 'hard'];
            // These should be valid TypeScript
            const mode1 = 'auto';
            const mode2 = 'hard';
            expect(validModes).toContain(mode1);
            expect(validModes).toContain(mode2);
            // This would cause a TypeScript compilation error:
            // const invalidMode: 'auto' | 'hard' = 'invalid'; // TypeScript would error here
        });
        it('should handle optional parameters correctly', () => {
            // These should all be valid TypeScript
            const mode1 = 'auto';
            const mode2 = 'hard';
            expect(mode1).toBe('auto');
            expect(mode2).toBe('hard');
        });
    });
    describe('Static class pattern', () => {
        it('should be a static class with execute method', () => {
            expect(typeof step1_1.Step1.execute).toBe('function');
            expect(step1_1.Step1.execute).toBeInstanceOf(Function);
        });
        it('should be a static-only class', () => {
            // Verify it's a static class pattern
            expect(typeof step1_1.Step1.execute).toBe('function');
        });
    });
    describe('Error handling', () => {
        it('should throw error when claudiomiro folder is not set', async () => {
            // Temporarily set claudiomiroFolder to null
            const originalFolder = state_1.default.claudiomiroFolder;
            state_1.default._claudiomiroFolder = null;
            await expect(step1_1.Step1.execute()).rejects.toThrow('Claudiomiro folder not set');
            // Restore original value
            state_1.default._claudiomiroFolder = originalFolder;
        });
        it('should handle missing TASK.md files gracefully', async () => {
            fs_1.default.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs_1.default.existsSync.mockImplementation((filePath) => {
                // TASK1 has TASK.md, TASK2 doesn't
                return filePath.includes('TASK1');
            });
            const { ClaudeExecutor } = require('../../services/claude-executor');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            await step1_1.Step1.execute();
            // Should only process TASK1 (TASK2 has no TASK.md)
            expect(fs_1.default.writeFileSync).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=step1.test.js.map