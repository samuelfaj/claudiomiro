import { ProgressCalculator, TaskState } from '../progress-calculator';

describe('ProgressCalculator', () => {
  describe('calculateProgress', () => {
    it('should return 0 for empty task states', () => {
      expect(ProgressCalculator.calculateProgress({})).toBe(0);
    });

    it('should return 0 for null or undefined input', () => {
      expect(ProgressCalculator.calculateProgress(null as any)).toBe(0);
      expect(ProgressCalculator.calculateProgress(undefined as any)).toBe(0);
    });

    it('should return 0 for non-object input', () => {
      expect(ProgressCalculator.calculateProgress('invalid' as any)).toBe(0);
      expect(ProgressCalculator.calculateProgress(123 as any)).toBe(0);
    });

    it('should calculate 0% progress for tasks with no steps completed', () => {
      const taskStates = {
        task1: { status: 'pending', step: 'step 1' },
        task2: { status: 'pending', step: 'step 1' }
      };

      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(0);
    });

    it('should calculate 0% progress when one task is on step 2', () => {
      const taskStates = {
        task1: { status: 'in_progress', step: 'step 2' },
        task2: { status: 'pending', step: 'step 1' },
        task3: { status: 'pending', step: 'step 1' }
      };

      // 0 completed steps out of 3 tasks * 3 steps = 0/9 = 0%
      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(0);
    });

    it('should calculate 100% progress when all tasks are completed', () => {
      const taskStates = {
        task1: { status: 'completed', step: 'done' },
        task2: { status: 'completed', step: 'step 4' }
      };

      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(100);
    });

    it('should calculate 50% progress for failed tasks', () => {
      const taskStates = {
        task1: { status: 'failed', step: 'error' },
        task2: { status: 'failed' }
      };

      // task1: failed with step='error' -> 0 steps
      // task2: failed with no step -> 3 steps
      // Total: 0 + 3 = 3 steps completed out of 6 possible (2 tasks * 3 steps) = 50%
      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(50);
    });

    it('should handle tasks with "done" prefix in step', () => {
      const taskStates = {
        task1: { status: 'in_progress', step: 'done with step 4' },
        task2: { status: 'pending', step: 'step 1' }
      };

      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(50);
    });

    it('should handle tasks with no step information', () => {
      const taskStates = {
        task1: { status: 'pending' },
        task2: { status: 'completed' }
      };

      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(50);
    });

    it('should handle mixed task states', () => {
      const taskStates = {
        task1: { status: 'completed', step: 'step 4' },
        task2: { status: 'in_progress', step: 'step 3' },
        task3: { status: 'pending', step: 'step 1' },
        task4: { status: 'failed', step: 'error' }
      };

      // task1: completed = 3 steps, task2: step 3 = 1 step, task3: step 1 = 0 steps, task4: failed with step='error' = 0 steps
      // Total: 3 + 1 + 0 + 0 = 4 steps completed out of 12 possible (4 tasks * 3 steps) = 33%
      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(33);
    });
  });

  // Type safety tests
  describe('Type safety', () => {
    it('should enforce TaskState interface', () => {
      const validState: TaskState = {
        status: 'completed',
        step: 'step 4',
        message: 'Task completed successfully'
      };

      const partialState: TaskState = {
        status: 'pending'
      };

      const taskStates: Record<string, TaskState> = {
        task1: validState,
        task2: partialState
      };

      const progress: number = ProgressCalculator.calculateProgress(taskStates);
      expect(typeof progress).toBe('number');
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('should handle edge cases with proper types', () => {
      const edgeCaseStates: Record<string, TaskState> = {
        task1: {},
        task2: { status: '', step: '' },
        task3: { status: 'completed', step: 'step 2' }
      };

      const progress = ProgressCalculator.calculateProgress(edgeCaseStates);
      expect(typeof progress).toBe('number');
    });
  });

  describe('Edge cases', () => {
    it('should handle tasks with null state values', () => {
      const taskStates = {
        task1: null as any,
        task2: { status: 'completed', step: 'step 4' }
      };

      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(50);
    });

    it('should handle tasks with undefined state values', () => {
      const taskStates = {
        task1: undefined as any,
        task2: { status: 'completed', step: 'step 4' }
      };

      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(50);
    });

    it('should handle step names with different cases', () => {
      const taskStates = {
        task1: { status: 'in_progress', step: 'STEP 2' },
        task2: { status: 'in_progress', step: 'Step 3' },
        task3: { status: 'in_progress', step: 'step 4' }
      };

      // All steps normalized to lowercase: STEP 2 = 0 steps, Step 3 = 1 step, step 4 = 2 steps
      // Total: 0 + 1 + 2 = 3 steps completed out of 9 possible (3 tasks * 3 steps) = 33%
      expect(ProgressCalculator.calculateProgress(taskStates)).toBe(33);
    });
  });
});