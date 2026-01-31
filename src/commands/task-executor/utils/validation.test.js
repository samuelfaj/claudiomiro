const fs = require('fs');
const {
    isCompletedFromExecution,
    isEffectivelyBlocked,
    hasApprovedCodeReview,
    canProceedWithBlockedCriteria,
    shouldEnableAutoAdjustMode,
} = require('./validation');

jest.mock('fs');

// Mock the criteria-relaxation module
jest.mock('../steps/step5/validators/criteria-relaxation', () => ({
    canProceedWithBlockedCriteria: jest.fn(),
}));

describe('validation', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isCompletedFromExecution', () => {
        describe('file existence checks', () => {
            test('should return completed:false when execution.json does not exist', () => {
                fs.existsSync.mockReturnValue(false);

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: false,
                    confidence: 1.0,
                    reason: 'execution.json not found',
                });
            });
        });

        describe('completion status detection', () => {
            test('should return completed:true when completion.status is completed', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'in_progress',
                    completion: { status: 'completed' },
                    phases: [],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: true,
                    confidence: 1.0,
                    reason: 'completion.status is completed',
                });
            });

            test('should return completed:true when status is completed', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'completed',
                    completion: { status: 'pending_validation' },
                    phases: [],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: true,
                    confidence: 0.9,
                    reason: 'status is completed',
                });
            });

            test('should return completed:false when status is blocked', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'blocked',
                    completion: { status: 'pending_validation' },
                    phases: [],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: false,
                    confidence: 1.0,
                    reason: 'status is blocked',
                });
            });

            test('should return completed:true when all phases are completed', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'in_progress',
                    completion: { status: 'pending_validation' },
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed' },
                        { id: 2, name: 'Phase 2', status: 'completed' },
                        { id: 3, name: 'Phase 3', status: 'completed' },
                    ],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: true,
                    confidence: 0.85,
                    reason: 'all phases completed',
                });
            });

            test('should return completed:false when some phases are not completed', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'in_progress',
                    completion: { status: 'pending_validation' },
                    phases: [
                        { id: 1, name: 'Phase 1', status: 'completed' },
                        { id: 2, name: 'Phase 2', status: 'in_progress' },
                        { id: 3, name: 'Phase 3', status: 'pending' },
                    ],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: false,
                    confidence: 0.8,
                    reason: 'task still in progress',
                });
            });

            test('should return completed:false when phases array is empty', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'in_progress',
                    completion: { status: 'pending_validation' },
                    phases: [],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: false,
                    confidence: 0.8,
                    reason: 'task still in progress',
                });
            });

            test('should return completed:false when phases is undefined', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'pending',
                    completion: { status: 'pending_validation' },
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result).toEqual({
                    completed: false,
                    confidence: 0.8,
                    reason: 'task still in progress',
                });
            });
        });

        describe('error handling', () => {
            test('should handle malformed JSON', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue('not valid json');

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result.completed).toBe(false);
                expect(result.confidence).toBe(0.5);
                expect(result.reason).toContain('Failed to parse execution.json');
            });

            test('should handle file read errors', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockImplementation(() => {
                    throw new Error('EACCES: permission denied');
                });

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result.completed).toBe(false);
                expect(result.confidence).toBe(0.5);
                expect(result.reason).toContain('Failed to parse execution.json');
            });
        });

        describe('priority of completion checks', () => {
            test('should prioritize completion.status over status field', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'in_progress',
                    completion: { status: 'completed' },
                    phases: [
                        { id: 1, status: 'pending' },
                    ],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result.completed).toBe(true);
                expect(result.reason).toBe('completion.status is completed');
            });

            test('should prioritize status over phases', () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue(JSON.stringify({
                    status: 'completed',
                    completion: { status: 'pending_validation' },
                    phases: [
                        { id: 1, status: 'pending' },
                    ],
                }));

                const result = isCompletedFromExecution('/test/execution.json');

                expect(result.completed).toBe(true);
                expect(result.reason).toBe('status is completed');
            });
        });
    });

    describe('hasApprovedCodeReview', () => {
        test('should return false when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(false);
        });

        test('should return false when ## Status section is missing', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Code Review\n\nSome content without status section');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(false);
        });

        test('should return true when status is Approved', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Code Review\n\n## Status\nApproved\n\n## Details');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(true);
        });

        test('should return true when status contains approved (case insensitive)', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Code Review\n\n## Status\nAPPROVED with comments\n\n## Details');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(true);
        });

        test('should return false when status is Rejected', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Code Review\n\n## Status\nRejected\n\n## Details');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(false);
        });

        test('should return false when status is Pending', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Code Review\n\n## Status\nPending\n\n## Details');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(false);
        });

        test('should handle status section with empty lines before value', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('## Status\n\n\nApproved');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(true);
        });

        test('should handle lowercase status header', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('## status\nApproved');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(true);
        });

        test('should return false when status section exists but has no value', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('## Status\n\n');

            expect(hasApprovedCodeReview('/test/CODE_REVIEW.md')).toBe(false);
        });
    });

    describe('isEffectivelyBlocked', () => {
        test('should return blocked:false when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result).toEqual({ blocked: false, reason: null });
        });

        test('should return blocked:true when status is blocked', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'blocked',
            }));

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result).toEqual({ blocked: true, reason: 'status is blocked' });
        });

        test('should return blocked:true when completion.summary contains BLOCKED', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'in_progress',
                completion: {
                    summary: ['TASK8 BLOCKED: Repository mismatch'],
                },
            }));

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('completion summary');
        });

        test('should return blocked:true when there is HIGH confidence repository mismatch', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'in_progress',
                uncertainties: [{
                    topic: 'Repository mismatch',
                    assumption: 'Task designed for repo A but running in repo B',
                    confidence: 'HIGH',
                }],
            }));

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('repository mismatch');
        });

        test('should return blocked:true when all phase items have Skipped evidence', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'in_progress',
                phases: [
                    {
                        id: 1,
                        name: 'Phase 1',
                        items: [
                            { description: 'Item 1', completed: true, evidence: 'Skipped - repository mismatch' },
                            { description: 'Item 2', completed: true, evidence: 'Skipped - cannot proceed' },
                        ],
                    },
                    {
                        id: 2,
                        name: 'Phase 2',
                        items: [
                            { description: 'Item 3', completed: true, evidence: 'Skipped - wrong repo' },
                        ],
                    },
                ],
            }));

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('all phase items were skipped');
        });

        test('should return blocked:false when phases have real work done', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'in_progress',
                phases: [
                    {
                        id: 1,
                        name: 'Phase 1',
                        items: [
                            { description: 'Item 1', completed: true, evidence: 'Created file.js' },
                            { description: 'Item 2', completed: true, evidence: 'Modified config.json' },
                        ],
                    },
                ],
            }));

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result).toEqual({ blocked: false, reason: null });
        });

        test('should return blocked:false for normal in_progress task', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'in_progress',
                phases: [],
            }));

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result).toEqual({ blocked: false, reason: null });
        });

        test('should return blocked:false on JSON parse error', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            const result = isEffectivelyBlocked('/test/execution.json');

            expect(result).toEqual({ blocked: false, reason: null });
        });
    });

    describe('canProceedWithBlockedCriteria', () => {
        const mockCriteriaRelaxation = require('../steps/step5/validators/criteria-relaxation');

        test('should return canProceed:false when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = canProceedWithBlockedCriteria('/test/execution.json');

            expect(result.canProceed).toBe(false);
            expect(result.summary).toBe('execution.json not found');
        });

        test('should call criteria-relaxation module with parsed execution', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                successCriteria: [{ criterion: 'Test', passed: true }],
            }));
            mockCriteriaRelaxation.canProceedWithBlockedCriteria.mockReturnValue({
                canProceed: true,
                passedCount: 1,
                blockedCount: 0,
                summary: 'All 1 criteria passed',
            });

            const result = canProceedWithBlockedCriteria('/test/execution.json');

            expect(mockCriteriaRelaxation.canProceedWithBlockedCriteria).toHaveBeenCalled();
            expect(result.canProceed).toBe(true);
        });

        test('should handle JSON parse errors', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            const result = canProceedWithBlockedCriteria('/test/execution.json');

            expect(result.canProceed).toBe(false);
            expect(result.summary).toContain('Failed to check criteria');
        });

        test('should handle module errors', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ successCriteria: [] }));
            mockCriteriaRelaxation.canProceedWithBlockedCriteria.mockImplementation(() => {
                throw new Error('Module error');
            });

            const result = canProceedWithBlockedCriteria('/test/execution.json');

            expect(result.canProceed).toBe(false);
            expect(result.summary).toContain('Failed to check criteria');
        });
    });

    describe('shouldEnableAutoAdjustMode', () => {
        test('should return false for attempts <= threshold', () => {
            expect(shouldEnableAutoAdjustMode(1)).toBe(false);
            expect(shouldEnableAutoAdjustMode(3)).toBe(false);
            expect(shouldEnableAutoAdjustMode(5)).toBe(false);
        });

        test('should return true for attempts > threshold', () => {
            expect(shouldEnableAutoAdjustMode(6)).toBe(true);
            expect(shouldEnableAutoAdjustMode(10)).toBe(true);
            expect(shouldEnableAutoAdjustMode(20)).toBe(true);
        });

        test('should use custom threshold', () => {
            expect(shouldEnableAutoAdjustMode(3, 2)).toBe(true);
            expect(shouldEnableAutoAdjustMode(3, 5)).toBe(false);
            expect(shouldEnableAutoAdjustMode(10, 10)).toBe(false);
            expect(shouldEnableAutoAdjustMode(11, 10)).toBe(true);
        });

        test('should use default threshold of 5', () => {
            expect(shouldEnableAutoAdjustMode(5)).toBe(false);
            expect(shouldEnableAutoAdjustMode(6)).toBe(true);
        });
    });
});
