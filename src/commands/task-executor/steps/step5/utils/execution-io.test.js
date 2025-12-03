const fs = require('fs');
const { loadExecution, saveExecution, recordError } = require('./execution-io');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../utils/schema-validator', () => ({
    validateExecutionJson: jest.fn(),
}));
jest.mock('./security', () => ({
    isCriticalError: jest.fn(),
}));
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('execution-io', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loadExecution', () => {
        test('should throw error if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            expect(() => loadExecution('/path/to/execution.json')).toThrow('execution.json not found');
        });

        test('should throw error if JSON is invalid', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{ invalid json }');

            expect(() => loadExecution('/path/to/execution.json')).toThrow('Failed to parse execution.json');
        });

        test('should return validated data when validation passes', () => {
            const mockData = { status: 'pending', phases: [] };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const { validateExecutionJson } = require('../../../utils/schema-validator');
            validateExecutionJson.mockReturnValue({
                valid: true,
                repairedData: mockData,
            });

            const result = loadExecution('/path/to/execution.json');
            expect(result).toEqual(mockData);
        });

        test('should return repaired data in lenient mode when validation has non-critical errors', () => {
            const mockData = { status: 'pending', phases: [] };
            const repairedData = { status: 'pending', phases: [], repaired: true };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const { validateExecutionJson } = require('../../../utils/schema-validator');
            validateExecutionJson.mockReturnValue({
                valid: false,
                errors: ['minor issue'],
                repairedData: repairedData,
            });

            const { isCriticalError } = require('./security');
            isCriticalError.mockReturnValue(false);

            const result = loadExecution('/path/to/execution.json', { lenient: true });
            expect(result).toEqual(repairedData);
        });

        test('should throw error in strict mode when validation fails', () => {
            const mockData = { status: 'pending', phases: [] };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const { validateExecutionJson } = require('../../../utils/schema-validator');
            validateExecutionJson.mockReturnValue({
                valid: false,
                errors: ['some error'],
            });

            const { isCriticalError } = require('./security');
            isCriticalError.mockReturnValue(false);

            expect(() => loadExecution('/path/to/execution.json', { lenient: false }))
                .toThrow('Invalid execution.json: some error');
        });
    });

    describe('saveExecution', () => {
        test('should save validated data when validation passes', () => {
            const mockData = { status: 'pending', phases: [] };

            const { validateExecutionJson } = require('../../../utils/schema-validator');
            validateExecutionJson.mockReturnValue({
                valid: true,
                repairedData: mockData,
            });

            saveExecution('/path/to/execution.json', mockData);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                '/path/to/execution.json',
                JSON.stringify(mockData, null, 2),
                'utf8',
            );
        });

        test('should save repaired data in lenient mode', () => {
            const mockData = { status: 'pending', phases: [] };
            const repairedData = { status: 'pending', phases: [], repaired: true };

            const { validateExecutionJson } = require('../../../utils/schema-validator');
            validateExecutionJson.mockReturnValue({
                valid: false,
                errors: ['minor issue'],
                repairedData: repairedData,
            });

            const { isCriticalError } = require('./security');
            isCriticalError.mockReturnValue(false);

            saveExecution('/path/to/execution.json', mockData, { lenient: true });

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                '/path/to/execution.json',
                JSON.stringify(repairedData, null, 2),
                'utf8',
            );
        });
    });

    describe('recordError', () => {
        test('should not do anything if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            recordError('/path/to/execution.json', new Error('test'));

            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should record error in execution.json', () => {
            const mockData = { status: 'in_progress', phases: [] };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const error = new Error('Test error');
            recordError('/path/to/execution.json', error, { failedValidation: 'success-criteria' });

            expect(fs.writeFileSync).toHaveBeenCalled();

            const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(savedData.errorHistory).toBeDefined();
            expect(savedData.errorHistory.length).toBe(1);
            expect(savedData.errorHistory[0].message).toBe('Test error');
            expect(savedData.errorHistory[0].failedValidation).toBe('success-criteria');
            expect(savedData.pendingFixes).toContain('success-criteria');
            expect(savedData.status).toBe('in_progress');
        });

        test('should append to existing error history', () => {
            const mockData = {
                status: 'in_progress',
                phases: [],
                errorHistory: [{ message: 'previous error', timestamp: '2025-01-01' }],
            };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const error = new Error('New error');
            recordError('/path/to/execution.json', error);

            const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(savedData.errorHistory.length).toBe(2);
        });
    });
});
