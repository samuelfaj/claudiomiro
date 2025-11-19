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

  describe('Advanced Concurrency Scenarios', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle true concurrent access with Promise.all() and varied delays', async () => {
      manager.initialize(['task1', 'task2', 'task3', 'task4', 'task5']);

      // Simulate true concurrent operations with different timing patterns
      const concurrentOperations = [
        // Status updates with different delays
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('task1', 'running');
            resolve('task1-status');
          }, 10);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('task2', 'running');
            resolve('task2-status');
          }, 5);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('task3', 'running');
            resolve('task3-status');
          }, 15);
        }),

        // Step updates with different delays
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStep('task1', 'Step 1');
            resolve('task1-step');
          }, 8);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStep('task2', 'Step 1');
            resolve('task2-step');
          }, 12);
        }),

        // Message updates with different delays
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateClaudeMessage('task1', 'Processing data');
            resolve('task1-message');
          }, 3);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateClaudeMessage('task2', 'Analyzing files');
            resolve('task2-message');
          }, 18);
        })
      ];

      // Advance timers to trigger all operations
      jest.advanceTimersByTime(20);

      // Wait for all concurrent operations to complete
      const results = await Promise.all(concurrentOperations);

      // Verify all operations completed successfully
      expect(results).toHaveLength(7);

      const states = manager.getAllTaskStates();
      expect(states.task1.status).toBe('running');
      expect(states.task1.step).toBe('Step 1');
      expect(states.task1.message).toBe('Processing data');
      expect(states.task2.status).toBe('running');
      expect(states.task2.step).toBe('Step 1');
      expect(states.task2.message).toBe('Analyzing files');
      expect(states.task3.status).toBe('running');
    });

    test('should maintain state consistency under high-frequency concurrent updates', async () => {
      const taskNames = Array.from({length: 50}, (_, i) => `task${i}`);
      manager.initialize(taskNames);

      // Create 100+ concurrent operations (performance target validation)
      const highFrequencyOperations = [];

      // Status updates for all tasks
      taskNames.forEach(taskName => {
        highFrequencyOperations.push(
          new Promise(resolve => {
            setTimeout(() => {
              manager.updateTaskStatus(taskName, 'running');
              resolve(`${taskName}-status`);
            }, Math.random() * 50);
          })
        );

        highFrequencyOperations.push(
          new Promise(resolve => {
            setTimeout(() => {
              manager.updateTaskStep(taskName, 'Processing');
              resolve(`${taskName}-step`);
            }, Math.random() * 50);
          })
        );

        highFrequencyOperations.push(
          new Promise(resolve => {
            setTimeout(() => {
              manager.updateClaudeMessage(taskName, `Processing ${taskName}`);
              resolve(`${taskName}-message`);
            }, Math.random() * 50);
          })
        );
      });

      // Advance timers to trigger all operations (simulate under 100ms target)
      jest.advanceTimersByTime(60);

      // Wait for all operations to complete
      const results = await Promise.all(highFrequencyOperations);

      // Verify all 150 operations completed
      expect(results).toHaveLength(150);

      const states = manager.getAllTaskStates();

      // Verify state consistency across all tasks
      taskNames.forEach(taskName => {
        expect(states[taskName].status).toBe('running');
        expect(states[taskName].step).toBe('Processing');
        expect(states[taskName].message).toBe(`Processing ${taskName}`);
      });
    });

    test('should handle singleton pattern race conditions with concurrent instantiation', async () => {
      // Test singleton pattern under concurrent instantiation pressure
      const concurrentInstantiation = Array.from({length: 20}, () =>
        new Promise(resolve => {
          setTimeout(() => {
            const newInstance = new ParallelStateManager();
            resolve(newInstance);
          }, Math.random() * 30);
        })
      );

      // Advance timers and wait for all instantiations
      jest.advanceTimersByTime(40);
      const instances = await Promise.all(concurrentInstantiation);

      // Verify all instances are the same (singleton pattern holds)
      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });

      // Verify state is shared across all "instances"
      firstInstance.initialize(['shared-task']);
      const states = instances[10].getAllTaskStates();
      expect(states).toHaveProperty('shared-task');
    });

    test('should validate state invariants under concurrent mixed operations', async () => {
      manager.initialize(['critical-task']);

      // Mix of valid and invalid operations to test thread safety
      const mixedOperations = [
        // Valid operations
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('critical-task', 'running');
            resolve('valid-status');
          }, 5);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStep('critical-task', 'Step 1');
            resolve('valid-step');
          }, 10);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateClaudeMessage('critical-task', 'Valid message');
            resolve('valid-message');
          }, 15);
        }),

        // Invalid operations (should not corrupt state)
        new Promise(resolve => {
          setTimeout(() => {
            try {
              manager.updateTaskStatus('critical-task', 'invalid-status');
              resolve('invalid-status-should-fail');
            } catch (error) {
              resolve('invalid-status-caught-error');
            }
          }, 8);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('non-existent-task', 'running');
            resolve('unknown-task-handled');
          }, 12);
        })
      ];

      // Advance timers and execute operations
      jest.advanceTimersByTime(20);
      const results = await Promise.all(mixedOperations);

      // Verify state invariants are maintained
      const states = manager.getAllTaskStates();
      expect(states['critical-task']).toBeDefined();
      expect(states['critical-task'].status).toBe('running');
      expect(states['critical-task'].step).toBe('Step 1');
      expect(states['critical-task'].message).toBe('Valid message');

      // Verify error handling worked correctly
      expect(results).toContain('invalid-status-caught-error');
      expect(results).toContain('unknown-task-handled');
    });

    test('should handle rapid re-initialization under concurrent access', async () => {
      // Test re-initialization edge case with concurrent operations
      manager.initialize(['initial-task']);

      const rapidReinitOperations = [
        new Promise(resolve => {
          setTimeout(() => {
            manager.initialize(['new-task-1', 'new-task-2']);
            resolve('reinit-1');
          }, 5);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.initialize(['new-task-3']);
            resolve('reinit-2');
          }, 10);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.initialize({ 'preserved-task': { status: 'completed' } });
            resolve('reinit-3');
          }, 15);
        })
      ];

      // Advance timers and execute rapid re-initializations
      jest.advanceTimersByTime(20);
      const results = await Promise.all(rapidReinitOperations);

      // Verify final state is consistent
      const states = manager.getAllTaskStates();
      expect(states).toHaveProperty('preserved-task');
      expect(states['preserved-task'].status).toBe('completed');
      expect(manager.isUIRendererActive()).toBe(false);

      // Previous tasks should be cleared
      expect(states).not.toHaveProperty('initial-task');
      expect(states).not.toHaveProperty('new-task-1');
      expect(states).not.toHaveProperty('new-task-2');
      expect(states).not.toHaveProperty('new-task-3');
    });

    test('should ensure atomic state operations under concurrent stress', async () => {
      manager.initialize(['atomic-task']);

      // Create operations that should be atomic
      const atomicOperations = Array.from({length: 100}, (_, i) =>
        new Promise(resolve => {
          setTimeout(() => {
            // Each operation should see a consistent state
            const beforeState = manager.getAllTaskStates()['atomic-task'];

            // Perform state update
            manager.updateTaskStatus('atomic-task', 'running');
            manager.updateClaudeMessage('atomic-task', `Update ${i}`);

            const afterState = manager.getAllTaskStates()['atomic-task'];

            // State should be consistent (status should be 'running', message should be from this operation)
            expect(afterState.status).toBe('running');
            expect(afterState.message).toBe(`Update ${i}`);

            resolve(`atomic-operation-${i}-completed`);
          }, Math.random() * 80);
        })
      );

      // Execute all atomic operations
      jest.advanceTimersByTime(100);
      const results = await Promise.all(atomicOperations);

      // Verify all operations completed successfully
      expect(results).toHaveLength(100);

      // Final state should reflect the last operation
      const finalState = manager.getAllTaskStates()['atomic-task'];
      expect(finalState.status).toBe('running');
    });
  });

  describe('Performance Regression Tests', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle 100+ concurrent state updates within timing targets', async () => {
      const largeTaskSet = Array.from({length: 30}, (_, i) => `perf-task-${i}`);
      manager.initialize(largeTaskSet);

      // Create 120 concurrent operations (exceeding 100 target)
      const performanceOperations = [];

      largeTaskSet.forEach(taskName => {
        // 4 operations per task = 120 total operations
        for (let op = 0; op < 4; op++) {
          performanceOperations.push(
            new Promise(resolve => {
              setTimeout(() => {
                const startTime = Date.now();

                switch (op % 4) {
                  case 0:
                    manager.updateTaskStatus(taskName, 'running');
                    break;
                  case 1:
                    manager.updateTaskStep(taskName, `Step ${op}`);
                    break;
                  case 2:
                    manager.updateClaudeMessage(taskName, `Message ${op}`);
                    break;
                  case 3:
                    manager.getAllTaskStates(); // Simulate read operation
                    break;
                }

                const endTime = Date.now();
                resolve(endTime - startTime);
              }, Math.random() * 90);
            })
          );
        }
      });

      // Execute within 100ms timing target
      jest.advanceTimersByTime(100);
      const operationTimes = await Promise.all(performanceOperations);

      // Verify performance targets (all operations should complete "instantly" with fake timers)
      expect(operationTimes).toHaveLength(120);
      expect(operationTimes.every(time => time >= 0)).toBe(true);

      // Verify final state consistency
      const states = manager.getAllTaskStates();
      expect(Object.keys(states)).toHaveLength(30);

      largeTaskSet.forEach(taskName => {
        expect(states[taskName]).toBeDefined();
        expect(states[taskName].status).toBe('running');
      });
    });

    test('should maintain memory efficiency for large task sets', async () => {
      // Test memory usage patterns with 50+ tasks
      const largeTaskSet = Array.from({length: 50}, (_, i) => `memory-task-${i}`);
      manager.initialize(largeTaskSet);

      // Perform multiple state updates per task
      const memoryTestOperations = largeTaskSet.flatMap(taskName => [
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus(taskName, 'running');
            resolve(`${taskName}-status`);
          }, Math.random() * 50);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStep(taskName, 'Long step description that uses more memory');
            resolve(`${taskName}-step`);
          }, Math.random() * 50);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            const longMessage = 'x'.repeat(150); // Test truncation behavior
            manager.updateClaudeMessage(taskName, longMessage);
            resolve(`${taskName}-message`);
          }, Math.random() * 50);
        })
      ]);

      // Execute memory stress test
      jest.advanceTimersByTime(60);
      const results = await Promise.all(memoryTestOperations);

      // Verify all operations completed
      expect(results).toHaveLength(150);

      // Verify memory efficiency (messages should be truncated to 103 chars max)
      const states = manager.getAllTaskStates();
      largeTaskSet.forEach(taskName => {
        expect(states[taskName].message.length).toBeLessThanOrEqual(103);
      });

      // Verify state structure integrity
      expect(Object.keys(states)).toHaveLength(50);
    });
  });

  describe('Integration with ParallelUIRenderer', () => {
    let mockUIRenderer;

    beforeEach(() => {
      jest.useFakeTimers();
      mockUIRenderer = {
        start: jest.fn(),
        stop: jest.fn(),
        renderFrame: jest.fn().mockReturnValue(['Test line']),
        isUIRendererActive: jest.fn().mockReturnValue(false)
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should coordinate UI renderer lifecycle with state changes', async () => {
      // Test complete integration scenario
      manager.initialize(['integration-task-1', 'integration-task-2']);

      // Simulate UI renderer starting
      manager.setUIRendererActive(true);
      expect(manager.isUIRendererActive()).toBe(true);

      // Perform concurrent state changes while UI is active
      const stateChangeOperations = [
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('integration-task-1', 'running');
            manager.updateTaskStep('integration-task-1', 'Step 1');
            resolve('task1-started');
          }, 10);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('integration-task-2', 'running');
            manager.updateTaskStep('integration-task-2', 'Step 1');
            resolve('task2-started');
          }, 20);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('integration-task-1', 'completed');
            manager.updateClaudeMessage('integration-task-1', 'Task completed successfully');
            resolve('task1-completed');
          }, 50);
        })
      ];

      jest.advanceTimersByTime(100);
      const results = await Promise.all(stateChangeOperations);

      // Verify state changes occurred
      expect(results).toHaveLength(3);

      const finalStates = manager.getAllTaskStates();
      expect(finalStates['integration-task-1'].status).toBe('completed');
      expect(finalStates['integration-task-2'].status).toBe('running');
    });

    test('should handle UI renderer activation with state synchronization', async () => {
      manager.initialize(['sync-task-1', 'sync-task-2']);

      // Set initial states
      manager.updateTaskStatus('sync-task-1', 'running');
      manager.updateTaskStatus('sync-task-2', 'pending');

      // Activate UI renderer and verify state is accessible
      manager.setUIRendererActive(true);

      const statesForUI = manager.getAllTaskStates();
      expect(statesForUI).toHaveProperty('sync-task-1');
      expect(statesForUI).toHaveProperty('sync-task-2');
      expect(statesForUI['sync-task-1'].status).toBe('running');
      expect(statesForUI['sync-task-2'].status).toBe('pending');

      // Continue state updates with UI active
      const uiActiveUpdates = [
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStep('sync-task-1', 'Processing with UI');
            manager.updateClaudeMessage('sync-task-1', 'UI visible update');
            resolve('update-1');
          }, 15);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            manager.updateTaskStatus('sync-task-2', 'running');
            manager.updateTaskStep('sync-task-2', 'Starting with UI');
            resolve('update-2');
          }, 25);
        })
      ];

      jest.advanceTimersByTime(50);
      const updateResults = await Promise.all(uiActiveUpdates);

      expect(updateResults).toHaveLength(2);
      expect(manager.isUIRendererActive()).toBe(true);

      // Verify states are consistent for UI consumption
      const finalStates = manager.getAllTaskStates();
      expect(finalStates['sync-task-1'].step).toBe('Processing with UI');
      expect(finalStates['sync-task-1'].message).toBe('UI visible update');
      expect(finalStates['sync-task-2'].status).toBe('running');
      expect(finalStates['sync-task-2'].step).toBe('Starting with UI');
    });

    test('should handle error recovery scenarios with UI coordination', async () => {
      manager.initialize(['error-recovery-task']);

      // Simulate UI active state
      manager.setUIRendererActive(true);

      // Test state updates with error conditions
      const errorScenarios = [
        new Promise(resolve => {
          setTimeout(() => {
            try {
              // This should fail gracefully
              manager.updateTaskStatus('error-recovery-task', 'invalid-status');
              resolve('should-not-reach');
            } catch (error) {
              resolve('error-caught');
            }
          }, 10);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            // This should handle unknown task gracefully
            manager.updateTaskStatus('unknown-task', 'running');
            resolve('unknown-handled');
          }, 20);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            // This should work normally
            manager.updateTaskStatus('error-recovery-task', 'failed');
            manager.updateClaudeMessage('error-recovery-task', 'Simulated error occurred');
            resolve('normal-operation');
          }, 30);
        })
      ];

      jest.advanceTimersByTime(50);
      const errorResults = await Promise.all(errorScenarios);

      expect(errorResults).toContain('error-caught');
      expect(errorResults).toContain('unknown-handled');
      expect(errorResults).toContain('normal-operation');

      // Verify state is consistent despite errors
      const finalStates = manager.getAllTaskStates();
      expect(finalStates['error-recovery-task'].status).toBe('failed');
      expect(finalStates['error-recovery-task'].message).toBe('Simulated error occurred');
      expect(manager.isUIRendererActive()).toBe(true); // UI should remain active
    });
  });
});
