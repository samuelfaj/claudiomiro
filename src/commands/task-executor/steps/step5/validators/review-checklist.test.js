const { validateReviewChecklist } = require('./review-checklist');
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
