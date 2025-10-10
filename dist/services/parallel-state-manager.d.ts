/**
 * ParallelStateManager - Manages state for parallel task execution
 * Singleton pattern to ensure single source of truth for task states
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export interface TaskState {
    status: TaskStatus;
    step: string | null;
    message: string | null;
}
export interface TaskConfig {
    status?: TaskStatus;
    deps?: string[];
}
export interface ParallelStateManagerInterface {
    initialize(tasks: Record<string, TaskConfig> | string[]): void;
    updateTaskStatus(taskName: string, status: TaskStatus): void;
    updateTaskStep(taskName: string, step: string | null): void;
    updateClaudeMessage(taskName: string, message: string | null): void;
    getAllTaskStates(): Record<string, TaskState>;
    setUIRendererActive(isActive: boolean): void;
    isUIRendererActive(): boolean;
}
export declare class ParallelStateManager implements ParallelStateManagerInterface {
    private static instance;
    private taskStates;
    private uiRendererActive;
    constructor();
    /**
     * Get the singleton instance of ParallelStateManager
     * @returns {ParallelStateManager} The singleton instance
     */
    static getInstance(): ParallelStateManager;
    /**
     * Initialize the state manager with a list of tasks
     * @param {string[]} tasks - Array of task names
     */
    initialize(tasks: Record<string, TaskConfig> | string[]): void;
    /**
     * Update the status of a task
     * @param {string} taskName - Name of the task
     * @param {string} status - New status (pending/running/completed/failed)
     */
    updateTaskStatus(taskName: string, status: TaskStatus): void;
    /**
     * Update the current step of a task
     * @param {string} taskName - Name of the task
     * @param {string|null} step - Current step description
     */
    updateTaskStep(taskName: string, step: string | null): void;
    /**
     * Update the Claude message for a task with truncation
     * @param {string} taskName - Name of the task
     * @param {string|null} message - Claude message (will be truncated to 100 chars)
     */
    updateClaudeMessage(taskName: string, message: string | null): void;
    /**
     * Get all task states
     * @returns {Object} Object with task names as keys and state objects as values
     */
    getAllTaskStates(): Record<string, TaskState>;
    /**
     * Enable or disable the live UI renderer flag
     * @param {boolean} isActive
     */
    setUIRendererActive(isActive: boolean): void;
    /**
     * Check if the live UI renderer is currently active
     * @returns {boolean}
     */
    isUIRendererActive(): boolean;
    /**
     * Reset the singleton instance (mainly for testing)
     */
    static reset(): void;
}
export default ParallelStateManager;
//# sourceMappingURL=parallel-state-manager.d.ts.map