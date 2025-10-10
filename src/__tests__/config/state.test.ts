import * as path from 'path';

// Import the State class for testing
import { State } from '../../config/state';

describe('State', () => {
  beforeEach(() => {
    // Reset the singleton instance for each test
    // @ts-ignore - accessing private property for testing
    (State as any)._instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = State.getInstance();
      const instance2 = State.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance when previous is reset', () => {
      const instance1 = State.getInstance();
      // @ts-ignore - accessing private property for testing
      (State as any)._instance = null;
      const instance2 = State.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Folder Management', () => {
    it('should set and get folder correctly', () => {
      const state = State.getInstance();
      const testFolder = '/test/folder';

      state.setFolder(testFolder);

      expect(state.folder).toBe(path.resolve(testFolder));
      expect(state.claudiomiroFolder).toBe(path.join(path.resolve(testFolder), '.claudiomiro'));
    });

    it('should handle null folder initially', () => {
      const state = State.getInstance();

      expect(state.folder).toBeNull();
      expect(state.claudiomiroFolder).toBeNull();
    });
  });

  describe('Executor Type Management', () => {
    it('should set and get executor type correctly', () => {
      const state = State.getInstance();

      state.setExecutorType('codex');
      expect(state.executorType).toBe('codex');

      state.setExecutorType('gemini');
      expect(state.executorType).toBe('gemini');
    });

    it('should default to claude executor type', () => {
      const state = State.getInstance();
      expect(state.executorType).toBe('claude');
    });

    it('should throw error for invalid executor type', () => {
      const state = State.getInstance();

      expect(() => {
        state.setExecutorType('invalid' as any);
      }).toThrow('Invalid executor type: invalid');
    });

    it('should accept all valid executor types', () => {
      const state = State.getInstance();
      const validTypes: Array<'claude' | 'codex' | 'deep-seek' | 'gemini'> = ['claude', 'codex', 'deep-seek', 'gemini'];

      validTypes.forEach(type => {
        expect(() => {
          state.setExecutorType(type);
        }).not.toThrow();
        expect(state.executorType).toBe(type);
      });
    });
  });

  describe('Type Safety', () => {
    it('should have correct TypeScript types', () => {
      const state = State.getInstance();

      // Test folder properties (initially null)
      expect(state.folder).toBeNull();
      expect(state.claudiomiroFolder).toBeNull();

      // Test executor type
      expect(typeof state.executorType).toBe('string');

      // Test methods exist
      expect(typeof state.setFolder).toBe('function');
      expect(typeof state.setExecutorType).toBe('function');
    });

    it('should maintain type safety with path resolution', () => {
      const state = State.getInstance();
      const relativePath = './test';

      state.setFolder(relativePath);

      expect(state.folder).toBe(path.resolve(relativePath));
      expect(state.claudiomiroFolder).toBe(path.join(path.resolve(relativePath), '.claudiomiro'));
    });
  });
});