const { detectCycles, parseDependencies, rebuildTaskGraphFromFiles, resolveDeadlock } = require('./deadlock-resolver');

// Mock dependencies
jest.mock('fs');
jest.mock('./claude-executor');
jest.mock('../utils/logger');
jest.mock('../config/state', () => ({
  claudiomiroFolder: '/mock/claudiomiro'
}));

const fs = require('fs');
const { executeClaude } = require('./claude-executor');
const logger = require('../utils/logger');

describe('deadlock-resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default logger mocks
    logger.info = jest.fn();
    logger.warning = jest.fn();
    logger.error = jest.fn();
    logger.success = jest.fn();
    logger.newline = jest.fn();
    logger.startSpinner = jest.fn();
    logger.stopSpinner = jest.fn();
  });

  describe('detectCycles', () => {
    test('should detect simple circular dependency between two tasks', () => {
      const tasks = {
        TASK1: { deps: ['TASK2'], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' }
      };

      const cycles = detectCycles(tasks);

      expect(cycles.length).toBeGreaterThan(0);
      // Should contain both tasks in the cycle
      const cycleFlat = cycles.flat();
      expect(cycleFlat).toContain('TASK1');
      expect(cycleFlat).toContain('TASK2');
    });

    test('should detect circular dependency among three tasks', () => {
      const tasks = {
        TASK1: { deps: ['TASK2'], status: 'pending' },
        TASK2: { deps: ['TASK3'], status: 'pending' },
        TASK3: { deps: ['TASK1'], status: 'pending' }
      };

      const cycles = detectCycles(tasks);

      expect(cycles.length).toBeGreaterThan(0);
    });

    test('should return empty array when no cycles exist', () => {
      const tasks = {
        TASK1: { deps: [], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' },
        TASK3: { deps: ['TASK1', 'TASK2'], status: 'pending' }
      };

      const cycles = detectCycles(tasks);

      expect(cycles).toEqual([]);
    });

    test('should handle tasks with no dependencies', () => {
      const tasks = {
        TASK1: { deps: [], status: 'pending' },
        TASK2: { deps: [], status: 'pending' }
      };

      const cycles = detectCycles(tasks);

      expect(cycles).toEqual([]);
    });

    test('should handle complex graph with multiple independent cycles', () => {
      const tasks = {
        // Cycle 1: A <-> B
        TASK_A: { deps: ['TASK_B'], status: 'pending' },
        TASK_B: { deps: ['TASK_A'], status: 'pending' },
        // Cycle 2: C -> D -> E -> C
        TASK_C: { deps: ['TASK_E'], status: 'pending' },
        TASK_D: { deps: ['TASK_C'], status: 'pending' },
        TASK_E: { deps: ['TASK_D'], status: 'pending' },
        // Independent task
        TASK_F: { deps: [], status: 'pending' }
      };

      const cycles = detectCycles(tasks);

      expect(cycles.length).toBeGreaterThan(0);
    });

    test('should handle self-referencing task', () => {
      const tasks = {
        TASK1: { deps: ['TASK1'], status: 'pending' }
      };

      const cycles = detectCycles(tasks);

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('TASK1');
    });

    test('should handle missing dependency references gracefully', () => {
      const tasks = {
        TASK1: { deps: ['TASK_MISSING'], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' }
      };

      // Should not throw
      const cycles = detectCycles(tasks);

      expect(Array.isArray(cycles)).toBe(true);
    });

    test('should handle empty task graph', () => {
      const tasks = {};

      const cycles = detectCycles(tasks);

      expect(cycles).toEqual([]);
    });

    test('should detect cycle in diamond pattern with back-edge', () => {
      const tasks = {
        //     TASK1
        //    /     \
        // TASK2   TASK3
        //    \     /
        //     TASK4 -> TASK1 (creates cycle)
        TASK1: { deps: [], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' },
        TASK3: { deps: ['TASK1'], status: 'pending' },
        TASK4: { deps: ['TASK2', 'TASK3', 'TASK1'], status: 'pending' }
      };

      // No cycle here - TASK4 depends on TASK1 but TASK1 doesn't depend on TASK4
      const cycles = detectCycles(tasks);
      expect(cycles).toEqual([]);

      // Now add the back-edge
      tasks.TASK1.deps = ['TASK4'];

      const cyclesWithBackEdge = detectCycles(tasks);
      expect(cyclesWithBackEdge.length).toBeGreaterThan(0);
    });
  });

  describe('parseDependencies', () => {
    test('should parse dependencies in bracket format', () => {
      const content = `# Task
@dependencies [TASK1, TASK2, TASK3]
Some description`;

      const deps = parseDependencies(content);

      expect(deps).toEqual(['TASK1', 'TASK2', 'TASK3']);
    });

    test('should parse dependencies without brackets', () => {
      const content = `# Task
@dependencies TASK1, TASK2
Some description`;

      const deps = parseDependencies(content);

      expect(deps).toEqual(['TASK1', 'TASK2']);
    });

    test('should handle single dependency', () => {
      const content = `# Task
@dependencies [TASK1]
Some description`;

      const deps = parseDependencies(content);

      expect(deps).toEqual(['TASK1']);
    });

    test('should return empty array when no dependencies', () => {
      const content = `# Task
Some description without dependencies`;

      const deps = parseDependencies(content);

      expect(deps).toEqual([]);
    });

    test('should handle @dependencies none', () => {
      const content = `# Task
@dependencies none
Some description`;

      const deps = parseDependencies(content);

      expect(deps).toEqual([]);
    });

    test('should handle empty brackets', () => {
      const content = `# Task
@dependencies []
Some description`;

      const deps = parseDependencies(content);

      expect(deps).toEqual([]);
    });

    test('should trim whitespace from dependency names', () => {
      const content = `# Task
@dependencies [ TASK1 ,  TASK2 ]
Some description`;

      const deps = parseDependencies(content);

      expect(deps).toEqual(['TASK1', 'TASK2']);
    });
  });

  describe('rebuildTaskGraphFromFiles', () => {
    test('should rebuild task graph from TASK.md files', async () => {
      const pendingTasks = [
        ['TASK1', { deps: [], status: 'pending' }],
        ['TASK2', { deps: ['TASK1'], status: 'pending' }]
      ];

      fs.existsSync.mockImplementation((path) => {
        return path.includes('TASK.md');
      });

      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('TASK1')) {
          return '# Task 1\n@dependencies []\nDescription';
        }
        if (path.includes('TASK2')) {
          return '# Task 2\n@dependencies [TASK1]\nDescription';
        }
        return '';
      });

      const tasks = await rebuildTaskGraphFromFiles(pendingTasks);

      expect(tasks.TASK1).toEqual({ deps: [], status: 'pending' });
      expect(tasks.TASK2).toEqual({ deps: ['TASK1'], status: 'pending' });
    });

    test('should skip tasks without TASK.md files', async () => {
      const pendingTasks = [
        ['TASK1', { deps: [], status: 'pending' }],
        ['TASK2', { deps: ['TASK1'], status: 'pending' }]
      ];

      fs.existsSync.mockImplementation((path) => {
        return path.includes('TASK1');
      });

      fs.readFileSync.mockReturnValue('# Task 1\n@dependencies []\nDescription');

      const tasks = await rebuildTaskGraphFromFiles(pendingTasks);

      expect(tasks.TASK1).toBeDefined();
      expect(tasks.TASK2).toBeUndefined();
    });
  });

  describe('resolveDeadlock', () => {
    test('should return true when AI successfully resolves deadlock', async () => {
      const tasks = {
        TASK1: { deps: ['TASK2'], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' }
      };
      const pendingTasks = Object.entries(tasks);

      // Mock executeClaude to succeed
      executeClaude.mockResolvedValue();

      // Mock fs to return fixed dependencies (no cycle)
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('TASK1')) {
          return '# Task 1\n@dependencies []\nDescription';
        }
        if (path.includes('TASK2')) {
          return '# Task 2\n@dependencies [TASK1]\nDescription';
        }
        return '';
      });

      const result = await resolveDeadlock(tasks, pendingTasks);

      expect(result).toBe(true);
      expect(executeClaude).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('✅ Deadlock resolution verified - no cycles remaining');
    });

    test('should return false when cycles still exist after AI resolution', async () => {
      const tasks = {
        TASK1: { deps: ['TASK2'], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' }
      };
      const pendingTasks = Object.entries(tasks);

      // Mock executeClaude to succeed
      executeClaude.mockResolvedValue();

      // Mock fs to return still-cyclic dependencies
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('TASK1')) {
          return '# Task 1\n@dependencies [TASK2]\nDescription';
        }
        if (path.includes('TASK2')) {
          return '# Task 2\n@dependencies [TASK1]\nDescription';
        }
        return '';
      });

      const result = await resolveDeadlock(tasks, pendingTasks);

      expect(result).toBe(false);
      expect(logger.warning).toHaveBeenCalledWith('⚠️ Cycles still detected after AI resolution:');
    });

    test('should return false when executeClaude throws an error', async () => {
      const tasks = {
        TASK1: { deps: ['TASK2'], status: 'pending' },
        TASK2: { deps: ['TASK1'], status: 'pending' }
      };
      const pendingTasks = Object.entries(tasks);

      // Mock executeClaude to throw
      executeClaude.mockRejectedValue(new Error('AI failed'));

      const result = await resolveDeadlock(tasks, pendingTasks);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to resolve deadlock: AI failed');
    });
  });
});
