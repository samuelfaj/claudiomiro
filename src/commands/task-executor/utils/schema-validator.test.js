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

                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
                expect(result.sanitizedData).toBeDefined();
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

    describe('sanitizeData', () => {
        test('should return null for undefined input', () => {
            const result = schemaValidator.sanitizeData(undefined);
            expect(result).toBeNull();
        });

        test('should return null for null input', () => {
            const result = schemaValidator.sanitizeData(null);
            expect(result).toBeNull();
        });

        test('should preserve primitive values', () => {
            expect(schemaValidator.sanitizeData('string')).toBe('string');
            expect(schemaValidator.sanitizeData(123)).toBe(123);
            expect(schemaValidator.sanitizeData(true)).toBe(true);
            expect(schemaValidator.sanitizeData(false)).toBe(false);
        });

        test('should filter undefined values from arrays', () => {
            const input = [1, undefined, 2, undefined, 3];
            const result = schemaValidator.sanitizeData(input);
            expect(result).toEqual([1, 2, 3]);
        });

        test('should preserve null values in arrays', () => {
            const input = [1, null, 2, null, 3];
            const result = schemaValidator.sanitizeData(input);
            expect(result).toEqual([1, null, 2, null, 3]);
        });

        test('should skip undefined properties in objects', () => {
            const input = { a: 1, b: undefined, c: 3 };
            const result = schemaValidator.sanitizeData(input);
            expect(result).toEqual({ a: 1, c: 3 });
            expect(result).not.toHaveProperty('b');
        });

        test('should preserve null properties in objects', () => {
            const input = { a: 1, b: null, c: 3 };
            const result = schemaValidator.sanitizeData(input);
            expect(result).toEqual({ a: 1, b: null, c: 3 });
        });

        test('should recursively sanitize nested objects', () => {
            const input = {
                level1: {
                    level2: {
                        value: 'test',
                        undefinedProp: undefined,
                        nullProp: null,
                    },
                    undefinedProp: undefined,
                },
            };
            const result = schemaValidator.sanitizeData(input);
            expect(result).toEqual({
                level1: {
                    level2: {
                        value: 'test',
                        nullProp: null,
                    },
                },
            });
        });

        test('should recursively sanitize arrays with nested objects', () => {
            const input = [
                { a: 1, b: undefined },
                undefined,
                { c: null, d: [undefined, 2, null] },
            ];
            const result = schemaValidator.sanitizeData(input);
            expect(result).toEqual([
                { a: 1 },
                { c: null, d: [2, null] },
            ]);
        });

        test('should handle uncertainties with null values (real-world scenario)', () => {
            const input = {
                uncertainties: [
                    {
                        id: 'U1',
                        topic: 'Test topic',
                        assumption: 'Test assumption',
                        confidence: 'MEDIUM',
                        resolution: null,
                        resolvedConfidence: null,
                    },
                ],
            };
            const result = schemaValidator.sanitizeData(input);
            expect(result.uncertainties[0].resolution).toBeNull();
            expect(result.uncertainties[0].resolvedConfidence).toBeNull();
        });
    });

    describe('validateExecutionJson with sanitization', () => {
        test('should return sanitizedData on successful validation', () => {
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = { status: 'pending', extra: undefined };
            const result = schemaValidator.validateExecutionJson(input);

            expect(result.valid).toBe(true);
            expect(result.sanitizedData).toBeDefined();
            expect(result.sanitizedData).not.toHaveProperty('extra');
        });

        test('should sanitize data before validation by default', () => {
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = {
                status: 'pending',
                uncertainties: [
                    { id: 'U1', resolution: null, resolvedConfidence: null },
                ],
            };
            const result = schemaValidator.validateExecutionJson(input);

            expect(result.valid).toBe(true);
            expect(result.sanitizedData.uncertainties[0].resolution).toBeNull();
        });

        test('should not sanitize data when sanitize option is false', () => {
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = { status: 'pending', undefinedField: undefined };
            const result = schemaValidator.validateExecutionJson(input, { sanitize: false, repair: false });

            expect(result.valid).toBe(true);
            // When sanitize is false, sanitizedData is not returned
            expect(result.sanitizedData).toBeUndefined();
        });
    });

    describe('repairExecutionJson', () => {
        test('should return data unchanged if null or not object', () => {
            expect(schemaValidator.repairExecutionJson(null)).toBeNull();
            expect(schemaValidator.repairExecutionJson(undefined)).toBeUndefined();
            expect(schemaValidator.repairExecutionJson('string')).toBe('string');
        });

        test('should add missing required top-level fields', () => {
            const input = {};
            const result = schemaValidator.repairExecutionJson(input);

            expect(result.$schema).toBe('execution-schema-v1');
            expect(result.version).toBe('1.0');
            expect(result.task).toBe('TASK0');
            expect(result.title).toBe('Untitled Task');
            expect(result.status).toBe('pending');
            expect(result.started).toBeDefined();
            expect(result.attempts).toBe(0);
        });

        test('should preserve valid existing fields', () => {
            const input = {
                $schema: 'execution-schema-v1',
                version: '2.0',
                task: 'TASK5',
                title: 'My Task',
                status: 'completed',
                started: '2025-01-01T00:00:00Z',
                attempts: 3,
            };
            const result = schemaValidator.repairExecutionJson(input);

            expect(result.version).toBe('2.0');
            expect(result.task).toBe('TASK5');
            expect(result.title).toBe('My Task');
            expect(result.status).toBe('completed');
            expect(result.attempts).toBe(3);
        });

        test('should normalize invalid status to pending', () => {
            const input = { status: 'invalid_status' };
            const result = schemaValidator.repairExecutionJson(input);

            expect(result.status).toBe('pending');
        });

        test('should repair phases array', () => {
            const input = {
                phases: [
                    { name: 'Phase 1' }, // missing id and status
                    null, // invalid entry
                    { id: 2, status: 'invalid' }, // invalid status
                ],
            };
            const result = schemaValidator.repairExecutionJson(input);

            expect(result.phases[0].id).toBe(1);
            expect(result.phases[0].status).toBe('pending');
            expect(result.phases[1].id).toBe(2);
            expect(result.phases[1].name).toBe('Phase 2');
            expect(result.phases[2].status).toBe('pending');
        });
    });

    describe('repairPreCondition', () => {
        test('should add missing required fields', () => {
            const input = { check: 'Test check' };
            const result = schemaValidator.repairPreCondition(input);

            expect(result.check).toBe('Test check');
            expect(result.command).toBe('echo "no command specified"');
            expect(result.expected).toBe('');
            expect(result.passed).toBe(false);
        });

        test('should handle null or undefined input', () => {
            const result = schemaValidator.repairPreCondition(null);

            expect(result.check).toBe('Unknown check');
            expect(result.command).toBe('echo "no command specified"');
            expect(result.expected).toBe('');
            expect(result.passed).toBe(false);
        });

        test('should preserve valid existing fields', () => {
            const input = {
                check: 'File exists',
                command: 'test -f file.txt',
                expected: 'true',
                passed: true,
                evidence: 'File found',
            };
            const result = schemaValidator.repairPreCondition(input);

            expect(result.check).toBe('File exists');
            expect(result.command).toBe('test -f file.txt');
            expect(result.expected).toBe('true');
            expect(result.passed).toBe(true);
            expect(result.evidence).toBe('File found');
        });

        test('should convert non-string expected to string', () => {
            const input = {
                check: 'Test',
                command: 'echo 123',
                expected: 123,
            };
            const result = schemaValidator.repairPreCondition(input);

            expect(result.expected).toBe('123');
        });

        test('should use description or name as fallback for check', () => {
            const input1 = { description: 'From description' };
            const result1 = schemaValidator.repairPreCondition(input1);
            expect(result1.check).toBe('From description');

            const input2 = { name: 'From name' };
            const result2 = schemaValidator.repairPreCondition(input2);
            expect(result2.check).toBe('From name');
        });
    });

    describe('repairPhaseItem', () => {
        test('should add missing required fields', () => {
            const input = {};
            const result = schemaValidator.repairPhaseItem(input);

            expect(result.description).toBe('Unknown item');
            expect(result.completed).toBe(false);
        });

        test('should handle null input', () => {
            const result = schemaValidator.repairPhaseItem(null);

            expect(result.description).toBe('Unknown item');
            expect(result.completed).toBe(false);
        });

        test('should use name or task as fallback for description', () => {
            const input = { name: 'Task name' };
            const result = schemaValidator.repairPhaseItem(input);

            expect(result.description).toBe('Task name');
        });
    });

    describe('repairArtifact', () => {
        test('should add missing required fields', () => {
            const input = {};
            const result = schemaValidator.repairArtifact(input);

            expect(result.type).toBe('modified');
            expect(result.path).toBe('unknown');
            expect(result.verified).toBe(false);
        });

        test('should normalize invalid type', () => {
            const input = { type: 'deleted' }; // deleted is not valid
            const result = schemaValidator.repairArtifact(input);

            expect(result.type).toBe('modified');
        });

        test('should use file as fallback for path', () => {
            const input = { file: 'src/test.js' };
            const result = schemaValidator.repairArtifact(input);

            expect(result.path).toBe('src/test.js');
        });
    });

    describe('repairUncertainty', () => {
        test('should add missing required fields', () => {
            const input = {};
            const result = schemaValidator.repairUncertainty(input, 0);

            expect(result.id).toBe('U1');
            expect(result.topic).toBe('Unknown');
            expect(result.assumption).toBe('Unknown');
            expect(result.confidence).toBe('MEDIUM');
            expect(result.resolution).toBeNull();
            expect(result.resolvedConfidence).toBeNull();
        });

        test('should normalize invalid confidence', () => {
            const input = { confidence: 'VERY_HIGH' };
            const result = schemaValidator.repairUncertainty(input, 0);

            expect(result.confidence).toBe('MEDIUM');
        });

        test('should clear invalid resolvedConfidence', () => {
            const input = { resolvedConfidence: 'INVALID' };
            const result = schemaValidator.repairUncertainty(input, 0);

            expect(result.resolvedConfidence).toBeNull();
        });
    });

    describe('repairSuccessCriterion', () => {
        test('should add missing required fields', () => {
            const input = {};
            const result = schemaValidator.repairSuccessCriterion(input);

            expect(result.criterion).toBe('Unknown criterion');
            expect(result.passed).toBe(false);
        });

        test('should use check or description as fallback', () => {
            const input = { check: 'From check' };
            const result = schemaValidator.repairSuccessCriterion(input);

            expect(result.criterion).toBe('From check');
        });

        test('should normalize invalid testType', () => {
            const input = { testType: 'INVALID' };
            const result = schemaValidator.repairSuccessCriterion(input);

            expect(result.testType).toBeNull();
        });
    });

    describe('repairCompletion', () => {
        test('should add missing required status', () => {
            const input = {};
            const result = schemaValidator.repairCompletion(input);

            expect(result.status).toBe('pending_validation');
        });

        test('should normalize invalid status', () => {
            const input = { status: 'done' };
            const result = schemaValidator.repairCompletion(input);

            expect(result.status).toBe('pending_validation');
        });

        test('should convert non-array fields to arrays', () => {
            const input = {
                summary: 'Single summary',
                deviations: 'Single deviation',
            };
            const result = schemaValidator.repairCompletion(input);

            expect(result.summary).toEqual(['Single summary']);
            expect(result.deviations).toEqual(['Single deviation']);
        });
    });

    describe('repairBeyondTheBasics', () => {
        test('should handle null input', () => {
            const result = schemaValidator.repairBeyondTheBasics(null);
            expect(result).toEqual({});
        });

        test('should repair cleanup flags', () => {
            const input = {
                cleanup: {
                    debugLogsRemoved: 'yes', // wrong type
                },
            };
            const result = schemaValidator.repairBeyondTheBasics(input);

            expect(result.cleanup.debugLogsRemoved).toBe(false);
            expect(result.cleanup.formattingConsistent).toBe(false);
            expect(result.cleanup.deadCodeRemoved).toBe(false);
        });
    });

    describe('stripUnknownProperties', () => {
        test('should strip unknown properties from uncertainties', () => {
            const input = {
                id: 'U1',
                topic: 'API version',
                assumption: 'Using v2',
                confidence: 'HIGH',
                description: 'Unknown property to strip',
                mitigation: 'Another unknown property',
                fallback: 'Yet another unknown property',
            };
            const result = schemaValidator.repairUncertainty(input, 0);

            expect(result.id).toBe('U1');
            expect(result.topic).toBe('API version');
            expect(result.assumption).toBe('Using v2');
            expect(result.confidence).toBe('HIGH');
            expect(result.description).toBeUndefined();
            expect(result.mitigation).toBeUndefined();
            expect(result.fallback).toBeUndefined();
        });

        test('should strip unknown properties from artifacts', () => {
            const input = {
                type: 'created',
                path: 'src/file.js',
                verified: true,
                description: 'Unknown property to strip',
            };
            const result = schemaValidator.repairArtifact(input);

            expect(result.type).toBe('created');
            expect(result.path).toBe('src/file.js');
            expect(result.verified).toBe(true);
            expect(result.description).toBeUndefined();
        });

        test('should strip unknown properties from completion', () => {
            const input = {
                status: 'completed',
                summary: ['Done'],
                reason: 'Unknown property to strip',
                lessonLearned: 'Another unknown property',
            };
            const result = schemaValidator.repairCompletion(input);

            expect(result.status).toBe('completed');
            expect(result.summary).toEqual(['Done']);
            expect(result.reason).toBeUndefined();
            expect(result.lessonLearned).toBeUndefined();
        });

        test('should strip unknown properties from phases', () => {
            const input = {
                id: 1,
                name: 'Phase 1',
                status: 'completed',
                extraField: 'Unknown property to strip',
            };
            const result = schemaValidator.repairPhase(input, 1);

            expect(result.id).toBe(1);
            expect(result.name).toBe('Phase 1');
            expect(result.status).toBe('completed');
            expect(result.extraField).toBeUndefined();
        });

        test('should handle the real-world execution.json error case', () => {
            // This is the exact scenario from the user's error
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = {
                uncertainties: [
                    { id: 'U1', topic: 'Test', assumption: 'None', confidence: 'HIGH', description: 'Extra', mitigation: 'Extra' },
                    { id: 'U2', topic: 'Test2', assumption: 'None2', confidence: 'LOW', description: 'Extra2', fallback: 'Extra2' },
                ],
                artifacts: [
                    { type: 'created', path: 'file.js', verified: true, description: 'Extra artifact desc' },
                ],
                completion: {
                    status: 'completed',
                    reason: 'Extra reason',
                    lessonLearned: 'Extra lesson',
                },
            };

            const result = schemaValidator.validateExecutionJson(input, { repair: true });

            expect(result.valid).toBe(true);
            expect(result.repairedData.uncertainties[0].description).toBeUndefined();
            expect(result.repairedData.uncertainties[0].mitigation).toBeUndefined();
            expect(result.repairedData.uncertainties[1].description).toBeUndefined();
            expect(result.repairedData.uncertainties[1].fallback).toBeUndefined();
            expect(result.repairedData.artifacts[0].description).toBeUndefined();
            expect(result.repairedData.completion.reason).toBeUndefined();
            expect(result.repairedData.completion.lessonLearned).toBeUndefined();
        });
    });

    describe('validateExecutionJson with repair', () => {
        test('should repair preConditions with missing command/expected', () => {
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = {
                phases: [
                    {
                        id: 1,
                        name: 'Phase 1',
                        status: 'pending',
                        preConditions: [
                            { check: 'Test without command' }, // missing command and expected
                        ],
                    },
                ],
            };

            const result = schemaValidator.validateExecutionJson(input, { repair: true });

            expect(result.valid).toBe(true);
            expect(result.repairedData.phases[0].preConditions[0].command).toBe('echo "no command specified"');
            expect(result.repairedData.phases[0].preConditions[0].expected).toBe('');
            expect(result.repairedData.phases[0].preConditions[0].passed).toBe(false);
        });

        test('should return repairedData on successful validation with repair enabled', () => {
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = { status: 'completed' };
            const result = schemaValidator.validateExecutionJson(input, { repair: true });

            expect(result.valid).toBe(true);
            expect(result.repairedData).toBeDefined();
            expect(result.repairedData.$schema).toBe('execution-schema-v1');
        });

        test('should not repair when repair option is false', () => {
            mockValidate.mockReturnValue(true);
            mockValidate.errors = null;

            const input = { status: 'completed' };
            const result = schemaValidator.validateExecutionJson(input, { repair: false, sanitize: false });

            expect(result.valid).toBe(true);
            expect(result.repairedData).toBeUndefined();
        });
    });
});
