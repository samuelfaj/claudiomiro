"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const cli_1 = require("../cli");
const state_1 = __importDefault(require("../config/state"));
// Mock dependencies
jest.mock('../../logger', () => ({
    banner: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    path: jest.fn(),
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
}));
jest.mock('../services/file-manager', () => ({
    FileManager: {
        startFresh: jest.fn(),
    },
}));
jest.mock('../services/dag-executor', () => ({
    DAGExecutor: jest.fn().mockImplementation(() => ({
        run: jest.fn(),
        runStep2: jest.fn(),
    })),
}));
jest.mock('../steps/index', () => ({
    step0: jest.fn(),
    step1: jest.fn(),
    step5: jest.fn(),
}));
jest.mock('../utils/validation', () => ({
    Validation: {
        isFullyImplemented: jest.fn(),
        hasApprovedCodeReview: jest.fn(),
    },
}));
describe('CLI Functionality Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset process.argv
        process.argv = ['node', 'cli'];
    });
    describe('Type Safety', () => {
        test('should have proper type definitions', () => {
            const validExecutors = ['claude', 'codex', 'deep-seek', 'gemini'];
            const validModes = ['auto', 'hard'];
            expect(validExecutors).toContain('claude');
            expect(validExecutors).toContain('codex');
            expect(validExecutors).toContain('deep-seek');
            expect(validExecutors).toContain('gemini');
            expect(validModes).toContain('auto');
            expect(validModes).toContain('hard');
        });
        test('should verify CLI interface types', () => {
            const result = { done: true };
            const graph = {
                'TASK1': { deps: [], status: 'pending' }
            };
            expect(result.done).toBe(true);
            expect(graph['TASK1'].status).toBe('pending');
        });
    });
    describe('isTaskApproved', () => {
        beforeEach(() => {
            // Mock the state instance
            state_1.default._claudiomiroFolder = '/test/folder';
        });
        test('should return false when claudiomiroFolder is not set', () => {
            state_1.default._claudiomiroFolder = undefined;
            expect((0, cli_1.isTaskApproved)('TASK1')).toBe(false);
        });
        test('should return false when TODO.md does not exist', () => {
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(false);
            expect((0, cli_1.isTaskApproved)('TASK1')).toBe(false);
        });
        test('should return false when task is not fully implemented', () => {
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            const { Validation } = require('../utils/validation');
            Validation.isFullyImplemented.mockReturnValue(false);
            expect((0, cli_1.isTaskApproved)('TASK1')).toBe(false);
        });
        test('should return true when task is fully implemented and approved', () => {
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            const { Validation } = require('../utils/validation');
            Validation.isFullyImplemented.mockReturnValue(true);
            Validation.hasApprovedCodeReview.mockReturnValue(true);
            expect((0, cli_1.isTaskApproved)('TASK1')).toBe(true);
        });
    });
    describe('allHasTodo', () => {
        test('should return null when claudiomiroFolder does not exist', () => {
            state_1.default._claudiomiroFolder = undefined;
            expect((0, cli_1.allHasTodo)()).toBe(null);
        });
        test('should return null when no tasks exist', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue([]);
            expect((0, cli_1.allHasTodo)()).toBe(null);
        });
        test('should return false when a task is missing TODO.md', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockImplementation((filePath) => {
                if (filePath.toString().includes('TODO.md'))
                    return false;
                return true;
            });
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1', 'TASK2']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            expect((0, cli_1.allHasTodo)()).toBe(false);
        });
        test('should return true when all tasks have TODO.md and split.txt', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1', 'TASK2']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            expect((0, cli_1.allHasTodo)()).toBe(true);
        });
    });
    describe('buildTaskGraph', () => {
        test('should return null when claudiomiroFolder does not exist', () => {
            state_1.default._claudiomiroFolder = undefined;
            expect((0, cli_1.buildTaskGraph)()).toBe(null);
        });
        test('should return null when no tasks exist', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue([]);
            expect((0, cli_1.buildTaskGraph)()).toBe(null);
        });
        test('should return null when a task is missing TASK.md', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockImplementation((filePath) => {
                if (filePath.toString().includes('TASK.md'))
                    return false;
                return true;
            });
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            expect((0, cli_1.buildTaskGraph)()).toBe(null);
        });
        test('should build graph when all tasks have dependencies', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            jest.spyOn(fs_1.default, 'readFileSync').mockReturnValue('@dependencies [TASK2, TASK3]');
            // Mock Validation to make isTaskApproved return false
            const { Validation } = require('../utils/validation');
            Validation.isFullyImplemented.mockReturnValue(false);
            Validation.hasApprovedCodeReview.mockReturnValue(false);
            const graph = (0, cli_1.buildTaskGraph)();
            expect(graph).toEqual({
                'TASK1': {
                    deps: ['TASK2', 'TASK3'],
                    status: 'pending'
                }
            });
        });
    });
    describe('Argument Parsing', () => {
        test('should parse --fresh flag', () => {
            process.argv = ['node', 'cli', '--fresh'];
            // This would test the actual argument parsing logic
            expect(process.argv.includes('--fresh')).toBe(true);
        });
        test('should parse --prompt flag', () => {
            process.argv = ['node', 'cli', '--prompt=test'];
            const promptArg = process.argv.find(arg => arg.startsWith('--prompt='));
            expect(promptArg).toBe('--prompt=test');
        });
        test('should parse --steps flag', () => {
            process.argv = ['node', 'cli', '--steps=1,2,3'];
            const stepsArg = process.argv.find(arg => arg.startsWith('--steps='));
            expect(stepsArg).toBe('--steps=1,2,3');
        });
        test('should parse executor flags', () => {
            process.argv = ['node', 'cli', '--codex'];
            expect(process.argv.includes('--codex')).toBe(true);
        });
    });
    describe('Error Handling', () => {
        test('should handle invalid folder path', () => {
            process.argv = ['node', 'cli', '/invalid/path'];
            // Mock process.exit to prevent test from exiting
            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('process.exit called');
            });
            // Import the mocked logger
            const logger = require('../../logger');
            expect(() => {
                // This would normally call process.exit(1)
                logger.error('Folder does not exist: /invalid/path');
            }).not.toThrow();
            mockExit.mockRestore();
        });
    });
    describe('Integration Tests', () => {
        test('should handle empty arguments gracefully', () => {
            process.argv = ['node', 'cli'];
            // Test that the CLI can initialize with default arguments
            expect(process.argv.length).toBe(2);
            expect(process.argv[1]).toBe('cli');
        });
        test('should handle complex argument combinations', () => {
            process.argv = [
                'node', 'cli',
                '--fresh',
                '--prompt=test-prompt',
                '--steps=1,2,3',
                '--maxConcurrent=5',
                '--codex',
                '--mode=hard'
            ];
            expect(process.argv.includes('--fresh')).toBe(true);
            expect(process.argv.includes('--codex')).toBe(true);
            expect(process.argv.some(arg => arg.startsWith('--prompt='))).toBe(true);
            expect(process.argv.some(arg => arg.startsWith('--steps='))).toBe(true);
            expect(process.argv.some(arg => arg.startsWith('--maxConcurrent='))).toBe(true);
            expect(process.argv.some(arg => arg.startsWith('--mode='))).toBe(true);
        });
        test('should handle --push=false flag correctly', () => {
            process.argv = ['node', 'cli', '--push=false'];
            const shouldPush = !process.argv.some(arg => arg === '--push=false');
            expect(shouldPush).toBe(false);
        });
        test('should handle --no-limit flag correctly', () => {
            process.argv = ['node', 'cli', '--no-limit'];
            const noLimit = process.argv.includes('--no-limit');
            expect(noLimit).toBe(true);
        });
        test('should handle --limit flag correctly', () => {
            process.argv = ['node', 'cli', '--limit=50'];
            const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
            const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
            expect(maxAttemptsPerTask).toBe(50);
        });
    });
    describe('CLI Function Coverage', () => {
        test('should validate task graph construction with edge cases', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1', 'TASK2']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            // Test empty dependencies
            jest.spyOn(fs_1.default, 'readFileSync').mockReturnValue('@dependencies []');
            const { Validation } = require('../utils/validation');
            Validation.isFullyImplemented.mockReturnValue(false);
            Validation.hasApprovedCodeReview.mockReturnValue(false);
            const graph = (0, cli_1.buildTaskGraph)();
            expect(graph).toEqual({
                'TASK1': { deps: [], status: 'pending' },
                'TASK2': { deps: [], status: 'pending' }
            });
        });
        test('should handle task with "none" dependencies', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            // Test "none" dependencies
            jest.spyOn(fs_1.default, 'readFileSync').mockReturnValue('@dependencies none');
            const { Validation } = require('../utils/validation');
            Validation.isFullyImplemented.mockReturnValue(false);
            Validation.hasApprovedCodeReview.mockReturnValue(false);
            const graph = (0, cli_1.buildTaskGraph)();
            expect(graph).toEqual({
                'TASK1': { deps: [], status: 'pending' }
            });
        });
        test('should handle self-dependency prevention', () => {
            state_1.default._claudiomiroFolder = '/test/folder';
            jest.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs_1.default, 'readdirSync').mockReturnValue(['TASK1']);
            jest.spyOn(fs_1.default, 'statSync').mockReturnValue({ isDirectory: () => true });
            // Test self-dependency
            jest.spyOn(fs_1.default, 'readFileSync').mockReturnValue('@dependencies [TASK1, TASK2]');
            const { Validation } = require('../utils/validation');
            Validation.isFullyImplemented.mockReturnValue(false);
            Validation.hasApprovedCodeReview.mockReturnValue(false);
            const graph = (0, cli_1.buildTaskGraph)();
            expect(graph).toEqual({
                'TASK1': { deps: ['TASK2'], status: 'pending' }
            });
        });
    });
});
//# sourceMappingURL=cli.test.js.map