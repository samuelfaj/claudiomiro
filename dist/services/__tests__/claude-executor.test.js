"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const claude_executor_1 = require("../claude-executor");
// Mock all dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../config/state');
jest.mock('../claude-logger', () => ({
    ClaudeLogger: {
        processMessage: jest.fn()
    }
}));
jest.mock('../parallel-state-manager', () => ({
    __esModule: true,
    default: {
        getInstance: jest.fn().mockReturnValue({
            updateClaudeMessage: jest.fn(),
            isUIRendererActive: jest.fn().mockReturnValue(false)
        })
    }
}));
jest.mock('../gemini-executor', () => ({
    __esModule: true,
    executeGemini: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../codex-executor', () => ({
    __esModule: true,
    executeCodex: jest.fn().mockResolvedValue(undefined),
    CodexExecutor: {
        execute: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../deep-seek-executor', () => ({
    __esModule: true,
    executeDeepSeek: jest.fn().mockResolvedValue(undefined),
    DeepSeekExecutor: {
        execute: jest.fn().mockResolvedValue(undefined)
    }
}));
const logger_1 = __importDefault(require("../../../logger"));
const state_1 = __importDefault(require("../../config/state"));
const claude_logger_1 = require("../claude-logger");
const parallel_state_manager_1 = __importDefault(require("../parallel-state-manager"));
// Mock ChildProcess class for testing
const EventEmitter = require('events');
class MockChildProcess extends EventEmitter {
    constructor() {
        super();
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
    }
}
describe('claude-executor', () => {
    let mockChildProcess;
    let mockWriteStream;
    let writeStreamWriteSpy;
    let writeStreamEndSpy;
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Setup state mock
        state_1.default.folder = '/test/folder';
        state_1.default.claudiomiroFolder = '/test/.claudiomiro';
        state_1.default.executorType = 'claude';
        // Setup fs mocks
        fs_1.default.writeFileSync = jest.fn();
        fs_1.default.existsSync = jest.fn().mockReturnValue(true);
        fs_1.default.unlinkSync = jest.fn();
        // Setup write stream mock
        writeStreamWriteSpy = jest.fn();
        writeStreamEndSpy = jest.fn();
        mockWriteStream = {
            write: writeStreamWriteSpy,
            end: writeStreamEndSpy
        };
        fs_1.default.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);
        // Setup logger mocks
        logger_1.default.stopSpinner = jest.fn();
        logger_1.default.command = jest.fn();
        logger_1.default.separator = jest.fn();
        logger_1.default.newline = jest.fn();
        logger_1.default.success = jest.fn();
        logger_1.default.error = jest.fn();
        // ParallelStateManager is already mocked at module level
        // Setup child_process mock
        mockChildProcess = new MockChildProcess();
        child_process_1.spawn.mockReturnValue(mockChildProcess);
        // Setup ClaudeLogger.processMessage mock
        claude_logger_1.ClaudeLogger.processMessage.mockImplementation((line) => {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'text' && parsed.text) {
                    return parsed.text;
                }
            }
            catch (e) {
                // Not JSON, ignore
            }
            return null;
        });
        // Mock console.log to prevent test output pollution
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });
    afterEach(() => {
        console.log.mockRestore();
    });
    describe('Setup test infrastructure and mocks', () => {
        it('should create child_process mock with spawn returning EventEmitter', () => {
            const child = (0, child_process_1.spawn)('test', ['arg']);
            expect(child).toBeInstanceOf(MockChildProcess);
            expect(child).toBeInstanceOf(require('events').EventEmitter);
            expect(child.stdout).toBeInstanceOf(require('events').EventEmitter);
            expect(child.stderr).toBeInstanceOf(require('events').EventEmitter);
        });
        it('should have fs mocks properly configured', () => {
            fs_1.default.writeFileSync('test.txt', 'content');
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith('test.txt', 'content');
            fs_1.default.existsSync('test.txt');
            expect(fs_1.default.existsSync).toHaveBeenCalledWith('test.txt');
            fs_1.default.unlinkSync('test.txt');
            expect(fs_1.default.unlinkSync).toHaveBeenCalledWith('test.txt');
            const stream = fs_1.default.createWriteStream('log.txt');
            expect(stream).toBe(mockWriteStream);
        });
        it('should have logger mocks properly configured', () => {
            logger_1.default.stopSpinner();
            logger_1.default.command('test');
            logger_1.default.separator();
            logger_1.default.success('test');
            logger_1.default.error('test');
            expect(logger_1.default.stopSpinner).toHaveBeenCalled();
            expect(logger_1.default.command).toHaveBeenCalledWith('test');
            expect(logger_1.default.separator).toHaveBeenCalled();
            expect(logger_1.default.success).toHaveBeenCalledWith('test');
            expect(logger_1.default.error).toHaveBeenCalledWith('test');
        });
    });
    describe('ClaudeExecutor.execute success flow', () => {
        it('should resolve promise on successful execution (code 0)', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            // Simulate successful execution
            setTimeout(() => {
                mockChildProcess.emit('close', 0);
            }, 10);
            await expect(promise).resolves.toBeUndefined();
            expect(logger_1.default.success).toHaveBeenCalledWith('Claude execution completed');
        });
        it('should spawn with correct arguments', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            expect(child_process_1.spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude --dangerously-skip-permissions')], expect.objectContaining({
                cwd: '/test/folder',
                stdio: ['ignore', 'pipe', 'pipe']
            }));
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should create temporary file with prompt text', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt content');
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(expect.stringMatching(/claudiomiro-prompt-\d+\.txt$/), 'test prompt content', 'utf-8');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should clean up temporary file after execution', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
            expect(fs_1.default.existsSync).toHaveBeenCalled();
            expect(fs_1.default.unlinkSync).toHaveBeenCalledWith(expect.stringMatching(/claudiomiro-prompt-\d+\.txt$/));
        });
        it('should call logger methods in correct sequence', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            expect(logger_1.default.stopSpinner).toHaveBeenCalled();
            expect(logger_1.default.command).toHaveBeenCalledWith(expect.stringContaining('claude --dangerously-skip-permissions'));
            expect(logger_1.default.separator).toHaveBeenCalled();
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
            expect(logger_1.default.success).toHaveBeenCalledWith('Claude execution completed');
        });
        it('should create log file with correct path', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            expect(fs_1.default.createWriteStream).toHaveBeenCalledWith('/test/.claudiomiro/log.txt', { flags: 'a' });
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should write log separator and timestamp to log file', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('='.repeat(80)));
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.+\] Claude execution started/));
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
    });
    describe('stdout streaming and message processing', () => {
        it('should process complete JSON lines from stdout', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const jsonLine1 = JSON.stringify({ type: 'text', text: 'Hello' });
            const jsonLine2 = JSON.stringify({ type: 'text', text: 'World' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine1 + '\n' + jsonLine2 + '\n'));
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith(jsonLine1);
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith(jsonLine2);
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle partial JSON lines with buffering', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const jsonLine = JSON.stringify({ type: 'text', text: 'Complete message' });
            const part1 = jsonLine.substring(0, 20);
            const part2 = jsonLine.substring(20);
            // Send partial data
            mockChildProcess.stdout.emit('data', Buffer.from(part1));
            expect(claude_logger_1.ClaudeLogger.processMessage).not.toHaveBeenCalled();
            // Send rest with newline
            mockChildProcess.stdout.emit('data', Buffer.from(part2 + '\n'));
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith(jsonLine);
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should call ClaudeLogger.processMessage for each complete line', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            mockChildProcess.stdout.emit('data', Buffer.from('line1\nline2\nline3\n'));
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledTimes(3);
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenNthCalledWith(1, 'line1');
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenNthCalledWith(2, 'line2');
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenNthCalledWith(3, 'line3');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should write stdout data to log file', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const testData = 'test output data\n';
            mockChildProcess.stdout.emit('data', Buffer.from(testData));
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(testData);
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should output Claude messages to console', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const jsonLine = JSON.stringify({ type: 'text', text: 'Test message' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(console.log).toHaveBeenCalledWith('💬 Claude:');
            expect(console.log).toHaveBeenCalledWith('Test message');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should write completion message to log file', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.+\] Claude execution completed with code 0/));
            expect(writeStreamEndSpy).toHaveBeenCalled();
        });
    });
    describe('error handling scenarios', () => {
        it('should reject promise on non-zero exit code', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('close', 1), 10);
            await expect(promise).rejects.toThrow('Claude exited with code 1');
            expect(logger_1.default.error).toHaveBeenCalledWith('Claude exited with code 1');
        });
        it('should clean up temp file on non-zero exit code', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('close', 1), 10);
            await expect(promise).rejects.toThrow();
            expect(fs_1.default.unlinkSync).toHaveBeenCalled();
        });
        it('should reject promise on spawn error', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const testError = new Error('Spawn failed');
            setTimeout(() => mockChildProcess.emit('error', testError), 10);
            await expect(promise).rejects.toThrow('Spawn failed');
            expect(logger_1.default.error).toHaveBeenCalledWith(expect.stringContaining('Failed to execute Claude'));
        });
        it('should clean up temp file on spawn error', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('error', new Error('Test error')), 10);
            await expect(promise).rejects.toThrow();
            expect(fs_1.default.unlinkSync).toHaveBeenCalled();
        });
        it('should write error to log file on spawn error', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('error', new Error('Test error message')), 10);
            await expect(promise).rejects.toThrow();
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Test error message'));
            expect(writeStreamEndSpy).toHaveBeenCalled();
        });
        it('should handle temp file cleanup failure gracefully', async () => {
            fs_1.default.unlinkSync.mockImplementation(() => {
                throw new Error('Cleanup failed');
            });
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await expect(promise).resolves.toBeUndefined();
            expect(logger_1.default.error).toHaveBeenCalledWith(expect.stringContaining('Failed to cleanup temp file'));
        });
        it('should handle missing temp file during cleanup', async () => {
            fs_1.default.existsSync.mockReturnValue(false);
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await expect(promise).resolves.toBeUndefined();
            expect(fs_1.default.unlinkSync).not.toHaveBeenCalled();
        });
    });
    describe('edge cases and integration', () => {
        it('should handle stderr data and write to log file', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const stderrData = 'Error output\n';
            mockChildProcess.stderr.emit('data', Buffer.from(stderrData));
            expect(writeStreamWriteSpy).toHaveBeenCalledWith('[STDERR] ' + stderrData);
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should maintain buffer with incomplete lines', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            // Send data without newline
            mockChildProcess.stdout.emit('data', Buffer.from('incomplete'));
            expect(claude_logger_1.ClaudeLogger.processMessage).not.toHaveBeenCalled();
            // Send more data, still no newline
            mockChildProcess.stdout.emit('data', Buffer.from(' line'));
            expect(claude_logger_1.ClaudeLogger.processMessage).not.toHaveBeenCalled();
            // Complete the line
            mockChildProcess.stdout.emit('data', Buffer.from(' complete\n'));
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith('incomplete line complete');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle long text wrapping in console output', async () => {
            // Mock a narrow terminal
            const originalColumns = process.stdout.columns;
            process.stdout.columns = 20;
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const longText = 'a'.repeat(50);
            const jsonLine = JSON.stringify({ type: 'text', text: longText });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            // Should wrap into multiple console.log calls
            expect(console.log).toHaveBeenCalledWith('💬 Claude:');
            // Line wrapping should occur
            const logCalls = console.log.mock.calls.filter((call) => call[0] !== '💬 Claude:');
            expect(logCalls.length).toBeGreaterThan(1);
            process.stdout.columns = originalColumns;
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle multiple stdout chunks in sequence', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            mockChildProcess.stdout.emit('data', Buffer.from('line1\n'));
            mockChildProcess.stdout.emit('data', Buffer.from('line2\n'));
            mockChildProcess.stdout.emit('data', Buffer.from('line3\n'));
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledTimes(3);
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle empty lines in stdout', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            mockChildProcess.stdout.emit('data', Buffer.from('line1\n\nline2\n'));
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith('line1');
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith('');
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith('line2');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle non-JSON lines gracefully', async () => {
            claude_logger_1.ClaudeLogger.processMessage.mockReturnValue(null);
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            mockChildProcess.stdout.emit('data', Buffer.from('not json\n'));
            // Should not crash, ClaudeLogger.processMessage returns null
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalledWith('not json');
            expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('not json'));
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should complete full execution flow end-to-end', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('integration test prompt');
            // Simulate realistic execution
            mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'text', text: 'Starting...' }) + '\n'));
            mockChildProcess.stderr.emit('data', Buffer.from('debug info\n'));
            mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'text', text: 'Done!' }) + '\n'));
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await expect(promise).resolves.toBeUndefined();
            // Verify complete flow
            expect(fs_1.default.writeFileSync).toHaveBeenCalled(); // Temp file created
            expect(child_process_1.spawn).toHaveBeenCalled(); // Process spawned
            expect(claude_logger_1.ClaudeLogger.processMessage).toHaveBeenCalled(); // Messages processed
            expect(writeStreamWriteSpy).toHaveBeenCalled(); // Log written
            expect(fs_1.default.unlinkSync).toHaveBeenCalled(); // Temp file cleaned
            expect(logger_1.default.success).toHaveBeenCalled(); // Success logged
        });
    });
    describe('ParallelStateManager integration', () => {
        let mockStateManager;
        beforeEach(() => {
            // Reset the getInstance mock
            parallel_state_manager_1.default.getInstance.mockClear();
        });
        it('should work without taskName (backward compatibility)', async () => {
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            // Should not call getInstance
            expect(parallel_state_manager_1.default.getInstance).not.toHaveBeenCalled();
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should call getInstance when taskName provided', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK1');
            // Should call getInstance
            expect(parallel_state_manager_1.default.getInstance).toHaveBeenCalled();
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should call updateClaudeMessage when taskName provided and message received', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK1');
            const jsonLine = JSON.stringify({ type: 'text', text: 'Test message from Claude' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledWith('TASK1', 'Test message from Claude');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should not call updateClaudeMessage when taskName not provided', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            const jsonLine = JSON.stringify({ type: 'text', text: 'Test message' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(mockStateManager.updateClaudeMessage).not.toHaveBeenCalled();
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should call updateClaudeMessage for multiple messages', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK2');
            const jsonLine1 = JSON.stringify({ type: 'text', text: 'Message 1' });
            const jsonLine2 = JSON.stringify({ type: 'text', text: 'Message 2' });
            const jsonLine3 = JSON.stringify({ type: 'text', text: 'Message 3' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine1 + '\n'));
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine2 + '\n'));
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine3 + '\n'));
            expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledTimes(3);
            expect(mockStateManager.updateClaudeMessage).toHaveBeenNthCalledWith(1, 'TASK2', 'Message 1');
            expect(mockStateManager.updateClaudeMessage).toHaveBeenNthCalledWith(2, 'TASK2', 'Message 2');
            expect(mockStateManager.updateClaudeMessage).toHaveBeenNthCalledWith(3, 'TASK2', 'Message 3');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should suppress console output when UI renderer is active', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            mockStateManager.isUIRendererActive.mockReturnValue(true);
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK_SUPPRESS');
            console.log.mockClear();
            const jsonLine = JSON.stringify({ type: 'text', text: 'Hidden message' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(console.log).not.toHaveBeenCalled();
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should not call updateClaudeMessage for non-text messages', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK3');
            // ClaudeLogger.processMessage returns null for non-text messages
            claude_logger_1.ClaudeLogger.processMessage.mockReturnValue(null);
            const jsonLine = JSON.stringify({ type: 'other', data: 'something' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(mockStateManager.updateClaudeMessage).not.toHaveBeenCalled();
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle taskName with special characters', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK-123_special');
            const jsonLine = JSON.stringify({ type: 'text', text: 'Test' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledWith('TASK-123_special', 'Test');
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should pass correct taskName even with errors', async () => {
            // Set up mock state manager for this test
            mockStateManager = parallel_state_manager_1.default.getInstance();
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK_ERROR');
            const jsonLine = JSON.stringify({ type: 'text', text: 'Error message' });
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine + '\n'));
            expect(mockStateManager.updateClaudeMessage).toHaveBeenCalledWith('TASK_ERROR', 'Error message');
            setTimeout(() => mockChildProcess.emit('close', 1), 10);
            await expect(promise).rejects.toThrow();
        });
    });
    describe('Gemini executor routing', () => {
        beforeEach(() => {
            // Reset all mocks for gemini-executor
            const { executeGemini } = require('../gemini-executor');
            executeGemini.mockClear();
        });
        it('should route to executeGemini when state.executorType is "gemini"', async () => {
            state_1.default.executorType = 'gemini';
            const result = await claude_executor_1.ClaudeExecutor.execute('test prompt');
            const { executeGemini } = require('../gemini-executor');
            expect(executeGemini).toHaveBeenCalledWith('test prompt', null);
            expect(result).toBeUndefined();
        });
        it('should call executeGemini with correct text parameter', async () => {
            state_1.default.executorType = 'gemini';
            await claude_executor_1.ClaudeExecutor.execute('specific test prompt');
            const { executeGemini } = require('../gemini-executor');
            expect(executeGemini).toHaveBeenCalledWith('specific test prompt', null);
        });
        it('should call executeGemini with correct taskName parameter when provided', async () => {
            state_1.default.executorType = 'gemini';
            await claude_executor_1.ClaudeExecutor.execute('test prompt', 'TASK_GEMINI');
            const { executeGemini } = require('../gemini-executor');
            expect(executeGemini).toHaveBeenCalledWith('test prompt', 'TASK_GEMINI');
        });
        it('should call executeGemini with null taskName when not provided', async () => {
            state_1.default.executorType = 'gemini';
            await claude_executor_1.ClaudeExecutor.execute('test prompt');
            const { executeGemini } = require('../gemini-executor');
            expect(executeGemini).toHaveBeenCalledWith('test prompt', null);
        });
        it('should propagate executeGemini return value through ClaudeExecutor.execute', async () => {
            state_1.default.executorType = 'gemini';
            const { executeGemini } = require('../gemini-executor');
            const mockResult = { success: true, data: 'test result' };
            executeGemini.mockResolvedValue(mockResult);
            const result = await claude_executor_1.ClaudeExecutor.execute('test prompt');
            expect(result).toBe(mockResult);
        });
        it('should propagate executeGemini rejection through ClaudeExecutor.execute', async () => {
            state_1.default.executorType = 'gemini';
            const { executeGemini } = require('../gemini-executor');
            const mockError = new Error('Gemini execution failed');
            executeGemini.mockRejectedValue(mockError);
            await expect(claude_executor_1.ClaudeExecutor.execute('test prompt')).rejects.toThrow('Gemini execution failed');
        });
        it('should not affect other executor types when routing to Gemini', async () => {
            // Test that codex routing still works
            state_1.default.executorType = 'codex';
            await claude_executor_1.ClaudeExecutor.execute('test prompt');
            const { executeCodex } = require('../codex-executor');
            expect(executeCodex).toHaveBeenCalledWith('test prompt', null);
        });
        it('should not affect deep-seek routing when routing to Gemini', async () => {
            // Test that deep-seek routing still works
            state_1.default.executorType = 'deep-seek';
            await claude_executor_1.ClaudeExecutor.execute('test prompt');
            const { executeDeepSeek } = require('../deep-seek-executor');
            expect(executeDeepSeek).toHaveBeenCalledWith('test prompt', null);
        });
        it('should fall back to default Claude when executorType is "claude"', async () => {
            state_1.default.executorType = 'claude';
            const promise = claude_executor_1.ClaudeExecutor.execute('test prompt');
            // Should spawn Claude process, not call any executor
            expect(child_process_1.spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('claude --dangerously-skip-permissions')], expect.any(Object));
            setTimeout(() => mockChildProcess.emit('close', 0), 10);
            await promise;
        });
        it('should handle full integration flow with state change and Gemini execution', async () => {
            state_1.default.executorType = 'gemini';
            const { executeGemini } = require('../gemini-executor');
            executeGemini.mockResolvedValue(undefined);
            // Change state and execute
            await claude_executor_1.ClaudeExecutor.execute('integration test prompt', 'INTEGRATION_TASK');
            expect(executeGemini).toHaveBeenCalledWith('integration test prompt', 'INTEGRATION_TASK');
        });
    });
});
//# sourceMappingURL=claude-executor.test.js.map