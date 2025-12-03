const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
}));

// Import after mocks
const { analyzeSplit } = require('./analyze-split');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

describe('analyze-split', () => {
    const mockTask = 'TASK1';
    const mockTaskFolder = '/test/.claudiomiro/task-executor/TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('analyzeSplit', () => {
        test('should skip when task is subtask (contains ".")', async () => {
            // Arrange
            const subtask = 'TASK1.1';

            // Act
            await analyzeSplit(subtask);

            // Assert
            expect(executeClaude).not.toHaveBeenCalled();
            expect(fs.existsSync).not.toHaveBeenCalled();
            expect(fs.readFileSync).not.toHaveBeenCalled();
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should skip when split.txt already exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return true;
                return false;
            });

            // Act
            await analyzeSplit(mockTask);

            // Assert
            expect(executeClaude).not.toHaveBeenCalled();
            expect(fs.readFileSync).not.toHaveBeenCalled();
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalledWith(path.join(mockTaskFolder, 'split.txt'));
        });

        test('should execute analysis and create split.txt when BLUEPRINT.md exists after execution', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false; // Initial check
                if (filePath.includes('BLUEPRINT.md')) return true;  // After execution
                if (filePath.includes('prompt-split.md')) return true; // Template exists
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Carefully analyze the task located at: {{taskFolder}}\nEvaluate complexity and parallelism for {{claudiomiroFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            const result = await analyzeSplit(mockTask);

            // Assert
            expect(fs.readFileSync).toHaveBeenCalledWith(
                path.join(__dirname, 'prompt-split.md'),
                'utf-8',
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Carefully analyze the task located at: /test/.claudiomiro/task-executor/TASK1'),
                mockTask,
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Evaluate complexity and parallelism for /test/.claudiomiro/task-executor'),
                mockTask,
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(mockTaskFolder, 'split.txt'),
                '1',
            );
            expect(result).toEqual({ success: true });
        });

        test('should execute analysis but skip split.txt creation when task was split (BLUEPRINT.md does not exist)', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false; // Initial check
                if (filePath.includes('BLUEPRINT.md')) return false; // After execution (task was split)
                if (filePath.includes('prompt-split.md')) return true; // Template exists
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Analyze task at: {{taskFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            const result = await analyzeSplit(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Analyze task at: /test/.claudiomiro/task-executor/TASK1'),
                mockTask,
            );
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        test('should verify placeholder replacement in prompt', async () => {
            // Arrange
            const mockTask2 = 'TASK2';
            const _mockTaskFolder2 = '/test/.claudiomiro/task-executor/TASK2';

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false;
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('prompt-split.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Task folder: {{taskFolder}}\nClaudiomiro folder: {{claudiomiroFolder}}\nAnalyze the task';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await analyzeSplit(mockTask2);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Task folder: /test/.claudiomiro/task-executor/TASK2'),
                mockTask2,
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Claudiomiro folder: /test/.claudiomiro/task-executor'),
                mockTask2,
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Analyze the task'),
                mockTask2,
            );

            // Verify no placeholder remains unreplaced
            const promptCall = executeClaude.mock.calls[0][0];
            expect(promptCall).not.toContain('{{taskFolder}}');
            expect(promptCall).not.toContain('{{claudiomiroFolder}}');
        });

        test('should handle executeClaude failure', async () => {
            // Arrange
            const mockError = new Error('Claude execution failed');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false;
                if (filePath.includes('prompt-split.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Analyze task at: {{taskFolder}}';
                }
                return '';
            });

            executeClaude.mockRejectedValue(mockError);

            // Act & Assert
            await expect(analyzeSplit(mockTask)).rejects.toThrow('Claude execution failed');

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Analyze task at: /test/.claudiomiro/task-executor/TASK1'),
                mockTask,
            );
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should throw error when task is null', async () => {
            // Arrange & Act & Assert
            await expect(analyzeSplit(null)).rejects.toThrow('path');
        });

        test('should throw error when task is non-string', async () => {
            // Arrange & Act & Assert
            await expect(analyzeSplit(123)).rejects.toThrow('path');
        });

        test('should execute when task is empty string (passes subtask check)', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return true; // Skip to avoid execution
                return false;
            });

            // Act & Assert - Should not throw because empty string doesn't contain '.'
            await expect(analyzeSplit('')).resolves.toBeUndefined();
        });
    });
});
