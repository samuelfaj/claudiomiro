const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('../../services/claude-executor');
jest.mock('../../config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));
jest.mock('../../utils/logger', () => ({
  startSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

// Import after mocks
const { generateTodo } = require('./generate-todo');
const { executeClaude } = require('../../services/claude-executor');

describe('generate-todo', () => {
  const mockTask = 'TASK1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTodo', () => {
    test('should load TODO.md template and call executeClaude with processed prompt', async () => {
      // Mock template files
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) {
          return 'TODO template content';
        }
        if (filePath.includes('prompt-generate-todo.md')) {
          return 'Generate TODO for {{taskMdPath}} with context {{contextSection}} using template {{todoTemplate}}';
        }
        return '';
      });

      // Mock directory structure
      fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockReturnValue(false); // No existing files to check

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('templates/TODO.md'),
        'utf-8'
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('prompt-generate-todo.md'),
        'utf-8'
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('Generate TODO for'),
        mockTask
      );
    });

    test('should collect AI_PROMPT.md as first context file', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        return '';
      });

      fs.readdirSync.mockReturnValue([]);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('AI_PROMPT.md');
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      expect(executeCall).toContain('/test/.claudiomiro/AI_PROMPT.md');
      expect(executeCall).toContain('RELATED CONTEXT FROM PREVIOUS TASKS');
    });

    test('should discover TASK directories and filter completed TODO.md files', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        // Mock completed TODO.md content for TASK1, incomplete for TASK2
        if (filePath.includes('TASK1/TODO.md')) return 'Fully implemented: YES\nContent here';
        if (filePath.includes('TASK2/TODO.md')) return 'Fully implemented: NO\nNot complete';
        return '';
      });

      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === '/test/.claudiomiro') {
          return ['TASK1', 'TASK2', 'other-folder'];
        }
        return [];
      });

      fs.statSync.mockImplementation((dirPath) => {
        return { isDirectory: () => !dirPath.includes('other-folder') };
      });

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('TODO.md') || filePath.includes('AI_PROMPT.md');
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/TODO.md');
      expect(executeCall).not.toContain('/test/.claudiomiro/TASK2/TODO.md');
      // The content of TODO.md files is not included in the prompt, only the file paths
      expect(executeCall).toContain('RELATED CONTEXT FROM PREVIOUS TASKS');
    });

    test('should include CONTEXT.md, RESEARCH.md, and DECISIONS.md without filtering', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        if (filePath.includes('CONTEXT.md')) return 'Context content';
        if (filePath.includes('RESEARCH.md')) return 'Research content';
        if (filePath.includes('DECISIONS.md')) return 'Decisions content';
        return '';
      });

      fs.readdirSync.mockReturnValue(['TASK1']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('AI_PROMPT.md') ||
               filePath.includes('CONTEXT.md') ||
               filePath.includes('RESEARCH.md') ||
               filePath.includes('DECISIONS.md');
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/CONTEXT.md');
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/RESEARCH.md');
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/DECISIONS.md');
    });

    test('should exclude PROMPT.md, TASK.md, CODE_REVIEW.md, and TODO.old.* files', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        return '';
      });

      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === '/test/.claudiomiro') return ['TASK1'];
        if (dirPath.includes('TASK1')) {
          return [
            'PROMPT.md',
            'TASK.md',
            'CODE_REVIEW.md',
            'TODO.old.1.md',
            'TODO.old.2.md',
            'custom.md'  // This should be included
          ];
        }
        return [];
      });

      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        // Only return true for AI_PROMPT.md and files that should be included
        return filePath.includes('AI_PROMPT.md') ||
               filePath.includes('custom.md') ||
               // Mock that excluded files exist but shouldn't be included
               (filePath.includes('TASK1') &&
                (filePath.includes('PROMPT.md') ||
                 filePath.includes('TASK.md') ||
                 filePath.includes('CODE_REVIEW.md') ||
                 filePath.includes('TODO.old.')));
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/custom.md');
      expect(executeCall).not.toContain('/test/.claudiomiro/TASK1/PROMPT.md');
      expect(executeCall).not.toContain('/test/.claudiomiro/TASK1/TASK.md');
      expect(executeCall).not.toContain('/test/.claudiomiro/TASK1/CODE_REVIEW.md');
      expect(executeCall).not.toContain('TODO.old');
    });

    test('should replace all placeholders in prompt template', async () => {
      const todoTemplate = 'TODO TEMPLATE CONTENT';
      const promptTemplate = 'Task: {{taskMdPath}} Prompt: {{promptMdPath}} TODO: {{todoMdPath}} AI: {{aiPromptPath}} Template: {{todoTemplate}} Context: {{contextSection}}';

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return todoTemplate;
        if (filePath.includes('prompt-generate-todo.md')) return promptTemplate;
        return '';
      });

      fs.readdirSync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];

      expect(executeCall).toContain('Task: /test/.claudiomiro/TASK1/TASK.md');
      expect(executeCall).toContain('Prompt: /test/.claudiomiro/TASK1/PROMPT.md');
      expect(executeCall).toContain('TODO: /test/.claudiomiro/TASK1/TODO.md');
      expect(executeCall).toContain('AI: /test/.claudiomiro/AI_PROMPT.md');
      expect(executeCall).toContain('Template: TODO TEMPLATE CONTENT');
    });

    test('should handle empty context when no previous TASK folders exist', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        return '';
      });

      fs.readdirSync.mockReturnValue(['other-folder']); // No TASK folders
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockReturnValue(false);

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      // Should still include AI_PROMPT.md in context
      expect(executeCall).toContain('/test/.claudiomiro/AI_PROMPT.md');
      expect(executeCall).not.toContain('TASK1');
      expect(executeCall).not.toContain('TASK2');
    });

    test('should handle mixed completed and incomplete TODO files across tasks', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        if (filePath.includes('TASK1/TODO.md')) return 'Fully implemented: YES\nTask 1 done';
        if (filePath.includes('TASK2/TODO.md')) return 'Fully implemented: NO\nTask 2 pending';
        if (filePath.includes('TASK3/TODO.md')) return 'Fully implemented: YES\nTask 3 done';
        return '';
      });

      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === '/test/.claudiomiro') return ['TASK1', 'TASK2', 'TASK3'];
        return [];
      });

      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('AI_PROMPT.md') || filePath.includes('TODO.md');
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/TODO.md');
      expect(executeCall).not.toContain('/test/.claudiomiro/TASK2/TODO.md');
      expect(executeCall).toContain('/test/.claudiomiro/TASK3/TODO.md');
    });

    test('should handle error when TODO.md template is missing', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) {
          throw new Error('ENOENT: no such file or directory');
        }
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        return '';
      });

      fs.readdirSync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);

      await expect(generateTodo(mockTask)).rejects.toThrow('ENOENT: no such file or directory');
    });

    test('should handle error when prompt template is missing', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) {
          throw new Error('ENOENT: no such file or directory');
        }
        return '';
      });

      fs.readdirSync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);

      await expect(generateTodo(mockTask)).rejects.toThrow('ENOENT: no such file or directory');
    });

    test('should pass task identifier correctly to executeClaude', async () => {
      const customTask = 'TASK2.1';

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt template';
        return '';
      });

      fs.readdirSync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(customTask);

      expect(executeClaude).toHaveBeenCalledWith(expect.any(String), customTask);
    });

    test('should include custom markdown files not in exclusion list', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('templates/TODO.md')) return 'TODO template';
        if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
        if (filePath.includes('ARCHITECTURE.md')) return 'Architecture decisions';
        if (filePath.includes('API_DESIGN.md')) return 'API design notes';
        return '';
      });

      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === '/test/.claudiomiro') return ['TASK1'];
        if (dirPath.includes('TASK1')) {
          return ['ARCHITECTURE.md', 'API_DESIGN.md', 'PROMPT.md']; // Mix of included and excluded
        }
        return [];
      });

      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('AI_PROMPT.md') ||
               filePath.includes('ARCHITECTURE.md') ||
               filePath.includes('API_DESIGN.md') ||
               filePath.includes('PROMPT.md'); // Mock that PROMPT.md exists but should be excluded
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateTodo(mockTask);

      const executeCall = executeClaude.mock.calls[0][0];
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/ARCHITECTURE.md');
      expect(executeCall).toContain('/test/.claudiomiro/TASK1/API_DESIGN.md');
      expect(executeCall).not.toContain('/test/.claudiomiro/TASK1/PROMPT.md');
    });
  });
});