const ParallelStateManager = require('./parallel-state-manager');

describe('ParallelStateManager', () => {
  let manager;

  beforeEach(() => {
    // Reset singleton instance before each test
    ParallelStateManager.reset();
    manager = new ParallelStateManager();
  });

  afterEach(() => {
    ParallelStateManager.reset();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const manager1 = new ParallelStateManager();
      const manager2 = new ParallelStateManager();

      expect(manager1).toBe(manager2);
    });

    test('should maintain state across instances', () => {
      const manager1 = new ParallelStateManager();
      manager1.initialize(['task1']);

      const manager2 = new ParallelStateManager();
      const states = manager2.getAllTaskStates();

      expect(states).toHaveProperty('task1');
    });
  });

  describe('initialize', () => {
    test('should initialize with empty array', () => {
      manager.initialize([]);
      const states = manager.getAllTaskStates();

      expect(states).toEqual({});
      expect(manager.isUIRendererActive()).toBe(false);
    });

    test('should initialize with single task', () => {
      manager.initialize(['task1']);
      const states = manager.getAllTaskStates();

      expect(states).toEqual({
        task1: {
          status: 'pending',
          step: null,
          message: null
        }
      });
    });

    test('should initialize with multiple tasks', () => {
      manager.initialize(['task1', 'task2', 'task3']);
      const states = manager.getAllTaskStates();

      expect(Object.keys(states)).toHaveLength(3);
      expect(states.task1.status).toBe('pending');
      expect(states.task2.status).toBe('pending');
      expect(states.task3.status).toBe('pending');
    });

    test('should clear previous state on re-initialization', () => {
      manager.initialize(['task1']);
      manager.initialize(['task2']);
      const states = manager.getAllTaskStates();

      expect(states).not.toHaveProperty('task1');
      expect(states).toHaveProperty('task2');
      expect(manager.isUIRendererActive()).toBe(false);
    });

    test('should initialize from object preserving status', () => {
      manager.initialize({
        task1: { status: 'completed' },
        task2: { status: 'failed' },
        task3: {}
      });

      const states = manager.getAllTaskStates();
      expect(states.task1.status).toBe('completed');
      expect(states.task2.status).toBe('failed');
      expect(states.task3.status).toBe('pending');
    });

    test('should throw error for invalid input', () => {
      expect(() => manager.initialize(null)).toThrow('Tasks must be an array or object');
      expect(() => manager.initialize(undefined)).toThrow('Tasks must be an array or object');
      expect(() => manager.initialize('task1')).toThrow('Tasks must be an array or object');
    });
  });

  describe('updateTaskStatus', () => {
    beforeEach(() => {
      manager.initialize(['task1']);
    });

    test('should update to pending', () => {
      manager.updateTaskStatus('task1', 'pending');
      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('pending');
    });

    test('should update to running', () => {
      manager.updateTaskStatus('task1', 'running');
      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('running');
    });

    test('should update to completed', () => {
      manager.updateTaskStatus('task1', 'completed');
      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('completed');
    });

    test('should update to failed', () => {
      manager.updateTaskStatus('task1', 'failed');
      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('failed');
    });

    test('should throw error for invalid status', () => {
      expect(() => manager.updateTaskStatus('task1', 'invalid')).toThrow('Invalid status');
      expect(() => manager.updateTaskStatus('task1', 'RUNNING')).toThrow('Invalid status');
      expect(() => manager.updateTaskStatus('task1', null)).toThrow('Invalid status');
    });

    test('should handle unknown task name gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => manager.updateTaskStatus('unknown', 'running')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Unknown task name: unknown');

      consoleSpy.mockRestore();
    });

    test('should allow multiple status transitions', () => {
      manager.updateTaskStatus('task1', 'running');
      manager.updateTaskStatus('task1', 'completed');
      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('completed');
    });
  });

  describe('updateTaskStep', () => {
    beforeEach(() => {
      manager.initialize(['task1']);
    });

    test('should update step with string value', () => {
      manager.updateTaskStep('task1', 'Step 1: Reading files');
      const states = manager.getAllTaskStates();

      expect(states.task1.step).toBe('Step 1: Reading files');
    });

    test('should update step with null value', () => {
      manager.updateTaskStep('task1', 'Step 1');
      manager.updateTaskStep('task1', null);
      const states = manager.getAllTaskStates();

      expect(states.task1.step).toBeNull();
    });

    test('should update step with undefined value', () => {
      manager.updateTaskStep('task1', 'Step 1');
      manager.updateTaskStep('task1', undefined);
      const states = manager.getAllTaskStates();

      expect(states.task1.step).toBeUndefined();
    });

    test('should handle unknown task name gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => manager.updateTaskStep('unknown', 'Step 1')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Unknown task name: unknown');

      consoleSpy.mockRestore();
    });

    test('should allow multiple step updates', () => {
      manager.updateTaskStep('task1', 'Step 1');
      manager.updateTaskStep('task1', 'Step 2');
      manager.updateTaskStep('task1', 'Step 3');
      const states = manager.getAllTaskStates();

      expect(states.task1.step).toBe('Step 3');
    });
  });

  describe('updateClaudeMessage', () => {
    beforeEach(() => {
      manager.initialize(['task1']);
    });

    test('should store message under 100 characters', () => {
      const message = 'Short message';
      manager.updateClaudeMessage('task1', message);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe('Short message');
    });

    test('should store message exactly 100 characters', () => {
      const message = 'a'.repeat(100);
      manager.updateClaudeMessage('task1', message);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe(message);
      expect(states.task1.message).toHaveLength(100);
    });

    test('should truncate message over 100 characters', () => {
      const message = 'a'.repeat(150);
      manager.updateClaudeMessage('task1', message);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe('a'.repeat(100) + '...');
      expect(states.task1.message).toHaveLength(103); // 100 + '...'
    });

    test('should truncate long message with meaningful text', () => {
      const message = 'This is a very long message that needs to be truncated because it exceeds the 100 character limit set by the system requirements';
      manager.updateClaudeMessage('task1', message);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe(message.substring(0, 100) + '...');
      expect(states.task1.message).toHaveLength(103);
    });

    test('should handle null message', () => {
      manager.updateClaudeMessage('task1', 'Some message');
      manager.updateClaudeMessage('task1', null);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBeNull();
    });

    test('should handle undefined message', () => {
      manager.updateClaudeMessage('task1', 'Some message');
      manager.updateClaudeMessage('task1', undefined);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBeNull();
    });

    test('should handle empty string', () => {
      manager.updateClaudeMessage('task1', '');
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBeNull();
    });

    test('should handle unknown task name gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => manager.updateClaudeMessage('unknown', 'message')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Unknown task name: unknown');

      consoleSpy.mockRestore();
    });

    test('should allow multiple message updates', () => {
      manager.updateClaudeMessage('task1', 'First message');
      manager.updateClaudeMessage('task1', 'Second message');
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe('Second message');
    });
  });

  describe('UI renderer state', () => {
    test('should toggle UI renderer active flag', () => {
      expect(manager.isUIRendererActive()).toBe(false);
      manager.setUIRendererActive(true);
      expect(manager.isUIRendererActive()).toBe(true);
      manager.setUIRendererActive(false);
      expect(manager.isUIRendererActive()).toBe(false);
    });

    test('should coerce non-boolean values when toggling', () => {
      manager.setUIRendererActive('truthy');
      expect(manager.isUIRendererActive()).toBe(true);
      manager.setUIRendererActive(0);
      expect(manager.isUIRendererActive()).toBe(false);
    });
  });

  describe('getAllTaskStates', () => {
    test('should return empty object for uninitialized manager', () => {
      const states = manager.getAllTaskStates();

      expect(states).toEqual({});
    });

    test('should return all task states', () => {
      manager.initialize(['task1', 'task2']);
      const states = manager.getAllTaskStates();

      expect(Object.keys(states)).toHaveLength(2);
      expect(states).toHaveProperty('task1');
      expect(states).toHaveProperty('task2');
    });

    test('should return correct state format', () => {
      manager.initialize(['task1']);
      const states = manager.getAllTaskStates();

      expect(states.task1).toHaveProperty('status');
      expect(states.task1).toHaveProperty('step');
      expect(states.task1).toHaveProperty('message');
    });

    test('should return updated states', () => {
      manager.initialize(['task1']);
      manager.updateTaskStatus('task1', 'running');
      manager.updateTaskStep('task1', 'Processing');
      manager.updateClaudeMessage('task1', 'Working on it');

      const states = manager.getAllTaskStates();

      expect(states.task1).toEqual({
        status: 'running',
        step: 'Processing',
        message: 'Working on it'
      });
    });

    test('should not expose internal state Map', () => {
      manager.initialize(['task1']);
      const states = manager.getAllTaskStates();

      expect(states).not.toBe(manager.taskStates);
      expect(states instanceof Map).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should not crash on null task name in updateTaskStatus', () => {
      manager.initialize(['task1']);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => manager.updateTaskStatus(null, 'running')).not.toThrow();

      consoleSpy.mockRestore();
    });

    test('should not crash on null task name in updateTaskStep', () => {
      manager.initialize(['task1']);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => manager.updateTaskStep(null, 'Step 1')).not.toThrow();

      consoleSpy.mockRestore();
    });

    test('should not crash on null task name in updateClaudeMessage', () => {
      manager.initialize(['task1']);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => manager.updateClaudeMessage(null, 'message')).not.toThrow();

      consoleSpy.mockRestore();
    });

    test('should handle concurrent updates simulation', () => {
      manager.initialize(['task1', 'task2', 'task3']);

      // Simulate concurrent updates
      manager.updateTaskStatus('task1', 'running');
      manager.updateTaskStatus('task2', 'running');
      manager.updateTaskStep('task1', 'Step 1');
      manager.updateTaskStatus('task3', 'running');
      manager.updateClaudeMessage('task2', 'Processing');
      manager.updateTaskStep('task3', 'Step 1');

      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('running');
      expect(states.task1.step).toBe('Step 1');
      expect(states.task2.status).toBe('running');
      expect(states.task2.message).toBe('Processing');
      expect(states.task3.status).toBe('running');
      expect(states.task3.step).toBe('Step 1');
    });

    test('should handle special characters in messages', () => {
      manager.initialize(['task1']);
      const message = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\n\t\\';

      manager.updateClaudeMessage('task1', message);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe(message);
    });

    test('should handle unicode characters in messages', () => {
      manager.initialize(['task1']);
      const message = '👍 Unicode 测试 émojis 🚀';

      manager.updateClaudeMessage('task1', message);
      const states = manager.getAllTaskStates();

      expect(states.task1.message).toBe(message);
    });

    test('should maintain state integrity across multiple operations', () => {
      manager.initialize(['task1']);

      manager.updateTaskStatus('task1', 'running');
      expect(manager.getAllTaskStates().task1.status).toBe('running');

      manager.updateTaskStep('task1', 'Step 1');
      expect(manager.getAllTaskStates().task1.status).toBe('running');
      expect(manager.getAllTaskStates().task1.step).toBe('Step 1');

      manager.updateClaudeMessage('task1', 'Message');
      expect(manager.getAllTaskStates().task1.status).toBe('running');
      expect(manager.getAllTaskStates().task1.step).toBe('Step 1');
      expect(manager.getAllTaskStates().task1.message).toBe('Message');

      manager.updateTaskStatus('task1', 'completed');
      expect(manager.getAllTaskStates().task1.status).toBe('completed');
      expect(manager.getAllTaskStates().task1.step).toBe('Step 1');
      expect(manager.getAllTaskStates().task1.message).toBe('Message');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle full task lifecycle', () => {
      manager.initialize(['task1']);

      // Task starts
      manager.updateTaskStatus('task1', 'running');
      manager.updateTaskStep('task1', 'Initializing');
      manager.updateClaudeMessage('task1', 'Starting task execution');

      let states = manager.getAllTaskStates();
      expect(states.task1.status).toBe('running');
      expect(states.task1.step).toBe('Initializing');

      // Task progresses
      manager.updateTaskStep('task1', 'Processing files');
      manager.updateClaudeMessage('task1', 'Reading and analyzing files');

      states = manager.getAllTaskStates();
      expect(states.task1.step).toBe('Processing files');

      // Task completes
      manager.updateTaskStatus('task1', 'completed');
      manager.updateTaskStep('task1', 'Done');
      manager.updateClaudeMessage('task1', 'Task completed successfully');

      states = manager.getAllTaskStates();
      expect(states.task1.status).toBe('completed');
      expect(states.task1.step).toBe('Done');
      expect(states.task1.message).toBe('Task completed successfully');
    });

    test('should handle multiple parallel tasks', () => {
      manager.initialize(['task1', 'task2', 'task3']);

      // All tasks start
      manager.updateTaskStatus('task1', 'running');
      manager.updateTaskStatus('task2', 'running');
      manager.updateTaskStatus('task3', 'running');

      // Tasks progress independently
      manager.updateTaskStep('task1', 'Step 1');
      manager.updateTaskStep('task2', 'Step 1');
      manager.updateTaskStep('task3', 'Step 1');

      // Task 1 completes
      manager.updateTaskStatus('task1', 'completed');

      // Task 2 fails
      manager.updateTaskStatus('task2', 'failed');
      manager.updateClaudeMessage('task2', 'Error: File not found');

      // Task 3 still running
      manager.updateTaskStep('task3', 'Step 2');

      const states = manager.getAllTaskStates();

      expect(states.task1.status).toBe('completed');
      expect(states.task2.status).toBe('failed');
      expect(states.task2.message).toBe('Error: File not found');
      expect(states.task3.status).toBe('running');
      expect(states.task3.step).toBe('Step 2');
    });
  });
});
