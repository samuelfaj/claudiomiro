const fs = require('fs');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../utils/scope-parser', () => ({
    parseTaskScope: jest.fn().mockReturnValue(null),
}));
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn().mockReturnValue(false),
    getRepository: jest.fn().mockReturnValue('/test/backend'),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
}));

// Import after mocks
const {
    completeChecklist,
    loadChecklist,
    saveChecklist,
    buildCompleteChecklistPrompt,
} = require('./complete-checklist');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { parseTaskScope } = require('../../utils/scope-parser');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

describe('complete-checklist', () => {
    const mockTask = 'TASK1';

    const mockChecklist = {
        $schema: 'review-checklist-schema-v1',
        task: 'TASK1',
        generated: '2025-12-02T10:00:00Z',
        items: [
            {
                id: 'RC1',
                file: 'src/services/user-service.js',
                lines: [45, 52],
                type: 'modified',
                description: 'Function changed - are all callers updated?',
                reviewed: false,
                category: 'compatibility',
            },
            {
                id: 'RC2',
                file: 'src/utils/validation.js',
                lines: [25],
                type: 'created',
                description: 'New validation function - is it exported?',
                reviewed: false,
                category: 'completeness',
            },
        ],
    };

    const mockCompletedChecklist = {
        ...mockChecklist,
        items: mockChecklist.items.map(item => ({ ...item, reviewed: true })),
    };

    const mockPromptTemplate = `# Complete Review Checklist
{{task}}
{{itemsList}}
{{itemCount}}
{{checklistPath}}
{{checklistJson}}`;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loadChecklist', () => {
        test('should load valid checklist from file', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockChecklist));

            // Act
            const result = loadChecklist('/test/checklist.json');

            // Assert
            expect(result).toEqual(mockChecklist);
            expect(result.items).toHaveLength(2);
        });

        test('should return null when file does not exist', () => {
            // Arrange
            fs.existsSync.mockReturnValue(false);

            // Act
            const result = loadChecklist('/test/checklist.json');

            // Assert
            expect(result).toBeNull();
        });

        test('should return null when JSON is invalid', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            // Act
            const result = loadChecklist('/test/checklist.json');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('saveChecklist', () => {
        test('should save checklist to file with proper formatting', () => {
            // Act
            saveChecklist('/test/checklist.json', mockChecklist);

            // Assert
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                '/test/checklist.json',
                JSON.stringify(mockChecklist, null, 2),
                'utf8',
            );
        });
    });

    describe('buildCompleteChecklistPrompt', () => {
        beforeEach(() => {
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-complete-checklist.md')) {
                    return mockPromptTemplate;
                }
                return '';
            });
        });

        test('should include all items in prompt', () => {
            // Act
            const result = buildCompleteChecklistPrompt(mockChecklist, '/test/checklist.json');

            // Assert
            expect(result).toContain('RC1');
            expect(result).toContain('RC2');
            expect(result).toContain('src/services/user-service.js');
            expect(result).toContain('src/utils/validation.js');
        });

        test('should include item count', () => {
            // Act
            const result = buildCompleteChecklistPrompt(mockChecklist, '/test/checklist.json');

            // Assert
            expect(result).toContain('2');
        });

        test('should include checklist JSON', () => {
            // Act
            const result = buildCompleteChecklistPrompt(mockChecklist, '/test/checklist.json');

            // Assert
            expect(result).toContain('"$schema": "review-checklist-schema-v1"');
        });

        test('should replace all placeholders', () => {
            // Act
            const result = buildCompleteChecklistPrompt(mockChecklist, '/test/checklist.json');

            // Assert
            expect(result).not.toContain('{{task}}');
            expect(result).not.toContain('{{itemsList}}');
            expect(result).not.toContain('{{itemCount}}');
            expect(result).not.toContain('{{checklistPath}}');
            expect(result).not.toContain('{{checklistJson}}');
        });

        test('should include line numbers when present', () => {
            // Act
            const result = buildCompleteChecklistPrompt(mockChecklist, '/test/checklist.json');

            // Assert
            expect(result).toContain(':45,52');
            expect(result).toContain(':25');
        });
    });

    describe('completeChecklist', () => {
        beforeEach(() => {
            // Default mocks for successful execution
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) return true;
                if (filePath.includes('prompt-complete-checklist.md')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) {
                    return JSON.stringify(mockCompletedChecklist);
                }
                if (filePath.includes('prompt-complete-checklist.md')) {
                    return mockPromptTemplate;
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '# BLUEPRINT';
                }
                return '';
            });

            fs.writeFileSync.mockImplementation(() => {});
            executeClaude.mockResolvedValue({ success: true });
        });

        test('should complete checklist successfully', async () => {
            // Act
            const result = await completeChecklist(mockTask);

            // Assert
            expect(result.success).toBe(true);
            expect(result.completedCount).toBe(2);
            expect(result.totalCount).toBe(2);
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should return success with zero items when no checklist exists', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) return false;
                return true;
            });

            // Act
            const result = await completeChecklist(mockTask);

            // Assert
            expect(result.success).toBe(true);
            expect(result.completedCount).toBe(0);
            expect(result.totalCount).toBe(0);
            expect(executeClaude).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                '[Step6] No review checklist found, skipping checklist completion',
            );
        });

        test('should return success with zero items when checklist has no items', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) {
                    return JSON.stringify({ ...mockChecklist, items: [] });
                }
                if (filePath.includes('prompt-complete-checklist.md')) {
                    return mockPromptTemplate;
                }
                return '';
            });

            // Act
            const result = await completeChecklist(mockTask);

            // Assert
            expect(result.success).toBe(true);
            expect(result.completedCount).toBe(0);
            expect(result.totalCount).toBe(0);
            expect(executeClaude).not.toHaveBeenCalled();
        });

        test('should pass cwd option to executeClaude', async () => {
            // Act
            await completeChecklist(mockTask, { cwd: '/custom/path' });

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                { cwd: '/custom/path' },
            );
        });

        test('should use state.folder as cwd when no option provided and single-repo', async () => {
            // Act
            await completeChecklist(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                undefined,
            );
        });

        test('should use repository path as cwd in multi-repo mode', async () => {
            // Arrange
            state.isMultiRepo.mockReturnValue(true);
            parseTaskScope.mockReturnValue('backend');

            // Act
            await completeChecklist(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                { cwd: '/test/backend' },
            );
        });

        test('should count completed items from updated checklist', async () => {
            // Arrange
            const partiallyCompletedChecklist = {
                ...mockChecklist,
                items: [
                    { ...mockChecklist.items[0], reviewed: true },
                    { ...mockChecklist.items[1], reviewed: false },
                ],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) {
                    return JSON.stringify(partiallyCompletedChecklist);
                }
                if (filePath.includes('prompt-complete-checklist.md')) {
                    return mockPromptTemplate;
                }
                return '';
            });

            // Act
            const result = await completeChecklist(mockTask);

            // Assert
            expect(result.completedCount).toBe(1);
            expect(result.totalCount).toBe(2);
        });

        test('should return failure when updated checklist cannot be loaded', async () => {
            // Arrange
            let callCount = 0;
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) {
                    callCount++;
                    // First call returns valid checklist, second call (after Claude) fails
                    if (callCount === 1) {
                        return JSON.stringify(mockChecklist);
                    }
                    throw new Error('File not found');
                }
                if (filePath.includes('prompt-complete-checklist.md')) {
                    return mockPromptTemplate;
                }
                return '';
            });

            // Act
            const result = await completeChecklist(mockTask);

            // Assert
            expect(result.success).toBe(false);
            expect(result.completedCount).toBe(0);
            expect(result.totalCount).toBe(2);
        });

        test('should log info message with item count', async () => {
            // Act
            await completeChecklist(mockTask);

            // Assert
            expect(logger.info).toHaveBeenCalledWith(
                '[Step6] Completing review checklist with 2 items',
            );
            expect(logger.info).toHaveBeenCalledWith(
                '[Step6] Checklist completed: 2/2 items verified',
            );
        });

        test('should handle checklist with null items array', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) {
                    return JSON.stringify({ ...mockChecklist, items: null });
                }
                return '';
            });

            // Act
            const result = await completeChecklist(mockTask);

            // Assert
            expect(result.success).toBe(true);
            expect(result.completedCount).toBe(0);
            expect(result.totalCount).toBe(0);
        });
    });
});
