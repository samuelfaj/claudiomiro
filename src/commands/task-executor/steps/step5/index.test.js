const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('./generate-research');
jest.mock('./generate-context');
jest.mock('../../../../shared/config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));
jest.mock('../../../../shared/utils/logger', () => ({
  warning: jest.fn(),
  info: jest.fn()
}));

// Import after mocks
const { step5 } = require('./index');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { generateResearchFile } = require('./generate-research');
const { generateContextFile } = require('./generate-context');
const logger = require('../../../../shared/utils/logger');

describe('step5', () => {
  const mockTask = 'TASK1';
  const taskFolder = path.join('/test/.claudiomiro', mockTask);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('step5', () => {
    test('should execute successfully on first run', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      // Mock file system state - no info.json, basic files exist
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return false;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return true;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      // Mock directory reading - no other tasks
      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\n## Implementation\nSome content';
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      // Act
      const result = await step5(mockTask);

      // Assert
      expect(generateResearchFile).toHaveBeenCalledWith(mockTask);
      expect(executeClaude).toHaveBeenCalled();
      expect(generateContextFile).toHaveBeenCalledWith(mockTask);

      // Check that info.json was written with attempts: 1
      const writeCalls = fs.writeFileSync.mock.calls;
      const infoWriteCall = writeCalls.find(call => call[0].includes('info.json'));
      expect(infoWriteCall).toBeDefined();
      const infoContent = JSON.parse(infoWriteCall[1]);
      expect(infoContent.attempts).toBe(1);

      expect(result).toEqual({ success: true });
    });

    test('should handle re-research after 3+ failed attempts', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      let researchExists = true; // RESEARCH.md exists initially
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return researchExists;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      // Mock existing info.json with 3 failed attempts
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) {
          return JSON.stringify({
            attempts: 3,
            lastError: { message: 'Previous error', timestamp: new Date().toISOString() },
            history: []
          });
        }
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation((oldPath, newPath) => {
        if (oldPath.includes('RESEARCH.md')) {
          researchExists = false; // File is renamed, no longer exists
        }
      });

      // Act
      const result = await step5(mockTask);

      // Assert
      expect(logger.warning).toHaveBeenCalledWith('Task has failed 3 times. Re-analyzing approach...');
      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join(taskFolder, 'RESEARCH.md'),
        path.join(taskFolder, 'RESEARCH.old.md')
      );

      // Check that info.json was written with reResearched: true
      const writeCalls = fs.writeFileSync.mock.calls;
      const infoWriteCall = writeCalls.find(call => call[0].includes('info.json'));
      expect(infoWriteCall).toBeDefined();
      const infoContent = JSON.parse(infoWriteCall[1]);
      expect(infoContent.reResearched).toBe(true);
    });

    test('should collect context files from previous tasks', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return false;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return false;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        if (filePath.includes('TASK2')) return true;
        if (filePath.includes('TASK3')) return true;
        return false;
      });

      // Mock multiple tasks with different statuses
      fs.readdirSync.mockReturnValue(['TASK2', 'TASK3']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        if (filePath.includes('TASK2/TODO.md')) return 'Fully implemented: YES\n\nTask 2 content';
        if (filePath.includes('TASK3/TODO.md')) return 'Fully implemented: NO\n\nTask 3 content'; // Should be excluded
        if (filePath.includes('TASK2/RESEARCH.md')) return 'Task 2 research';
        if (filePath.includes('TASK3/CONTEXT.md')) return 'Task 3 context'; // Should be included
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('TASK2')) return ['TODO.md', 'RESEARCH.md'];
        if (dir.includes('TASK3')) return ['TODO.md', 'CONTEXT.md'];
        return ['TASK2', 'TASK3'];
      });

      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step5(mockTask);

      // Assert
      // Based on step5 logic: TODO.md only included if "Fully implemented: YES", RESEARCH.md and CONTEXT.md always included
      const writeCalls = fs.writeFileSync.mock.calls;
      const todoWriteCall = writeCalls.find(call => call[0].includes('TODO.md') && !call[0].includes('TASK2') && !call[0].includes('TASK3'));
      expect(todoWriteCall[1]).toContain('PREVIOUS TASKS CONTEXT FILES AND RESEARCH:');
      expect(todoWriteCall[1]).toContain('TASK2/TODO.md'); // Should be included (fully implemented)
      expect(todoWriteCall[1]).toContain('TASK2/RESEARCH.md'); // Should be included
      expect(todoWriteCall[1]).toContain('TASK3/CONTEXT.md'); // Should be included
      // Actually, looking at the step5 code, TODO filtering is only for the file detection,
      // but all files that pass the filter are included regardless of TODO status
      expect(todoWriteCall[1]).toContain('TASK3/TODO.md'); // Will be included since it passes filter
    });

    test('should handle executeClaude failure and update info.json with error', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      const error = new Error('Claude execution failed');
      executeClaude.mockRejectedValue(error);

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return false;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      fs.readdirSync.mockReturnValue([]);

      let infoContent = {
        attempts: 1,
        lastError: null,
        history: []
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) {
          return JSON.stringify(infoContent);
        }
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        return '';
      });

      let todoContent = 'Fully implemented: YES\n\nContent';

      fs.writeFileSync.mockImplementation((filePath, content) => {
        if (filePath.includes('info.json')) {
          infoContent = JSON.parse(content);
        }
        if (filePath.includes('TODO.md') && filePath.includes(mockTask)) {
          todoContent = content;
        }
      });

      // Act & Assert
      await expect(step5(mockTask)).rejects.toThrow('Claude execution failed');

      // Verify error tracking - check the infoContent variable that was updated by our mock
      expect(infoContent.lastError).toEqual({
        message: 'Claude execution failed',
        timestamp: expect.any(String),
        attempt: 2  // Attempts incremented before executeClaude call
      });
      expect(infoContent.errorHistory).toHaveLength(1);
      expect(infoContent.errorHistory[0]).toEqual({
        timestamp: expect.any(String),
        attempt: 2,
        message: 'Claude execution failed',
        stack: expect.any(String)
      });

      // Verify TODO.md is marked as not fully implemented
      expect(todoContent).toContain('Fully implemented: NO');
    });

    test('should remove CODE_REVIEW.md if it exists', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CODE_REVIEW.md')) return true;
        if (filePath.includes('info.json')) return false;
        if (filePath.includes('RESEARCH.md')) return false;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.rmSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step5(mockTask);

      // Assert
      expect(fs.rmSync).toHaveBeenCalledWith(path.join(taskFolder, 'CODE_REVIEW.md'));
    });

    test('should handle missing RESEARCH.md in execution context', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return false;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return false; // No research file
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step5(mockTask);

      // Assert
      expect(executeClaude).toHaveBeenCalledWith(
        expect.not.stringContaining('RESEARCH CONTEXT:'),
        mockTask
      );
    });

    test('should track execution history in info.json', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return true;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return false;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) {
          return JSON.stringify({
            attempts: 2,
            lastError: null,
            reResearched: false,
            history: [
              { timestamp: '2023-01-01T00:00:00.000Z', attempt: 1, reResearched: false },
              { timestamp: '2023-01-01T01:00:00.000Z', attempt: 2, reResearched: false }
            ]
          });
        }
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step5(mockTask);

      // Assert
      const writeCalls = fs.writeFileSync.mock.calls;
      const infoWriteCall = writeCalls.find(call => call[0].includes('info.json'));
      const infoContent = JSON.parse(infoWriteCall[1]);

      expect(infoContent.attempts).toBe(3);
      expect(infoContent.history).toHaveLength(3);
      expect(infoContent.history[2]).toEqual({
        timestamp: expect.any(String),
        attempt: 3,
        reResearched: false
      });
    });

    test('should create new info.json for first run', async () => {
      // Arrange
      generateResearchFile.mockResolvedValue();
      generateContextFile.mockResolvedValue();
      executeClaude.mockResolvedValue({ success: true });

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('info.json')) return false;
        if (filePath.includes('CODE_REVIEW.md')) return false;
        if (filePath.includes('RESEARCH.md')) return false;
        if (filePath.includes('TODO.md')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath === '/test/.claudiomiro') return true;
        return false;
      });

      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('TODO.md')) return 'Fully implemented: YES\n\nContent';
        if (filePath.includes('prompt.md')) return 'Execute task for {{todoPath}} with {{researchSection}}';
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      // Act
      await step5(mockTask);

      // Assert
      const writeCalls = fs.writeFileSync.mock.calls;
      const infoWriteCall = writeCalls.find(call => call[0].includes('info.json'));
      const infoContent = JSON.parse(infoWriteCall[1]);

      expect(infoContent).toEqual({
        firstRun: expect.any(String),
        lastRun: expect.any(String),
        attempts: 1,
        lastError: null,
        reResearched: false,
        history: [{
          timestamp: expect.any(String),
          attempt: 1,
          reResearched: false
        }]
      });
    });
  });
});