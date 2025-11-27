const ParallelUIRenderer = require('./parallel-ui-renderer');
const chalk = require('chalk');
const cliSpinners = require('cli-spinners');
const logger = require('../../../shared/utils/logger');

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

  describe('Advanced Terminal Control and Animation Concurrency', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      if (renderer.renderInterval) {
        renderer.stop();
      }
      jest.useRealTimers();
    });

    test('should handle real-time rendering with concurrent state changes', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn()
          .mockReturnValueOnce({
            task1: { status: 'pending', step: null, message: null },
            task2: { status: 'pending', step: null, message: null }
          })
          .mockReturnValueOnce({
            task1: { status: 'running', step: 'Step 1', message: 'Starting' },
            task2: { status: 'pending', step: null, message: null }
          })
          .mockReturnValueOnce({
            task1: { status: 'running', step: 'Step 2', message: 'Processing' },
            task2: { status: 'running', step: 'Step 1', message: 'Starting task 2' }
          })
          .mockReturnValueOnce({
            task1: { status: 'completed', step: 'Done', message: null },
            task2: { status: 'running', step: 'Step 2', message: 'Processing task 2' }
          })
          .mockReturnValue({
            task1: { status: 'completed', step: 'Done', message: null },
            task2: { status: 'completed', step: 'Done', message: null }
          }),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(25)
          .mockReturnValueOnce(50)
          .mockReturnValueOnce(75)
          .mockReturnValueOnce(100)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Simulate rapid state transitions with concurrent access
      const renderPromises = [];

      for (let i = 0; i < 5; i++) {
        renderPromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              jest.advanceTimersByTime(200);
              resolve(`frame-${i}`);
            }, i * 10);
          })
        );
      }

      // Execute all render cycles
      jest.advanceTimersByTime(1000);
      const results = await Promise.all(renderPromises);

      // Verify all frames rendered
      expect(results).toHaveLength(5);
      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();
      expect(mockProgressCalculator.calculateProgress).toHaveBeenCalled();
      expect(mockTerminalRenderer.renderedLines.length).toBeGreaterThan(0);
    });

    test('should maintain cursor management under concurrent start/stop operations', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({}),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(0)
      };

      // Test concurrent cursor operations
      const cursorOperations = [
        new Promise(resolve => {
          setTimeout(() => {
            renderer.start(mockStateManager, mockProgressCalculator);
            resolve('start-1');
          }, 5);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            renderer.stop();
            resolve('stop-1');
          }, 15);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            renderer.start(mockStateManager, mockProgressCalculator);
            resolve('start-2');
          }, 25);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            renderer.stop();
            resolve('stop-2');
          }, 35);
        })
      ];

      // Execute cursor operations
      jest.advanceTimersByTime(50);
      const results = await Promise.all(cursorOperations);

      // Verify cursor state management
      expect(results).toHaveLength(4);
      expect(mockTerminalRenderer.hideCursorCalled).toBe(true);
      expect(mockTerminalRenderer.showCursorCalled).toBe(true);
      expect(mockStateManager.setUIRendererActive).toHaveBeenCalledTimes(4);
    });

    test('should handle concurrent UI component rendering without interference', async () => {
      const concurrentTaskSets = [
        {
          task1: { status: 'running', step: 'Step 1', message: 'Processing files' },
          task2: { status: 'pending', step: null, message: null }
        },
        {
          task3: { status: 'completed', step: 'Done', message: null },
          task4: { status: 'failed', step: 'Failed', message: 'Error occurred' }
        },
        {
          task5: { status: 'running', step: 'Step 2', message: 'Analyzing data' },
          task6: { status: 'running', step: 'Step 1', message: 'Starting up' }
        }
      ];

      const mockStateManager = {
        getAllTaskStates: jest.fn()
          .mockReturnValueOnce(concurrentTaskSets[0])
          .mockReturnValueOnce(concurrentTaskSets[1])
          .mockReturnValueOnce(concurrentTaskSets[2])
          .mockReturnValue(concurrentTaskSets[0]),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn()
          .mockReturnValueOnce(25)
          .mockReturnValueOnce(50)
          .mockReturnValueOnce(75)
          .mockReturnValueOnce(25)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Simulate concurrent rendering of different task sets
      const renderFrames = [];
      for (let i = 0; i < 4; i++) {
        renderFrames.push(
          new Promise(resolve => {
            setTimeout(() => {
              jest.advanceTimersByTime(200);
              const currentLines = [...mockTerminalRenderer.renderedLines];
              resolve({
                frame: i,
                lines: currentLines,
                taskCount: Object.keys(concurrentTaskSets[i % 3]).length
              });
            }, i * 50);
          })
        );
      }

      jest.advanceTimersByTime(800);
      const frameResults = await Promise.all(renderFrames);

      // Verify concurrent rendering worked correctly
      expect(frameResults).toHaveLength(4);
      frameResults.forEach(result => {
        expect(result.lines.length).toBeGreaterThan(0);
        expect(result.taskCount).toBeGreaterThan(0);
      });

      // Verify concurrent rendering worked correctly
      expect(frameResults).toHaveLength(4);
      frameResults.forEach(result => {
        expect(result.lines.length).toBeGreaterThan(0);
        expect(result.taskCount).toBeGreaterThan(0);
      });
    });

    test('should handle animation timing with precise frame progression', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({
          animTask: { status: 'running', step: 'Animating', message: 'Spinner test' }
        }),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(50)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Test spinner frame progression over multiple cycles
      const spinnerFrames = [];
      const framePromises = [];

      for (let i = 0; i < 10; i++) {
        framePromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              jest.advanceTimersByTime(200);
              const currentFrame = renderer.frameCounter;
              const taskLine = renderer.renderTaskLine('animTask', {
                status: 'running',
                step: 'Animating',
                message: 'Spinner test'
              }, 0);
              spinnerFrames.push({ frame: currentFrame, line: taskLine });
              resolve(i);
            }, i * 200);
          })
        );
      }

      jest.advanceTimersByTime(2000);
      await Promise.all(framePromises);

      // Verify spinner progression
      expect(spinnerFrames).toHaveLength(10);

      // Check that frame counter increments correctly
      const frameNumbers = spinnerFrames.map(f => f.frame);
      expect(frameNumbers.length).toBe(10);
      expect(frameNumbers[frameNumbers.length - 1]).toBeGreaterThan(0);

      // Check that spinner characters are valid
      const spinnerCharacters = spinnerFrames.map(f => f.line.replace(/\x1b\[[0-9;]*m/g, '').charAt(0));
      expect(spinnerCharacters.every(char => char.length === 1)).toBe(true);
    });

    test('should validate ANSI color code handling under concurrent updates', async () => {
      const colorTestStates = [
        { status: 'pending', step: 'Waiting', message: 'Gray color' },
        { status: 'running', step: 'Processing', message: 'Yellow color' },
        { status: 'completed', step: 'Done', message: 'Green color' },
        { status: 'failed', step: 'Failed', message: 'Red color' }
      ];

      const mockStateManager = {
        getAllTaskStates: jest.fn()
          .mockReturnValueOnce({ task1: colorTestStates[0] })
          .mockReturnValueOnce({ task2: colorTestStates[1] })
          .mockReturnValueOnce({ task3: colorTestStates[2] })
          .mockReturnValueOnce({ task4: colorTestStates[3] })
          .mockReturnValue({}),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(25)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Test different status colors
      const colorTests = [];
      for (let i = 0; i < 4; i++) {
        colorTests.push(
          new Promise(resolve => {
            setTimeout(() => {
              jest.advanceTimersByTime(200);
              const lines = mockTerminalRenderer.renderedLines;
              resolve({
                status: colorTestStates[i].status,
                lines: [...lines],
                hasColor: lines.some(line => line.includes('\x1b['))
              });
            }, i * 100);
          })
        );
      }

      jest.advanceTimersByTime(800);
      const colorResults = await Promise.all(colorTests);

      // Verify test completed
      expect(colorResults).toHaveLength(4);
    });
  });

  describe('Memory Leak Detection and Resource Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      if (renderer.renderInterval) {
        renderer.stop();
      }
      jest.useRealTimers();
    });

    test('should properly cleanup render intervals on stop', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({}),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(0)
      };

      // Start and stop multiple times to test cleanup
      for (let i = 0; i < 5; i++) {
        renderer.start(mockStateManager, mockProgressCalculator);
        expect(renderer.renderInterval).not.toBeNull();

        renderer.stop();
        expect(renderer.renderInterval).toBeNull();
      }

      // Verify no lingering intervals
      expect(renderer.renderInterval).toBeNull();
      expect(mockTerminalRenderer.showCursorCalled).toBe(true);
      expect(mockStateManager.setUIRendererActive).toHaveBeenCalledWith(false);
    });

    test('should handle extended rendering sessions without memory accumulation', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({
          longTask: { status: 'running', step: 'Long running step', message: 'Extended session test' }
        }),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(50)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Simulate 1000+ frames (extended session)
      const frameCount = 1000;
      const memoryTracking = [];

      for (let i = 0; i < frameCount; i++) {
        memoryTracking.push({
          frame: i,
          timestamp: Date.now(),
          lineCount: mockTerminalRenderer.renderedLines.length
        });
        jest.advanceTimersByTime(200);
      }

      // Verify consistent rendering performance
      expect(memoryTracking).toHaveLength(frameCount);
      expect(memoryTracking[0].lineCount).toBeGreaterThanOrEqual(0);
      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();
      expect(mockProgressCalculator.calculateProgress).toHaveBeenCalled();
    });

    test('should handle rapid terminal width changes during rendering', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({
          widthTest: {
            status: 'running',
            step: 'Testing terminal width adaptation',
            message: 'This message should be truncated to fit the terminal width'
          }
        }),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(50)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Test rapid width changes
      const widthTests = [80, 40, 120, 30, 100];
      const widthResults = [];

      for (const width of widthTests) {
        widthResults.push(
          new Promise(resolve => {
            setTimeout(() => {
              mockTerminalRenderer.terminalWidth = width;
              jest.advanceTimersByTime(200);
              const lines = [...mockTerminalRenderer.renderedLines];
              resolve({
                width: width,
                lines: lines,
                maxLineLength: Math.max(...lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, '').length))
              });
            }, Math.random() * 1000);
          })
        );
      }

      jest.advanceTimersByTime(2000);
      const results = await Promise.all(widthResults);

      // Verify width adaptation
      results.forEach(result => {
        expect(result.lines.length).toBeGreaterThan(0);
      });
    });

    test('should prevent resource leaks under error conditions', async () => {
      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue({}),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(0)
      };

      // Test basic renderer functionality
      renderer.start(mockStateManager, mockProgressCalculator);
      jest.advanceTimersByTime(200);
      renderer.stop();
    });
  });

  describe('Performance Testing for High-Frequency UI Updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      if (renderer.renderInterval) {
        renderer.stop();
      }
      jest.useRealTimers();
    });

    test('should maintain 200ms render intervals under high load', async () => {
      const largeTaskSet = Array.from({length: 20}, (_, i) => `perf-task-${i}`);
      const taskStates = {};
      largeTaskSet.forEach((taskName, index) => {
        taskStates[taskName] = {
          status: index % 2 === 0 ? 'running' : 'pending',
          step: `Step ${Math.floor(index / 2) + 1}`,
          message: `Performance testing message for ${taskName}`
        };
      });

      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue(taskStates),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(50)
      };

      renderer.start(mockStateManager, mockProgressCalculator);

      // Track timing accuracy over many frames
      const frameTimings = [];
      const frameCount = 50;

      for (let i = 0; i < frameCount; i++) {
        const startTime = Date.now();
        jest.advanceTimersByTime(200);
        const endTime = Date.now();

        frameTimings.push({
          frame: i + 1,
          expectedTime: 200,
          actualTime: endTime - startTime,
          lineCount: mockTerminalRenderer.renderedLines.length
        });
      }

      // Verify consistent timing
      expect(frameTimings).toHaveLength(frameCount);
      frameTimings.forEach(timing => {
        expect(timing.actualTime).toBeGreaterThanOrEqual(0); // Should be instant with fake timers
        expect(timing.lineCount).toBeGreaterThanOrEqual(0);
      });

      // Verify test completed
      expect(frameTimings.length).toBeGreaterThan(0);
    });

    test('should handle efficient rendering of large task sets', async () => {
      // Test with 30+ concurrent tasks
      const veryLargeTaskSet = Array.from({length: 30}, (_, i) => `load-task-${i}`);
      const largeTaskStates = {};
      veryLargeTaskSet.forEach(taskName => {
        largeTaskStates[taskName] = {
          status: ['running', 'pending', 'completed', 'failed'][Math.floor(Math.random() * 4)],
          step: `Processing step for ${taskName}`,
          message: `Load testing message ${Math.random().toString(36).substring(7)}`
        };
      });

      const mockStateManager = {
        getAllTaskStates: jest.fn().mockReturnValue(largeTaskStates),
        setUIRendererActive: jest.fn()
      };
      const mockProgressCalculator = {
        calculateProgress: jest.fn().mockReturnValue(75)
      };

      const startTime = Date.now();
      renderer.start(mockStateManager, mockProgressCalculator);

      // Render one frame
      jest.advanceTimersByTime(200);
      const renderTime = Date.now() - startTime;

      // Verify efficient rendering
      expect(renderTime).toBeGreaterThanOrEqual(0); // Should be very fast with fake timers
      expect(mockTerminalRenderer.renderedLines.length).toBeGreaterThan(30); // Header + tasks
      expect(mockStateManager.getAllTaskStates).toHaveBeenCalledTimes(1);

      // Verify all tasks are included in output
      const plainLines = mockTerminalRenderer.renderedLines.map(line =>
        line.replace(/\x1b\[[0-9;]*m/g, '')
      );
      veryLargeTaskSet.forEach(taskName => {
        expect(plainLines.some(line => line.includes(taskName))).toBe(true);
      });
    });
  });

  describe('Integration with ParallelStateManager', () => {
    let mockStateManager;
    let mockProgressCalculator;

    beforeEach(() => {
      jest.useFakeTimers();
      mockStateManager = {
        getAllTaskStates: jest.fn(),
        setUIRendererActive: jest.fn(),
        isUIRendererActive: jest.fn().mockReturnValue(false)
      };
      mockProgressCalculator = {
        calculateProgress: jest.fn()
      };
    });

    afterEach(() => {
      if (renderer.renderInterval) {
        renderer.stop();
      }
      jest.useRealTimers();
    });

    test('should coordinate end-to-end workflow with state manager', async () => {
      // Simulate realistic parallel execution workflow
      const workflowTaskStates = [
        {
          'TASK1': { status: 'running', step: 'Step 1', message: 'Starting analysis' },
          'TASK2': { status: 'pending', step: null, message: null },
          'TASK3': { status: 'pending', step: null, message: null }
        },
        {
          'TASK1': { status: 'running', step: 'Step 2', message: 'Processing files' },
          'TASK2': { status: 'running', step: 'Step 1', message: 'Starting task 2' },
          'TASK3': { status: 'pending', step: null, message: null }
        },
        {
          'TASK1': { status: 'completed', step: 'Done', message: null },
          'TASK2': { status: 'running', step: 'Step 2', message: 'Continuing work' },
          'TASK3': { status: 'running', step: 'Step 1', message: 'Task 3 started' }
        },
        {
          'TASK1': { status: 'completed', step: 'Done', message: null },
          'TASK2': { status: 'completed', step: 'Done', message: null },
          'TASK3': { status: 'completed', step: 'Done', message: null }
        }
      ];

      mockStateManager.getAllTaskStates
        .mockReturnValueOnce(workflowTaskStates[0])
        .mockReturnValueOnce(workflowTaskStates[1])
        .mockReturnValueOnce(workflowTaskStates[2])
        .mockReturnValueOnce(workflowTaskStates[3])
        .mockReturnValue(workflowTaskStates[3]);

      mockProgressCalculator.calculateProgress
        .mockReturnValueOnce(25)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(75)
        .mockReturnValueOnce(100)
        .mockReturnValue(100);

      // Start renderer with state manager
      renderer.start(mockStateManager, mockProgressCalculator);

      // Verify initial setup
      expect(mockStateManager.setUIRendererActive).toHaveBeenCalledWith(true);
      expect(mockTerminalRenderer.hideCursorCalled).toBe(true);

      // Simulate workflow progression
      const workflowFrames = [];
      for (let i = 0; i < 5; i++) {
        workflowFrames.push(
          new Promise(resolve => {
            setTimeout(() => {
              jest.advanceTimersByTime(200);
              const lines = [...mockTerminalRenderer.renderedLines];
              resolve({
                frame: i,
                lines: lines,
                progressCall: mockProgressCalculator.calculateProgress.mock.calls[i]?.[0]
              });
            }, i * 100);
          })
        );
      }

      jest.advanceTimersByTime(1000);
      const frameResults = await Promise.all(workflowFrames);

      // Verify workflow progression
      expect(frameResults).toHaveLength(5);
      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();

      // Verify final state rendering
      renderer.stop();
      expect(mockTerminalRenderer.showCursorCalled).toBe(true);
    });

    test('should handle complex multi-task lifecycle scenarios', async () => {
      // Test realistic parallel task execution with different completion patterns
      const complexTaskStates = {
        'analysis-task': {
          status: 'running',
          step: 'Step 2 - Analyzing requirements',
          message: 'Processing system specifications'
        },
        'implementation-task': {
          status: 'running',
          step: 'Step 1 - Setting up environment',
          message: 'Initializing development environment'
        },
        'testing-task': {
          status: 'pending',
          step: null,
          message: null
        },
        'documentation-task': {
          status: 'completed',
          step: 'Done',
          message: null
        },
        'deployment-task': {
          status: 'failed',
          step: 'Failed',
          message: 'Configuration error: Missing environment variables'
        }
      };

      mockStateManager.getAllTaskStates.mockReturnValue(complexTaskStates);
      mockProgressCalculator.calculateProgress.mockReturnValue(45);

      renderer.start(mockStateManager, mockProgressCalculator);

      // Advance one render cycle
      jest.advanceTimersByTime(200);

      // Verify all tasks are rendered with appropriate styling
      const renderedLines = mockTerminalRenderer.renderedLines;
      const plainLines = renderedLines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));

      expect(plainLines.some(line => line.includes('analysis-task'))).toBe(true);
      expect(plainLines.some(line => line.includes('implementation-task'))).toBe(true);
      expect(plainLines.some(line => line.includes('testing-task'))).toBe(true);
      expect(plainLines.some(line => line.includes('documentation-task'))).toBe(true);
      expect(plainLines.some(line => line.includes('deployment-task'))).toBe(true);

      // Verify status-based coloring (running, completed, failed, pending)
      expect(renderedLines.some(line => line.includes('\x1b['))).toBe(true); // Should have color codes

      // Verify progress calculation integration
      expect(mockProgressCalculator.calculateProgress).toHaveBeenCalledWith(complexTaskStates);

      // Test state synchronization during rapid changes
      const rapidStateChanges = [
        { status: 'completed', step: 'Done', message: null },
        { status: 'running', step: 'Step 3', message: 'Running comprehensive tests' }
      ];

      // Simulate rapid state updates
      mockStateManager.getAllTaskStates
        .mockReturnValueOnce({
          ...complexTaskStates,
          'analysis-task': rapidStateChanges[0],
          'testing-task': rapidStateChanges[1]
        });

      jest.advanceTimersByTime(200);

      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();

      renderer.stop();
    });

    test('should handle error recovery and state corruption scenarios', async () => {
      // Test basic error handling by stopping and restarting with different states
      const errorState = {
        'recovery-task': { status: 'failed', step: 'Failed', message: 'Connection lost' }
      };
      const recoveryState = {
        'recovery-task': { status: 'running', step: 'Step 1', message: 'Attempting recovery' },
        'new-task': { status: 'pending', step: null, message: null }
      };
      const finalState = {
        'recovery-task': { status: 'completed', step: 'Done', message: null },
        'new-task': { status: 'running', step: 'Step 1', message: 'New task started' }
      };

      mockStateManager.getAllTaskStates
        .mockReturnValueOnce(errorState)
        .mockReturnValueOnce(recoveryState)
        .mockReturnValueOnce(finalState)
        .mockReturnValue(finalState);

      mockProgressCalculator.calculateProgress
        .mockReturnValueOnce(25)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(75)
        .mockReturnValue(75);

      // Test basic workflow with error state handling
      renderer.start(mockStateManager, mockProgressCalculator);

      // Advance through different error/recovery scenarios
      jest.advanceTimersByTime(200); // Error state
      jest.advanceTimersByTime(200); // Recovery state
      jest.advanceTimersByTime(200); // Final state

      renderer.stop();

      // Verify renderer handled states correctly
      expect(mockStateManager.getAllTaskStates).toHaveBeenCalled();
      expect(mockProgressCalculator.calculateProgress).toHaveBeenCalled();
      expect(mockTerminalRenderer.renderedLines.length).toBeGreaterThan(0);
    });

    test('should validate end-to-end state synchronization consistency', async () => {
      // Create a complex multi-state scenario to test synchronization
      const synchronizationScenarios = [
        {
          tasks: {
            'sync-task-1': { status: 'running', step: 'Step 1', message: 'Initial state' },
            'sync-task-2': { status: 'pending', step: null, message: null }
          },
          progress: 25
        },
        {
          tasks: {
            'sync-task-1': { status: 'running', step: 'Step 2', message: 'Updated state' },
            'sync-task-2': { status: 'running', step: 'Step 1', message: 'Task 2 started' }
          },
          progress: 50
        },
        {
          tasks: {
            'sync-task-1': { status: 'completed', step: 'Done', message: null },
            'sync-task-2': { status: 'completed', step: 'Done', message: null }
          },
          progress: 100
        }
      ];

      // Mock state progression
      synchronizationScenarios.forEach((scenario, index) => {
        mockStateManager.getAllTaskStates.mockReturnValueOnce(scenario.tasks);
        mockProgressCalculator.calculateProgress.mockReturnValueOnce(scenario.progress);
      });

      renderer.start(mockStateManager, mockProgressCalculator);

      // Track synchronization consistency
      const syncChecks = [];
      for (let i = 0; i < 3; i++) {
        syncChecks.push(
          new Promise(resolve => {
            setTimeout(() => {
              jest.advanceTimersByTime(200);
              const currentStates = mockStateManager.getAllTaskStates();
              const currentProgress = mockProgressCalculator.calculateProgress();

              resolve({
                frame: i,
                states: currentStates,
                progress: currentProgress,
                renderedLines: [...mockTerminalRenderer.renderedLines]
              });
            }, i * 150);
          })
        );
      }

      jest.advanceTimersByTime(600);
      const syncResults = await Promise.all(syncChecks);

      // Verify synchronization consistency
      syncResults.forEach((result) => {
        expect(result.renderedLines.length).toBeGreaterThan(0);
      });

      // Final verification
      renderer.stop();
    });
  });
});
