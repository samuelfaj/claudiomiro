const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const state = require('../config/state');
const ParallelStateManager = require('./parallel-state-manager');
const ParallelUIRenderer = require('./parallel-ui-renderer');
const TerminalRenderer = require('../utils/terminal-renderer');
const { calculateProgress } = require('../utils/progress-calculator');
const { isFullyImplemented, hasApprovedCodeReview } = require('../utils/validation');
const DAGExecutor = require('./dag-executor');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('./parallel-state-manager');
jest.mock('./parallel-ui-renderer');
jest.mock('../utils/terminal-renderer');
jest.mock('../utils/progress-calculator');
jest.mock('../utils/validation');

// Mock steps module
jest.mock('../steps', () => ({
  step4: jest.fn(),
  step5: jest.fn(),
  step6: jest.fn(),
  step7: jest.fn()
}));

// Mock process.argv
const originalArgv = process.argv;

describe('DAGExecutor', () => {
  let executor;
  let mockTasks;
  let mockStateManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    os.cpus.mockReturnValue([1, 2, 3, 4]); // 4 cores
    state.claudiomiroFolder = '/test/.claudiomiro';
    path.join.mockImplementation((...args) => args.join('/'));

    // Create mock state manager
    mockStateManager = {
      initialize: jest.fn(),
      updateTaskStatus: jest.fn(),
      updateTaskStep: jest.fn()
    };
    ParallelStateManager.mockImplementation(() => mockStateManager);

    // Setup default tasks
    mockTasks = {
      'task1': { deps: [], status: 'pending' },
      'task2': { deps: ['task1'], status: 'pending' },
      'task3': { deps: ['task1'], status: 'pending' }
    };

    // Mock process.argv
    process.argv = [...originalArgv];

    // Create executor instance
    executor = new DAGExecutor(mockTasks);
  });

  afterAll(() => {
    process.argv = originalArgv;
  });

  describe('constructor', () => {
    test('should initialize with default parameters', () => {
      const tasks = { test: { deps: [], status: 'pending' } };
      const exec = new DAGExecutor(tasks);

      expect(exec.tasks).toBe(tasks);
      expect(exec.allowedSteps).toBeNull();
      expect(exec.noLimit).toBe(false);
      expect(exec.maxAttemptsPerTask).toBe(20);
      expect(exec.maxConcurrent).toBe(4); // CORE_COUNT
      expect(exec.running).toBeInstanceOf(Set);
      expect(exec.stateManager).toBe(mockStateManager);
    });

    test('should initialize with custom parameters', () => {
      const tasks = { test: { deps: [], status: 'pending' } };
      const allowedSteps = [4, 5];
      const maxConcurrent = 8;
      const noLimit = true;
      const maxAttemptsPerTask = 50;

      const exec = new DAGExecutor(tasks, allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);

      expect(exec.allowedSteps).toBe(allowedSteps);
      expect(exec.noLimit).toBe(noLimit);
      expect(exec.maxAttemptsPerTask).toBe(maxAttemptsPerTask);
      expect(exec.maxConcurrent).toBe(maxConcurrent);
    });

    test('should use CORE_COUNT when maxConcurrent is not provided', () => {
      os.cpus.mockReturnValue([1, 2]); // 2 cores

      const tasks = { test: { deps: [], status: 'pending' } };
      const exec = new DAGExecutor(tasks);

      expect(exec.maxConcurrent).toBe(2);
    });

    test('should ensure maxConcurrent is at least 1', () => {
      os.cpus.mockReturnValue([]); // 0 cores

      const tasks = { test: { deps: [], status: 'pending' } };
      const exec = new DAGExecutor(tasks);

      expect(exec.maxConcurrent).toBe(1);
    });

    test('should initialize state manager with tasks', () => {
      const tasks = { test: { deps: [], status: 'pending' } };
      new DAGExecutor(tasks);

      expect(mockStateManager.initialize).toHaveBeenCalledWith(tasks);
    });
  });

  describe('getStateManager', () => {
    test('should return the state manager instance', () => {
      expect(executor.getStateManager()).toBe(mockStateManager);
    });
  });

  describe('shouldRunStep', () => {
    test('should return true when no allowedSteps is set', () => {
      executor.allowedSteps = null;
      expect(executor.shouldRunStep(4)).toBe(true);
    });

    test('should return true when step is in allowedSteps', () => {
      executor.allowedSteps = [4, 5, 6];
      expect(executor.shouldRunStep(4)).toBe(true);
      expect(executor.shouldRunStep(5)).toBe(true);
      expect(executor.shouldRunStep(6)).toBe(true);
    });

    test('should return false when step is not in allowedSteps', () => {
      executor.allowedSteps = [4, 5];
      expect(executor.shouldRunStep(6)).toBe(false);
      expect(executor.shouldRunStep(7)).toBe(false);
    });
  });

  describe('getReadyTasks', () => {
    test('should return tasks with no dependencies and pending status', () => {
      const tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: ['task1'], status: 'pending' }
      };
      executor.tasks = tasks;

      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['task1']);
    });

    test('should return tasks when all dependencies are completed', () => {
      const tasks = {
        task1: { deps: [], status: 'completed' },
        task2: { deps: ['task1'], status: 'pending' }
      };
      executor.tasks = tasks;

      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['task2']);
    });

    test('should not return tasks with incomplete dependencies', () => {
      const tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: ['task1'], status: 'pending' }
      };
      executor.tasks = tasks;

      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['task1']);
      expect(ready).not.toContain('task2');
    });

    test('should not return tasks with non-pending status', () => {
      const tasks = {
        task1: { deps: [], status: 'completed' },
        task2: { deps: [], status: 'running' },
        task3: { deps: [], status: 'failed' },
        task4: { deps: [], status: 'pending' }
      };
      executor.tasks = tasks;

      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['task4']);
    });

    test('should handle missing dependency tasks gracefully', () => {
      const tasks = {
        task1: { deps: ['missing'], status: 'pending' }
      };
      executor.tasks = tasks;

      const ready = executor.getReadyTasks();
      expect(ready).toEqual([]); // Should not crash, just not ready
    });
  });

  describe('executeWave', () => {
    test('should return false when no tasks are ready', () => {
      const getReadyTasksSpy = jest.spyOn(executor, 'getReadyTasks');
      getReadyTasksSpy.mockReturnValue([]);

      const result = executor.executeWave();

      expect(result).toBe(false);
      expect(getReadyTasksSpy).toHaveBeenCalled();
    });

    test('should execute tasks up to maxConcurrent limit', () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      const mockTasks = ['task1', 'task2', 'task3'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockResolvedValue();

      const result = executor.executeWave();

      expect(result).toBe(true);
      expect(executeTaskSpy).toHaveBeenCalledTimes(2); // Limited by maxConcurrent
      expect(executeTaskSpy).toHaveBeenCalledWith('task1');
      expect(executeTaskSpy).toHaveBeenCalledWith('task2');
      expect(executor.tasks['task1'].status).toBe('running');
      expect(executor.tasks['task2'].status).toBe('running');
      expect(executor.tasks['task3'].status).toBe('pending'); // Not executed
    });

    test('should update running set and task status', () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);
      jest.spyOn(executor, 'executeTask').mockResolvedValue();

      executor.executeWave();

      expect(executor.running.has('task1')).toBe(true);
      expect(executor.running.has('task2')).toBe(true);
      expect(executor.tasks['task1'].status).toBe('running');
      expect(executor.tasks['task2'].status).toBe('running');
    });

    test('should respect already running tasks when calculating slots', () => {
      executor.maxConcurrent = 2;
      executor.running = new Set(['existing-task']);

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);
      jest.spyOn(executor, 'executeTask').mockResolvedValue();

      executor.executeWave();

      expect(jest.spyOn(executor, 'executeTask')).toHaveBeenCalledTimes(1); // Only 1 slot available
    });
  });

  describe('executeTask', () => {
    let mockStep4, mockStep5, mockStep6;

    beforeEach(() => {
      const { step4, step5, step6 } = require('../steps');
      mockStep4 = step4;
      mockStep5 = step5;
      mockStep6 = step6;

      // Default mock implementations
      mockStep4.mockResolvedValue();
      mockStep5.mockResolvedValue();
      mockStep6.mockResolvedValue();
    });

    test('should mark task as completed if already approved', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return false;
      });
      isFullyImplemented.mockReturnValue(true);
      hasApprovedCodeReview.mockReturnValue(true);

      await executor.executeTask('testTask');

      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'running');
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
      expect(executor.tasks['testTask'].status).toBe('completed');
      expect(executor.running.has('testTask')).toBe(false);
    });

    test('should execute step4 if TODO.md does not exist', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        return true;
      });

      await executor.executeTask('testTask');

      expect(mockStep4).toHaveBeenCalledWith('testTask');
      expect(mockStateManager.updateTaskStep).toHaveBeenCalledWith('testTask', 'Step 4 - Research and planning');
    });

    test('should skip step4 if not in allowedSteps', async () => {
      executor.allowedSteps = [5, 6]; // Step 4 not allowed
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false;
        return true;
      });

      await executor.executeTask('testTask');

      expect(mockStep4).not.toHaveBeenCalled();
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
    });

    test('should handle task splitting (folder no longer exists)', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('/testTask')) return false; // Task folder gone
        if (filePath.includes('TODO.md')) return false;
        return true;
      });

      await executor.executeTask('testTask');

      expect(mockStep4).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('✅ testTask was split into subtasks');
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
    });

    test('should stop after step4 if step5 not allowed', async () => {
      executor.allowedSteps = [4]; // Only step 4 allowed
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false; // Will be created by step4
        return true;
      });

      // Mock step4 creates TODO.md
      mockStep4.mockImplementation(() => {
        fs.existsSync.mockImplementation(filePath => {
          if (filePath.includes('TODO.md')) return true;
          return true;
        });
      });

      await executor.executeTask('testTask');

      expect(mockStep5).not.toHaveBeenCalled();
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
    });

    test('should implement step5 with retry logic', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true; // TODO.md exists
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });

      // First attempt fails, second succeeds
      isFullyImplemented
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockStep5
        .mockRejectedValueOnce(new Error('Implementation failed'))
        .mockResolvedValueOnce();

      await executor.executeTask('testTask');

      expect(mockStep5).toHaveBeenCalledTimes(2);
      expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Step 5 failed'));
    });

    test('should stop after step5 if step6 not allowed', async () => {
      executor.allowedSteps = [4, 5]; // Steps 4 and 5 allowed
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });
      isFullyImplemented.mockReturnValue(true);

      await executor.executeTask('testTask');

      expect(mockStep6).not.toHaveBeenCalled();
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
    });

    test('should execute step6 for code review', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });
      isFullyImplemented.mockReturnValue(true);
      hasApprovedCodeReview
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      await executor.executeTask('testTask');

      expect(mockStep6).toHaveBeenCalledWith('testTask', true);
      expect(mockStateManager.updateTaskStep).toHaveBeenCalledWith('testTask', 'Step 6 - Code review');
    });

    test('should respect --push=false flag for step6', async () => {
      process.argv.push('--push=false');

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });
      isFullyImplemented.mockReturnValue(true);
      hasApprovedCodeReview.mockReturnValue(false);

      await executor.executeTask('testTask');

      expect(mockStep6).toHaveBeenCalledWith('testTask', false);
    });

    test('should handle maximum attempts limit', async () => {
      executor.maxAttemptsPerTask = 2;
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        return true;
      });
      isFullyImplemented.mockReturnValue(false); // Never fully implemented

      await expect(executor.executeTask('testTask')).rejects.toThrow('Maximum attempts (2) reached');

      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'failed');
      expect(logger.error).toHaveBeenCalled();
    });

    test('should respect noLimit flag', async () => {
      executor.noLimit = true;
      executor.maxAttemptsPerTask = 1; // Low limit, but noLimit overrides

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        return true;
      });

      let callCount = 0;
      isFullyImplemented.mockImplementation(() => {
        callCount++;
        return callCount > 3; // Succeeds after 3 attempts
      });

      mockStep5.mockResolvedValue();

      // Should not throw despite exceeding maxAttemptsPerTask
      await expect(executor.executeTask('testTask')).resolves.not.toThrow();
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
    });

    test('should handle TODO.old.md restoration', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false;
        if (filePath.includes('TODO.old.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });

      const mockCpSync = jest.fn();
      const mockRmSync = jest.fn();
      fs.cpSync = mockCpSync;
      fs.rmSync = mockRmSync;

      await executor.executeTask('testTask');

      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('TODO.old.md'),
        expect.stringContaining('TODO.md')
      );
      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('TODO.old.md'),
        { force: true }
      );
    });

    test('should handle task execution errors', async () => {
      const error = new Error('Task execution failed');
      mockStep4.mockRejectedValue(error);

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false;
        return true;
      });

      await expect(executor.executeTask('testTask')).rejects.toThrow('Task execution failed');

      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'failed');
      expect(executor.tasks['testTask'].status).toBe('failed');
      expect(executor.running.has('testTask')).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('❌ testTask failed: Task execution failed');
    });
  });

  describe('run', () => {
    beforeEach(() => {
      // Mock UI renderer and terminal
      const mockUIRenderer = {
        start: jest.fn(),
        stop: jest.fn(),
        update: jest.fn()
      };
      ParallelUIRenderer.mockImplementation(() => mockUIRenderer);

      // Mock terminal renderer
      const mockTerminalRenderer = {
        renderParallelProgress: jest.fn(),
        stop: jest.fn()
      };
      TerminalRenderer.getInstance.mockReturnValue(mockTerminalRenderer);

      // Mock calculateProgress
      calculateProgress.mockReturnValue({ completed: 1, total: 3, percentage: 33.3 });
    });

    test('should execute tasks until completion', async () => {
      // Mock ready tasks and execution
      jest.spyOn(executor, 'getReadyTasks')
        .mockReturnValueOnce(['task1'])
        .mockReturnValueOnce(['task2'])
        .mockReturnValueOnce([]);

      jest.spyOn(executor, 'executeTask')
        .mockResolvedValue();

      await executor.run();

      expect(executor.executeTask).toHaveBeenCalledTimes(2);
      expect(executor.executeTask).toHaveBeenCalledWith('task1');
      expect(executor.executeTask).toHaveBeenCalledWith('task2');
    });

    test('should handle no tasks scenario', async () => {
      executor.tasks = {};
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      await executor.run();

      expect(logger.success).toHaveBeenCalledWith('✅ All tasks completed successfully!');
    });

    test('should handle execution errors and continue', async () => {
      jest.spyOn(executor, 'getReadyTasks')
        .mockReturnValue(['task1']);

      jest.spyOn(executor, 'executeTask')
        .mockRejectedValue(new Error('Task failed'));

      await executor.run();

      expect(logger.error).toHaveBeenCalled();
    });

    test('should detect deadlock condition', async () => {
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      // Simulate some running tasks that never complete
      executor.running = new Set(['stuck-task']);

      await executor.run();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('DEADLOCK DETECTED'));
    });
  });

  describe('runStep2', () => {
    test('should execute step2 tasks', async () => {
      jest.spyOn(executor, 'executeStep2Wave').mockResolvedValue(true);

      await executor.runStep2();

      expect(executor.executeStep2Wave).toHaveBeenCalled();
    });
  });

  describe('executeStep2Wave', () => {
    test('should return false when no tasks are ready', async () => {
      const result = await executor.executeStep2Wave();
      expect(result).toBe(false);
    });
  });

  describe('executeStep2Task', () => {
    test('should handle step2 task execution', async () => {
      fs.existsSync.mockReturnValue(true);

      const result = await executor.executeStep2Task('testTask');

      expect(typeof result).toBe('boolean');
    });
  });
});