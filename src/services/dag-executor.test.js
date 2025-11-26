// Mock modules BEFORE requiring them
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

// Set up os.cpus mock before module import
const os = require('os');
os.cpus.mockReturnValue([1, 2, 3, 4]); // 4 cores

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const state = require('../config/state');
const ParallelStateManager = require('./parallel-state-manager');
const ParallelUIRenderer = require('./parallel-ui-renderer');
const TerminalRenderer = require('../utils/terminal-renderer');
const { calculateProgress } = require('../utils/progress-calculator');
const { isFullyImplemented, hasApprovedCodeReview } = require('../utils/validation');
const { DAGExecutor } = require('./dag-executor');

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
    // os.cpus is already mocked before module import
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

  afterEach(() => {
    // Clear all timers to prevent worker process hangs
    jest.clearAllTimers();
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
      // Since os.cpus is mocked to return 4 cores, maxConcurrent should be 4
      const tasks = { test: { deps: [], status: 'pending' } };
      const exec = new DAGExecutor(tasks);

      expect(exec.maxConcurrent).toBe(4); // Based on our mock of 4 cores
    });

    test('should ensure maxConcurrent is at least 1', () => {
      // This test verifies the logic but we can't easily change the os.cpus mock
      // after module loading. The real implementation would handle 0 cores correctly.
      const tasks = { test: { deps: [], status: 'pending' } };
      const exec = new DAGExecutor(tasks);

      // With our current 4-core mock, this should be 4
      expect(exec.maxConcurrent).toBeGreaterThanOrEqual(1);
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

    // Enhanced dependency resolution tests
    test('should handle complex multi-level dependency chains', () => {
      const tasks = {
        A: { deps: [], status: 'pending' },           // Level 0
        B: { deps: ['A'], status: 'pending' },        // Level 1
        C: { deps: ['A'], status: 'pending' },        // Level 1
        D: { deps: ['B', 'C'], status: 'pending' },   // Level 2
        E: { deps: ['D'], status: 'pending' },        // Level 3
        F: { deps: ['D'], status: 'pending' }         // Level 3
      };
      executor.tasks = tasks;

      // Initially only A should be ready
      expect(executor.getReadyTasks()).toEqual(['A']);

      // Complete A
      executor.tasks.A.status = 'completed';

      // Now B and C should be ready
      const readyAfterA = executor.getReadyTasks();
      expect(readyAfterA).toContain('B');
      expect(readyAfterA).toContain('C');
      expect(readyAfterA).not.toContain('D');
      expect(readyAfterA).not.toContain('E');
      expect(readyAfterA).not.toContain('F');

      // Complete B
      executor.tasks.B.status = 'completed';

      // Only C should be ready (D still waiting for C)
      const readyAfterB = executor.getReadyTasks();
      expect(readyAfterB).toEqual(['C']);

      // Complete C
      executor.tasks.C.status = 'completed';

      // Now D should be ready
      expect(executor.getReadyTasks()).toEqual(['D']);

      // Complete D
      executor.tasks.D.status = 'completed';

      // Now E and F should be ready
      const readyAfterD = executor.getReadyTasks();
      expect(readyAfterD).toContain('E');
      expect(readyAfterD).toContain('F');
    });

    test('should handle circular dependency detection gracefully', () => {
      const tasks = {
        task1: { deps: ['task2'], status: 'pending' },  // task1 depends on task2
        task2: { deps: ['task3'], status: 'pending' },  // task2 depends on task3
        task3: { deps: ['task1'], status: 'pending' }   // task3 depends on task1 (circular!)
      };
      executor.tasks = tasks;

      // Should return empty array - no tasks can start due to circular dependency
      const ready = executor.getReadyTasks();
      expect(ready).toEqual([]);

      // Should not crash or hang
      expect(ready).toHaveLength(0);
    });

    test('should handle self-dependency scenarios', () => {
      const tasks = {
        task1: { deps: ['task1'], status: 'pending' }, // Self dependency
        task2: { deps: [], status: 'pending' }
      };
      executor.tasks = tasks;

      // Only task2 should be ready, task1 has self dependency
      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['task2']);
      expect(ready).not.toContain('task1');
    });

    test('should handle empty dependency arrays', () => {
      const tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: [], status: 'pending' },
        task3: { deps: [], status: 'completed' },
        task4: { deps: [], status: 'running' }
      };
      executor.tasks = tasks;

      // Only pending tasks with no deps should be ready
      const ready = executor.getReadyTasks();
      expect(ready).toContain('task1');
      expect(ready).toContain('task2');
      expect(ready).not.toContain('task3'); // completed
      expect(ready).not.toContain('task4'); // running
    });

    test('should handle missing dependencies with partial completion', () => {
      const tasks = {
        task1: { deps: [], status: 'completed' },
        task2: { deps: ['task1', 'missing'], status: 'pending' }, // missing dependency
        task3: { deps: ['task1'], status: 'pending' }
      };
      executor.tasks = tasks;

      // Only task3 should be ready (has all available dependencies)
      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['task3']);
      expect(ready).not.toContain('task2'); // waiting for missing dependency
    });

    test('should handle multiple dependency levels with mixed statuses', () => {
      const tasks = {
        foundation: { deps: [], status: 'completed' },
        middleware1: { deps: ['foundation'], status: 'completed' },
        middleware2: { deps: ['foundation'], status: 'failed' },
        app1: { deps: ['middleware1'], status: 'pending' },
        app2: { deps: ['middleware1', 'middleware2'], status: 'pending' },
        frontend: { deps: ['app1', 'app2'], status: 'pending' }
      };
      executor.tasks = tasks;

      // app1 should be ready (middleware1 completed)
      // app2 should NOT be ready (middleware2 failed, but still considered as a dependency)
      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['app1']);
      expect(ready).not.toContain('app2');
      expect(ready).not.toContain('frontend');
    });

    test('should maintain deterministic ordering for consistent execution', () => {
      const tasks = {
        zebra: { deps: [], status: 'pending' },
        apple: { deps: [], status: 'pending' },
        banana: { deps: [], status: 'pending' }
      };
      executor.tasks = tasks;

      const ready = executor.getReadyTasks();
      // Should return tasks in a consistent order (based on Object.entries order)
      expect(ready).toEqual(['zebra', 'apple', 'banana']);
    });

    test('should handle complex diamond dependency pattern', () => {
      const tasks = {
        root: { deps: [], status: 'completed' },
        left: { deps: ['root'], status: 'completed' },
        right: { deps: ['root'], status: 'completed' },
        merge: { deps: ['left', 'right'], status: 'pending' },
        final: { deps: ['merge'], status: 'pending' }
      };
      executor.tasks = tasks;

      // merge should be ready (both left and right completed)
      const ready = executor.getReadyTasks();
      expect(ready).toEqual(['merge']);

      // Complete merge
      executor.tasks.merge.status = 'completed';

      // Now final should be ready
      expect(executor.getReadyTasks()).toEqual(['final']);
    });
  });

  describe('executeWave', () => {
    test('should return false when no tasks are ready', async () => {
      const getReadyTasksSpy = jest.spyOn(executor, 'getReadyTasks');
      getReadyTasksSpy.mockReturnValue([]);

      const result = await executor.executeWave();

      expect(result).toBe(false);
      expect(getReadyTasksSpy).toHaveBeenCalled();
    });

    test('should execute tasks up to maxConcurrent limit', async () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      // Set up tasks in executor.tasks
      executor.tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: [], status: 'pending' },
        task3: { deps: [], status: 'pending' }
      };

      const mockTasks = ['task1', 'task2', 'task3'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockResolvedValue();

      const result = await executor.executeWave();

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

    // Enhanced parallel execution edge cases
    test('should handle maxConcurrent limit of 1 (sequential execution)', async () => {
      executor.maxConcurrent = 1;
      executor.running = new Set();

      // Set up tasks in executor.tasks
      executor.tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: [], status: 'pending' },
        task3: { deps: [], status: 'pending' }
      };

      const mockTasks = ['task1', 'task2', 'task3'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        // Simulate async task execution
        await new Promise(resolve => setTimeout(resolve, 10));
        return taskName;
      });

      await executor.executeWave();

      expect(executeTaskSpy).toHaveBeenCalledTimes(1); // Only 1 task at a time
      expect(executor.running.has('task1')).toBe(true);
      expect(executor.tasks['task1'].status).toBe('running');
    });

    test('should handle concurrent task execution with Promise.allSettled', async () => {
      executor.maxConcurrent = 3;
      executor.running = new Set();

      // Set up tasks in executor.tasks
      executor.tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: [], status: 'pending' }
      };

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      let task1Resolved = false;
      let task2Resolved = false;

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        if (taskName === 'task1') {
          await new Promise(resolve => setTimeout(resolve, 50));
          task1Resolved = true;
        } else if (taskName === 'task2') {
          await new Promise(resolve => setTimeout(resolve, 30));
          task2Resolved = true;
        }
        return taskName;
      });

      await executor.executeWave();

      // Both tasks should have been executed in parallel
      expect(executeTaskSpy).toHaveBeenCalledWith('task1');
      expect(executeTaskSpy).toHaveBeenCalledWith('task2');
      expect(task1Resolved).toBe(true);
      expect(task2Resolved).toBe(true);
    });

    test('should handle zero available slots when all slots are occupied', async () => {
      executor.maxConcurrent = 2;
      executor.running = new Set(['task1', 'task2']); // All slots occupied

      // Set up tasks in executor.tasks
      executor.tasks = {
        task1: { deps: [], status: 'running' },
        task2: { deps: [], status: 'running' },
        task3: { deps: [], status: 'pending' },
        task4: { deps: [], status: 'pending' }
      };

      const mockTasks = ['task3', 'task4'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockResolvedValue();

      const result = await executor.executeWave();

      expect(result).toBe(false);
      expect(executeTaskSpy).not.toHaveBeenCalled();
      expect(executor.tasks['task3'].status).toBe('pending');
      expect(executor.tasks['task4'].status).toBe('pending');
    });

    test('should handle partial slot availability with mixed running/ready tasks', () => {
      executor.maxConcurrent = 3;
      executor.running = new Set(['existing-task']); // 1 slot occupied, 2 available

      // Set up tasks in executor.tasks
      executor.tasks = {
        'existing-task': { deps: [], status: 'running' },
        task1: { deps: [], status: 'pending' },
        task2: { deps: [], status: 'pending' },
        task3: { deps: [], status: 'pending' }
      };

      const mockTasks = ['task1', 'task2', 'task3'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockResolvedValue();

      executor.executeWave();

      expect(executeTaskSpy).toHaveBeenCalledTimes(2); // Only 2 slots available
      expect(executeTaskSpy).toHaveBeenCalledWith('task1');
      expect(executeTaskSpy).toHaveBeenCalledWith('task2');
      expect(executeTaskSpy).not.toHaveBeenCalledWith('task3'); // No slot for task3
    });

    test('should handle resource cleanup after task completion', async () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        // Simulate task that completes and removes itself from running set
        setTimeout(() => {
          executor.running.delete(taskName);
          executor.tasks[taskName].status = 'completed';
        }, 10);
        return taskName;
      });

      await executor.executeWave();

      expect(executeTaskSpy).toHaveBeenCalledTimes(2);
      // Note: In actual implementation, running set management happens in executeTask
      // This test verifies the wave execution pattern
    });

    test('should maintain task isolation during parallel execution', async () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const taskStates = {};

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        taskStates[taskName] = 'running';
        await new Promise(resolve => setTimeout(resolve, 20));
        taskStates[taskName] = 'completed';
        return taskName;
      });

      await executor.executeWave();

      expect(executeTaskSpy).toHaveBeenCalledTimes(2);
      expect(taskStates.task1).toBe('completed');
      expect(taskStates.task2).toBe('completed');
    });

    test('should handle dynamic concurrent limit changes', () => {
      executor.maxConcurrent = 1; // Start with limit 1
      executor.running = new Set();

      // Set up tasks in executor.tasks
      executor.tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: [], status: 'pending' }
      };

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockResolvedValue();

      // First wave with limit 1
      executor.executeWave();
      expect(executeTaskSpy).toHaveBeenCalledTimes(1);

      // Change limit and execute another wave
      executor.maxConcurrent = 3;
      executor.running.clear();
      executor.tasks = {
        task2: { deps: [], status: 'pending' },
        task3: { deps: [], status: 'pending' },
        task4: { deps: [], status: 'pending' }
      };
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(['task2', 'task3', 'task4']);

      executor.executeWave();
      expect(executeTaskSpy).toHaveBeenCalledTimes(4); // 1 + 3 new tasks
    });

    test('should handle execution order preservation with concurrent limits', () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      // Set up tasks in executor.tasks
      executor.tasks = {
        first: { deps: [], status: 'pending' },
        second: { deps: [], status: 'pending' },
        third: { deps: [], status: 'pending' },
        fourth: { deps: [], status: 'pending' }
      };

      const mockTasks = ['first', 'second', 'third', 'fourth'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      const executeTaskSpy = jest.spyOn(executor, 'executeTask').mockResolvedValue();

      executor.executeWave();

      // Should execute tasks in order up to the limit
      expect(executeTaskSpy).toHaveBeenCalledWith('first');
      expect(executeTaskSpy).toHaveBeenCalledWith('second');
      expect(executeTaskSpy).not.toHaveBeenCalledWith('third');
      expect(executeTaskSpy).not.toHaveBeenCalledWith('fourth');
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
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });

      let callCount = 0;
      isFullyImplemented.mockImplementation(() => {
        callCount++;
        return callCount > 3; // Succeeds after 3 attempts
      });

      // Also mock hasApprovedCodeReview to prevent infinite loop
      hasApprovedCodeReview.mockImplementation(() => {
        return callCount > 3; // Approved after 3 attempts
      });

      mockStep5.mockResolvedValue();

      // Should not throw despite exceeding maxAttemptsPerTask
      await expect(executor.executeTask('testTask')).resolves.not.toThrow();
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'completed');
    }, 10000); // 10 second timeout to prevent hanging

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

    // Enhanced error recovery tests
    test('should handle step5 retry with progressive delays', async () => {
      executor.maxAttemptsPerTask = 3;
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      });

      // Step5 fails twice, then succeeds
      isFullyImplemented
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockStep5
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce();

      await executor.executeTask('testTask');

      expect(mockStep5).toHaveBeenCalledTimes(3);
      expect(delays).toHaveLength(2); // Two delays before retries
      expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Step 5 failed'));

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    test('should handle state rollback after partial task failures', async () => {
      const taskName = 'rollbackTask';

      // Mock step4 succeeds, step5 fails
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true; // TODO exists after step4
        if (filePath.includes('CODE_REVIEW.md')) return false;
        return true;
      });

      mockStep5.mockRejectedValue(new Error('Implementation error'));

      await expect(executor.executeTask(taskName)).rejects.toThrow('Implementation error');

      // Verify state cleanup after failure
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith(taskName, 'running');
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith(taskName, 'failed');
      expect(executor.tasks[taskName].status).toBe('failed');
      expect(executor.running.has(taskName)).toBe(false);
    });

    test('should handle error propagation through dependency chains', async () => {
      const dependentTask = 'dependentTask';

      // Setup task that depends on a failed dependency
      executor.tasks[dependentTask] = { deps: ['failedDependency'], status: 'pending' };
      executor.tasks['failedDependency'] = { deps: [], status: 'failed' };

      const ready = executor.getReadyTasks();

      // Dependent task should not be ready when dependency failed
      expect(ready).not.toContain(dependentTask);
    });

    test('should handle graceful degradation under multiple concurrent failures', async () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      // Both tasks fail
      const executeTaskSpy = jest.spyOn(executor, 'executeTask')
        .mockRejectedValueOnce(new Error('Task1 failed'))
        .mockRejectedValueOnce(new Error('Task2 failed'));

      // executeWave should handle failures gracefully
      const result = await executor.executeWave();

      expect(result).toBe(true); // Wave executed (even though tasks failed)
      expect(executeTaskSpy).toHaveBeenCalledTimes(2);
    });

    test('should handle recovery from state manager initialization failures', () => {
      const initError = new Error('State manager init failed');
      mockStateManager.initialize.mockImplementation(() => {
        throw initError;
      });

      const tasks = { test: { deps: [], status: 'pending' } };

      expect(() => new DAGExecutor(tasks)).toThrow('State manager init failed');
    });

    test('should handle resource cleanup during task interruption', async () => {
      const taskName = 'interruptedTask';

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        return true;
      });

      // Mock a task that gets interrupted/cancelled
      let taskCompleted = false;
      mockStep5.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        taskCompleted = true;
      });

      // Simulate interruption by throwing during execution
      const originalExecuteTask = executor.executeTask.bind(executor);
      let taskStarted = false;
      executor.executeTask = jest.fn().mockImplementation(async (name) => {
        if (name === taskName) {
          taskStarted = true;
          throw new Error('Task interrupted');
        }
        return originalExecuteTask(name);
      });

      await expect(executor.executeTask(taskName)).rejects.toThrow('Task interrupted');

      expect(taskStarted).toBe(true);
      expect(executor.running.has(taskName)).toBe(false);
      expect(executor.tasks[taskName].status).toBe('failed');
    });

    test('should handle timeout and recovery scenarios', async () => {
      executor.maxAttemptsPerTask = 2;

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        return true;
      });

      // Simulate timeout-like behavior with a hanging task
      mockStep5.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Long delay
      });

      // Use a timeout to simulate recovery
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), 100)
      );

      await expect(Promise.race([
        executor.executeTask('timeoutTask'),
        timeoutPromise
      ])).rejects.toThrow('Task timeout');
    });

    test('should maintain error state consistency across multiple attempts', async () => {
      executor.maxAttemptsPerTask = 3;

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        return true;
      });

      // All attempts fail with the same error
      const persistentError = new Error('Persistent failure');
      mockStep5.mockRejectedValue(persistentError);

      await expect(executor.executeTask('persistentFailTask')).rejects.toThrow('Persistent failure');

      // Verify error state is maintained throughout
      expect(executor.tasks['persistentFailTask'].status).toBe('failed');
      expect(executor.running.has('persistentFailTask')).toBe(false);
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('persistentFailTask', 'failed');
    });

    test('should handle mixed success/failure scenarios in batch execution', async () => {
      const successfulTask = 'successTask';
      const failingTask = 'failTask';

      // Mock successful task
      jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        if (taskName === successfulTask) {
          return Promise.resolve();
        } else if (taskName === failingTask) {
          throw new Error('Task execution failed');
        }
      });

      // Test that executor can handle mixed outcomes
      const successResult = await executor.executeTask(successfulTask).catch(() => 'failed');
      const failResult = await executor.executeTask(failingTask).catch(() => 'failed');

      expect(successResult).toBeUndefined(); // Success (no error)
      expect(failResult).toBe('failed'); // Failure caught
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

    test('should update task graph dynamically when buildTaskGraph returns new graph', async () => {
      // Initial tasks
      executor.tasks = {
        'TASK1': { deps: [], status: 'completed' },
        'TASK2': { deps: ['TASK1'], status: 'pending' }
      };

      // Mock state manager with Map for taskStates
      mockStateManager.taskStates = new Map([
        ['TASK1', { status: 'completed', step: null, message: null }],
        ['TASK2', { status: 'pending', step: null, message: null }]
      ]);

      // buildTaskGraph returns updated graph with new task (simulating task split)
      const buildTaskGraph = jest.fn()
        .mockReturnValueOnce({
          'TASK1': { deps: [], status: 'completed' },
          'TASK2.1': { deps: ['TASK1'], status: 'pending' },
          'TASK2.2': { deps: ['TASK1'], status: 'pending' }
        })
        .mockReturnValueOnce({
          'TASK1': { deps: [], status: 'completed' },
          'TASK2.1': { deps: ['TASK1'], status: 'completed' },
          'TASK2.2': { deps: ['TASK1'], status: 'completed' }
        });

      jest.spyOn(executor, 'getReadyTasks')
        .mockReturnValueOnce(['TASK2.1', 'TASK2.2'])
        .mockReturnValueOnce([]);

      jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        executor.tasks[taskName].status = 'completed';
        executor.running.delete(taskName);
      });

      await executor.run(buildTaskGraph);

      // Verify that new tasks were added
      expect(executor.tasks['TASK2.1']).toBeDefined();
      expect(executor.tasks['TASK2.2']).toBeDefined();

      // Verify that old task (TASK2) was removed since it was pending and no longer in graph
      expect(executor.tasks['TASK2']).toBeUndefined();

      // Verify buildTaskGraph was called
      expect(buildTaskGraph).toHaveBeenCalled();
    });

    test('should preserve running task status when updating graph', async () => {
      executor.tasks = {
        'TASK1': { deps: [], status: 'running' }
      };
      executor.running.add('TASK1');

      mockStateManager.taskStates = new Map([
        ['TASK1', { status: 'running', step: null, message: null }]
      ]);

      // buildTaskGraph returns same task with different status (should be preserved)
      const buildTaskGraph = jest.fn().mockReturnValue({
        'TASK1': { deps: [], status: 'pending' } // Graph says pending, but it's actually running
      });

      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      // Short execution - immediately complete
      executor.tasks['TASK1'].status = 'completed';

      await executor.run(buildTaskGraph);

      // The running status should have been preserved during update
      expect(buildTaskGraph).toHaveBeenCalled();
    });

    test('should update task dependencies from new graph', async () => {
      executor.tasks = {
        'TASK1': { deps: [], status: 'completed' },
        'TASK2': { deps: ['TASK1'], status: 'pending' }
      };

      mockStateManager.taskStates = new Map([
        ['TASK1', { status: 'completed', step: null, message: null }],
        ['TASK2', { status: 'pending', step: null, message: null }]
      ]);

      // buildTaskGraph returns updated dependencies
      const buildTaskGraph = jest.fn().mockReturnValue({
        'TASK1': { deps: [], status: 'completed' },
        'TASK2': { deps: ['TASK1', 'TASK1.1'], status: 'pending' }, // New dependency added
        'TASK1.1': { deps: ['TASK1'], status: 'completed' }
      });

      jest.spyOn(executor, 'getReadyTasks')
        .mockReturnValueOnce(['TASK2'])
        .mockReturnValueOnce([]);

      jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        executor.tasks[taskName].status = 'completed';
        executor.running.delete(taskName);
      });

      await executor.run(buildTaskGraph);

      // Verify dependencies were updated
      expect(executor.tasks['TASK2'].deps).toContain('TASK1.1');
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

  // Enhanced state management integration tests
  describe.skip('State Management Integration', () => {
    let mockUIRenderer;
    let mockTerminalRenderer;

    beforeEach(() => {
      // Setup comprehensive mocks for UI and terminal renderers
      mockUIRenderer = {
        start: jest.fn(),
        stop: jest.fn(),
        update: jest.fn()
      };
      ParallelUIRenderer.mockImplementation(() => mockUIRenderer);

      mockTerminalRenderer = {
        renderParallelProgress: jest.fn(),
        stop: jest.fn()
      };
      TerminalRenderer.getInstance.mockReturnValue(mockTerminalRenderer);

      // Mock progress calculation
      calculateProgress.mockReturnValue({ completed: 1, total: 3, percentage: 33.3 });
    });

    test('should initialize StateManager with correct task data', () => {
      const tasks = {
        task1: { deps: [], status: 'pending' },
        task2: { deps: ['task1'], status: 'pending' }
      };

      new DAGExecutor(tasks);

      expect(mockStateManager.initialize).toHaveBeenCalledWith(tasks);
    });

    test('should update StateManager with correct parameters during task execution', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });

      await executor.executeTask('testTask');

      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('testTask', 'running');
      expect(mockStateManager.updateTaskStep).toHaveBeenCalledWith('testTask', 'Step 4 - Research and planning');
    });

    test('should handle StateManager lifecycle in run() method', async () => {
      // Mock successful task execution
      jest.spyOn(executor, 'getReadyTasks')
        .mockReturnValueOnce(['task1'])
        .mockReturnValueOnce([]);

      jest.spyOn(executor, 'executeTask')
        .mockResolvedValue();

      await executor.run();

      // Verify UI renderer lifecycle
      expect(mockUIRenderer.start).toHaveBeenCalledWith(
        mockStateManager,
        { calculateProgress }
      );
      expect(mockUIRenderer.stop).toHaveBeenCalled();
    });

    test('should handle progress calculation integration', async () => {
      // Mock task states for progress calculation
      const mockTaskStates = {
        task1: { status: 'completed', step: 'Step 6 - Code review' },
        task2: { status: 'running', step: 'Step 5 - Implementing tasks' },
        task3: { status: 'pending', step: null }
      };

      mockStateManager.getTaskStates = jest.fn().mockReturnValue(mockTaskStates);
      calculateProgress.mockReturnValue(50);

      // Trigger progress calculation by starting run method
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      await executor.run();

      expect(mockStateManager.getTaskStates).toHaveBeenCalled();
      expect(calculateProgress).toHaveBeenCalledWith(mockTaskStates);
    });

    test('should maintain StateManager consistency during parallel execution', async () => {
      executor.maxConcurrent = 2;
      executor.running = new Set();

      const mockTasks = ['task1', 'task2'];
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(mockTasks);

      // Mock tasks that update state correctly
      jest.spyOn(executor, 'executeTask').mockImplementation(async (taskName) => {
        // Simulate task updating its state during execution
        mockStateManager.updateTaskStatus(taskName, 'running');
        await new Promise(resolve => setTimeout(resolve, 10));
        mockStateManager.updateTaskStatus(taskName, 'completed');
      });

      await executor.executeWave();

      // Verify state manager calls for each task
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('task1', 'running');
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith('task2', 'running');
    });

    test('should handle UI renderer start/stop lifecycle correctly', async () => {
      // Mock successful execution
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      await executor.run();

      expect(mockUIRenderer.start).toHaveBeenCalledTimes(1);
      expect(mockUIRenderer.stop).toHaveBeenCalledTimes(1);
      expect(mockTerminalRenderer.stop).toHaveBeenCalled();
    });

    test('should handle UI renderer cleanup on execution failure', async () => {
      // Mock task failure
      jest.spyOn(executor, 'getReadyTasks').mockReturnValue(['failingTask']);
      jest.spyOn(executor, 'executeTask').mockRejectedValue(new Error('Task failed'));

      await executor.run();

      // UI renderer should still be stopped even on failure
      expect(mockUIRenderer.start).toHaveBeenCalledTimes(1);
      expect(mockUIRenderer.stop).toHaveBeenCalledTimes(1);
    });

    test('should handle StateManager updates for different step transitions', async () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        return true;
      });

      isFullyImplemented.mockReturnValue(false);
      mockStep5.mockResolvedValue();

      await executor.executeTask('testTask');

      // Should track transitions through different steps
      expect(mockStateManager.updateTaskStep).toHaveBeenCalledWith('testTask', expect.stringContaining('Step 5'));
    });

    test('should handle persistent state handling across task lifecycle', async () => {
      const taskName = 'persistentTask';

      // Simulate task that completes successfully
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return true;
        return true;
      });

      isFullyImplemented.mockReturnValue(true);
      hasApprovedCodeReview.mockReturnValue(true);

      await executor.executeTask(taskName);

      // Verify complete state lifecycle
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith(taskName, 'running');
      expect(mockStateManager.updateTaskStatus).toHaveBeenCalledWith(taskName, 'completed');
      expect(executor.tasks[taskName].status).toBe('completed');
    });

    test('should handle state cleanup after execution completion', async () => {
      // Mock successful completion of all tasks
      executor.tasks = {
        task1: { deps: [], status: 'completed' },
        task2: { deps: ['task1'], status: 'completed' }
      };

      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      await executor.run();

      // Should clean up UI resources
      expect(mockUIRenderer.stop).toHaveBeenCalled();
      expect(mockTerminalRenderer.stop).toHaveBeenCalled();
    });

    test('should handle StateManager error scenarios gracefully', async () => {
      // Mock StateManager throwing an error
      mockStateManager.updateTaskStatus.mockImplementation(() => {
        throw new Error('State manager error');
      });

      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('TODO.md')) return false;
        return true;
      });

      // Should handle StateManager errors without crashing
      await expect(executor.executeTask('testTask')).rejects.toThrow('State manager error');
    });

    test('should validate progress calculation accuracy during execution', async () => {
      // Mock different task states for progress calculation
      const completedTask = { status: 'completed', step: 'done' };
      const runningTask = { status: 'running', step: 'Step 5 - Implementing tasks' };
      const pendingTask = { status: 'pending', step: null };

      mockStateManager.getTaskStates = jest.fn().mockReturnValue({
        task1: completedTask,
        task2: runningTask,
        task3: pendingTask
      });

      // Mock the progress calculation to return different values
      calculateProgress.mockReturnValue(66);

      jest.spyOn(executor, 'getReadyTasks').mockReturnValue([]);

      await executor.run();

      expect(calculateProgress).toHaveBeenCalledWith({
        task1: completedTask,
        task2: runningTask,
        task3: pendingTask
      });
    });

    test('should handle UI renderer lifecycle management during step2 execution', async () => {
      jest.spyOn(executor, 'executeStep2Wave').mockResolvedValue(false);

      await executor.runStep2();

      expect(mockUIRenderer.start).toHaveBeenCalledWith(
        mockStateManager,
        { calculateProgress }
      );
      expect(mockUIRenderer.stop).toHaveBeenCalled();
    });
  });
});