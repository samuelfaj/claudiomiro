/**
 * Task state interface representing the structure of task state objects
 */
export interface TaskState {
    status?: string | undefined;
    step?: string | undefined;
    message?: string | undefined;
}
/**
 * Progress calculator for tracking task completion across parallel workflows
 */
export declare class ProgressCalculator {
    private static readonly STEP_SEQUENCE;
    /**
     * Normalize a string value to lowercase for consistent comparison
     * @param value - The value to normalize
     * @returns Normalized string value
     */
    private static normalize;
    /**
     * Count completed steps for a single task state
     * @param state - The task state object
     * @returns Number of completed steps (0 to STEP_SEQUENCE.length)
     */
    private static countCompletedSteps;
    /**
     * Calculate the total progress percentage across all parallel tasks
     * @param taskStates - Object mapping task names to state objects
     * @returns Integer percentage (0-100) representing completed steps
     */
    static calculateProgress(taskStates: Record<string, TaskState>): number;
}
//# sourceMappingURL=progress-calculator.d.ts.map