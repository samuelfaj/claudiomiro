const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('../executors/claude-executor');
const { commitOrFix } = require('./git-commit');

// Mock modules
jest.mock('../utils/logger');
jest.mock('../config/state');
jest.mock('../executors/claude-executor');

describe('git-commit', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    executeClaude.mockResolvedValue();
  });

  describe('commitOrFix', () => {
    test('should execute Claude with enhanced prompt containing hard rules', async () => {
      const prompt = 'Commit these changes';
      const taskName = 'test-task';

      await commitOrFix(prompt, taskName);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining(prompt),
        taskName
      );

      const calledPrompt = executeClaude.mock.calls[0][0];
      expect(calledPrompt).toContain('HARD RULES:');
      expect(calledPrompt).toContain('NEVER mention that you are an AI model');
      expect(calledPrompt).toContain('NEVER mention Authored or Co-Authored');
      expect(calledPrompt).toContain('NEVER mention any AI model');
      expect(calledPrompt).toContain('The Authorship must be the user and only the user');
      expect(calledPrompt).toContain('NOBODY can know that AI was used');
      expect(calledPrompt).toContain('git commit -m "message"');
      expect(calledPrompt).toContain('git push');
      expect(calledPrompt).toContain('create a PR, use the available git tools');
    });

    test('should work without taskName parameter', async () => {
      const prompt = 'Commit these changes';

      await commitOrFix(prompt);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining(prompt),
        null
      );
    });

    test('should stop spinner and log appropriate messages', async () => {
      await commitOrFix('test prompt');

      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Git committing via Claude...');
      expect(logger.newline).toHaveBeenCalledTimes(2);
      expect(logger.separator).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('Git commit/PR process completed');
    });

    test('should handle Claude execution success', async () => {
      executeClaude.mockResolvedValue();

      const result = await commitOrFix('test prompt');

      expect(result).toBe(true);
      expect(logger.success).toHaveBeenCalled();
    });

    test('should handle Claude execution failure gracefully', async () => {
      const error = new Error('Claude execution failed');
      executeClaude.mockRejectedValue(error);

      const result = await commitOrFix('test prompt');

      expect(result).toBe(true); // Should still return true even on failure
      expect(logger.warning).toHaveBeenCalledWith('⚠️  Git commit/PR process failed: Claude execution failed');
    });

    test('should handle empty prompt', async () => {
      await commitOrFix('');

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining(''),
        null
      );
    });

    test('should handle prompt with special characters', async () => {
      const prompt = 'Commit "special" chars & symbols: @#$%^&*()';

      await commitOrFix(prompt);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining(prompt),
        null
      );
    });

    test('should handle very long prompts', async () => {
      const longPrompt = 'x'.repeat(10000);

      await commitOrFix(longPrompt);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining(longPrompt),
        null
      );
    });

    test('should preserve original prompt in enhanced message', async () => {
      const originalPrompt = 'Fix the bug in authentication module';

      await commitOrFix(originalPrompt);

      const calledPrompt = executeClaude.mock.calls[0][0];
      expect(calledPrompt).toContain(originalPrompt);
      expect(calledPrompt).toContain('HARD RULES:');
    });

    test('should format hard rules consistently', async () => {
      await commitOrFix('any prompt');

      const calledPrompt = executeClaude.mock.calls[0][0];

      // Check that all hard rules are present with exact formatting
      const expectedRules = [
        'HARD RULES:',
        ' - NEVER mention that you are an AI model',
        ' - NEVER mention Authored or Co-Authored',
        ' - NEVER mention any AI model (example: Claude, ChatGPT, GLM, Deepseek)',
        ' - The Authorship must be the user and only the user',
        ' - NOBODY can know that AI was used',
        ' - If you need to commit, use git commit -m "message"',
        ' - If you need to push, use git push',
        ' - If you need to create a PR, use the available git tools (GitHub, GitLab, etc.)'
      ];

      expectedRules.forEach(rule => {
        expect(calledPrompt).toContain(rule);
      });
    });

    test('should pass through taskName parameter correctly', async () => {
      const taskName = 'feature-authentication';

      await commitOrFix('test prompt', taskName);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.any(String),
        taskName
      );
    });

    test('should handle different task names', async () => {
      const taskNames = ['task1', 'task-with-dashes', 'task_with_underscores', 'task123'];

      for (const taskName of taskNames) {
        await commitOrFix('test prompt', taskName);

        expect(executeClaude).toHaveBeenCalledWith(
          expect.any(String),
          taskName
        );

        // Reset mock for next iteration
        executeClaude.mockClear();
      }
    });

    test('should handle execution errors with different error types', async () => {
      const errorTypes = [
        new Error('Network error'),
        new Error('File not found'),
        new Error('Permission denied'),
        new Error('Command failed')
      ];

      for (const error of errorTypes) {
        executeClaude.mockRejectedValue(error);

        const result = await commitOrFix('test prompt');

        expect(result).toBe(true);
        expect(logger.warning).toHaveBeenCalledWith(
          `⚠️  Git commit/PR process failed: ${error.message}`
        );

        // Reset mock for next iteration
        executeClaude.mockClear();
        logger.warning.mockClear();
      }
    });

    test('should call logger methods in correct order on success', async () => {
      const callOrder = [];

      logger.stopSpinner.mockImplementation(() => callOrder.push('stopSpinner'));
      logger.info.mockImplementation(() => callOrder.push('info'));
      logger.newline.mockImplementation(() => callOrder.push('newline'));
      logger.separator.mockImplementation(() => callOrder.push('separator'));
      logger.success.mockImplementation(() => callOrder.push('success'));

      executeClaude.mockImplementation(async () => {
        // Simulate async execution
        await Promise.resolve();
      });

      await commitOrFix('test prompt');

      expect(callOrder).toEqual([
        'stopSpinner',
        'info',
        'newline',
        'newline',
        'separator',
        'success'
      ]);
    });

    test('should call logger methods in correct order on failure', async () => {
      const callOrder = [];

      logger.stopSpinner.mockImplementation(() => callOrder.push('stopSpinner'));
      logger.info.mockImplementation(() => callOrder.push('info'));
      logger.warning.mockImplementation(() => callOrder.push('warning'));

      executeClaude.mockRejectedValue(new Error('Test error'));

      await commitOrFix('test prompt');

      expect(callOrder).toEqual([
        'stopSpinner',
        'info',
        'warning'
      ]);
    });

    test('should handle multiline prompts', async () => {
      const multilinePrompt = 'Line 1\nLine 2\nLine 3';

      await commitOrFix(multilinePrompt);

      const calledPrompt = executeClaude.mock.calls[0][0];
      expect(calledPrompt).toContain(multilinePrompt);
    });

    test('should handle prompts with git commands', async () => {
      const promptWithGit = 'Run git status and then git add .';

      await commitOrFix(promptWithGit);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining(promptWithGit),
        null
      );
    });

    test('should maintain consistency across multiple calls', async () => {
      const prompts = ['prompt1', 'prompt2', 'prompt3'];

      for (const prompt of prompts) {
        await commitOrFix(prompt);

        const calledPrompt = executeClaude.mock.calls[0][0];
        expect(calledPrompt).toContain(prompt);
        expect(calledPrompt).toContain('HARD RULES:');

        // Reset for next iteration
        executeClaude.mockClear();
      }
    });
  });
});