jest.mock('./generate-execution');
jest.mock('./analyze-split');
jest.mock('../../../../shared/utils/logger', () => ({
    warning: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    newline: jest.fn(),
}));

// Import after mocks
const { step4 } = require('./index');
const { generateExecution } = require('./generate-execution');
const { analyzeSplit } = require('./analyze-split');
const logger = require('../../../../shared/utils/logger');

describe('step4', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('step4', () => {
        test('should orchestrate generateExecution and analyzeSplit successfully', async () => {
            // Arrange
            generateExecution.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: false, reason: 'Simple task' });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(generateExecution).toHaveBeenCalledWith(mockTask);
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
            expect(logger.success).toHaveBeenCalledWith('execution.json generated successfully');
            expect(result).toEqual({ shouldSplit: false, reason: 'Simple task' });
        });

        test('should propagate error when generateExecution fails', async () => {
            // Arrange
            const error = new Error('Failed to generate execution.json');
            generateExecution.mockRejectedValue(error);

            // Act & Assert
            await expect(step4(mockTask)).rejects.toThrow('Failed to generate execution.json');
            expect(generateExecution).toHaveBeenCalledWith(mockTask);
            expect(analyzeSplit).not.toHaveBeenCalled();
        });

        test('should propagate error when analyzeSplit fails', async () => {
            // Arrange
            generateExecution.mockResolvedValue();
            const error = new Error('Failed to analyze task for splitting');
            analyzeSplit.mockRejectedValue(error);

            // Act & Assert
            await expect(step4(mockTask)).rejects.toThrow('Failed to analyze task for splitting');
            expect(generateExecution).toHaveBeenCalledWith(mockTask);
            expect(analyzeSplit).toHaveBeenCalledWith(mockTask);
        });

        test('should work with different task identifiers', async () => {
            // Arrange
            const differentTask = 'TASK42';
            generateExecution.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: true });

            // Act
            await step4(differentTask);

            // Assert
            expect(generateExecution).toHaveBeenCalledWith(differentTask);
            expect(analyzeSplit).toHaveBeenCalledWith(differentTask);
        });

        test('should return split analysis result with subtasks', async () => {
            // Arrange
            generateExecution.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: true, subtasks: ['TASK1.1', 'TASK1.2'] });

            // Act
            const result = await step4(mockTask);

            // Assert
            expect(result).toEqual({ shouldSplit: true, subtasks: ['TASK1.1', 'TASK1.2'] });
        });

        test('should call logger.success after generating execution.json', async () => {
            // Arrange
            generateExecution.mockResolvedValue();
            analyzeSplit.mockResolvedValue({ shouldSplit: false });

            // Act
            await step4(mockTask);

            // Assert
            expect(logger.success).toHaveBeenCalledTimes(1);
            expect(logger.success).toHaveBeenCalledWith('execution.json generated successfully');
        });
    });
});
