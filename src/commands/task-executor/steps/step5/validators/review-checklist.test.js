const { validateReviewChecklist, validateItemFormat } = require('./review-checklist');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('validate-review-checklist', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('when execution.json does not exist', () => {
        test('should return valid=true and skip validation', async () => {
            fs.existsSync.mockReturnValue(false);

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });
    });

    describe('when execution.json has no artifacts', () => {
        test('should return valid=true and skip validation', async () => {
            fs.existsSync.mockImplementation((path) => {
                return path.includes('execution.json');
            });

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({ artifacts: [] });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });
    });

    describe('when review-checklist.json does not exist', () => {
        test('should return valid=false with all artifacts missing', async () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('execution.json')) return true;
                if (path.includes('review-checklist.json')) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [
                            { path: 'src/handler.ext', type: 'modified' },
                            { path: 'src/test.ext', type: 'created' },
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(2);
            expect(result.missing[0]).toEqual({
                artifact: 'src/handler.ext',
                reason: 'No review checklist entry for this artifact',
            });
            expect(result.missing[1]).toEqual({
                artifact: 'src/test.ext',
                reason: 'No review checklist entry for this artifact',
            });
        });
    });

    describe('when review-checklist.json has invalid JSON', () => {
        test('should return valid=false with parse error', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [{ path: 'src/handler.ext', type: 'modified' }],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return '{ invalid json }';
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0].artifact).toBe('review-checklist.json');
            expect(result.missing[0].reason).toContain('Invalid JSON format');
        });
    });

    describe('when artifacts are missing from checklist', () => {
        test('should identify missing artifacts', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [
                            { path: 'src/handler.ext', type: 'modified' },
                            { path: 'src/validator.ext', type: 'created' },
                            { path: 'src/test.ext', type: 'created' },
                        ],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return JSON.stringify({
                        task: 'TASK0',
                        generatedAt: '2025-12-02T23:45:12.000Z',
                        items: [
                            {
                                artifact: 'src/handler.ext',
                                questions: [
                                    { category: 'compatibility', question: 'Q1?', why: 'Because' },
                                ],
                            },
                            // Missing: src/validator.ext
                            // Missing: src/test.ext
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(2);
            expect(result.missing[0]).toEqual({
                artifact: 'src/validator.ext',
                reason: 'Missing from review-checklist.json',
            });
            expect(result.missing[1]).toEqual({
                artifact: 'src/test.ext',
                reason: 'Missing from review-checklist.json',
            });
        });
    });

    describe('when checklist items have no questions', () => {
        test('should identify items without questions', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [
                            { path: 'src/handler.ext', type: 'modified' },
                            { path: 'src/validator.ext', type: 'created' },
                        ],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return JSON.stringify({
                        task: 'TASK0',
                        generatedAt: '2025-12-02T23:45:12.000Z',
                        items: [
                            {
                                artifact: 'src/handler.ext',
                                questions: [], // ❌ Empty questions array
                            },
                            {
                                artifact: 'src/validator.ext',
                                // ❌ Missing questions field
                            },
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(2);
            expect(result.missing[0]).toEqual({
                artifact: 'src/handler.ext',
                reason: 'No review questions defined',
            });
            expect(result.missing[1]).toEqual({
                artifact: 'src/validator.ext',
                reason: 'No review questions defined',
            });
        });
    });

    describe('when deleted artifacts exist', () => {
        test('should skip deleted artifacts from validation', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [
                            { path: 'src/old-handler.ext', type: 'deleted' },
                            { path: 'src/new-handler.ext', type: 'created' },
                        ],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return JSON.stringify({
                        task: 'TASK0',
                        generatedAt: '2025-12-02T23:45:12.000Z',
                        items: [
                            {
                                artifact: 'src/new-handler.ext',
                                questions: [
                                    { category: 'completeness', question: 'Q1?', why: 'Because' },
                                ],
                            },
                            // Deleted file doesn't need checklist entry
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });
    });

    describe('when all validations pass', () => {
        test('should return valid=true with correct counts', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [
                            { path: 'src/handler.ext', type: 'modified' },
                            { path: 'src/validator.ext', type: 'created' },
                            { path: 'src/test.ext', type: 'created' },
                        ],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return JSON.stringify({
                        task: 'TASK0',
                        generatedAt: '2025-12-02T23:45:12.000Z',
                        items: [
                            {
                                artifact: 'src/handler.ext',
                                questions: [
                                    { category: 'compatibility', question: 'Q1?', why: 'Because' },
                                    { category: 'error-handling', question: 'Q2?', why: 'Because' },
                                ],
                            },
                            {
                                artifact: 'src/validator.ext',
                                questions: [
                                    { category: 'completeness', question: 'Q3?', why: 'Because' },
                                    { category: 'edge-cases', question: 'Q4?', why: 'Because' },
                                ],
                            },
                            {
                                artifact: 'src/test.ext',
                                questions: [
                                    { category: 'testing', question: 'Q5?', why: 'Because' },
                                ],
                            },
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
            expect(result.totalArtifacts).toBe(3);
            expect(result.totalChecklistItems).toBe(3);
        });
    });

    describe('when checklist has extra items not in artifacts', () => {
        test('should still pass validation (extra items are allowed)', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [{ path: 'src/handler.ext', type: 'modified' }],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return JSON.stringify({
                        task: 'TASK0',
                        generatedAt: '2025-12-02T23:45:12.000Z',
                        items: [
                            {
                                artifact: 'src/handler.ext',
                                questions: [
                                    { category: 'compatibility', question: 'Q1?', why: 'Because' },
                                ],
                            },
                            {
                                artifact: 'src/extra-file.ext',
                                questions: [
                                    { category: 'testing', question: 'Q2?', why: 'Because' },
                                ],
                            },
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            // Extra items are allowed (may be planned for future or manually added)
            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });
    });

    describe('mixed scenarios', () => {
        test('should handle mix of valid, missing, and deleted artifacts', async () => {
            fs.existsSync.mockReturnValue(true);

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        artifacts: [
                            { path: 'src/handler.ext', type: 'modified' },
                            { path: 'src/old-file.ext', type: 'deleted' },
                            { path: 'src/validator.ext', type: 'created' },
                            { path: 'src/test.ext', type: 'created' },
                        ],
                    });
                }
                if (path.includes('review-checklist.json')) {
                    return JSON.stringify({
                        task: 'TASK0',
                        generatedAt: '2025-12-02T23:45:12.000Z',
                        items: [
                            {
                                artifact: 'src/handler.ext',
                                questions: [
                                    { category: 'compatibility', question: 'Q1?', why: 'Because' },
                                ],
                            },
                            {
                                artifact: 'src/validator.ext',
                                questions: [], // ❌ Empty
                            },
                            // Missing: src/test.ext
                            // Deleted file doesn't need entry
                        ],
                    });
                }
            });

            const result = await validateReviewChecklist('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(2);

            // Validator has empty questions
            expect(result.missing.find(m => m.artifact === 'src/validator.ext')).toEqual({
                artifact: 'src/validator.ext',
                reason: 'No review questions defined',
            });

            // Test is missing entirely
            expect(result.missing.find(m => m.artifact === 'src/test.ext')).toEqual({
                artifact: 'src/test.ext',
                reason: 'Missing from review-checklist.json',
            });
        });
    });
});

describe('validateItemFormat (v2 schema)', () => {
    test('should pass with valid v2 item', () => {
        const validItem = {
            id: 'RC1',
            file: 'src/handler.ext',
            lines: [45, 50],
            type: 'modified',
            description: 'Does the validation at lines 45-50 handle empty strings correctly?',
            reviewed: false,
            category: 'error-handling',
            context: {
                action: 'Added input validation for user data',
                why: 'Prevent invalid data from reaching database',
            },
        };

        const issues = validateItemFormat(validItem);
        expect(issues).toEqual([]);
    });

    test('should fail if item missing context object', () => {
        const item = {
            id: 'RC1',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Does the validation handle empty strings?',
            // Missing context
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC1 missing context object');
    });

    test('should fail if context.action is missing', () => {
        const item = {
            id: 'RC2',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Does the validation handle empty strings?',
            context: {
                why: 'Prevent invalid data',
                // Missing action
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC2 missing or too short context.action (min 5 chars)');
    });

    test('should fail if context.action is too short', () => {
        const item = {
            id: 'RC3',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Does the validation handle empty strings?',
            context: {
                action: 'Add', // Too short (< 5 chars)
                why: 'Prevent invalid data',
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC3 missing or too short context.action (min 5 chars)');
    });

    test('should fail if context.why is missing', () => {
        const item = {
            id: 'RC4',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Does the validation handle empty strings?',
            context: {
                action: 'Added input validation',
                // Missing why
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC4 missing or too short context.why (min 5 chars)');
    });

    test('should fail if context.why is too short', () => {
        const item = {
            id: 'RC5',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Does the validation handle empty strings?',
            context: {
                action: 'Added input validation',
                why: 'Fix', // Too short (< 5 chars)
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC5 missing or too short context.why (min 5 chars)');
    });

    test('should fail if description contains backticks (inline code)', () => {
        const item = {
            id: 'RC6',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Is `validateUser(data)` handling errors correctly?', // Contains backticks
            context: {
                action: 'Added user validation function',
                why: 'Prevent invalid user data',
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC6 contains inline code (backticks) - use file:line references only');
    });

    test('should fail if lines array is empty', () => {
        const item = {
            id: 'RC7',
            file: 'src/handler.ext',
            lines: [], // Empty array
            description: 'Does the validation handle empty strings correctly?',
            context: {
                action: 'Added input validation',
                why: 'Prevent invalid data',
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC7 missing line number references (lines array empty or missing)');
    });

    test('should fail if lines is missing', () => {
        const item = {
            id: 'RC8',
            file: 'src/handler.ext',
            // Missing lines
            description: 'Does the validation handle empty strings correctly?',
            context: {
                action: 'Added input validation',
                why: 'Prevent invalid data',
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC8 missing line number references (lines array empty or missing)');
    });

    test('should fail if description is too short', () => {
        const item = {
            id: 'RC9',
            file: 'src/handler.ext',
            lines: [45],
            description: 'Is it correct?', // Too short (< 20 chars)
            context: {
                action: 'Added input validation',
                why: 'Prevent invalid data',
            },
        };

        const issues = validateItemFormat(item);
        expect(issues).toContain('Item RC9 description too short (min 20 chars)');
    });

    test('should report multiple issues at once', () => {
        const item = {
            id: 'RC10',
            file: 'src/handler.ext',
            lines: [], // Empty
            description: '`code`?', // Too short and has backticks
            context: {}, // Missing action and why
        };

        const issues = validateItemFormat(item);
        expect(issues.length).toBeGreaterThanOrEqual(4);
        expect(issues).toContain('Item RC10 missing line number references (lines array empty or missing)');
        expect(issues).toContain('Item RC10 contains inline code (backticks) - use file:line references only');
        expect(issues).toContain('Item RC10 description too short (min 20 chars)');
    });
});

describe('validateReviewChecklist (v2 schema)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should detect v2 schema and validate format', async () => {
        fs.existsSync.mockReturnValue(true);

        fs.readFileSync.mockImplementation((path) => {
            if (path.includes('execution.json')) {
                return JSON.stringify({
                    artifacts: [{ path: 'src/handler.ext', type: 'modified' }],
                });
            }
            if (path.includes('review-checklist.json')) {
                return JSON.stringify({
                    $schema: 'review-checklist-schema-v2',
                    task: 'TASK0',
                    generated: '2025-12-02T23:45:12.000Z',
                    items: [
                        {
                            id: 'RC1',
                            file: 'src/handler.ext',
                            lines: [45, 50],
                            type: 'modified',
                            description: 'Does the new validation at lines 45-50 handle empty string input?',
                            reviewed: false,
                            category: 'error-handling',
                            context: {
                                action: 'Added input validation for user data',
                                why: 'Prevent invalid data from reaching database',
                            },
                        },
                    ],
                });
            }
        });

        const result = await validateReviewChecklist('TASK0', {
            claudiomiroFolder: '/.claudiomiro',
        });

        expect(result.valid).toBe(true);
        expect(result.schemaVersion).toBe('v2');
        expect(result.formatIssues).toEqual([]);
    });

    test('should fail v2 validation if items have format issues', async () => {
        fs.existsSync.mockReturnValue(true);

        fs.readFileSync.mockImplementation((path) => {
            if (path.includes('execution.json')) {
                return JSON.stringify({
                    artifacts: [{ path: 'src/handler.ext', type: 'modified' }],
                });
            }
            if (path.includes('review-checklist.json')) {
                return JSON.stringify({
                    $schema: 'review-checklist-schema-v2',
                    task: 'TASK0',
                    generated: '2025-12-02T23:45:12.000Z',
                    items: [
                        {
                            id: 'RC1',
                            file: 'src/handler.ext',
                            lines: [], // Empty - should fail
                            type: 'modified',
                            description: 'Is `validateUser()` working?', // Has backticks - should fail
                            reviewed: false,
                            category: 'error-handling',
                            context: {
                                action: 'Fix', // Too short - should fail
                                why: 'Bug', // Too short - should fail
                            },
                        },
                    ],
                });
            }
        });

        const result = await validateReviewChecklist('TASK0', {
            claudiomiroFolder: '/.claudiomiro',
        });

        expect(result.valid).toBe(false);
        expect(result.schemaVersion).toBe('v2');
        expect(result.formatIssues.length).toBeGreaterThan(0);
    });

    test('should use file field for v2 schema (not artifact)', async () => {
        fs.existsSync.mockReturnValue(true);

        fs.readFileSync.mockImplementation((path) => {
            if (path.includes('execution.json')) {
                return JSON.stringify({
                    artifacts: [
                        { path: 'src/handler.ext', type: 'modified' },
                        { path: 'src/validator.ext', type: 'created' },
                    ],
                });
            }
            if (path.includes('review-checklist.json')) {
                return JSON.stringify({
                    $schema: 'review-checklist-schema-v2',
                    task: 'TASK0',
                    generated: '2025-12-02T23:45:12.000Z',
                    items: [
                        {
                            id: 'RC1',
                            file: 'src/handler.ext', // Uses 'file' not 'artifact'
                            lines: [45],
                            type: 'modified',
                            description: 'Does the validation at line 45 handle empty strings?',
                            reviewed: false,
                            category: 'error-handling',
                            context: {
                                action: 'Added input validation',
                                why: 'Prevent invalid data',
                            },
                        },
                        {
                            id: 'RC2',
                            file: 'src/validator.ext', // Uses 'file' not 'artifact'
                            lines: [10, 20],
                            type: 'created',
                            description: 'Does the validator correctly check all required fields?',
                            reviewed: false,
                            category: 'completeness',
                            context: {
                                action: 'Created validator module',
                                why: 'Centralize validation logic',
                            },
                        },
                    ],
                });
            }
        });

        const result = await validateReviewChecklist('TASK0', {
            claudiomiroFolder: '/.claudiomiro',
        });

        expect(result.valid).toBe(true);
        expect(result.missing).toEqual([]);
        expect(result.totalChecklistItems).toBe(2);
    });
});
