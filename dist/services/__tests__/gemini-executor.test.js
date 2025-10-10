"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const gemini_executor_1 = require("../gemini-executor");
// Mock all dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../config/state');
jest.mock('../gemini-logger', () => ({
    GeminiLogger: {
        processMessage: jest.fn()
    }
}));
jest.mock('../parallel-state-manager');
const logger_1 = __importDefault(require("../../../logger"));
const state_1 = __importDefault(require("../../config/state"));
const gemini_logger_1 = require("../gemini-logger");
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
describe('gemini-executor', () => {
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
        logger_1.default.info = jest.fn();
        logger_1.default.command = jest.fn();
        logger_1.default.separator = jest.fn();
        logger_1.default.newline = jest.fn();
        logger_1.default.success = jest.fn();
        logger_1.default.error = jest.fn();
        logger_1.default.warn = jest.fn();
        logger_1.default.debug = jest.fn();
        // Setup gemini-logger mock
        gemini_logger_1.GeminiLogger.processMessage.mockImplementation((line) => {
            if (line.includes('{"text":')) {
                return JSON.parse(line).text;
            }
            return null;
        });
        // Setup parallel state manager mock
        parallel_state_manager_1.default.getInstance = jest.fn().mockReturnValue({
            isUIRendererActive: jest.fn().mockReturnValue(false),
            updateClaudeMessage: jest.fn()
        });
        // Setup child process mock
        mockChildProcess = new MockChildProcess();
        child_process_1.spawn.mockReturnValue(mockChildProcess);
    });
    describe('setup', () => {
        it('should mock all dependencies correctly', () => {
            expect(fs_1.default.writeFileSync).toBeDefined();
            expect(child_process_1.spawn).toBeDefined();
            expect(logger_1.default.stopSpinner).toBeDefined();
            expect(gemini_logger_1.GeminiLogger.processMessage).toBeDefined();
            expect(parallel_state_manager_1.default.getInstance).toBeDefined();
        });
        it('should setup state correctly', () => {
            expect(state_1.default.folder).toBe('/test/folder');
            expect(state_1.default.claudiomiroFolder).toBe('/test/.claudiomiro');
        });
        it('should setup write stream correctly', () => {
            expect(fs_1.default.createWriteStream).toBeDefined();
            expect(mockWriteStream.write).toBeDefined();
            expect(mockWriteStream.end).toBeDefined();
        });
    });
    describe('success flow', () => {
        it('should resolve promise on exit code 0', async () => {
            const testText = 'Test prompt text';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            // Simulate successful process completion
            mockChildProcess.emit('close', 0);
            await expect(promise).resolves.toBeUndefined();
            expect(logger_1.default.success).toHaveBeenCalledWith('Gemini execution completed');
        });
        it('should call spawn with correct arguments', async () => {
            const testText = 'Test prompt text';
            gemini_executor_1.GeminiExecutor.execute(testText);
            expect(child_process_1.spawn).toHaveBeenCalledWith('sh', ['-c', expect.stringContaining('cat')], {
                cwd: state_1.default.folder,
                stdio: ['ignore', 'pipe', 'pipe']
            });
        });
        it('should create temporary file with prompt text', async () => {
            const testText = 'Test prompt text';
            gemini_executor_1.GeminiExecutor.execute(testText);
            expect(fs_1.default.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('claudiomiro-gemini-prompt-'), testText, { encoding: 'utf-8', mode: 0o600 });
        });
        it('should cleanup temporary file on success', async () => {
            const testText = 'Test prompt text';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('close', 0);
            await promise;
            expect(fs_1.default.unlinkSync).toHaveBeenCalled();
        });
        it('should log command execution sequence', async () => {
            const testText = 'Test prompt text';
            gemini_executor_1.GeminiExecutor.execute(testText);
            expect(logger_1.default.stopSpinner).toHaveBeenCalled();
            expect(logger_1.default.info).toHaveBeenCalledWith('Executing Gemini CLI');
            expect(logger_1.default.command).toHaveBeenCalledWith('gemini ...');
        });
        it('should create log file with correct path', async () => {
            const testText = 'Test prompt text';
            gemini_executor_1.GeminiExecutor.execute(testText);
            expect(fs_1.default.createWriteStream).toHaveBeenCalledWith(path_1.default.join(state_1.default.claudiomiroFolder, 'gemini-log.txt'), { flags: 'a' });
        });
        it('should write timestamp to log file', async () => {
            const testText = 'Test prompt text';
            gemini_executor_1.GeminiExecutor.execute(testText);
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini execution started'));
        });
    });
    describe('streaming', () => {
        it('should process complete JSON lines immediately', async () => {
            const testText = 'Test prompt text';
            const jsonLine = '{"text": "Hello world"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Hello world"}');
        });
        it('should buffer partial lines across multiple data events', async () => {
            const testText = 'Test prompt text';
            const partial1 = '{"text": "Hello';
            const partial2 = ' world"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(partial1));
            mockChildProcess.stdout.emit('data', Buffer.from(partial2));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Hello world"}');
        });
        it('should process multiple lines in single data chunk', async () => {
            const testText = 'Test prompt text';
            const multipleLines = '{"text": "Line 1"}\n{"text": "Line 2"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(multipleLines));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Line 1"}');
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Line 2"}');
        });
        it('should handle empty lines without errors', async () => {
            const testText = 'Test prompt text';
            const linesWithEmpty = '{"text": "Line 1"}\n\n{"text": "Line 2"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(linesWithEmpty));
            // Should only process non-empty lines
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledTimes(2);
        });
        it('should write output to log file', async () => {
            const testText = 'Test prompt text';
            const output = '{"text": "Test output"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(output);
        });
        it('should handle console output when not suppressed', async () => {
            const testText = 'Test prompt text';
            const output = '{"text": "Test output"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            // Console output should occur when not suppressed
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalled();
        });
        it('should process completion messages', async () => {
            const testText = 'Test prompt text';
            const completionMsg = '{"text": "Completed successfully"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(completionMsg));
            mockChildProcess.emit('close', 0);
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Completed successfully"}');
        });
        it('should integrate with GeminiLogger.processMessage', async () => {
            const testText = 'Test prompt text';
            const jsonLine = '{"text": "Test message"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(jsonLine));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Test message"}');
        });
        it('should maintain buffer across data events', async () => {
            const testText = 'Test prompt text';
            const partial1 = '{"text": "Hello';
            const partial2 = ' world';
            const partial3 = '"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(partial1));
            mockChildProcess.stdout.emit('data', Buffer.from(partial2));
            mockChildProcess.stdout.emit('data', Buffer.from(partial3));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Hello world"}');
        });
    });
    describe('error handling', () => {
        it('should reject promise on non-zero exit code', async () => {
            const testText = 'Test prompt text';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('close', 1);
            await expect(promise).rejects.toThrow('Gemini exited with code 1');
            expect(logger_1.default.error).toHaveBeenCalledWith('Gemini exited with code 1');
        });
        it('should cleanup on error', async () => {
            const testText = 'Test prompt text';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('close', 1);
            try {
                await promise;
            }
            catch (error) {
                // Expected to throw
            }
            expect(fs_1.default.unlinkSync).toHaveBeenCalled();
        });
        it('should reject promise on spawn error', async () => {
            const testText = 'Test prompt text';
            const spawnError = new Error('Failed to spawn process');
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('error', spawnError);
            await expect(promise).rejects.toThrow('Failed to spawn process');
            expect(logger_1.default.error).toHaveBeenCalledWith('Failed to execute Gemini: Failed to spawn process');
        });
        it('should cleanup on spawn error', async () => {
            const testText = 'Test prompt text';
            const spawnError = new Error('Failed to spawn process');
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('error', spawnError);
            try {
                await promise;
            }
            catch (error) {
                // Expected to throw
            }
            expect(fs_1.default.unlinkSync).toHaveBeenCalled();
        });
        it('should write error to log file', async () => {
            const testText = 'Test prompt text';
            const spawnError = new Error('Failed to spawn process');
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('error', spawnError);
            try {
                await promise;
            }
            catch (error) {
                // Expected to throw
            }
            expect(writeStreamWriteSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR:'));
        });
        it('should handle cleanup failure gracefully', async () => {
            const testText = 'Test prompt text';
            // Make unlinkSync throw
            fs_1.default.unlinkSync.mockImplementation(() => {
                throw new Error('Cleanup failed');
            });
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('close', 0);
            // Should still resolve despite cleanup failure
            await expect(promise).resolves.toBeUndefined();
            expect(logger_1.default.error).toHaveBeenCalledWith('Failed to cleanup temp file: Cleanup failed');
        });
        it('should handle missing temp file during cleanup', async () => {
            const testText = 'Test prompt text';
            // Make existsSync return false
            fs_1.default.existsSync.mockReturnValue(false);
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('close', 0);
            await expect(promise).resolves.toBeUndefined();
            // Should not attempt to unlink non-existent file
            expect(fs_1.default.unlinkSync).not.toHaveBeenCalled();
        });
        it('should close log stream on all exit paths', async () => {
            const testText = 'Test prompt text';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.emit('close', 0);
            await promise;
            expect(writeStreamEndSpy).toHaveBeenCalled();
        });
    });
    describe('edge cases', () => {
        it('should handle stderr output', async () => {
            const testText = 'Test prompt text';
            const stderrOutput = 'Warning: Something happened\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stderr.emit('data', Buffer.from(stderrOutput));
            expect(writeStreamWriteSpy).toHaveBeenCalledWith('[STDERR] ' + stderrOutput);
        });
        it('should handle long text wrapping', async () => {
            const testText = 'Test prompt text';
            const longLine = '{"text": "' + 'x'.repeat(200) + '"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(longLine));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith(expect.stringContaining('x'.repeat(200)));
        });
        it('should handle sequential chunks correctly', async () => {
            const testText = 'Test prompt text';
            const chunk1 = '{"text": "Chunk1"}\n';
            const chunk2 = '{"text": "Chunk2"}\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(chunk1));
            mockChildProcess.stdout.emit('data', Buffer.from(chunk2));
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Chunk1"}');
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Chunk2"}');
        });
        it('should handle empty lines in output', async () => {
            const testText = 'Test prompt text';
            const output = '\n\n{"text": "Actual content"}\n\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            // Should only process non-empty lines
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledTimes(1);
        });
        it('should handle non-JSON lines gracefully', async () => {
            const testText = 'Test prompt text';
            const nonJsonLine = 'This is not JSON\n';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(nonJsonLine));
            // GeminiLogger.processMessage should be called but may return null
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('This is not JSON');
        });
        it('should handle full end-to-end flow', async () => {
            const testText = 'Test prompt text';
            const output1 = '{"text": "First line"}\n';
            const output2 = '{"text": "Second line"}\n';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(output1));
            mockChildProcess.stdout.emit('data', Buffer.from(output2));
            mockChildProcess.emit('close', 0);
            await expect(promise).resolves.toBeUndefined();
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "First line"}');
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Second line"}');
            expect(logger_1.default.success).toHaveBeenCalledWith('Gemini execution completed');
        });
    });
    describe('ParallelStateManager', () => {
        it('should not interact with state manager when taskName is null', async () => {
            const testText = 'Test prompt text';
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from('{"text": "Test"}\n'));
            expect(parallel_state_manager_1.default.getInstance).not.toHaveBeenCalled();
        });
        it('should call getInstance when taskName provided', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task';
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            expect(parallel_state_manager_1.default.getInstance).toHaveBeenCalled();
        });
        it('should call updateClaudeMessage per message when taskName provided', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task';
            const output = '{"text": "Message 1"}\n{"text": "Message 2"}\n';
            const stateManager = parallel_state_manager_1.default.getInstance();
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            expect(stateManager.updateClaudeMessage).toHaveBeenCalledTimes(2);
            expect(stateManager.updateClaudeMessage).toHaveBeenCalledWith(taskName, 'Message 1');
            expect(stateManager.updateClaudeMessage).toHaveBeenCalledWith(taskName, 'Message 2');
        });
        it('should not call updateClaudeMessage without taskName', async () => {
            const testText = 'Test prompt text';
            const output = '{"text": "Test message"}\n';
            const stateManager = parallel_state_manager_1.default.getInstance();
            gemini_executor_1.GeminiExecutor.execute(testText);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            expect(stateManager.updateClaudeMessage).not.toHaveBeenCalled();
        });
        it('should handle multiple messages with state manager', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task';
            const output1 = '{"text": "First"}\n';
            const output2 = '{"text": "Second"}\n';
            const stateManager = parallel_state_manager_1.default.getInstance();
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            mockChildProcess.stdout.emit('data', Buffer.from(output1));
            mockChildProcess.stdout.emit('data', Buffer.from(output2));
            expect(stateManager.updateClaudeMessage).toHaveBeenCalledTimes(2);
        });
        it('should suppress console output when UI renderer is active', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task';
            const output = '{"text": "Test message"}\n';
            const stateManager = parallel_state_manager_1.default.getInstance();
            stateManager.isUIRendererActive.mockReturnValue(true);
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            // GeminiLogger.processMessage should still be called
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": "Test message"}');
        });
        it('should handle non-text messages with state manager', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task';
            const output = '{"text": ""}\n'; // Empty text
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            mockChildProcess.stdout.emit('data', Buffer.from(output));
            // GeminiLogger.processMessage may return null for empty text
            expect(gemini_logger_1.GeminiLogger.processMessage).toHaveBeenCalledWith('{"text": ""}');
        });
        it('should handle special characters in taskName', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task_123';
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            expect(parallel_state_manager_1.default.getInstance).toHaveBeenCalled();
        });
        it('should warn on invalid taskName format', async () => {
            const testText = 'Test prompt text';
            const taskName = 'invalid@task';
            gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            expect(logger_1.default.warning).toHaveBeenCalledWith(`Invalid taskName format: ${taskName}. Must be alphanumeric with dashes/underscores.`);
        });
        it('should handle state manager on errors', async () => {
            const testText = 'Test prompt text';
            const taskName = 'test-task';
            const promise = gemini_executor_1.GeminiExecutor.execute(testText, taskName);
            mockChildProcess.emit('close', 1);
            await expect(promise).rejects.toThrow();
            // State manager should still be initialized
            expect(parallel_state_manager_1.default.getInstance).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=gemini-executor.test.js.map