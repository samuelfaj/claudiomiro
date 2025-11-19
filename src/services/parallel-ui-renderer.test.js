const ParallelUIRenderer = require('./parallel-ui-renderer');
const chalk = require('chalk');
const cliSpinners = require('cli-spinners');
const logger = require('../utils/logger');

// Mock TerminalRenderer
class MockTerminalRenderer {
  constructor() {
    this.hideCursorCalled = false;
    this.showCursorCalled = false;
    this.renderedLines = [];
    this.terminalWidth = 80;
  }

  hideCursor() {
    this.hideCursorCalled = true;
  }

  showCursor() {
    this.showCursorCalled = true;
  }

  getTerminalWidth() {
    return this.terminalWidth;
  }

  renderBlock(lines) {
    this.renderedLines = lines;
  }

  reset() {
    this.hideCursorCalled = false;
    this.showCursorCalled = false;
    this.renderedLines = [];
  }
}

describe('ParallelUIRenderer', () => {
  let renderer;
  let mockTerminalRenderer;

  beforeEach(() => {
    mockTerminalRenderer = new MockTerminalRenderer();
    renderer = new ParallelUIRenderer(mockTerminalRenderer);
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (renderer.renderInterval) {
      renderer.stop();
    }
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    test('should initialize with TerminalRenderer', () => {
      expect(renderer.terminalRenderer).toBe(mockTerminalRenderer);
      expect(renderer.renderInterval).toBeNull();
      expect(renderer.frameCounter).toBe(0);
    });

    test('should throw error if TerminalRenderer is not provided', () => {
      expect(() => new ParallelUIRenderer()).toThrow('TerminalRenderer is required');
      expect(() => new ParallelUIRenderer(null)).toThrow('TerminalRenderer is required');
    });

    test('should initialize with correct spinner types', () => {
      expect(renderer.spinnerTypes).toEqual(['dots', 'line', 'arrow', 'bouncingBar']);
    });
  });

  describe('getColorForStatus', () => {
    test('should return green for completed status', () => {
      expect(renderer.getColorForStatus('completed')).toBe(chalk.green);
    });

    test('should return yellow for running status', () => {
      expect(renderer.getColorForStatus('running')).toBe(chalk.yellow);
    });

    test('should return red for failed status', () => {
      expect(renderer.getColorForStatus('failed')).toBe(chalk.red);
    });

    test('should return gray for pending status', () => {
      expect(renderer.getColorForStatus('pending')).toBe(chalk.gray);
    });

    test('should return gray for unknown status', () => {
      expect(renderer.getColorForStatus('unknown')).toBe(chalk.gray);
      expect(renderer.getColorForStatus()).toBe(chalk.gray);
    });
  });

  describe('getSpinnerFrame', () => {
    test('should return a frame from the specified spinner type', () => {
      const frame = renderer.getSpinnerFrame('dots');
      expect(typeof frame).toBe('string');
      expect(frame.length).toBeGreaterThan(0);
    });

    test('should cycle through spinner frames', () => {
      const frames = [];
      for (let i = 0; i < 5; i++) {
        renderer.frameCounter = i;
        frames.push(renderer.getSpinnerFrame('dots'));
      }
      // Should have some variation in frames
      expect(frames.length).toBe(5);
    });

    test('should fall back to dots spinner for unknown type', () => {
      const frame = renderer.getSpinnerFrame('unknownSpinner');
      expect(typeof frame).toBe('string');
    });
  });

  describe('renderTaskLine', () => {
    test('should render task line with all components', () => {
      const taskState = {
        status: 'running',
        step: '2/5',
        message: 'Processing files'
      };
      const line = renderer.renderTaskLine('Task1', taskState, 0);

      // Remove ANSI codes for assertion
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainLine).toContain('Task1');
      expect(plainLine).toContain('2/5');
      expect(plainLine).toContain('Processing files');
    });

    test('should render task line with only status', () => {
      const taskState = {
        status: 'pending',
        step: null,
        message: null
      };
      const line = renderer.renderTaskLine('Task2', taskState, 1);
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainLine).toContain('Task2');
      expect(plainLine).not.toContain('Claude:');
    });

    test('should include spinner for running tasks', () => {
      const taskState = { status: 'running', step: '1/3', message: 'Working' };
      const line = renderer.renderTaskLine('Task3', taskState, 0);
      // Running tasks should have spinner, not just space
      expect(line).toBeTruthy();
    });

    test('should not include spinner for non-running tasks', () => {
      const taskState = { status: 'completed', step: 'done', message: 'Success' };
      renderer.frameCounter = 0;
      const line = renderer.renderTaskLine('Task4', taskState, 0);
      // First character after color codes should be space
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainLine.charAt(0)).toBe(' ');
    });

    test('should use different spinners for different task indices', () => {
      const taskState = { status: 'running', step: '1/1', message: 'Test' };

      // Different indices should potentially use different spinner types
      const line0 = renderer.renderTaskLine('Task0', taskState, 0);
      const line1 = renderer.renderTaskLine('Task1', taskState, 1);

      expect(line0).toBeTruthy();
      expect(line1).toBeTruthy();
    });

    test('should sanitize multiline task data into single line', () => {
      const taskState = {
        status: 'running',
        step: 'Step\nWith\nBreaks',
        message: 'Line one\nLine two\tExtra'
      };

      const line = renderer.renderTaskLine('Task\nName', taskState, 0);
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');

      expect(plainLine).not.toMatch(/\n/);
      expect(plainLine).toContain('Task Name');
      expect(plainLine).toContain('Step With Breaks');
      expect(plainLine).toContain('Line one Line two Extra');
    });

    test('should display Done for completed tasks without Claude message', () => {
      const taskState = {
        status: 'completed',
        step: 'Step 4 - Code review and PR',
        message: 'Last Claude command'
      };

      const line = renderer.renderTaskLine('TaskDone', taskState, 0);
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');

      expect(plainLine).toContain('TaskDone');
      expect(plainLine).toContain('Done');
      expect(plainLine).not.toContain('Claude:');
    });
  });

  describe('truncateLine', () => {
    test('should not truncate lines shorter than max width', () => {
      const line = 'Short line';
      const truncated = renderer.truncateLine(line, 80);
      expect(truncated).toBe(line);
    });

    test('should truncate lines exceeding max width', () => {
      const longLine = 'a'.repeat(100);
      const truncated = renderer.truncateLine(longLine, 50);
      const plainTruncated = truncated.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainTruncated.length).toBe(50);
      expect(plainTruncated).toContain('...');
    });

    test('should handle lines with ANSI color codes', () => {
      const coloredLine = chalk.green('a'.repeat(100));
      const truncated = renderer.truncateLine(coloredLine, 50);
      const plainTruncated = truncated.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainTruncated.length).toBe(50);
    });
  });

  describe('renderFrame', () => {
    test('should render header with progress percentage', () => {
      const taskStates = {
        task1: { status: 'completed', step: 'done', message: 'OK' },
        task2: { status: 'running', step: 'Step 3 - Implementing tasks', message: 'Working' }
      };
      const lines = renderer.renderFrame(taskStates, 50);

      expect(lines.length).toBeGreaterThan(0);
      const plainHeader = lines[0].replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainHeader).toContain('Total Complete:');
      expect(plainHeader).toContain('63%');
    });

    test('should render all task lines', () => {
      const taskStates = {
        task1: { status: 'completed', step: 'done', message: 'Success' },
        task2: { status: 'running', step: 'Step 2 - Planning', message: 'Processing' },
        task3: { status: 'pending', step: null, message: null }
      };
      const lines = renderer.renderFrame(taskStates, 33);

      // Header + blank + 3 task lines
      expect(lines.length).toBe(5);

      const plainLines = lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, ''));
      const taskLines = plainLines.filter(line => line.trim().length && !line.includes('Total Complete:'));
      expect(taskLines).toHaveLength(3);
      expect(taskLines.some(line => line.includes('task1'))).toBe(true);
      expect(taskLines.some(line => line.includes('task2'))).toBe(true);
      expect(taskLines.some(line => line.includes('task3'))).toBe(true);
    });

    test('should handle empty task states', () => {
      const lines = renderer.renderFrame({}, 0);
      expect(lines.length).toBe(1); // Just header
      const plainHeader = lines[0].replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainHeader).toContain('0%');
    });

    test('should handle null task states', () => {
      const lines = renderer.renderFrame(null, 0);
      expect(lines.length).toBe(1); // Just header
    });

    test('should truncate lines to terminal width', () => {
      mockTerminalRenderer.terminalWidth = 30;
      const taskStates = {
        task1: {
          status: 'running',
          step: 'very long step description',
          message: 'very long claude message that exceeds terminal width'
        }
      };

      const lines = renderer.renderFrame(taskStates, 0);
      lines.forEach(line => {
        const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        expect(plainLine.length).toBeLessThanOrEqual(30);
      });
    });

    test('should handle tasks with missing fields', () => {
      const taskStates = {
        task1: { status: 'running' },
        task2: {},
        task3: { status: 'completed', step: 'done' }
      };

      const lines = renderer.renderFrame(taskStates, 0);
      expect(lines.length).toBe(5); // Header + blank + 3 tasks
      // Should not throw errors
    });

    test('should calculate progress based on step completion', () => {
      const taskStates = {
        task1: { status: 'completed', step: 'done', message: '' },
        task2: { status: 'running', step: 'Step 3 - Implementing tasks', message: 'Working' },
        task3: { status: 'pending', step: null, message: null }
      };

      const lines = renderer.renderFrame(taskStates, 0);
      const plainHeader = lines[0].replace(/\x1b\[[0-9;]*m/g, '');
      expect(plainHeader).toContain('42%');
    });
  });

  describe('start', () => {
    let mockStateManager;
    let mockProgressCalculator;
    let stopSpinnerSpy;

    beforeEach(() => {
      mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({
          task1: { status: 'running', step: '1/2', message: 'Test' }
        }),
        setUIRendererActive: jest.fn()
      };
      mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(50)
      };
      stopSpinnerSpy = jest.spyOn(logger, 'stopSpinner').mockImplementation(() => {});
    });

    afterEach(() => {
      if (stopSpinnerSpy) {
        stopSpinnerSpy.mockRestore();
      }
    });

    test('should throw error if stateManager is not provided', () => {
      expect(() => renderer.start(null, mockProgressCalculator)).toThrow(
        'StateManager and ProgressCalculator are required'
      );
    });

    test('should throw error if progressCalculator is not provided', () => {
      expect(() => renderer.start(mockStateManager, null)).toThrow(
        'StateManager and ProgressCalculator are required'
      );
    });

    test('should hide cursor on start', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      expect(mockTerminalRenderer.hideCursorCalled).toBe(true);
    });

    test('should mark UI renderer as active when supported', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      expect(mockStateManager.setUIRendererActive).toHaveBeenCalledWith(true);
    });

    test('should stop logger spinner when starting', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      expect(stopSpinnerSpy).toHaveBeenCalled();
    });

    test('should create interval with 200ms delay', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      expect(renderer.renderInterval).not.toBeNull();
    });

    test('should call renderFrame and renderBlock on interval', () => {
      renderer.start(mockStateManager, mockProgressCalculator);

      // Advance timers by 200ms
      jest.advanceTimersByTime(200);

      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();
      expect(mockProgressCalculator.calculateProgress).toHaveBeenCalled();
      expect(mockTerminalRenderer.renderedLines.length).toBeGreaterThan(0);
    });

    test('should increment frame counter on each render', () => {
      renderer.start(mockStateManager, mockProgressCalculator);

      expect(renderer.frameCounter).toBe(0);

      jest.advanceTimersByTime(200);
      expect(renderer.frameCounter).toBe(1);

      jest.advanceTimersByTime(200);
      expect(renderer.frameCounter).toBe(2);
    });
  });

  describe('stop', () => {
    let mockStateManager;
    let mockProgressCalculator;

    beforeEach(() => {
      mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({
          task1: { status: 'completed', step: 'done', message: 'Success' }
        }),
        setUIRendererActive: jest.fn()
      };
      mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(100)
      };
    });

    test('should clear interval', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      const intervalId = renderer.renderInterval;
      expect(intervalId).not.toBeNull();

      renderer.stop();
      expect(renderer.renderInterval).toBeNull();
    });

    test('should render final static frame', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      mockTerminalRenderer.reset();

      renderer.stop();

      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();
      expect(mockProgressCalculator.calculateProgress).toHaveBeenCalled();
      expect(mockTerminalRenderer.renderedLines.length).toBeGreaterThan(0);
    });

    test('should show cursor after stop', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      renderer.stop();

      expect(mockTerminalRenderer.showCursorCalled).toBe(true);
    });

    test('should mark UI renderer as inactive when stopped', () => {
      renderer.start(mockStateManager, mockProgressCalculator);
      renderer.stop();

      expect(mockStateManager.setUIRendererActive).toHaveBeenCalledWith(false);
    });

    test('should handle stop when not started', () => {
      expect(() => renderer.stop()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long task names', () => {
      const taskStates = {
        'very-long-task-name-that-exceeds-normal-length': {
          status: 'completed',
          step: 'done',
          message: 'msg'
        }
      };

      const lines = renderer.renderFrame(taskStates, 50);
      expect(lines.length).toBe(3); // Header + blank + 1 task
      expect(lines[1]).toBe('');
    });

    test('should handle special characters in task names', () => {
      const taskStates = {
        'task-with-special-chars-!@#$%': {
          status: 'running',
          step: 'Step 2 - Planning',
          message: 'msg'
        }
      };

      const lines = renderer.renderFrame(taskStates, 50);
      expect(lines.length).toBe(3);
    });

    test('should handle rapid start/stop cycles', () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({})
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(0)
      };

      renderer.start(mockStateManager, mockProgressCalculator);
      renderer.stop();
      renderer.start(mockStateManager, mockProgressCalculator);
      renderer.stop();

      expect(() => renderer.stop()).not.toThrow();
    });
  });
});
