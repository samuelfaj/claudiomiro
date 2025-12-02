// Mock Ajv module - must be before imports
const mockValidate = jest.fn();
const mockCompile = jest.fn(() => mockValidate);
const mockAjvInstance = {
    compile: mockCompile,
};
jest.mock('ajv', () => jest.fn(() => mockAjvInstance));

// Mock ajv-formats
jest.mock('ajv-formats', () => jest.fn());

// Mock fs module with default implementations
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}));

describe('schema-validator', () => {
    let schemaValidator;

    const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['status'],
        properties: {
            status: { type: 'string', enum: ['pending', 'completed'] },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset the module to clear cached validator
        jest.resetModules();

        // Re-mock the modules after resetModules
        jest.doMock('ajv', () => jest.fn(() => mockAjvInstance));
        jest.doMock('ajv-formats', () => jest.fn());
        jest.doMock('fs', () => ({
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue(JSON.stringify(mockSchema)),
        }));

        // Re-require the module
        schemaValidator = require('./schema-validator');

        // Default mock implementations for validate
        mockValidate.mockReturnValue(true);
        mockValidate.errors = null;
    });

    describe('getSchemaPath', () => {
        test('should return correct path to execution-schema.json', () => {
            const result = schemaValidator.getSchemaPath();
            expect(result).toContain('templates');
            expect(result).toContain('execution-schema.json');
        });
    });

    describe('validateExecutionJson', () => {
        describe('happy path', () => {
            test('should return valid: true for valid data', () => {
                const validData = {
                    $schema: 'execution-schema-v1',
                    version: '1.0',
                    task: 'TASK1',
                    title: 'Test Task',
                    status: 'pending',
                    started: '2025-01-01T00:00:00Z',
                    attempts: 1,
                };

                mockValidate.mockReturnValue(true);
                mockValidate.errors = null;

                const result = schemaValidator.validateExecutionJson(validData);

                expect(result).toEqual({ valid: true, errors: [] });
            });

            test('should return valid: true with empty errors array', () => {
                mockValidate.mockReturnValue(true);
                mockValidate.errors = null;

                const result = schemaValidator.validateExecutionJson({ status: 'pending' });

                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
            });
        });

        describe('missing required field', () => {
            test('should return error for missing required field', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'required',
                        instancePath: '',
                        params: { missingProperty: 'status' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({});

                expect(result.valid).toBe(false);
                expect(result.errors).toContain("root: Missing required field 'status'");
            });

            test('should return multiple errors for multiple missing fields', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    { keyword: 'required', instancePath: '', params: { missingProperty: 'status' } },
                    { keyword: 'required', instancePath: '', params: { missingProperty: 'task' } },
                ];

                const result = schemaValidator.validateExecutionJson({});

                expect(result.valid).toBe(false);
                expect(result.errors).toHaveLength(2);
            });
        });

        describe('invalid enum value', () => {
            test('should return error for invalid status enum', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'enum',
                        instancePath: '/status',
                        params: { allowedValues: ['pending', 'in_progress', 'completed', 'blocked'] },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ status: 'invalid' });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toContain('status');
                expect(result.errors[0]).toContain('Invalid value');
            });
        });

        describe('invalid nested structure', () => {
            test('should return error with path for nested validation failure', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'required',
                        instancePath: '/phases/0/preConditions/0',
                        params: { missingProperty: 'passed' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({
                    phases: [{ preConditions: [{ check: 'test' }] }],
                });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toContain('phases.0.preConditions.0');
                expect(result.errors[0]).toContain('passed');
            });
        });

        describe('empty object', () => {
            test('should fail with multiple errors for empty object', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    { keyword: 'required', instancePath: '', params: { missingProperty: '$schema' } },
                    { keyword: 'required', instancePath: '', params: { missingProperty: 'version' } },
                    { keyword: 'required', instancePath: '', params: { missingProperty: 'task' } },
                    { keyword: 'required', instancePath: '', params: { missingProperty: 'status' } },
                ];

                const result = schemaValidator.validateExecutionJson({});

                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(1);
            });
        });

        describe('null/undefined input', () => {
            test('should handle null input gracefully', () => {
                const result = schemaValidator.validateExecutionJson(null);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Input data is null or undefined');
            });

            test('should handle undefined input gracefully', () => {
                const result = schemaValidator.validateExecutionJson(undefined);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Input data is null or undefined');
            });

            test('should handle array input gracefully', () => {
                const result = schemaValidator.validateExecutionJson([]);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Input data must be an object');
            });

            test('should handle string input gracefully', () => {
                const result = schemaValidator.validateExecutionJson('invalid');

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Input data must be an object');
            });
        });

        describe('schema file not found', () => {
            test('should return error when schema file does not exist', () => {
                // Reset module and set up mock to return false for existsSync
                jest.resetModules();
                jest.doMock('fs', () => ({
                    existsSync: jest.fn().mockReturnValue(false),
                    readFileSync: jest.fn(),
                }));

                const validator = require('./schema-validator');
                const result = validator.validateExecutionJson({ status: 'pending' });

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Schema file not found');
            });
        });

        describe('invalid JSON in schema file', () => {
            test('should return error for invalid JSON in schema', () => {
                // Reset module and set up mock to return invalid JSON
                jest.resetModules();
                jest.doMock('fs', () => ({
                    existsSync: jest.fn().mockReturnValue(true),
                    readFileSync: jest.fn().mockReturnValue('{ invalid json }'),
                }));

                const validator = require('./schema-validator');
                const result = validator.validateExecutionJson({ status: 'pending' });

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid JSON in schema file');
            });
        });

        describe('type validation errors', () => {
            test('should format type error correctly', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'type',
                        instancePath: '/attempts',
                        params: { type: 'integer' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ attempts: 'not-a-number' });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toBe('attempts: Expected integer');
            });
        });

        describe('pattern validation errors', () => {
            test('should format pattern error correctly', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'pattern',
                        instancePath: '/task',
                        params: { pattern: '^TASK\\d+$' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ task: 'invalid-task' });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toContain('task');
                expect(result.errors[0]).toContain('pattern');
            });
        });

        describe('format validation errors', () => {
            test('should format date-time format error correctly', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'format',
                        instancePath: '/started',
                        params: { format: 'date-time' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ started: 'not-a-date' });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toBe('started: Invalid date-time format');
            });
        });

        describe('minimum validation errors', () => {
            test('should format minimum error correctly', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'minimum',
                        instancePath: '/attempts',
                        params: { limit: 0 },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ attempts: -1 });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toBe('attempts: Value must be >= 0');
            });
        });

        describe('const validation errors', () => {
            test('should format const error correctly', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'const',
                        instancePath: '/$schema',
                        params: { allowedValue: 'execution-schema-v1' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ $schema: 'wrong-schema' });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toBe("$schema: Value must be 'execution-schema-v1'");
            });
        });

        describe('additionalProperties errors', () => {
            test('should format additionalProperties error correctly', () => {
                mockValidate.mockReturnValue(false);
                mockValidate.errors = [
                    {
                        keyword: 'additionalProperties',
                        instancePath: '',
                        params: { additionalProperty: 'unknownField' },
                    },
                ];

                const result = schemaValidator.validateExecutionJson({ unknownField: 'value' });

                expect(result.valid).toBe(false);
                expect(result.errors[0]).toBe("root: Unknown property 'unknownField'");
            });
        });
    });

    describe('getValidator', () => {
        test('should cache validator after first load', () => {
            const mockFs = require('fs');

            // First call - should load schema
            schemaValidator.getValidator();
            expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

            // Second call - should use cache
            schemaValidator.getValidator();
            expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
        });

        test('should cache error after schema load failure', () => {
            // Reset module and set up mock for failure
            jest.resetModules();
            jest.doMock('fs', () => ({
                existsSync: jest.fn().mockReturnValue(false),
                readFileSync: jest.fn(),
            }));

            const validator = require('./schema-validator');

            // First call - should try to load schema
            const result1 = validator.getValidator();
            expect(result1.error).toBe('Schema file not found');

            // Second call - should use cached error
            const result2 = validator.getValidator();
            expect(result2.error).toBe('Schema file not found');
        });
    });

    describe('resetValidatorCache', () => {
        test('should clear cached validator', () => {
            const mockFs = require('fs');

            // Load schema
            schemaValidator.getValidator();
            expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

            // Reset cache
            schemaValidator.resetValidatorCache();

            // Should load schema again
            schemaValidator.getValidator();
            expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
        });
    });

    describe('formatErrors', () => {
        test('should return empty array for null errors', () => {
            const result = schemaValidator.formatErrors(null);
            expect(result).toEqual([]);
        });

        test('should return empty array for empty errors array', () => {
            const result = schemaValidator.formatErrors([]);
            expect(result).toEqual([]);
        });

        test('should handle unknown error keywords with default message', () => {
            const errors = [
                {
                    keyword: 'unknownKeyword',
                    instancePath: '/field',
                    message: 'Custom error message',
                },
            ];

            const result = schemaValidator.formatErrors(errors);

            expect(result[0]).toBe('field: Custom error message');
        });
    });
});
