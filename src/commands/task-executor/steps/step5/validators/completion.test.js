const { validateCompletion } = require('./completion');

// Mock dependencies
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
}));

describe('completion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateCompletion', () => {
        test('should return true when all phases are completed', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    { id: 2, name: 'Phase 2', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [],
                successCriteria: [],
            };

            expect(validateCompletion(execution)).toBe(true);
        });

        test('should return false when any phase is not completed', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    { id: 2, name: 'Phase 2', status: 'in_progress', items: [], preConditions: [] },
                ],
                artifacts: [],
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return false when any item is not completed', () => {
            const execution = {
                phases: [
                    {
                        id: 1,
                        name: 'Phase 1',
                        status: 'completed',
                        items: [
                            { description: 'Item 1', completed: true },
                            { description: 'Item 2', completed: false },
                        ],
                        preConditions: [],
                    },
                ],
                artifacts: [],
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return false when any pre-condition is not passed', () => {
            const execution = {
                phases: [
                    {
                        id: 1,
                        name: 'Phase 1',
                        status: 'completed',
                        items: [],
                        preConditions: [
                            { check: 'Check 1', passed: true },
                            { check: 'Check 2', passed: false },
                        ],
                    },
                ],
                artifacts: [],
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return false when any artifact is not verified', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [
                    { path: 'file1.js', verified: true },
                    { path: 'file2.js', verified: false },
                ],
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return false when any success criterion is not passed', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [],
                successCriteria: [
                    { criterion: 'Test passes', passed: true },
                    { criterion: 'Lint passes', passed: false },
                ],
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return false when cleanup is not complete', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [],
                successCriteria: [],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: false,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return true when cleanup is complete', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [],
                successCriteria: [],
                beyondTheBasics: {
                    cleanup: {
                        debugLogsRemoved: true,
                        formattingConsistent: true,
                        deadCodeRemoved: true,
                    },
                },
            };

            expect(validateCompletion(execution)).toBe(true);
        });

        test('should handle empty phases array', () => {
            const execution = {
                phases: [],
                artifacts: [],
            };

            expect(validateCompletion(execution)).toBe(true);
        });

        test('should handle missing optional fields', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed' },
                ],
            };

            expect(validateCompletion(execution)).toBe(true);
        });
    });
});
