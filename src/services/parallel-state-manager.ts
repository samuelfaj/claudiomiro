/**
 * ParallelStateManager - Manages state for parallel task execution
 * Singleton pattern to ensure single source of truth for task states
 */

// Type definitions
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

export class ParallelStateManager implements ParallelStateManagerInterface {
  private static instance: ParallelStateManager | null = null;
  private taskStates: Map<string, TaskState>;
  private uiRendererActive: boolean;

  constructor() {
    if (ParallelStateManager.instance) {
      return ParallelStateManager.instance;
    }

    this.taskStates = new Map<string, TaskState>();
    this.uiRendererActive = false;
    ParallelStateManager.instance = this;
  }

  /**
   * Get the singleton instance of ParallelStateManager
   * @returns {ParallelStateManager} The singleton instance
   */
  static getInstance(): ParallelStateManager {
    if (!ParallelStateManager.instance) {
      ParallelStateManager.instance = new ParallelStateManager();
    }
    return ParallelStateManager.instance;
  }

  /**
   * Initialize the state manager with a list of tasks
   * @param {string[]} tasks - Array of task names
   */
  initialize(tasks: Record<string, TaskConfig> | string[]): void {
    if (!tasks || (typeof tasks !== 'object' && !Array.isArray(tasks))) {
      throw new Error('Tasks must be an array or object');
    }

    this.taskStates.clear();
    this.uiRendererActive = false;

    const entries = Array.isArray(tasks)
      ? tasks.map(taskName => [taskName, null])
      : Object.entries(tasks);

    entries.forEach(([taskName, taskConfig]) => {
      if (!taskName) {
        return;
      }
      const status =
        taskConfig && (taskConfig as TaskConfig).status
          ? (taskConfig as TaskConfig).status
          : 'pending';

      this.taskStates.set(taskName, {
        status: status || 'pending',
        step: null,
        message: null
      });
    });
  }

  /**
   * Update the status of a task
   * @param {string} taskName - Name of the task
   * @param {string} status - New status (pending/running/completed/failed)
   */
  updateTaskStatus(taskName: string, status: TaskStatus): void {
    const validStatuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const taskState = this.taskStates.get(taskName);
    if (!taskState) {
      // Gracefully handle unknown tasks
      console.warn(`Unknown task name: ${taskName}`);
      return;
    }

    taskState.status = status;
  }

  /**
   * Update the current step of a task
   * @param {string} taskName - Name of the task
   * @param {string|null} step - Current step description
   */
  updateTaskStep(taskName: string, step: string | null): void {
    const taskState = this.taskStates.get(taskName);
    if (!taskState) {
      console.warn(`Unknown task name: ${taskName}`);
      return;
    }

    taskState.step = step;
  }

  /**
   * Update the Claude message for a task with truncation
   * @param {string} taskName - Name of the task
   * @param {string|null} message - Claude message (will be truncated to 100 chars)
   */
  updateClaudeMessage(taskName: string, message: string | null): void {
    const taskState = this.taskStates.get(taskName);
    if (!taskState) {
      console.warn(`Unknown task name: ${taskName}`);
      return;
    }

    if (!message) {
      taskState.message = null;
      return;
    }

    // Truncate to 100 characters and add "..." if needed
    if (message.length > 100) {
      taskState.message = message.substring(0, 100) + '...';
    } else {
      taskState.message = message;
    }
  }

  /**
   * Get all task states
   * @returns {Object} Object with task names as keys and state objects as values
   */
  getAllTaskStates(): Record<string, TaskState> {
    const states: Record<string, TaskState> = {};

    this.taskStates.forEach((state, taskName) => {
      states[taskName] = {
        status: state.status,
        step: state.step,
        message: state.message
      };
    });

    return states;
  }

  /**
   * Enable or disable the live UI renderer flag
   * @param {boolean} isActive
   */
  setUIRendererActive(isActive: boolean): void {
    this.uiRendererActive = Boolean(isActive);
  }

  /**
   * Check if the live UI renderer is currently active
   * @returns {boolean}
   */
  isUIRendererActive(): boolean {
    return this.uiRendererActive;
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static reset(): void {
    ParallelStateManager.instance = null;
  }
}

export default ParallelStateManager;