import { TerminalRenderer } from '../utils/terminal-renderer';
import { ParallelStateManager, TaskState } from './parallel-state-manager';
export interface ProgressCalculatorInterface {
    calculateProgress(taskStates: Record<string, TaskState>): number;
}
export declare class ParallelUIRenderer {
    private terminalRenderer;
    private renderInterval;
    private frameCounter;
    private spinnerTypes;
    private stepOrder;
    private stateManager;
    private progressCalculator;
    constructor(terminalRenderer: TerminalRenderer);
    /**
     * Normalize text for single-line display
     * @param {string|null|undefined} value - Raw text value
     * @returns {string} Sanitized single-line text
     */
    sanitizeText(value: string | null | undefined): string;
    /**
     * Get the current frame of a spinner
     * @param {string} spinnerType - Type of spinner (dots, line, arrow, bouncingBar)
     * @returns {string} Current frame character
     */
    getSpinnerFrame(spinnerType: string): string;
    /**
     * Get color for task status
     * @param {string} status - Task status (pending/running/completed/failed)
     * @returns {Function} Chalk color function
     */
    getColorForStatus(status: string): (text: string) => string;
    /**
     * Render a single task line
     * @param {string} taskName - Name of the task
     * @param {Object} taskState - Task state object {status, step, message}
     * @param {number} taskIndex - Index of the task (for spinner variety)
     * @returns {string} Formatted task line
     */
    renderTaskLine(taskName: string, taskState: TaskState, taskIndex: number): string;
    /**
     * Truncate a line to fit terminal width
     * @param {string} line - Line to truncate
     * @param {number} maxWidth - Maximum width
     * @returns {string} Truncated line
     */
    truncateLine(line: string, maxWidth: number): string;
    /**
     * Render a complete frame with header and all task lines
     * @param {Object} taskStates - Object mapping task names to state objects
     * @param {number} totalProgress - Total progress percentage (0-100)
     * @returns {string[]} Array of formatted lines
     */
    renderFrame(taskStates: Record<string, TaskState>): string[];
    /**
     * Determine how many workflow steps are completed for a task
     * @param {Object} taskState
     * @returns {number}
     */
    getCompletedStepCount(taskState: TaskState): number;
    /**
     * Calculate total progress percentage based on completed steps
     * @param {Object} taskStates
     * @returns {number}
     */
    calculateTotalProgress(taskStates: Record<string, TaskState>): number;
    /**
     * Start the live rendering loop
     * @param {Object} stateManager - ParallelStateManager instance
     * @param {Object} progressCalculator - Progress calculator module
     */
    start(stateManager: ParallelStateManager, progressCalculator: ProgressCalculatorInterface): void;
    /**
     * Stop the rendering loop and render final static frame
     */
    stop(): void;
}
export default ParallelUIRenderer;
//# sourceMappingURL=parallel-ui-renderer.d.ts.map