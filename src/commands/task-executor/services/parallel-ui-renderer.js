const chalk = require('chalk');
const cliSpinners = require('cli-spinners');
const logger = require('../utils/logger');

/**
 * ParallelUIRenderer - Renders live UI updates for parallel task execution
 */
class ParallelUIRenderer {
  constructor(terminalRenderer) {
    if (!terminalRenderer) {
      throw new Error('TerminalRenderer is required');
    }

    this.terminalRenderer = terminalRenderer;
    this.renderInterval = null;
    this.frameCounter = 0;

    // Spinner types to cycle through
    this.spinnerTypes = ['dots', 'line', 'arrow', 'bouncingBar'];
    this.stepOrder = ['step 2', 'step 3', 'step 3.1', 'step 4'];
  }

  /**
   * Normalize text for single-line display
   * @param {string|null|undefined} value - Raw text value
   * @returns {string} Sanitized single-line text
   */
  sanitizeText(value) {
    if (!value) {
      return '';
    }

    return value
      .toString()
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get the current frame of a spinner
   * @param {string} spinnerType - Type of spinner (dots, line, arrow, bouncingBar)
   * @returns {string} Current frame character
   */
  getSpinnerFrame(spinnerType) {
    const spinner = cliSpinners[spinnerType] || cliSpinners.dots;
    const frameIndex = this.frameCounter % spinner.frames.length;
    return spinner.frames[frameIndex];
  }

  /**
   * Get color for task status
   * @param {string} status - Task status (pending/running/completed/failed)
   * @returns {Function} Chalk color function
   */
  getColorForStatus(status) {
    switch (status) {
      case 'completed':
        return chalk.green;
      case 'running':
        return chalk.yellow;
      case 'failed':
        return chalk.red;
      case 'pending':
      default:
        return chalk.gray;
    }
  }

  /**
   * Render a single task line
   * @param {string} taskName - Name of the task
   * @param {Object} taskState - Task state object {status, step, message}
   * @param {number} taskIndex - Index of the task (for spinner variety)
   * @returns {string} Formatted task line
   */
  renderTaskLine(taskName, taskState, taskIndex) {
    const status = taskState.status || 'pending';
    const lowerStatus = status.toLowerCase();
    const isCompleted = lowerStatus === 'completed';
    const isFailed = lowerStatus === 'failed';
    let step = this.sanitizeText(taskState.step);
    let message = this.sanitizeText(taskState.message);

    if (isCompleted) {
      step = 'Done';
      message = '';
    } else if (isFailed) {
      step = 'Failed';
    }

    // Use different spinner for each task
    const spinnerType = this.spinnerTypes[taskIndex % this.spinnerTypes.length];
    const spinner = status === 'running' ? this.getSpinnerFrame(spinnerType) : ' ';

    // Apply color based on status
    const colorFn = this.getColorForStatus(status);

    // Format the line
    const displayName = this.sanitizeText(taskName) || 'Task';
    let line = `${spinner} ${displayName}`;
    if (step) {
      line += `: ${step}`;
    }
    if (message) {
      line += ` - ${message}`;
    }

    return colorFn(line);
  }

  /**
   * Truncate a line to fit terminal width
   * @param {string} line - Line to truncate
   * @param {number} maxWidth - Maximum width
   * @returns {string} Truncated line
   */
  truncateLine(line, maxWidth) {
    // Remove ANSI codes for length calculation
    const plainText = line.replace(/\x1b\[[0-9;]*m/g, '');

    if (plainText.length <= maxWidth) {
      return line;
    }

    // Truncate the plain text and reconstruct with same color codes
    const truncated = plainText.substring(0, maxWidth - 3) + '...';

    // Extract color codes from original line
    const colorMatch = line.match(/^(\x1b\[[0-9;]*m)+/);
    const colorPrefix = colorMatch ? colorMatch[0] : '';
    const colorSuffix = '\x1b[0m';

    return colorPrefix + truncated + colorSuffix;
  }

  /**
   * Render a complete frame with header and all task lines
   * @param {Object} taskStates - Object mapping task names to state objects
   * @param {number} totalProgress - Total progress percentage (0-100)
   * @returns {string[]} Array of formatted lines
   */
  renderFrame(taskStates, totalProgress) {
    const lines = [];
    const terminalWidth = this.terminalRenderer.getTerminalWidth();
    const computedProgress = this.calculateTotalProgress(taskStates);

    // Render header
    const header = `${chalk.bold.white('Total Complete:')} ${chalk.cyan(computedProgress + '%')}`;
    lines.push(this.truncateLine(header, terminalWidth));

    // Render task lines
    if (taskStates && typeof taskStates === 'object') {
      const taskNames = Object.keys(taskStates).sort((a, b) => {
        // Extract numbers from task names (e.g., "TASK10" -> 10)
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });
      if (taskNames.length > 0) {
        lines.push('');
      }
      taskNames.forEach((taskName, index) => {
        const taskState = taskStates[taskName];
        const taskLine = this.renderTaskLine(taskName, taskState, index);
        lines.push(this.truncateLine(taskLine, terminalWidth));
      });
    }

    return lines;
  }

  /**
   * Determine how many workflow steps are completed for a task
   * @param {Object} taskState
   * @returns {number}
   */
  getCompletedStepCount(taskState) {
    if (!taskState) {
      return 0;
    }

    const status = this.sanitizeText(taskState.status).toLowerCase();
    if (status === 'completed') {
      return this.stepOrder.length;
    }

    const stepText = this.sanitizeText(taskState.step).toLowerCase();
    if (!stepText) {
      return status === 'failed' ? this.stepOrder.length : 0;
    }

    if (stepText.startsWith('done')) {
      return this.stepOrder.length;
    }

    for (let i = this.stepOrder.length - 1; i >= 0; i--) {
      const prefix = this.stepOrder[i];
      if (stepText.startsWith(prefix)) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Calculate total progress percentage based on completed steps
   * @param {Object} taskStates
   * @returns {number}
   */
  calculateTotalProgress(taskStates) {
    if (!taskStates || typeof taskStates !== 'object') {
      return 0;
    }

    const taskNames = Object.keys(taskStates);
    if (taskNames.length === 0) {
      return 0;
    }

    const totalSteps = taskNames.length * this.stepOrder.length;
    const completedSteps = taskNames.reduce((acc, taskName) => {
      return acc + this.getCompletedStepCount(taskStates[taskName]);
    }, 0);

    if (totalSteps === 0) {
      return 0;
    }

    return Math.round((completedSteps / totalSteps) * 100);
  }

  /**
   * Start the live rendering loop
   * @param {Object} stateManager - ParallelStateManager instance
   * @param {Object} progressCalculator - Progress calculator module
   */
  start(stateManager, progressCalculator) {
    if (!stateManager || !progressCalculator) {
      throw new Error('StateManager and ProgressCalculator are required');
    }

    this.stateManager = stateManager;
    this.progressCalculator = progressCalculator;
    if (typeof this.stateManager.setUIRendererActive === 'function') {
      this.stateManager.setUIRendererActive(true);
    }

    if (logger && typeof logger.stopSpinner === 'function') {
      logger.stopSpinner();
    }

    // Hide cursor for cleaner rendering
    this.terminalRenderer.hideCursor();

    // Start render loop at 200ms intervals
    this.renderInterval = setInterval(() => {
      this.frameCounter++;

      const taskStates = this.stateManager.getAllTaskStates();
      const totalProgress = this.progressCalculator.calculateProgress(taskStates);

      const lines = this.renderFrame(taskStates, totalProgress);
      this.terminalRenderer.renderBlock(lines);
    }, 200);
  }

  /**
   * Stop the rendering loop and render final static frame
   */
  stop() {
    // Clear the interval
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }

    // Render final static frame (no animation)
    if (this.stateManager && this.progressCalculator) {
      const taskStates = this.stateManager.getAllTaskStates();
      const totalProgress = this.progressCalculator.calculateProgress(taskStates);
      const lines = this.renderFrame(taskStates, totalProgress);
      this.terminalRenderer.renderBlock(lines);
    }

    if (this.stateManager && typeof this.stateManager.setUIRendererActive === 'function') {
      this.stateManager.setUIRendererActive(false);
    }

    // Show cursor again
    this.terminalRenderer.showCursor();
  }
}

module.exports = ParallelUIRenderer;
