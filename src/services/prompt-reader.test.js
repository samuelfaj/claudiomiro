const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const state = require('../config/state');
const { readPrompt } = require('./prompt-reader');

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('../utils/logger');
jest.mock('../config/state');

describe('prompt-reader', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    path.join.mockImplementation((...args) => args.join('/'));
    state.claudiomiroFolder = '/test/.claudiomiro';
  });

  describe('readPrompt', () => {
    test('should read and return AI_PROMPT.md content when it exists', async () => {
      const mockPromptContent = 'This is the AI prompt content';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockPromptContent);

      const result = await readPrompt('testTask');

      expect(fs.existsSync).toHaveBeenCalledWith('/test/.claudiomiro/testTask/AI_PROMPT.md');
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/.claudiomiro/testTask/AI_PROMPT.md', 'utf-8');
      expect(result).toBe(mockPromptContent);
    });

    test('should throw error when AI_PROMPT.md does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await expect(readPrompt('testTask')).rejects.toThrow('AI_PROMPT.md not found for task: testTask');
    });

    test('should use correct path for task with special characters', async () => {
      const mockPromptContent = 'Prompt content';
      const taskName = 'task-with-special-chars_123';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockPromptContent);

      const result = await readPrompt(taskName);

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', taskName, 'AI_PROMPT.md');
      expect(result).toBe(mockPromptContent);
    });

    test('should handle empty AI_PROMPT.md file', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      const result = await readPrompt('testTask');

      expect(result).toBe('');
    });

    test('should handle AI_PROMPT.md with unicode content', async () => {
      const unicodeContent = '🚀 Prompt with émojis and spëcial chars';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(unicodeContent);

      const result = await readPrompt('testTask');

      expect(result).toBe(unicodeContent);
    });

    test('should handle very long AI_PROMPT.md content', async () => {
      const longContent = 'x'.repeat(100000);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(longContent);

      const result = await readPrompt('testTask');

      expect(result).toBe(longContent);
      expect(result.length).toBe(100000);
    });

    test('should handle task names with different formats', async () => {
      const taskNames = [
        'simple-task',
        'task_with_underscores',
        'task-with-dashes',
        'Task123',
        'TASK-NAME',
        'task.with.dots',
        'task with spaces'
      ];

      const mockContent = 'Test prompt';

      for (const taskName of taskNames) {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(mockContent);

        const result = await readPrompt(taskName);

        expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', taskName, 'AI_PROMPT.md');
        expect(result).toBe(mockContent);

        // Reset mocks for next iteration
        jest.clearAllMocks();
        path.join.mockImplementation((...args) => args.join('/'));
        state.claudiomiroFolder = '/test/.claudiomiro';
      }
    });

    test('should handle file system read errors', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(readPrompt('testTask')).rejects.toThrow('Permission denied');
    });

    test('should propagate fs.readFileSync errors with original message', async () => {
      fs.existsSync.mockReturnValue(true);
      const errorMessage = 'ENOENT: no such file or directory';
      fs.readFileSync.mockImplementation(() => {
        const error = new Error(errorMessage);
        error.code = 'ENOENT';
        throw error;
      });

      await expect(readPrompt('testTask')).rejects.toThrow(errorMessage);
    });

    test('should use utf-8 encoding by default', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('content');

      await readPrompt('testTask');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/test/.claudiomiro/testTask/AI_PROMPT.md',
        'utf-8'
      );
    });

    test('should handle undefined claudiomiroFolder', async () => {
      state.claudiomiroFolder = undefined;

      await expect(readPrompt('testTask')).rejects.toThrow();
    });

    test('should handle null claudiomiroFolder', async () => {
      state.claudiomiroFolder = null;

      await expect(readPrompt('testTask')).rejects.toThrow();
    });

    test('should construct correct path for nested task directories', async () => {
      const nestedTask = 'parent/child/task';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('nested prompt');

      const result = await readPrompt(nestedTask);

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', nestedTask, 'AI_PROMPT.md');
      expect(result).toBe('nested prompt');
    });

    test('should handle task name with leading/trailing slashes', async () => {
      const taskWithSlashes = '/testTask/';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('prompt content');

      const result = await readPrompt(taskWithSlashes);

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', taskWithSlashes, 'AI_PROMPT.md');
      expect(result).toBe('prompt content');
    });

    test('should handle AI_PROMPT.md with markdown formatting', async () => {
      const markdownContent = `# AI Prompt

## Task Description
This is a **formatted** prompt with:
- Lists
- **Bold text**
- *Italic text*

\`\`\`javascript
// Code blocks
console.log('Hello');
\`\`\``;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(markdownContent);

      const result = await readPrompt('testTask');

      expect(result).toBe(markdownContent);
      expect(result).toContain('# AI Prompt');
      expect(result).toContain('**Bold text**');
      expect(result).toContain('```javascript');
    });

    test('should handle AI_PROMPT.md with JSON content', async () => {
      const jsonPrompt = JSON.stringify({
        task: "Test task",
        instructions: ["Step 1", "Step 2"],
        requirements: {
          language: "javascript",
          framework: "react"
        }
      }, null, 2);

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(jsonPrompt);

      const result = await readPrompt('testTask');

      expect(result).toBe(jsonPrompt);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should handle different state.claudiomiroFolder paths', async () => {
      const folders = [
        '/custom/path/.claudiomiro',
        '/home/user/project/.claudiomiro',
        'C:\\Users\\User\\Project\\.claudiomiro',
        './.claudiomiro',
        '../project/.claudiomiro'
      ];

      for (const folder of folders) {
        state.claudiomiroFolder = folder;
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('content');

        const result = await readPrompt('testTask');

        expect(path.join).toHaveBeenCalledWith(folder, 'testTask', 'AI_PROMPT.md');
        expect(result).toBe('content');

        // Reset for next iteration
        jest.clearAllMocks();
        path.join.mockImplementation((...args) => args.join('/'));
      }
    });

    test('should handle extremely long task names', async () => {
      const longTaskName = 'task-'.repeat(100) + 'very-long-name';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('prompt');

      const result = await readPrompt(longTaskName);

      expect(path.join).toHaveBeenCalledWith('/test/.claudiomiro', longTaskName, 'AI_PROMPT.md');
      expect(result).toBe('prompt');
    });

    test('should maintain original prompt formatting including line endings', async () => {
      const promptWithLineEndings = 'Line 1\r\nLine 2\nLine 3\r\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(promptWithLineEndings);

      const result = await readPrompt('testTask');

      expect(result).toBe(promptWithLineEndings);
      expect(result).toContain('\r\n');
      expect(result).toContain('\n');
    });
  });
});