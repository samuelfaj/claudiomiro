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

/**
 * Tests for analyze-split.js
 *
 * Purpose: Verify FAST model viability analysis behavior
 * - Only splits tasks if ALL subtasks can use FAST model
 * - Keeps task intact if ANY part requires medium/hard model
 * - Subtasks created have @difficulty fast tag
 */
describe('analyze-split (FAST model viability)', () => {
    const mockTask = 'TASK1';
    const mockTaskFolder = '/test/.claudiomiro/task-executor/TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('analyzeSplit', () => {
        test('should skip analysis for subtasks (already split)', async () => {
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

        test('should skip when task was already analyzed (split.txt exists)', async () => {
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

        test('should mark task as analyzed (split.txt) when task was NOT split (FAST not viable)', async () => {
            // Arrange
            // When BLUEPRINT.md still exists after analysis, it means task was NOT split
            // (task kept intact because FAST model was not viable for all parts)
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false; // Initial check
                if (filePath.includes('BLUEPRINT.md')) return true;  // Task NOT split (kept intact)
                if (filePath.includes('prompt-split.md')) return true; // Template exists
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Analyze FAST viability for task at: {{taskFolder}}\nCheck patterns in {{claudiomiroFolder}}';
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
            const promptArg = executeClaude.mock.calls[0][0];
            expect(promptArg).toContain('Analyze FAST viability for task at: /test/.claudiomiro/task-executor/TASK1');
            expect(promptArg).toContain('Check patterns in /test/.claudiomiro/task-executor');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ model: 'medium' }),
            );
            // split.txt is created to mark task as analyzed (even if not split)
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(mockTaskFolder, 'split.txt'),
                '1',
            );
            expect(result).toEqual({ success: true });
        });

        test('should NOT create split.txt when task WAS split (FAST viable - subtasks created with @difficulty fast)', async () => {
            // Arrange
            // When BLUEPRINT.md does NOT exist after analysis, it means task WAS split
            // into subtasks (TASK1.1, TASK1.2, etc.) with @difficulty fast
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false; // Initial check
                if (filePath.includes('BLUEPRINT.md')) return false; // Task WAS split (subtasks created)
                if (filePath.includes('prompt-split.md')) return true; // Template exists
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Analyze FAST viability for task at: {{taskFolder}}';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            const result = await analyzeSplit(mockTask);

            // Assert
            const promptArg = executeClaude.mock.calls[0][0];
            expect(promptArg).toContain('Analyze FAST viability for task at: /test/.claudiomiro/task-executor/TASK1');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ model: 'medium' }),
            );
            // split.txt is NOT created because original folder was deleted (task was split)
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        test('should correctly replace placeholders in FAST viability prompt', async () => {
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
                    return 'Task folder: {{taskFolder}}\nClaudiomiro folder: {{claudiomiroFolder}}\nAnalyze FAST viability';
                }
                return '';
            });

            executeClaude.mockResolvedValue({ success: true });

            // Act
            await analyzeSplit(mockTask2);

            // Assert
            const promptArg = executeClaude.mock.calls[0][0];
            expect(promptArg).toContain('Task folder: /test/.claudiomiro/task-executor/TASK2');
            expect(promptArg).toContain('Claudiomiro folder: /test/.claudiomiro/task-executor');
            expect(promptArg).toContain('Analyze FAST viability');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask2,
                expect.objectContaining({ model: 'medium' }),
            );

            // Verify no placeholder remains unreplaced
            expect(promptArg).not.toContain('{{taskFolder}}');
            expect(promptArg).not.toContain('{{claudiomiroFolder}}');
        });

        test('should propagate errors when FAST viability analysis fails', async () => {
            // Arrange
            const mockError = new Error('Claude execution failed');

            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('split.txt')) return false;
                if (filePath.includes('prompt-split.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-split.md')) {
                    return 'Analyze FAST viability for task at: {{taskFolder}}';
                }
                return '';
            });

            executeClaude.mockRejectedValue(mockError);

            // Act & Assert
            await expect(analyzeSplit(mockTask)).rejects.toThrow('Claude execution failed');

            const promptArg = executeClaude.mock.calls[0][0];
            expect(promptArg).toContain('Analyze FAST viability for task at: /test/.claudiomiro/task-executor/TASK1');
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ model: 'medium' }),
            );
            // No split.txt created on error
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
