const { validateCompletion } = require('./completion');

// Mock dependencies
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
}));

describe('completion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateCompletion', () => {
        test('should return true when all phases are completed and cleanup is done', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    { id: 2, name: 'Phase 2', status: 'completed', items: [], preConditions: [] },
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

        test('should return false when beyondTheBasics.cleanup is missing', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [],
                successCriteria: [],
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should return false when beyondTheBasics exists but cleanup is missing', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                ],
                artifacts: [],
                successCriteria: [],
                beyondTheBasics: {},
            };

            expect(validateCompletion(execution)).toBe(false);
        });

        test('should handle empty phases array with cleanup', () => {
            const execution = {
                phases: [],
                artifacts: [],
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

        test('should handle missing optional fields with cleanup', () => {
            const execution = {
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed' },
                ],
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

        // Tests for blocked criteria (auto-adjust feature)
        describe('blocked criteria support', () => {
            test('should return true when criterion is blocked with proper documentation', () => {
                const execution = {
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    ],
                    artifacts: [],
                    successCriteria: [
                        { criterion: 'Test passes', passed: true },
                        {
                            criterion: 'External service test',
                            passed: null,
                            status: 'blocked',
                            blockReason: 'Service unavailable in test environment',
                            workaround: 'Manual verification documented',
                        },
                    ],
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

            test('should return false when blocked criterion is missing blockReason', () => {
                const execution = {
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    ],
                    artifacts: [],
                    successCriteria: [
                        {
                            criterion: 'External service test',
                            status: 'blocked',
                            workaround: 'Manual verification',
                            // missing blockReason
                        },
                    ],
                    beyondTheBasics: {
                        cleanup: {
                            debugLogsRemoved: true,
                            formattingConsistent: true,
                            deadCodeRemoved: true,
                        },
                    },
                };

                expect(validateCompletion(execution)).toBe(false);
            });

            test('should return false when blocked criterion is missing workaround', () => {
                const execution = {
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    ],
                    artifacts: [],
                    successCriteria: [
                        {
                            criterion: 'External service test',
                            status: 'blocked',
                            blockReason: 'Service unavailable',
                            // missing workaround
                        },
                    ],
                    beyondTheBasics: {
                        cleanup: {
                            debugLogsRemoved: true,
                            formattingConsistent: true,
                            deadCodeRemoved: true,
                        },
                    },
                };

                expect(validateCompletion(execution)).toBe(false);
            });

            test('should return true when all criteria are properly blocked or passed', () => {
                const execution = {
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    ],
                    artifacts: [],
                    successCriteria: [
                        { criterion: 'Test 1', passed: true },
                        { criterion: 'Test 2', passed: true },
                        {
                            criterion: 'Test 3',
                            status: 'blocked',
                            blockReason: 'Reason',
                            workaround: 'Workaround',
                        },
                        {
                            criterion: 'Test 4',
                            status: 'blocked',
                            blockReason: 'Another reason',
                            workaround: 'Another workaround',
                        },
                    ],
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

            test('should return true when criterion has manual status', () => {
                const execution = {
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    ],
                    artifacts: [],
                    successCriteria: [
                        { criterion: 'Test passes', passed: true },
                        {
                            criterion: 'Manual verification',
                            status: 'manual',
                        },
                    ],
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

            test('should return false when criterion is failed (not blocked)', () => {
                const execution = {
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed', items: [], preConditions: [] },
                    ],
                    artifacts: [],
                    successCriteria: [
                        { criterion: 'Test passes', passed: true },
                        {
                            criterion: 'Failing test',
                            passed: false,
                            status: 'failed',
                        },
                    ],
                    beyondTheBasics: {
                        cleanup: {
                            debugLogsRemoved: true,
                            formattingConsistent: true,
                            deadCodeRemoved: true,
                        },
                    },
                };

                expect(validateCompletion(execution)).toBe(false);
            });
        });
    });
});
