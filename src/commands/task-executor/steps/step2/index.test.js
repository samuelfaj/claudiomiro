const fs = require('fs');
const _path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
}));
jest.mock('../../../../shared/utils/logger', () => ({
    newline: jest.fn(),
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    warn: jest.fn(),
}));

// Import after mocks are defined
const { step2 } = require('./index');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');

describe('step2', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset NODE_ENV to test value for each test
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
    // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('step2 function', () => {
        test('should execute Claude with replaced prompt in test environment', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}/TASKX directory';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(logger.newline).toHaveBeenCalled();
            expect(logger.startSpinner).toHaveBeenCalledWith('Creating tasks...');
            expect(executeClaude).toHaveBeenCalledWith(
                'Create tasks in /test/.claudiomiro/task-executor/TASKX directory',
            );
            expect(logger.stopSpinner).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');

            // In test environment, validation should be skipped
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
        });

        test('should validate task creation in non-test environment when TASK0 exists', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0')) return true;
                // TASK1 won't be checked because short-circuit evaluation
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
        });

        test('should validate task creation in non-test environment when TASK1 exists (TASK0 does not)', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';
            let callOrder = [];

            fs.existsSync.mockImplementation((filePath) => {
                callOrder.push(filePath);
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0')) return false;
                if (filePath.includes('TASK1')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');

            // Verify TASK0 was checked before TASK1
            const task0Index = callOrder.findIndex(path => path.includes('TASK0'));
            const task1Index = callOrder.findIndex(path => path.includes('TASK1'));
            expect(task0Index).toBeLessThan(task1Index);
        });

        test('should throw error when tasks not created in non-test environment', async () => {
            // Arrange
            process.env.NODE_ENV = 'production';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                if (filePath.includes('TASK0')) return false;
                if (filePath.includes('TASK1')) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act & Assert
            await expect(step2()).rejects.toThrow('Error creating tasks');
            expect(executeClaude).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
        });

        test('should handle executeClaude failure', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            const errorMessage = 'Claude execution failed';
            executeClaude.mockRejectedValue(new Error(errorMessage));

            // Act & Assert
            await expect(step2()).rejects.toThrow(errorMessage);
            expect(logger.startSpinner).toHaveBeenCalledWith('Creating tasks...');
            expect(executeClaude).toHaveBeenCalled();
            // Note: stopSpinner and success won't be called because error occurs before them
        });

        test('should read prompt.md from correct path', async () => {
            // Arrange
            let actualFilePath = '';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    actualFilePath = filePath;
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(actualFilePath).toContain('step2/prompt.md');
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should replace claudiomiroFolder placeholder in prompt', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Tasks go in {{claudiomiroFolder}}/TASKX and {{claudiomiroFolder}}/TASKY';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                'Tasks go in /test/.claudiomiro/task-executor/TASKX and /test/.claudiomiro/task-executor/TASKY',
            );
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
        });

        test('should skip validation in test environment even when tasks do not exist', async () => {
            // Arrange - NODE_ENV is 'test' by default in this test file
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) return true;
                // Both TASK0 and TASK1 don't exist
                if (filePath.includes('TASK0')) return false;
                if (filePath.includes('TASK1')) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt.md')) {
                    return 'Create tasks in {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await step2();

            // Assert
            expect(executeClaude).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('Tasks created successfully');
            // Validation should be skipped, so no error should be thrown
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK0'),
            );
            expect(fs.existsSync).not.toHaveBeenCalledWith(
                expect.stringContaining('TASK1'),
            );
        });
    });
});
