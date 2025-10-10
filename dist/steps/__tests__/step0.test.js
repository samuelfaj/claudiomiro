"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const step0_1 = require("../step0");
const fs_1 = __importDefault(require("fs"));
const state_1 = __importDefault(require("../../config/state"));
const index_1 = require("../../services/index");
// Mock dependencies
jest.mock('../../../logger', () => ({
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
}));
jest.mock('../../services/index', () => ({
    PromptReader: {
        getMultilineInput: jest.fn(),
    },
    FileManager: {
        startFresh: jest.fn(),
    },
    ClaudeExecutor: {
        execute: jest.fn(),
    },
    executeClaude: jest.fn(),
}));
jest.mock('../step1', () => ({
    Step1: {
        execute: jest.fn(),
    },
}));
// Mock process.exit to prevent test from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
});
// Mock file system operations
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
}));
describe('Step0', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset state
        state_1.default.setFolder('/test/path');
        // Mock file system operations
        fs_1.default.existsSync.mockReturnValue(false);
        fs_1.default.mkdirSync.mockImplementation(() => { });
        fs_1.default.writeFileSync.mockImplementation(() => { });
        fs_1.default.readFileSync.mockReturnValue('Mock step0.md content');
    });
    afterAll(() => {
        mockExit.mockRestore();
    });
    describe('execute', () => {
        it('should execute successfully with provided prompt text', async () => {
            const options = {
                promptText: 'Test task description with more than 10 characters',
                sameBranch: false,
                mode: 'auto',
            };
            const { ClaudeExecutor } = require('../../services/index');
            const { Step1 } = require('../step1');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            Step1.execute.mockResolvedValue(undefined);
            const result = await step0_1.Step0.execute(options);
            expect(result.success).toBe(true);
            expect(result.message).toBe('Tasks created successfully');
            expect(index_1.FileManager.startFresh).toHaveBeenCalledWith(true);
            expect(ClaudeExecutor.execute).toHaveBeenCalled();
            expect(Step1.execute).toHaveBeenCalled();
        });
        it('should execute successfully with sameBranch option', async () => {
            const options = {
                promptText: 'Test task with same branch',
                sameBranch: true,
                mode: 'auto',
            };
            const { ClaudeExecutor } = require('../../services/index');
            const { Step1 } = require('../step1');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            Step1.execute.mockResolvedValue(undefined);
            const result = await step0_1.Step0.execute(options);
            expect(result.success).toBe(true);
            expect(index_1.FileManager.startFresh).toHaveBeenCalledWith(true);
            expect(ClaudeExecutor.execute).toHaveBeenCalled();
            expect(Step1.execute).toHaveBeenCalled();
        });
        it('should handle prompt input when no promptText provided', async () => {
            const { ClaudeExecutor } = require('../../services/index');
            const { Step1 } = require('../step1');
            index_1.PromptReader.getMultilineInput.mockResolvedValue('User provided task description with enough characters');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            Step1.execute.mockResolvedValue(undefined);
            const result = await step0_1.Step0.execute();
            expect(result.success).toBe(true);
            expect(index_1.PromptReader.getMultilineInput).toHaveBeenCalled();
            expect(index_1.FileManager.startFresh).toHaveBeenCalledWith(true);
            expect(ClaudeExecutor.execute).toHaveBeenCalled();
            expect(Step1.execute).toHaveBeenCalled();
        });
        it('should exit when task is too short', async () => {
            const options = {
                promptText: 'Short',
            };
            // Since process.exit throws an error, the promise will resolve with an error result
            const result = await step0_1.Step0.execute(options);
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('process.exit called');
        });
        it('should handle empty task input', async () => {
            index_1.PromptReader.getMultilineInput.mockResolvedValue('');
            // Since process.exit throws an error, the promise will resolve with an error result
            const result = await step0_1.Step0.execute();
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('process.exit called');
        });
        it('should handle task creation failure in non-test environment', async () => {
            // Temporarily set NODE_ENV to something other than 'test'
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            const options = {
                promptText: 'Test task that fails to create tasks',
            };
            const { executeClaude } = require('../../services/index');
            executeClaude.mockResolvedValue(undefined);
            index_1.FileManager.startFresh.mockImplementation(() => {
                // Simulate that tasks were not created
                // This would normally happen if Claude fails to create task directories
            });
            // Mock fs.writeFileSync to avoid file system errors
            jest.spyOn(fs_1.default, 'writeFileSync').mockImplementation(() => { });
            // Mock fs.existsSync to return false for task directories
            jest.spyOn(fs_1.default, 'existsSync').mockImplementation((path) => {
                if (typeof path === 'string' && (path.includes('TASK0') || path.includes('TASK1'))) {
                    return false;
                }
                return true;
            });
            const result = await step0_1.Step0.execute(options);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to create tasks');
            expect(result.error?.message).toBe('Error creating tasks');
            // Restore original NODE_ENV
            process.env.NODE_ENV = originalNodeEnv;
            jest.restoreAllMocks();
        });
        it('should handle Claude execution failure', async () => {
            const options = {
                promptText: 'Test task that fails Claude execution',
            };
            const { ClaudeExecutor } = require('../../services/index');
            const claudeError = new Error('Claude execution failed');
            ClaudeExecutor.execute.mockRejectedValue(claudeError);
            const result = await step0_1.Step0.execute(options);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to create tasks');
            expect(result.error).toBe(claudeError);
            // The stopSpinner should be called in the catch block
        });
        it('should handle step1 execution failure', async () => {
            const options = {
                promptText: 'Test task that fails step1',
            };
            const { ClaudeExecutor } = require('../../services/index');
            const { Step1 } = require('../step1');
            ClaudeExecutor.execute.mockResolvedValue(undefined);
            const step1Error = new Error('Step1 execution failed');
            Step1.execute.mockRejectedValue(step1Error);
            const result = await step0_1.Step0.execute(options);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to create tasks');
            expect(result.error).toBe(step1Error);
            // The stopSpinner should be called in the catch block
        });
    });
    // Type safety tests
    describe('Type safety', () => {
        it('should have proper parameter types', () => {
            // These should compile without type errors
            const options = {
                sameBranch: true,
                promptText: 'Test task',
                mode: 'hard',
            };
            const result = {
                success: true,
                message: 'Test message',
            };
            expect(typeof options.sameBranch).toBe('boolean');
            expect(typeof options.promptText).toBe('string');
            expect(typeof options.mode).toBe('string');
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.message).toBe('string');
        });
        it('should validate mode parameter types', () => {
            // This test verifies TypeScript type checking at compile time
            const validModes = ['auto', 'hard'];
            const options = {
                mode: 'auto', // Should be valid
            };
            // This would cause a TypeScript compilation error:
            // const invalidOptions: Step0Options = {
            //   mode: 'invalid', // TypeScript would error here
            // };
            expect(validModes).toContain(options.mode);
        });
        it('should handle optional parameters correctly', () => {
            // These should all be valid TypeScript
            const options1 = {};
            const options2 = { sameBranch: true };
            const options3 = { promptText: null };
            const options4 = { mode: 'hard' };
            expect(options1).toBeDefined();
            expect(options2.sameBranch).toBe(true);
            expect(options3.promptText).toBeNull();
            expect(options4.mode).toBe('hard');
        });
    });
    describe('Static class pattern', () => {
        it('should be a static class with execute method', () => {
            expect(typeof step0_1.Step0.execute).toBe('function');
            expect(step0_1.Step0.execute).toBeInstanceOf(Function);
        });
        it('should be a static-only class', () => {
            // Verify it's a static class pattern
            expect(typeof step0_1.Step0.execute).toBe('function');
        });
    });
});
//# sourceMappingURL=step0.test.js.map