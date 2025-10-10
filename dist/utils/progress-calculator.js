"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressCalculator = void 0;
/**
 * Progress calculator for tracking task completion across parallel workflows
 */
class ProgressCalculator {
    /**
     * Normalize a string value to lowercase for consistent comparison
     * @param value - The value to normalize
     * @returns Normalized string value
     */
    static normalize(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return value.toString().toLowerCase();
    }
    /**
     * Count completed steps for a single task state
     * @param state - The task state object
     * @returns Number of completed steps (0 to STEP_SEQUENCE.length)
     */
    static countCompletedSteps(state) {
        if (!state) {
            return 0;
        }
        const normalizedStatus = ProgressCalculator.normalize(state.status);
        if (normalizedStatus === 'completed') {
            return ProgressCalculator.STEP_SEQUENCE.length;
        }
        const normalizedStep = ProgressCalculator.normalize(state.step);
        if (normalizedStep === '') {
            return normalizedStatus === 'failed' ? ProgressCalculator.STEP_SEQUENCE.length : 0;
        }
        if (normalizedStep.startsWith('done')) {
            return ProgressCalculator.STEP_SEQUENCE.length;
        }
        for (let i = ProgressCalculator.STEP_SEQUENCE.length - 1; i >= 0; i--) {
            const prefix = ProgressCalculator.STEP_SEQUENCE[i];
            if (normalizedStep.startsWith(prefix)) {
                return i;
            }
        }
        return 0;
    }
    /**
     * Calculate the total progress percentage across all parallel tasks
     * @param taskStates - Object mapping task names to state objects
     * @returns Integer percentage (0-100) representing completed steps
     */
    static calculateProgress(taskStates) {
        if (!taskStates || typeof taskStates !== 'object') {
            return 0;
        }
        const taskNames = Object.keys(taskStates);
        const totalTasks = taskNames.length;
        if (totalTasks === 0) {
            return 0;
        }
        const totalSteps = totalTasks * ProgressCalculator.STEP_SEQUENCE.length;
        if (totalSteps === 0) {
            return 0;
        }
        const completedSteps = taskNames.reduce((sum, taskName) => {
            const state = taskStates[taskName];
            return sum + ProgressCalculator.countCompletedSteps(state);
        }, 0);
        return Math.round((completedSteps / totalSteps) * 100);
    }
}
exports.ProgressCalculator = ProgressCalculator;
ProgressCalculator.STEP_SEQUENCE = ['step 2', 'step 3', 'step 4'];
//# sourceMappingURL=progress-calculator.js.map