/**
 * ParallelStateManager - Manages state for parallel task execution
 * Singleton pattern to ensure single source of truth for task states
 */
class ParallelStateManager {
  constructor() {
    if (ParallelStateManager.instance) {
      return ParallelStateManager.instance;
    }

    this.taskStates = new Map();
    this.uiRendererActive = false;
    ParallelStateManager.instance = this;
  }

  /**
   * Get the singleton instance of ParallelStateManager
   * @returns {ParallelStateManager} The singleton instance
   */
  static getInstance() {
    if (!ParallelStateManager.instance) {
      ParallelStateManager.instance = new ParallelStateManager();
    }
    return ParallelStateManager.instance;
  }

  /**
   * Initialize the state manager with a list of tasks
   * @param {string[]} tasks - Array of task names
   */
  initialize(tasks) {
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
        taskConfig && taskConfig.status
          ? taskConfig.status
          : 'pending';

      this.taskStates.set(taskName, {
        status,
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
  updateTaskStatus(taskName, status) {
    const validStatuses = ['pending', 'running', 'completed', 'failed'];

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
  updateTaskStep(taskName, step) {
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
  updateClaudeMessage(taskName, message) {
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
  getAllTaskStates() {
    const states = {};

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
  setUIRendererActive(isActive) {
    this.uiRendererActive = Boolean(isActive);
  }

  /**
   * Check if the live UI renderer is currently active
   * @returns {boolean}
   */
  isUIRendererActive() {
    return this.uiRendererActive;
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static reset() {
    ParallelStateManager.instance = null;
  }
}

module.exports = ParallelStateManager;
module.exports.ParallelStateManager = ParallelStateManager;
