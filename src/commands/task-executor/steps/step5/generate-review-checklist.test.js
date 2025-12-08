const fs = require('fs');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
}));
jest.mock('../../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
}));

// Import after mocks
const {
    generateReviewChecklist,
    loadArtifactsFromExecution,
    buildChecklistPrompt,
} = require('./generate-review-checklist');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');

describe('generate-review-checklist', () => {
    const mockTask = 'TASK1';

    const mockExecution = {
        artifacts: [
            { type: 'created', path: 'src/services/user-service.js', verified: false },
            { type: 'modified', path: 'src/utils/validation.js', verified: true },
        ],
    };

    const mockChecklist = {
        $schema: 'review-checklist-schema-v1',
        task: 'TASK1',
        generated: '2025-12-02T10:00:00Z',
        items: [
            {
                id: 'RC1',
                file: 'src/services/user-service.js',
                lines: [1, 50],
                type: 'created',
                description: 'New service created - verify all exports are documented',
                reviewed: false,
                category: 'completeness',
            },
            {
                id: 'RC2',
                file: 'src/utils/validation.js',
                lines: [25],
                type: 'modified',
                description: 'Validation function modified - are all callers updated?',
                reviewed: false,
                category: 'compatibility',
            },
        ],
    };

    const mockPromptTemplate = `# Generate Review Checklist
{{artifactsList}}
{{blueprintSummary}}
{{checklistPath}}
{{task}}
{{timestamp}}
{{artifactCount}}`;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loadArtifactsFromExecution', () => {
        test('should extract artifacts array from valid execution.json', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockExecution));

            // Act
            const result = loadArtifactsFromExecution('/test/execution.json');

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].type).toBe('created');
            expect(result[0].path).toBe('src/services/user-service.js');
            expect(result[1].type).toBe('modified');
        });

        test('should return empty array when file does not exist', () => {
            // Arrange
            fs.existsSync.mockReturnValue(false);

            // Act
            const result = loadArtifactsFromExecution('/test/execution.json');

            // Assert
            expect(result).toEqual([]);
        });

        test('should return empty array when JSON is invalid', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            // Act
            const result = loadArtifactsFromExecution('/test/execution.json');

            // Assert
            expect(result).toEqual([]);
        });

        test('should return empty array when artifacts field is missing', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ status: 'completed' }));

            // Act
            const result = loadArtifactsFromExecution('/test/execution.json');

            // Assert
            expect(result).toEqual([]);
        });

        test('should return empty array when artifacts is null', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ artifacts: null }));

            // Act
            const result = loadArtifactsFromExecution('/test/execution.json');

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('buildChecklistPrompt', () => {
        beforeEach(() => {
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('prompt-review-checklist.md')) {
                    return mockPromptTemplate;
                }
                return '';
            });
        });

        test('should include all artifacts in prompt', () => {
            // Arrange
            const artifacts = [
                { type: 'created', path: 'src/new-file.js' },
                { type: 'modified', path: 'src/old-file.js' },
            ];

            // Act
            const result = buildChecklistPrompt(
                artifacts,
                'Blueprint content',
                '/test/checklist.json',
                'TASK1',
            );

            // Assert
            expect(result).toContain('src/new-file.js');
            expect(result).toContain('CREATED');
            expect(result).toContain('src/old-file.js');
            expect(result).toContain('MODIFIED');
        });

        test('should truncate long blueprint content', () => {
            // Arrange
            const longBlueprint = 'x'.repeat(2000);
            const artifacts = [{ type: 'created', path: 'file.js' }];

            // Act
            const result = buildChecklistPrompt(
                artifacts,
                longBlueprint,
                '/test/checklist.json',
                'TASK1',
            );

            // Assert
            expect(result).toContain('(truncated)');
        });

        test('should not truncate short blueprint content', () => {
            // Arrange
            const shortBlueprint = 'Short content';
            const artifacts = [{ type: 'created', path: 'file.js' }];

            // Act
            const result = buildChecklistPrompt(
                artifacts,
                shortBlueprint,
                '/test/checklist.json',
                'TASK1',
            );

            // Assert
            expect(result).not.toContain('(truncated)');
            expect(result).toContain('Short content');
        });

        test('should replace all template placeholders', () => {
            // Arrange
            const artifacts = [{ type: 'created', path: 'src/file.js' }];

            // Act
            const result = buildChecklistPrompt(
                artifacts,
                'Blueprint',
                '/test/checklist.json',
                'TASK1',
            );

            // Assert
            expect(result).not.toContain('{{artifactsList}}');
            expect(result).not.toContain('{{blueprintSummary}}');
            expect(result).not.toContain('{{checklistPath}}');
            expect(result).not.toContain('{{task}}');
            expect(result).not.toContain('{{timestamp}}');
            expect(result).not.toContain('{{artifactCount}}');
        });

        test('should include correct artifact count', () => {
            // Arrange
            const artifacts = [
                { type: 'created', path: 'file1.js' },
                { type: 'modified', path: 'file2.js' },
                { type: 'created', path: 'file3.js' },
            ];

            // Act
            const result = buildChecklistPrompt(
                artifacts,
                'Blueprint',
                '/test/checklist.json',
                'TASK1',
            );

            // Assert
            expect(result).toContain('3');
        });
    });

    describe('generateReviewChecklist', () => {
        beforeEach(() => {
            // Default mocks for successful execution
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('review-checklist.json')) return true;
                if (filePath.includes('prompt-review-checklist.md')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(mockExecution);
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '# Task Blueprint\n\nTask description';
                }
                if (filePath.includes('prompt-review-checklist.md')) {
                    return mockPromptTemplate;
                }
                if (filePath.includes('review-checklist.json')) {
                    return JSON.stringify(mockChecklist);
                }
                return '';
            });

            fs.rmSync.mockImplementation(() => {});
            fs.writeFileSync.mockImplementation(() => {});
            executeClaude.mockResolvedValue({ success: true });
        });

        test('should generate checklist successfully with artifacts', async () => {
            // Act
            const result = await generateReviewChecklist(mockTask);

            // Assert
            expect(result.success).toBe(true);
            expect(result.itemCount).toBe(2);
            expect(result.checklistPath).toContain('review-checklist.json');
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should return success with zero items when no artifacts', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return JSON.stringify({ artifacts: [] });
                }
                return '';
            });

            // Act
            const result = await generateReviewChecklist(mockTask);

            // Assert
            expect(result.success).toBe(true);
            expect(result.itemCount).toBe(0);
            expect(result.checklistPath).toBeNull();
            expect(executeClaude).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                '[Step5] No artifacts to generate checklist for',
            );
        });

        test('should return failure when BLUEPRINT.md is missing', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) return false;
                if (filePath.includes('execution.json')) return true;
                return false;
            });

            // Act
            const result = await generateReviewChecklist(mockTask);

            // Assert
            expect(result.success).toBe(false);
            expect(result.checklistPath).toBeNull();
            expect(logger.warning).toHaveBeenCalledWith(
                '[Step5] BLUEPRINT.md not found, skipping checklist',
            );
        });

        test('should remove existing checklist before generating new one', async () => {
            // Arrange
            let checklistExists = true;
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) return checklistExists;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('prompt-review-checklist.md')) return true;
                return false;
            });

            fs.rmSync.mockImplementation(() => {
                checklistExists = false;
            });

            // Act
            await generateReviewChecklist(mockTask);

            // Assert
            expect(fs.rmSync).toHaveBeenCalled();
        });

        test('should pass cwd option to executeClaude', async () => {
            // Act
            await generateReviewChecklist(mockTask, { cwd: '/custom/path' });

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                expect.objectContaining({ cwd: '/custom/path' }),
            );
        });

        test('should return failure when checklist file not created', async () => {
            // Arrange
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('review-checklist.json')) return false;
                if (filePath.includes('execution.json')) return true;
                if (filePath.includes('BLUEPRINT.md')) return true;
                if (filePath.includes('prompt-review-checklist.md')) return true;
                return false;
            });

            // Act
            const result = await generateReviewChecklist(mockTask);

            // Assert
            expect(result.success).toBe(false);
            expect(result.checklistPath).toBeNull();
            expect(logger.warning).toHaveBeenCalledWith(
                '[Step5] review-checklist.json was not created',
            );
        });

        test('should handle invalid JSON in generated checklist gracefully', async () => {
            // Arrange
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(mockExecution);
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '# Task Blueprint';
                }
                if (filePath.includes('prompt-review-checklist.md')) {
                    return mockPromptTemplate;
                }
                if (filePath.includes('review-checklist.json')) {
                    return 'invalid json';
                }
                return '';
            });

            // Act
            const result = await generateReviewChecklist(mockTask);

            // Assert
            // Should still succeed but fallback to artifact count
            expect(result.success).toBe(true);
            expect(result.itemCount).toBe(2); // Falls back to artifacts.length
        });

        test('should use model option without cwd when cwd not provided', async () => {
            // Act
            await generateReviewChecklist(mockTask);

            // Assert
            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                mockTask,
                { model: 'medium' },
            );
        });

        test('should count items from generated checklist', async () => {
            // Arrange
            const checklistWith5Items = {
                ...mockChecklist,
                items: [
                    { id: 'RC1', file: 'a.js', type: 'created', description: 'Test 1', reviewed: false, category: 'completeness' },
                    { id: 'RC2', file: 'b.js', type: 'created', description: 'Test 2', reviewed: false, category: 'completeness' },
                    { id: 'RC3', file: 'c.js', type: 'created', description: 'Test 3', reviewed: false, category: 'completeness' },
                    { id: 'RC4', file: 'd.js', type: 'modified', description: 'Test 4', reviewed: false, category: 'compatibility' },
                    { id: 'RC5', file: 'e.js', type: 'modified', description: 'Test 5', reviewed: false, category: 'integration' },
                ],
            };

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return JSON.stringify(mockExecution);
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '# Task Blueprint';
                }
                if (filePath.includes('prompt-review-checklist.md')) {
                    return mockPromptTemplate;
                }
                if (filePath.includes('review-checklist.json')) {
                    return JSON.stringify(checklistWith5Items);
                }
                return '';
            });

            // Act
            const result = await generateReviewChecklist(mockTask);

            // Assert
            expect(result.itemCount).toBe(5);
        });
    });
});
