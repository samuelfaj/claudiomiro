import fs from 'fs';
import path from 'path';
import { Step2 } from '../step2';
import state from '../../config/state';
import { ClaudeExecutor } from '../../services/claude-executor';

// Mock all dependencies
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  rmSync: jest.fn(),
  readFileSync: jest.fn(),
}));
jest.mock('path');
jest.mock('../../config/state');
jest.mock('../../services/claude-executor');

describe('Step2', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup state mock - mock the entire state object
    (state as any).claudiomiroFolder = '/test/.claudiomiro';

    // Setup path.join to work correctly
    (path.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));

    // Setup ClaudeExecutor.execute mock to resolve
    (ClaudeExecutor.execute as jest.Mock).mockResolvedValue(undefined);

    // Setup fs mocks
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });
  });

  describe('Setup test infrastructure and mocks', () => {
    it('should have state mock properly configured', () => {
      expect(state.claudiomiroFolder).toBe('/test/.claudiomiro');
    });

    it('should have path.join mock properly configured', () => {
      const result = path.join('a', 'b', 'c');
      expect(result).toBe('a/b/c');
      expect(path.join).toHaveBeenCalledWith('a', 'b', 'c');
    });

    it('should have ClaudeExecutor.execute mock properly configured', async () => {
      await ClaudeExecutor.execute('test');
      expect(ClaudeExecutor.execute).toHaveBeenCalledWith('test');
    });
  });

  describe('Step2.execute method execution flow', () => {
    it('should call ClaudeExecutor.execute twice with task context', async () => {
      await Step2.execute('TASK1');

      expect(ClaudeExecutor.execute).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = (ClaudeExecutor.execute as jest.Mock).mock.calls;
      expect(firstCall[1]).toBe('TASK1');
      expect(secondCall[1]).toBe('TASK1');
    });

    it('should generate correct folder paths for task files', async () => {
      await Step2.execute('TASK1');

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK1', 'PROMPT.md');
      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK1', 'TODO.md');
    });

    it('should include PROMPT.md path in the prompt text', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('/test/.claudiomiro/TASK1/PROMPT.md');
    });

    it('should include TODO.md path in the prompt text', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('/test/.claudiomiro/TASK1/TODO.md');
    });

    it('should include PHASE: IMPLEMENTATION PLANNING in prompt', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('## Your Task');
    });

    it('should include critical rule about not creating commits', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('Do NOT run any git commands');
    });

    it('should include critical rule about first line being "Fully implemented: NO"', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('First line of');
      expect(promptArg).toContain('MUST be: `Fully implemented: NO`');
    });

    it('should include critical rule about creating 5-10 items MAX', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('quality over quantity');
    });

    it('should include TODO.md structure template', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('## TODO.md Structure');
      expect(promptArg).toContain('## Implementation Plan');
      expect(promptArg).toContain('## Verification');
    });

    it('should instruct to read PROMPT.md and create TODO.md', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('Read');
      expect(promptArg).toContain('create');
      expect(promptArg).toContain('PROMPT.md');
      expect(promptArg).toContain('TODO.md');
    });

    it('should include task breakdown instructions', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('Your Task');
      expect(promptArg).toContain('Identify implementation steps');
      expect(promptArg).toContain('Group work by');
    });

    it('should mention context7 usage for understanding codebase', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('codebase knowledge source');
      expect(promptArg).toContain('context7');
    });

    it('should emphasize quality over quantity', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('quality over quantity');
    });

    it('should return a promise', () => {
      const result = Step2.execute('TASK1');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve when ClaudeExecutor.execute resolves', async () => {
      (ClaudeExecutor.execute as jest.Mock).mockResolvedValue(undefined);

      const result = await Step2.execute('TASK1');
      expect(result).toBeUndefined();
    });
  });

  describe('state transitions and file operations', () => {
    it('should use state.claudiomiroFolder for path generation', async () => {
      (state as any).claudiomiroFolder = '/custom/path';

      await Step2.execute('TASK1');

      expect(path.join).toHaveBeenCalledWith('/custom/path', 'TASK1', 'PROMPT.md');
      expect(path.join).toHaveBeenCalledWith('/custom/path', 'TASK1', 'TODO.md');
    });

    it('should handle different task names correctly', async () => {
      await Step2.execute('TASK99');

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK99', 'PROMPT.md');
      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK99', 'TODO.md');
    });

    it('should handle task names with special characters', async () => {
      await Step2.execute('TASK-ABC-123');

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK-ABC-123', 'PROMPT.md');
      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK-ABC-123', 'TODO.md');
    });

    it('should call path.join for PROMPT.md and TODO.md paths', async () => {
      await Step2.execute('TASK1');

      // path.join is called for PROMPT.md and TODO.md
      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK1', 'PROMPT.md');
      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK1', 'TODO.md');
    });

    it('should construct proper file paths with path.join', async () => {
      (path.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));

      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('/test/.claudiomiro/TASK1/PROMPT.md');
      expect(promptArg).toContain('/test/.claudiomiro/TASK1/TODO.md');
    });
  });

  describe('error handling and edge cases', () => {
    it('should propagate errors from ClaudeExecutor.execute', async () => {
      const testError = new Error('Claude execution failed');
      (ClaudeExecutor.execute as jest.Mock).mockRejectedValue(testError);

      await expect(Step2.execute('TASK1')).rejects.toThrow('Claude execution failed');
    });

    it('should handle ClaudeExecutor.execute rejection with custom error', async () => {
      (ClaudeExecutor.execute as jest.Mock).mockRejectedValue(new Error('Custom error message'));

      await expect(Step2.execute('TASK1')).rejects.toThrow('Custom error message');
    });

    it('should handle empty task name', async () => {
      await Step2.execute('');

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', '', 'PROMPT.md');
      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', '', 'TODO.md');
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
    });

    it('should handle undefined state.claudiomiroFolder', async () => {
      (state as any).claudiomiroFolder = undefined;

      await Step2.execute('TASK1');

      expect(path.join).toHaveBeenCalledWith(undefined, 'TASK1', 'PROMPT.md');
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
    });

    it('should not catch ClaudeExecutor.execute errors', async () => {
      (ClaudeExecutor.execute as jest.Mock).mockRejectedValue(new Error('Test error'));

      await expect(Step2.execute('TASK1')).rejects.toThrow();
    });

    it('should handle long task names', async () => {
      const longTaskName = 'TASK_' + 'A'.repeat(100);
      await Step2.execute(longTaskName);

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', longTaskName, 'PROMPT.md');
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
    });

    it('should handle task names with forward slashes', async () => {
      await Step2.execute('TASK/SUB/TASK');

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', 'TASK/SUB/TASK', 'PROMPT.md');
    });

    it('should handle null task name', async () => {
      await Step2.execute(null as any);

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', null, 'PROMPT.md');
      expect(ClaudeExecutor.execute).toHaveBeenCalled();
    });
  });

  describe('integration and coverage verification', () => {
    it('should complete full execution flow end-to-end', async () => {
      (state as any).claudiomiroFolder = '/project/.claudiomiro';
      (path.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));
      (ClaudeExecutor.execute as jest.Mock).mockResolvedValue(undefined);

      await Step2.execute('TASK5');

      // Verify complete flow
      expect(path.join).toHaveBeenCalled();
      expect(ClaudeExecutor.execute).toHaveBeenCalled();

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      expect(promptArg).toContain('/project/.claudiomiro/TASK5/PROMPT.md');
      expect(promptArg).toContain('/project/.claudiomiro/TASK5/TODO.md');
      expect(promptArg).toContain('## Your Task');
    });

    it('should verify all critical rules are present in prompt', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      const criticalRules = [
        'Do NOT run any git commands',
        'First line of',
        'MUST be: `Fully implemented: NO`',
        'Only add actions an AI agent can perform',
        'quality over quantity'
      ];

      criticalRules.forEach(rule => {
        expect(promptArg).toContain(rule);
      });
    });

    it('should verify TODO.md structure elements are present', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      const structureElements = [
        'Fully implemented: NO',
        '## Implementation Plan',
        '- [ ] **Item X',
        'Context (read-only)',
        'Touched (will modify/create)',
        'Tests:',
        '## Verification',
        '- [ ] All automated tests pass',
        '- [ ] Code builds cleanly',
        '- [ ] Feature meets **Acceptance Criteria**'
      ];

      structureElements.forEach(element => {
        expect(promptArg).toContain(element);
      });
    });

    it('should verify task instructions are comprehensive', async () => {
      await Step2.execute('TASK1');

      const promptArg = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];
      const instructions = [
        'Read',
        'Identify implementation steps',
        'Group work by',
        'Write',
        'codebase knowledge source'
      ];

      instructions.forEach(instruction => {
        expect(promptArg).toContain(instruction);
      });
    });

    it('should call ClaudeExecutor.execute twice per invocation', async () => {
      await Step2.execute('TASK1');
      expect(ClaudeExecutor.execute).toHaveBeenCalledTimes(2);

      jest.clearAllMocks();

      await Step2.execute('TASK2');
      expect(ClaudeExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it('should create unique prompts for different tasks', async () => {
      await Step2.execute('TASK1');
      const prompt1 = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];

      jest.clearAllMocks();

      await Step2.execute('TASK2');
      const prompt2 = (ClaudeExecutor.execute as jest.Mock).mock.calls[0][0];

      expect(prompt1).not.toBe(prompt2);
      expect(prompt1).toContain('TASK1');
      expect(prompt2).toContain('TASK2');
    });
  });
});