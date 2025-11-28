const path = require('path');

jest.mock('./generate-todo');
jest.mock('./analyze-split');
jest.mock('./utils');
jest.mock('../../../../shared/utils/logger', () => ({
    warning: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    newline: jest.fn(),
}));
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro',
}));

// Import after mocks
const { step4 } = require('./index');
const { generateTodo } = require('./generate-todo');
const { analyzeSplit } = require('./analyze-split');
const { validateTodoQuality } = require('./utils');
const logger = require('../../../../shared/utils/logger');

describe('step4', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('step4', () => {
        test('should orchestrate generateTodo and analyzeSplit successfully', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: false, reason: 'Simple task' });
            validateTodoQuality.mockReturnValue({
                valid: true,
                errors: [],
                contextScore: 3,
            });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(generateTodo).toHaveBeenCalledWith(mockTask);
            expect(validateTodoQuality).toHaveBeenCalledWith(path.join('/test/.claudiomiro', mockTask, 'TODO.md'));
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(logger.success).toHaveBeenCalledWith('TODO.md validated successfully (context reference score: 3/3)');
            expect(result).toEqual({ shouldSplit: false, reason: 'Simple task' });
        });

        test('should handle TODO validation with errors and continue to analyzeSplit', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: true, subtasks: ['TASK1.1', 'TASK1.2'] });
            validateTodoQuality.mockReturnValue({
                valid: false,
                errors: [
                    'TODO.md is too short (< 500 chars) - likely missing context',
                    'Missing required section: ## Implementation Plan',
                ],
                contextScore: 1,
            });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(generateTodo).toHaveBeenCalledWith(mockTask);
            expect(validateTodoQuality).toHaveBeenCalled();
            expect(logger.warning).toHaveBeenCalledWith('TODO.md quality issues detected:');
            expect(logger.warning).toHaveBeenCalledWith('  - TODO.md is too short (< 500 chars) - likely missing context');
            expect(logger.warning).toHaveBeenCalledWith('  - Missing required section: ## Implementation Plan');
            expect(logger.info).toHaveBeenCalledWith('Context reference score: 1/3');
            expect(logger.info).toHaveBeenCalledWith('TODO.md was created but may need manual review for completeness.');
            expect(logger.newline).toHaveBeenCalled();
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(result).toEqual({ shouldSplit: true, subtasks: ['TASK1.1', 'TASK1.2'] });
        });

        test('should handle validation with context score of 0', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: false, reason: 'Task analysis complete' });
            validateTodoQuality.mockReturnValue({
                valid: false,
                errors: ['No context references found'],
                contextScore: 0,
            });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(logger.warning).toHaveBeenCalledWith('TODO.md quality issues detected:');
            expect(logger.warning).toHaveBeenCalledWith('  - No context references found');
            expect(logger.info).toHaveBeenCalledWith('Context reference score: 0/3');
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(result).toEqual({ shouldSplit: false, reason: 'Task analysis complete' });
        });

        test('should handle validation with context score of 2', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: true, reason: 'Complex task' });
            validateTodoQuality.mockReturnValue({
                valid: false,
                errors: ['Missing some implementation details'],
                contextScore: 2,
            });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(logger.warning).toHaveBeenCalledWith('TODO.md quality issues detected:');
            expect(logger.warning).toHaveBeenCalledWith('  - Missing some implementation details');
            expect(logger.info).toHaveBeenCalledWith('Context reference score: 2/3');
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(result).toEqual({ shouldSplit: true, reason: 'Complex task' });
        });

        test('should handle validation with multiple errors', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: false, reason: 'Proceed with task' });
            validateTodoQuality.mockReturnValue({
                valid: false,
                errors: [
                    'TODO.md was not created',
                    'Missing required section: ## Context Reference',
                    'Missing required section: ## Implementation Plan',
                    'Missing required section: ## Verification',
                ],
                contextScore: 0,
            });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(logger.warning).toHaveBeenCalledWith('TODO.md quality issues detected:');
            expect(logger.warning).toHaveBeenCalledWith('  - TODO.md was not created');
            expect(logger.warning).toHaveBeenCalledWith('  - Missing required section: ## Context Reference');
            expect(logger.warning).toHaveBeenCalledWith('  - Missing required section: ## Implementation Plan');
            expect(logger.warning).toHaveBeenCalledWith('  - Missing required section: ## Verification');
            expect(logger.info).toHaveBeenCalledWith('Context reference score: 0/3');
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(result).toEqual({ shouldSplit: false, reason: 'Proceed with task' });
        });

        test('should propagate error when generateTodo fails', async () => {
            // Arrange
            const error = new Error('Failed to generate TODO.md');
            generateTodo.mockRejectedValue(error);

            // Act & Assert
            await expect(step4(mockTask)).rejects.toThrow('Failed to generate TODO.md');
            expect(generateTodo).toHaveBeenCalledWith(mockTask);
            expect(validateTodoQuality).not.toHaveBeenCalled();
            expect(analyzeSplit).not.toHaveBeenCalled();
        });

        test('should propagate error when analyzeSplit fails', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            validateTodoQuality.mockReturnValue({
                valid: true,
                errors: [],
                contextScore: 3,
            });
            const error = new Error('Failed to analyze task for splitting');
            analyzeSplit.mockRejectedValue(error);

            // Act & Assert
            await expect(step4(mockTask)).rejects.toThrow('Failed to analyze task for splitting');
            expect(generateTodo).toHaveBeenCalledWith(mockTask);
            expect(validateTodoQuality).toHaveBeenCalled();
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
        });

        test('should handle empty errors array with invalid validation', async () => {
            // Arrange
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: false, reason: 'Analysis complete' });
            validateTodoQuality.mockReturnValue({
                valid: false,
                errors: [],
                contextScore: 2,
            });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(logger.warning).toHaveBeenCalledWith('TODO.md quality issues detected:');
            expect(logger.info).toHaveBeenCalledWith('Context reference score: 2/3');
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(result).toEqual({ shouldSplit: false, reason: 'Analysis complete' });
        });

        test('should work with different task identifiers', async () => {
            // Arrange
            const differentTask = 'TASK42';
            generateTodo.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: true });
            validateTodoQuality.mockReturnValue({
                valid: true,
                errors: [],
                contextScore: 3,
            });

            // Act
            await step4(differentTask);

            // Assert
            expect(generateTodo).toHaveBeenCalledWith(differentTask);
            expect(validateTodoQuality).toHaveBeenCalledWith(path.join('/test/.claudiomiro', differentTask, 'TODO.md'));
            expect(analyzeSplit).toHaveBeenCalledWith(differentTask);
        });

        test('should handle all valid context scores (0, 1, 2, 3)', async () => {
            // Test each context score value
            const testCases = [
                { score: 0, expectedMessage: 'Context reference score: 0/3' },
                { score: 1, expectedMessage: 'Context reference score: 1/3' },
                { score: 2, expectedMessage: 'Context reference score: 2/3' },
                { score: 3, expectedMessage: 'context reference score: 3/3' },
            ];

            for (const testCase of testCases) {
                // Arrange
                jest.clearAllMocks();
                generateTodo.mockResolvedValue();
                analyzeSplit.mockResolvedValue({ shouldSplit: false });
                validateTodoQuality.mockReturnValue({
                    valid: testCase.score === 3,
                    errors: testCase.score < 3 ? ['Some error'] : [],
                    contextScore: testCase.score,
                });

                // Act
                await step4(mockTask);

                // Assert
                if (testCase.score === 3) {
                    expect(logger.success).toHaveBeenCalledWith(`TODO.md validated successfully (${testCase.expectedMessage})`);
                } else {
                    expect(logger.info).toHaveBeenCalledWith(testCase.expectedMessage);
                }
            }
        });
    });
});
