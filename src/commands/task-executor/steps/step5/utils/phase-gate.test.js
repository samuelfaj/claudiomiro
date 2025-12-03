const { enforcePhaseGate, updatePhaseProgress } = require('./phase-gate');

// Mock dependencies
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
}));

describe('phase-gate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('enforcePhaseGate', () => {
        test('should return true for phase 1 (no gate check needed)', () => {
            const execution = {
                currentPhase: { id: 1, name: 'Phase 1' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'pending' },
                ],
            };

            const result = enforcePhaseGate(execution);

            expect(result).toBe(true);
        });

        test('should return true if previous phase is completed', () => {
            const execution = {
                currentPhase: { id: 2, name: 'Phase 2' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed' },
                    { id: 2, name: 'Phase 2', status: 'in_progress' },
                ],
            };

            const result = enforcePhaseGate(execution);

            expect(result).toBe(true);
        });

        test('should return false and reset currentPhase if previous phase is not completed', () => {
            const execution = {
                currentPhase: { id: 3, name: 'Phase 3' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed' },
                    { id: 2, name: 'Phase 2', status: 'in_progress' },
                    { id: 3, name: 'Phase 3', status: 'pending' },
                ],
            };

            const result = enforcePhaseGate(execution);

            expect(result).toBe(false);
            expect(execution.currentPhase.id).toBe(2);
            expect(execution.currentPhase.name).toBe('Phase 2');
        });

        test('should reset to first incomplete phase (not just previous)', () => {
            const execution = {
                currentPhase: { id: 4, name: 'Phase 4' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'pending' }, // This is first incomplete
                    { id: 2, name: 'Phase 2', status: 'pending' },
                    { id: 3, name: 'Phase 3', status: 'pending' },
                    { id: 4, name: 'Phase 4', status: 'pending' },
                ],
            };

            const result = enforcePhaseGate(execution);

            expect(result).toBe(false);
            expect(execution.currentPhase.id).toBe(1);
        });

        test('should handle missing currentPhase', () => {
            const execution = {
                phases: [{ id: 1, name: 'Phase 1', status: 'pending' }],
            };

            const result = enforcePhaseGate(execution);

            expect(result).toBe(true);
        });

        test('should handle empty phases array', () => {
            const execution = {
                currentPhase: { id: 2, name: 'Phase 2' },
                phases: [],
            };

            const result = enforcePhaseGate(execution);

            expect(result).toBe(true);
        });
    });

    describe('updatePhaseProgress', () => {
        test('should update phase status', () => {
            const execution = {
                currentPhase: { id: 1, name: 'Phase 1' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'pending' },
                    { id: 2, name: 'Phase 2', status: 'pending' },
                ],
            };

            updatePhaseProgress(execution, 1, 'completed');

            expect(execution.phases[0].status).toBe('completed');
        });

        test('should update currentPhase when advancing', () => {
            const execution = {
                currentPhase: { id: 1, name: 'Phase 1' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed' },
                    { id: 2, name: 'Phase 2', status: 'pending' },
                ],
            };

            updatePhaseProgress(execution, 2, 'in_progress');

            expect(execution.currentPhase.id).toBe(2);
            expect(execution.currentPhase.name).toBe('Phase 2');
        });

        test('should not update currentPhase when going backwards', () => {
            const execution = {
                currentPhase: { id: 2, name: 'Phase 2' },
                phases: [
                    { id: 1, name: 'Phase 1', status: 'completed' },
                    { id: 2, name: 'Phase 2', status: 'in_progress' },
                ],
            };

            updatePhaseProgress(execution, 1, 'completed');

            expect(execution.currentPhase.id).toBe(2); // Should not change
        });

        test('should handle non-existent phase gracefully', () => {
            const execution = {
                currentPhase: { id: 1, name: 'Phase 1' },
                phases: [{ id: 1, name: 'Phase 1', status: 'pending' }],
            };

            // Should not throw
            updatePhaseProgress(execution, 99, 'completed');

            expect(execution.phases[0].status).toBe('pending'); // Unchanged
        });
    });
});
