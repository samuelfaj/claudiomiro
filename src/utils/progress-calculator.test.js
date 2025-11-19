const { calculateProgress } = require('./progress-calculator');

const makeState = (status, step = null, message = null) => ({ status, step, message });

describe('calculateProgress', () => {
  describe('Edge Cases', () => {
    test('returns 0 for zero tasks (empty object)', () => {
      expect(calculateProgress({})).toBe(0);
    });

    test('returns 0 for null input', () => {
      expect(calculateProgress(null)).toBe(0);
    });

    test('returns 0 for undefined input', () => {
      expect(calculateProgress(undefined)).toBe(0);
    });

    test('returns 0 for non-object input', () => {
      expect(calculateProgress('invalid')).toBe(0);
      expect(calculateProgress(123)).toBe(0);
      expect(calculateProgress([])).toBe(0);
    });
  });

  describe('Step-based progress', () => {
    test('returns 0% when no steps completed', () => {
      const taskStates = {
        task1: makeState('pending'),
        task2: makeState('running', 'Step 2 - Research and planning')
      };

      expect(calculateProgress(taskStates)).toBe(0);
    });

    test('counts steps completed for running tasks', () => {
      const taskStates = {
        task1: makeState('running', 'Step 3 - Implementing tasks'),
        task2: makeState('running', 'Step 4 - Code review and PR')
      };

      // (1 + 2) completed steps out of (2 tasks × 3 steps) = 50% → 50%
      expect(calculateProgress(taskStates)).toBe(50);
    });

    test('counts completed tasks as all steps finished', () => {
      const taskStates = {
        task1: makeState('completed'),
        task2: makeState('running', 'Step 4 - Code review and PR'),
        task3: makeState('pending')
      };

      // (3 + 2 + 0) / 9 = 55.55% → 56%
      expect(calculateProgress(taskStates)).toBe(56);
    });

    test('counts failed tasks based on the last recorded step', () => {
      const taskStates = {
        task1: makeState('failed', 'Step 4 - Code review and PR'),
        task2: makeState('completed'),
        task3: makeState('pending')
      };

      // (2 + 3 + 0) / 9 = 55.55% → 56%
      expect(calculateProgress(taskStates)).toBe(56);
    });

    test('returns 100% when every task is completed', () => {
      const taskStates = {
        task1: makeState('completed'),
        task2: makeState('completed'),
        task3: makeState('completed')
      };

      expect(calculateProgress(taskStates)).toBe(100);
    });

    test('ignores steps that are not recognised', () => {
      const taskStates = {
        task1: makeState('running', 'Custom phase'),
        task2: makeState('pending')
      };

      expect(calculateProgress(taskStates)).toBe(0);
    });
  });

  describe('Rounding behavior', () => {
    test('rounds down when fractional part is under .5', () => {
      const taskStates = {
        task1: makeState('running', 'Step 3 - Implementing tasks'),
        task2: makeState('pending'),
        task3: makeState('pending')
      };

      // 1 / 9 = 11.11% → 11%
      expect(calculateProgress(taskStates)).toBe(11);
    });

    test('rounds up when fractional part is .5 or higher', () => {
      const taskStates = {
        task1: makeState('completed'),
        task2: makeState('running', 'Step 4 - Code review and PR')
      };

      // (3 + 2) / 6 = 83.33% → 83%
      expect(calculateProgress(taskStates)).toBe(83);
    });
  });

  describe('Pure function behaviour', () => {
    test('does not modify input object', () => {
      const taskStates = {
        task1: makeState('completed'),
        task2: makeState('running', 'Step 3 - Implementing tasks')
      };
      const originalCopy = JSON.parse(JSON.stringify(taskStates));

      calculateProgress(taskStates);

      expect(taskStates).toEqual(originalCopy);
    });

    test('returns same result for repeated calls with same input', () => {
      const taskStates = {
        task1: makeState('completed'),
        task2: makeState('failed', 'Step 4 - Code review and PR'),
        task3: makeState('running', 'Step 3 - Implementing tasks')
      };

      const result1 = calculateProgress(taskStates);
      const result2 = calculateProgress(taskStates);
      const result3 = calculateProgress(taskStates);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('Single task scenarios', () => {
    test('returns 100% for a completed task', () => {
      const taskStates = { task1: makeState('completed') };
      expect(calculateProgress(taskStates)).toBe(100);
    });

    test('returns 67% for a task running Step 4', () => {
      const taskStates = {
        task1: makeState('running', 'Step 4 - Code review and PR')
      };
      expect(calculateProgress(taskStates)).toBe(67);
    });

    test('returns 33% for a task at Step 3', () => {
      const taskStates = {
        task1: makeState('running', 'Step 3 - Implementing tasks')
      };
      expect(calculateProgress(taskStates)).toBe(33);
    });

    test('returns 0% for a task at Step 2', () => {
      const taskStates = {
        task1: makeState('running', 'Step 2 - Research and planning')
      };
      expect(calculateProgress(taskStates)).toBe(0);
    });

    test('returns 0% for a pending task', () => {
      const taskStates = { task1: makeState('pending') };
      expect(calculateProgress(taskStates)).toBe(0);
    });
  });
});
