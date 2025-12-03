const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const executionSchema = require('./execution-schema.json');

describe('execution-schema', () => {
    let ajv;
    let validate;

    beforeAll(() => {
        ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);
        validate = ajv.compile(executionSchema);
    });

    describe('valid execution.json', () => {
        test('should validate minimal execution.json with required fields only', () => {
            const minimal = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            const valid = validate(minimal);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should validate full execution.json with all optional fields', () => {
            const full = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK1',
                title: 'Full Test Task',
                status: 'in_progress',
                started: '2025-01-01T12:00:00.000Z',
                attempts: 2,
                currentPhase: {
                    id: 2,
                    name: 'Core Implementation',
                    lastAction: 'Created main function',
                },
                errorHistory: [
                    {
                        timestamp: '2025-01-01T12:00:00.000Z',
                        message: 'Test failed',
                        stack: 'Error: Test failed\n    at test.js:10:5\n    at run.js:20:3',
                        phase: 'Testing',
                    },
                ],
                phases: [
                    {
                        id: 1,
                        name: 'Preparation',
                        status: 'completed',
                        preConditions: [
                            {
                                check: 'Node version',
                                command: 'node --version',
                                expected: 'v18+',
                                passed: true,
                                evidence: 'v20.10.0',
                            },
                        ],
                        items: [
                            {
                                description: 'Install dependencies',
                                completed: true,
                                source: 'package.json:5',
                                evidence: 'npm install completed successfully',
                            },
                        ],
                    },
                    {
                        id: 2,
                        name: 'Core Implementation',
                        status: 'in_progress',
                        preConditions: [],
                        items: [
                            {
                                description: 'Create handler function',
                                completed: true,
                            },
                            {
                                description: 'Add validation logic',
                                completed: false,
                            },
                        ],
                    },
                ],
                successCriteria: [
                    {
                        criterion: 'All tests pass',
                        command: 'npm test',
                        expected: 'exit code 0',
                        passed: true,
                        evidence: 'Tests: 10 passed, 10 total',
                    },
                ],
                uncertainties: [
                    {
                        id: 'U1',
                        topic: 'API Design',
                        assumption: 'REST is preferred',
                        confidence: 'MEDIUM',
                        resolution: 'Confirmed via docs',
                        resolvedConfidence: 'HIGH',
                    },
                ],
                artifacts: [
                    {
                        type: 'created',
                        path: 'src/feature.js',
                        verified: true,
                        verification: 'File exists and passes lint',
                    },
                    {
                        type: 'modified',
                        path: 'src/index.js',
                        verified: false,
                    },
                ],
                beyondTheBasics: {
                    extras: ['Added JSDoc comments'],
                    edgeCases: ['Handled null input'],
                    downstreamImpact: { 'step5': 'No impact' },
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
                completion: {
                    status: 'pending_validation',
                    summary: ['Implemented core feature'],
                    deviations: ['Used different naming'],
                    forFutureTasks: ['Consider caching'],
                    codeReviewPassed: false,
                    blockedBy: ['Waiting for API approval'],
                },
            };

            const valid = validate(full);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });
    });

    describe('missing required fields', () => {
        test('should fail when task field is missing', () => {
            const missingTask = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            const valid = validate(missingTask);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: expect.objectContaining({ missingProperty: 'task' }),
                }),
            );
        });

        test('should fail when status field is missing', () => {
            const missingStatus = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            const valid = validate(missingStatus);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: expect.objectContaining({ missingProperty: 'status' }),
                }),
            );
        });

        test('should fail when $schema field is missing', () => {
            const missingSchema = {
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            const valid = validate(missingSchema);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: expect.objectContaining({ missingProperty: '$schema' }),
                }),
            );
        });
    });

    describe('invalid enum values', () => {
        test('should fail for invalid status enum value', () => {
            const invalidStatus = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'invalid_status',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            const valid = validate(invalidStatus);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'enum',
                    instancePath: '/status',
                }),
            );
        });

        test('should fail for invalid confidence enum value', () => {
            const invalidConfidence = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                uncertainties: [
                    {
                        id: 'U1',
                        topic: 'Test',
                        assumption: 'Test assumption',
                        confidence: 'INVALID',
                    },
                ],
            };

            const valid = validate(invalidConfidence);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'enum',
                    instancePath: '/uncertainties/0/confidence',
                }),
            );
        });

        test('should fail for invalid artifact type enum value', () => {
            const invalidArtifactType = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                artifacts: [
                    {
                        type: 'deleted',
                        path: 'src/file.js',
                        verified: false,
                    },
                ],
            };

            const valid = validate(invalidArtifactType);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'enum',
                    instancePath: '/artifacts/0/type',
                }),
            );
        });

        test('should fail for invalid completion status enum value', () => {
            const invalidCompletionStatus = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'completed',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                completion: {
                    status: 'done',
                },
            };

            const valid = validate(invalidCompletionStatus);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'enum',
                    instancePath: '/completion/status',
                }),
            );
        });
    });

    describe('nested structures validation', () => {
        test('should validate preConditions structure correctly', () => {
            const validPreConditions = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                phases: [
                    {
                        id: 1,
                        name: 'Preparation',
                        status: 'pending',
                        preConditions: [
                            {
                                check: 'Dependencies installed',
                                command: 'npm ls',
                                expected: 'No errors',
                                passed: true,
                                evidence: 'All dependencies OK',
                            },
                        ],
                    },
                ],
            };

            const valid = validate(validPreConditions);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should fail for preConditions missing required passed field', () => {
            const missingPassed = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                phases: [
                    {
                        id: 1,
                        name: 'Preparation',
                        status: 'pending',
                        preConditions: [
                            {
                                check: 'Test check',
                                command: 'test command',
                                expected: 'expected output',
                            },
                        ],
                    },
                ],
            };

            const valid = validate(missingPassed);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: expect.objectContaining({ missingProperty: 'passed' }),
                }),
            );
        });

        test('should validate beyondTheBasics.cleanup structure', () => {
            const validCleanup = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: false,
                        deadCodeRemoved: true,
                    },
                },
            };

            const valid = validate(validCleanup);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should fail for cleanup missing required fields', () => {
            const incompleteCleanup = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                    },
                },
            };

            const valid = validate(incompleteCleanup);
            expect(valid).toBe(false);
            expect(validate.errors.some(e =>
                e.keyword === 'required' &&
                (e.params.missingProperty === 'formattingConsistent' ||
                 e.params.missingProperty === 'deadCodeRemoved'),
            )).toBe(true);
        });
    });

    describe('new optional fields validation', () => {
        test('should validate errorHistory structure', () => {
            const withErrorHistory = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                errorHistory: [
                    {
                        timestamp: '2025-01-01T12:00:00.000Z',
                        message: 'Build failed',
                    },
                    {
                        timestamp: '2025-01-01T13:00:00.000Z',
                        message: 'Test failed',
                        stack: 'Error: Test failed\n    at test.js:10',
                        phase: 'Testing',
                    },
                ],
            };

            const valid = validate(withErrorHistory);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should validate successCriteria structure', () => {
            const withSuccessCriteria = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                successCriteria: [
                    {
                        criterion: 'All tests pass',
                        command: 'npm test',
                        passed: true,
                    },
                    {
                        criterion: 'Build succeeds',
                        command: 'npm run build',
                        expected: 'exit code 0',
                        passed: false,
                        evidence: 'Build failed with exit code 1',
                    },
                ],
            };

            const valid = validate(withSuccessCriteria);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should validate phase items structure', () => {
            const withPhaseItems = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                phases: [
                    {
                        id: 1,
                        name: 'Implementation',
                        status: 'in_progress',
                        items: [
                            {
                                description: 'Create files',
                                completed: true,
                                source: 'src/file.js:10',
                                evidence: 'File created successfully',
                            },
                            {
                                description: 'Write tests',
                                completed: false,
                                source: 'tests/file.test.js:5',
                            },
                        ],
                    },
                ],
            };

            const valid = validate(withPhaseItems);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should validate completion.codeReviewPassed and completion.blockedBy', () => {
            const withCompletionExtras = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'blocked',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                completion: {
                    status: 'pending_validation',
                    codeReviewPassed: true,
                    blockedBy: ['TASK1', 'TASK2'],
                },
            };

            const valid = validate(withCompletionExtras);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should fail for phase items missing required fields', () => {
            const invalidPhaseItems = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                phases: [
                    {
                        id: 1,
                        name: 'Implementation',
                        status: 'in_progress',
                        items: [
                            { description: 'Create files' }, // missing completed
                        ],
                    },
                ],
            };

            const valid = validate(invalidPhaseItems);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: expect.objectContaining({ missingProperty: 'completed' }),
                }),
            );
        });

        test('should validate completion.status with blocked value', () => {
            const withBlockedStatus = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'blocked',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                completion: {
                    status: 'blocked',
                    blockedBy: ['Waiting for API'],
                },
            };

            const valid = validate(withBlockedStatus);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('should validate completion.status with failed value', () => {
            const withFailedStatus = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test Task',
                status: 'blocked',  // root status uses different enum
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
                completion: {
                    status: 'failed',  // completion.status can be 'failed'
                    summary: ['Task failed due to errors'],
                },
            };

            const valid = validate(withFailedStatus);
            expect(valid).toBe(true);
            expect(validate.errors).toBeNull();
        });
    });

    describe('task identifier pattern', () => {
        test('should accept valid task identifier TASK0', () => {
            const validTask = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK0',
                title: 'Test',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            expect(validate(validTask)).toBe(true);
        });

        test('should accept valid task identifier TASK123', () => {
            const validTask = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'TASK123',
                title: 'Test',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            expect(validate(validTask)).toBe(true);
        });

        test('should fail for invalid task identifier format', () => {
            const invalidTask = {
                $schema: 'execution-schema-v1',
                version: '1.0',
                task: 'task1',
                title: 'Test',
                status: 'pending',
                started: '2025-01-01T00:00:00.000Z',
                attempts: 1,
            };

            const valid = validate(invalidTask);
            expect(valid).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'pattern',
                    instancePath: '/task',
                }),
            );
        });
    });
});
