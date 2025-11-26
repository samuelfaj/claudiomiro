const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));
jest.mock('../../../../shared/utils/logger', () => ({
  newline: jest.fn(),
  startSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Import after mocks
const { step3 } = require('./index');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const logger = require('../../../../shared/utils/logger');

describe('step3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('No tasks scenario', () => {
    test('should log info and return early when no tasks found', async () => {
      // Arrange
      fs.readdirSync.mockReturnValue([]);

      // Act
      await step3();

      // Assert
      expect(fs.readdirSync).toHaveBeenCalledWith('/test/.claudiomiro');
      expect(fs.statSync).not.toHaveBeenCalled();
      expect(logger.newline).toHaveBeenCalled();
      expect(logger.startSpinner).toHaveBeenCalledWith('Analyzing task dependencies...');
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('No tasks found for dependency analysis');
      expect(logger.success).not.toHaveBeenCalled();
      expect(executeClaude).not.toHaveBeenCalled();
    });
  });

  describe('Single task scenario (without dependencies)', () => {
    test('should add empty dependencies to single task without @dependencies', async () => {
      // Arrange
      const mockTask = 'TASK1';
      const mockTaskContent = '# Test Task\n\nThis is a test task description.';

      fs.readdirSync.mockReturnValue([mockTask]);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('TASK.md')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(mockTaskContent);
      fs.writeFileSync.mockImplementation();

      // Act
      await step3();

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/.claudiomiro', mockTask, 'TASK.md'),
        `@dependencies []\n${mockTaskContent}`,
        'utf-8'
      );
      expect(logger.info).toHaveBeenCalledWith('Single task detected, adding empty dependencies');
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('Empty dependencies added to single task');
      expect(executeClaude).not.toHaveBeenCalled();
    });
  });

  describe('Single task scenario (with dependencies)', () => {
    test('should skip single task that already has @dependencies', async () => {
      // Arrange
      const mockTask = 'TASK1';
      const mockTaskContent = '@dependencies [TASK0]\n\n# Test Task\n\nThis is a test task description.';

      fs.readdirSync.mockReturnValue([mockTask]);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('TASK.md')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(mockTaskContent);

      // Act
      await step3();

      // Assert
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalledWith('Single task detected, adding empty dependencies');
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.success).not.toHaveBeenCalled();
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should skip when single task TASK.md does not exist', async () => {
      // Arrange
      const mockTask = 'TASK1';

      fs.readdirSync.mockReturnValue([mockTask]);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('TASK.md')) return false;
        return false;
      });

      // Act
      await step3();

      // Assert
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalledWith('Single task detected, adding empty dependencies');
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.success).not.toHaveBeenCalled();
      expect(executeClaude).not.toHaveBeenCalled();
    });
  });

  describe('Multiple tasks scenario', () => {
    test('should execute full dependency analysis for multiple tasks', async () => {
      // Arrange
      const mockTasks = ['TASK1', 'TASK2', 'TASK3'];
      const mockTaskContents = {
        'TASK1': { task: '# Task 1\nDescription 1', prompt: 'Prompt 1' },
        'TASK2': { task: '# Task 2\nDescription 2', prompt: 'Prompt 2' },
        'TASK3': { task: '# Task 3\nDescription 3', prompt: 'Prompt 3' }
      };

      fs.readdirSync.mockReturnValue(mockTasks);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        // Return true for all TASK.md and PROMPT.md files
        if (filePath.includes('TASK.md') || filePath.includes('PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true; // Template file
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // Mock template file content
        if (filePath.includes('prompt.md')) {
          return '# HARD MODE: Deep Dependency Analysis\n\nAnalyze {{taskCount}} tasks ({{taskList}})\n\n{{taskDescriptions}}';
        }

        // Mock task and prompt files
        for (const [task, content] of Object.entries(mockTaskContents)) {
          if (filePath.includes(`${task}/TASK.md`)) return content.task;
          if (filePath.includes(`${task}/PROMPT.md`)) return content.prompt;
        }

        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step3();

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('HARD MODE: Deep Dependency Analysis')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('Analyze 3 tasks (TASK1, TASK2, TASK3)')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('### TASK1')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('### TASK2')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('### TASK3')
      );
      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('Task dependencies analyzed and configured');
    });

    test('should handle missing TASK.md and PROMPT.md files gracefully', async () => {
      // Arrange
      const mockTasks = ['TASK1', 'TASK2'];

      fs.readdirSync.mockReturnValue(mockTasks);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        // Return false for all TASK.md and PROMPT.md files
        if (filePath.includes('TASK.md') || filePath.includes('PROMPT.md')) return false;
        if (filePath.includes('prompt.md')) return true; // Template file
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // Mock template file content
        if (filePath.includes('prompt.md')) {
          return '# HARD MODE: Deep Dependency Analysis\n\nAnalyze {{taskCount}} tasks ({{taskList}})\n\n{{taskDescriptions}}';
        }

        return ''; // Empty content for missing files
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step3();

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('### TASK1')
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('### TASK2')
      );
      // Should contain empty sections for missing files
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/### TASK1\s*\n\n\s*\n\n/)
      );
    });
  });

  describe('Template processing', () => {
    test('should replace all placeholders correctly', async () => {
      // Arrange
      const mockTasks = ['TASK2', 'TASK10'];
      const mockTemplate = 'Count: {{taskCount}}\nList: {{taskList}}\nDescriptions:\n{{taskDescriptions}}';

      fs.readdirSync.mockReturnValue(mockTasks);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockReturnValue(true); // All files exist

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) return mockTemplate;
        return 'Mock content';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step3();

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/Count: 2/)
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/List: TASK2, TASK10/)
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/Descriptions:\s*### TASK2/)
      );
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/### TASK10/)
      );
    });
  });

  describe('Task sorting', () => {
    test('should sort tasks numerically (TASK2 before TASK10)', async () => {
      // Arrange
      const unsortedTasks = ['TASK10', 'TASK2', 'TASK1'];
      const expectedSortedOrder = ['TASK1', 'TASK2', 'TASK10'];

      fs.readdirSync.mockReturnValue(unsortedTasks);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) return true; // Template file
        return true; // All other files exist
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // Mock template file content
        if (filePath.includes('prompt.md')) {
          return '# HARD MODE: Deep Dependency Analysis\n\nAnalyze {{taskCount}} tasks ({{taskList}})\n\n{{taskDescriptions}}';
        }

        // Mock task-specific content
        if (filePath.includes('TASK1/TASK.md')) return '### TASK1\n\nTask 1 content';
        if (filePath.includes('TASK1/PROMPT.md')) return 'Prompt 1';
        if (filePath.includes('TASK2/TASK.md')) return '### TASK2\n\nTask 2 content';
        if (filePath.includes('TASK2/PROMPT.md')) return 'Prompt 2';
        if (filePath.includes('TASK10/TASK.md')) return '### TASK10\n\nTask 10 content';
        if (filePath.includes('TASK10/PROMPT.md')) return 'Prompt 10';

        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step3();

      // Assert
      // The sort should be applied when building task descriptions
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/TASK1.*TASK2.*TASK10/s)
      );
      expect(fs.readdirSync).toHaveBeenCalledWith('/test/.claudiomiro');
    });
  });

  describe('Error handling', () => {
    test('should handle executeClaude failure gracefully', async () => {
      // Arrange
      const mockTasks = ['TASK1', 'TASK2'];

      fs.readdirSync.mockReturnValue(mockTasks);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) return true; // Template file
        return true; // All other files exist
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // Mock template file content
        if (filePath.includes('prompt.md')) {
          return '# HARD MODE: Deep Dependency Analysis\n\nAnalyze {{taskCount}} tasks ({{taskList}})\n\n{{taskDescriptions}}';
        }

        // Mock task-specific content
        if (filePath.includes('TASK1/TASK.md')) return '### TASK1\n\nTask 1 content';
        if (filePath.includes('TASK1/PROMPT.md')) return 'Prompt 1';
        if (filePath.includes('TASK2/TASK.md')) return '### TASK2\n\nTask 2 content';
        if (filePath.includes('TASK2/PROMPT.md')) return 'Prompt 2';

        return '';
      });

      executeClaude.mockResolvedValue({ success: false });

      // Act & Assert
      await expect(step3()).resolves.not.toThrow();

      expect(logger.stopSpinner).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('Task dependencies analyzed and configured');
      // The function doesn't check executeClaude return value, so success is always logged
    });
  });

  describe('File system integration', () => {
    test('should handle non-directory items in task folder', async () => {
      // Arrange
      const mockItems = ['TASK1', 'file.txt', 'TASK2'];
      const mockTasks = ['TASK1', 'TASK2'];

      fs.readdirSync.mockReturnValue(mockItems);
      fs.statSync.mockImplementation((filePath) => {
        const name = path.basename(filePath);
        return {
          isDirectory: () => name.startsWith('TASK')
        };
      });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) return true; // Template file
        return true; // All other files exist
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // Mock template file content
        if (filePath.includes('prompt.md')) {
          return '# HARD MODE: Deep Dependency Analysis\n\nAnalyze {{taskCount}} tasks ({{taskList}})\n\n{{taskDescriptions}}';
        }

        // Mock task-specific content
        if (filePath.includes('TASK1/TASK.md')) return '### TASK1\n\nTask 1 content';
        if (filePath.includes('TASK1/PROMPT.md')) return 'Prompt 1';
        if (filePath.includes('TASK2/TASK.md')) return '### TASK2\n\nTask 2 content';
        if (filePath.includes('TASK2/PROMPT.md')) return 'Prompt 2';

        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step3();

      // Assert
      // Only directories should be processed
      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringMatching(/TASK1.*TASK2/s)
      );
      expect(executeClaude).not.toHaveBeenCalledWith(
        expect.stringContaining('file.txt')
      );
    });
  });

  describe('Logger integration', () => {
    test('should call logger methods in correct sequence', async () => {
      // Arrange
      fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) return true; // Template file
        return true; // All other files exist
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // Mock template file content
        if (filePath.includes('prompt.md')) {
          return '# HARD MODE: Deep Dependency Analysis\n\nAnalyze {{taskCount}} tasks ({{taskList}})\n\n{{taskDescriptions}}';
        }

        // Mock task-specific content
        if (filePath.includes('TASK1/TASK.md')) return '### TASK1\n\nTask 1 content';
        if (filePath.includes('TASK1/PROMPT.md')) return 'Prompt 1';
        if (filePath.includes('TASK2/TASK.md')) return '### TASK2\n\nTask 2 content';
        if (filePath.includes('TASK2/PROMPT.md')) return 'Prompt 2';

        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      // Act
      await step3();

      // Assert
      expect(logger.newline).toHaveBeenCalledTimes(1);
      expect(logger.startSpinner).toHaveBeenCalledTimes(1);
      expect(logger.startSpinner).toHaveBeenCalledWith('Analyzing task dependencies...');
      expect(logger.stopSpinner).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalledWith('Task dependencies analyzed and configured');
    });
  });
});