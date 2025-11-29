const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
}));

// Mock Date for deterministic timestamps
const mockDate = new Date('2024-01-01T00:00:00.000Z');
global.Date = jest.fn(() => mockDate);
global.Date.getTime = jest.fn(() => mockDate.getTime());

// Import after mocking
const { reanalyzeFailed } = require('./reanalyze-failed');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

describe('reanalyze-failed', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset path.join mock to return path arguments joined with '/'
        path.join.mockImplementation((...paths) => paths.join('/'));

        // Default fs mocks
        fs.existsSync.mockReturnValue(true);
        fs.cpSync.mockImplementation();
        fs.rmSync.mockImplementation();
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('reanalyze-prompt.md')) {
                return 'Template with {{promptPath}} {{taskPath}} {{todoOldPath}} {{todoPath}} {{failureHistory}} {{contextSection}} {{todoTemplate}}';
            }
            if (filePath.includes('TODO.md')) {
                return 'Current TODO content';
            }
            if (filePath.includes('info.json')) {
                return JSON.stringify({
                    attempts: 5,
                    errorHistory: [
                        { attempt: 1, timestamp: '2024-01-01T10:00:00Z', message: 'First error' },
                        { attempt: 2, timestamp: '2024-01-01T11:00:00Z', message: 'Second error' },
                        { attempt: 3, timestamp: '2024-01-01T12:00:00Z', message: 'Third error' },
                        { attempt: 4, timestamp: '2024-01-01T13:00:00Z', message: 'Fourth error' },
                    ],
                });
            }
            return 'mock file content';
        });

        // Default executeClaude mock
        executeClaude.mockResolvedValue({ success: true });
    });

    afterEach(() => {
    // Restore Date mock
        global.Date = Date;
    });

    describe('skip conditions', () => {
        test('should skip when TODO.old.md already exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return true;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(executeClaude).not.toHaveBeenCalled();
            expect(fs.cpSync).not.toHaveBeenCalled();
            expect(fs.rmSync).not.toHaveBeenCalled();
        });
    });

    describe('backup and restore flow', () => {
        test('should create backup and timestamped backup before deleting TODO.md', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false; // Skip condition
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(fs.cpSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/TASK1/TODO.md',
                '/test/.claudiomiro/task-executor/TASK1/TODO.old.md',
            );
            expect(fs.cpSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/TASK1/TODO.md',
                '/test/.claudiomiro/task-executor/TASK1/TODO.old.1704067200000.md',
            );
            expect(fs.rmSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/TASK1/TODO.md',
                { force: true },
            );
        });

        test('should restore TODO.md when creation fails', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false; // Skip condition
                if (filePath.includes('TODO.md')) return false; // TODO.md not created after executeClaude
                return true;
            });
            executeClaude.mockResolvedValue({ success: true });

            // Act & Assert
            await expect(reanalyzeFailed(mockTask)).rejects.toThrow('Error creating TODO.md file in deep re-analysis');
            expect(fs.cpSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/TASK1/TODO.old.md',
                '/test/.claudiomiro/task-executor/TASK1/TODO.md',
            );
        });

        test('should cleanup TODO.old.md after successful TODO.md creation', async () => {
            // Arrange
            let _existsCallCount = 0;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false; // Skip condition
                if (filePath.includes('TODO.md')) {
                    _existsCallCount++;
                    // First call (line 67): return true to skip restoration
                    // Subsequent calls: return true for normal operation
                    return true;
                }
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(fs.rmSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/TASK1/TODO.old.md',
                { force: true },
            );
        });
    });

    describe('context file collection', () => {
        test('should include AI_PROMPT.md in context', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('AI_PROMPT.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/AI_PROMPT.md');
        });

        test('should include RESEARCH.md when it exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md')) return true;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('RESEARCH.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/RESEARCH.md');
        });

        test('should handle missing RESEARCH.md gracefully', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                if (filePath.includes('AI_PROMPT.md')) return true;
                if (filePath.includes('RESEARCH.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toContain('/test/.claudiomiro/task-executor/TASK1/RESEARCH.md');
            expect(actualCall).toContain('AI_PROMPT.md');
        });
    });

    describe('failure history processing', () => {
        test('should include failure history when info.json exists with errorHistory', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];

            expect(actualCall).toContain('## 📊 FAILURE PATTERN ANALYSIS');
            expect(actualCall).toContain('This task has failed 5 times');
            expect(actualCall).toContain('Attempt 2 (2024-01-01T11:00:00Z):');
            expect(actualCall).toContain('Second error');
            expect(actualCall).toContain('Attempt 4 (2024-01-01T13:00:00Z):');
            expect(actualCall).toContain('Fourth error');

            // Check for the critical message with correct formatting
            expect(actualCall).toContain('**CRITICAL**: Analyze why these approaches failed and take a DIFFERENT strategy');
            // Check individual components
            expect(actualCall).toContain('CRITICAL');
            expect(actualCall).toContain('Analyze why these approaches failed');
        });

        test('should handle missing info.json gracefully', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                if (filePath.includes('info.json')) return false;
                if (filePath.includes('AI_PROMPT.md')) return true;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toContain('## 📊 FAILURE PATTERN ANALYSIS');
            expect(actualCall).not.toContain('This task has failed');
        });

        test('should handle info.json without errorHistory gracefully', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('info.json')) {
                    return JSON.stringify({ attempts: 3 });
                }
                if (filePath.includes('reanalyze-prompt.md')) {
                    return 'Template with {{promptPath}} {{taskPath}} {{todoOldPath}} {{todoPath}} {{failureHistory}} {{contextSection}} {{todoTemplate}}';
                }
                return 'mock file content';
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toContain('## 📊 FAILURE PATTERN ANALYSIS');
            expect(actualCall).not.toContain('This task has failed');
        });

        test('should format last 3 errors from errorHistory', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('info.json')) {
                    return JSON.stringify({
                        attempts: 7,
                        errorHistory: [
                            { attempt: 1, timestamp: '2024-01-01T10:00:00Z', message: 'First error' },
                            { attempt: 2, timestamp: '2024-01-01T11:00:00Z', message: 'Second error' },
                            { attempt: 3, timestamp: '2024-01-01T12:00:00Z', message: 'Third error' },
                            { attempt: 4, timestamp: '2024-01-01T13:00:00Z', message: 'Fourth error' },
                            { attempt: 5, timestamp: '2024-01-01T14:00:00Z', message: 'Fifth error' },
                        ],
                    });
                }
                if (filePath.includes('reanalyze-prompt.md')) {
                    return 'Template with {{promptPath}} {{taskPath}} {{todoOldPath}} {{todoPath}} {{failureHistory}} {{contextSection}} {{todoTemplate}}';
                }
                return 'mock file content';
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('This task has failed 7 times');
            // Should include last 3 errors: attempts 3, 4, 5
            expect(actualCall).toContain('Attempt 3 (2024-01-01T12:00:00Z):');
            expect(actualCall).toContain('Third error');
            expect(actualCall).toContain('Attempt 5 (2024-01-01T14:00:00Z):');
            expect(actualCall).toContain('Fifth error');
            // Should not include first 2 errors
            expect(actualCall).not.toContain('Attempt 1');
            expect(actualCall).not.toContain('First error');
        });
    });

    describe('prompt template processing', () => {
        test('should load reanalyze-prompt.md template', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('reanalyze-prompt.md'),
                'utf-8',
            );
        });

        test('should replace all placeholders in template', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).not.toMatch(/\{\{.*\}\}/);
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/PROMPT.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/TASK.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/TODO.old.md');
            expect(actualCall).toContain('/test/.claudiomiro/task-executor/TASK1/TODO.md');
        });

        test('should include TODO template from templates directory', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.md') && filePath.includes('templates')) {
                    return '# TODO Template\n- [ ] Item 1\n- [ ] Item 2';
                }
                if (filePath.includes('reanalyze-prompt.md')) {
                    return 'Template with {{promptPath}} {{taskPath}} {{todoOldPath}} {{todoPath}} {{failureHistory}} {{contextSection}} {{todoTemplate}}';
                }
                if (filePath.includes('info.json')) {
                    return JSON.stringify({ attempts: 1 });
                }
                return 'mock file content';
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('templates/TODO.md'),
                'utf-8',
            );
            const actualCall = executeClaude.mock.calls[0][0];
            expect(actualCall).toContain('# TODO Template');
            expect(actualCall).toContain('- [ ] Item 1');
        });
    });

    describe('executeClaude integration', () => {
        test('should call executeClaude with built prompt', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
            );
        });

        test('should return executeClaude result', async () => {
            // Arrange
            const mockResult = { success: true, filesCreated: ['TODO.md'] };
            executeClaude.mockResolvedValue(mockResult);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                if (filePath.includes('TODO.md')) return true; // TODO.md exists after execution
                return true;
            });

            // Act
            const result = await reanalyzeFailed(mockTask);

            // Assert
            expect(result).toBe(mockResult);
        });

        test('should propagate executeClaude errors', async () => {
            // Arrange
            const executeError = new Error('Claude execution failed');
            executeClaude.mockRejectedValue(executeError);
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });

            // Act & Assert
            await expect(reanalyzeFailed(mockTask)).rejects.toThrow('Claude execution failed');
        });
    });

    describe('timestamp generation', () => {
        test('should use consistent timestamp for backup files', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('TODO.old.md')) return false;
                return true;
            });

            // Act
            await reanalyzeFailed(mockTask);

            // Assert
            expect(fs.cpSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/TASK1/TODO.md',
                '/test/.claudiomiro/task-executor/TASK1/TODO.old.1704067200000.md',
            );
        });
    });
});
