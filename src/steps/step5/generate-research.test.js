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
  warn: jest.fn()
}));

// Import after mocks
const { generateResearchFile } = require('./generate-research');
const { executeClaude } = require('../../services/claude-executor');

describe('generate-research', () => {
  const mockTask = 'TASK1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResearchFile', () => {
    test('should skip if RESEARCH.md already exists', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('RESEARCH.md')) return true;
        return false;
      });

      await generateResearchFile(mockTask);

      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should skip if TODO.md does not exist', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('RESEARCH.md')) return false;
        if(filePath.includes('TODO.md')) return false;
        return false;
      });

      await generateResearchFile(mockTask);

      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should generate RESEARCH.md when TODO.md exists and RESEARCH.md does not', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('RESEARCH.md')) return false;
        if(filePath.includes('TODO.md')) return true;
        if(filePath.includes('research-prompt.md')) return true;
        return false;
      });

      // Mock readFileSync to return the prompt template and the generated research content
      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('research-prompt.md')) {
          return '## RESEARCH PHASE: Deep Context Analysis\n\nYou are about to execute the task at: {{todoPath}}';
        }
        // Return the generated RESEARCH.md content with sufficient length
        return '# Research content with sufficient length to pass validation test and ensure that the file is not too short';
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateResearchFile(mockTask);

      expect(executeClaude).toHaveBeenCalledWith(
        expect.stringContaining('RESEARCH PHASE: Deep Context Analysis'),
        mockTask
      );
    });

    test('should validate RESEARCH.md was created', async () => {
      const logger = require('../../utils/logger');

      fs.existsSync.mockImplementation((filePath) => {
        // First calls: check if files exist
        if(filePath.includes('RESEARCH.md')) return false;
        if(filePath.includes('TODO.md')) return true;
        if(filePath.includes('research-prompt.md')) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('research-prompt.md')) {
          return '## RESEARCH PHASE: Deep Context Analysis\n\nYou are about to execute the task at: {{todoPath}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateResearchFile(mockTask);

      expect(logger.error).toHaveBeenCalledWith('RESEARCH.md was not created. Research phase failed.');
    });

    test('should validate RESEARCH.md has minimum content', async () => {
      const logger = require('../../utils/logger');
      let existsCallCount = 0;

      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('RESEARCH.md')) {
          existsCallCount++;
          // First call (initial check): doesn't exist
          // Second call (after executeClaude): exists
          return existsCallCount > 1;
        }
        if(filePath.includes('TODO.md')) return true;
        if(filePath.includes('research-prompt.md')) return true;
        return false;
      });

      // Mock readFileSync for different file types
      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('research-prompt.md')) {
          return '## RESEARCH PHASE: Deep Context Analysis\n\nYou are about to execute the task at: {{todoPath}}';
        }
        // Content too short for RESEARCH.md
        return 'short';
      });

      executeClaude.mockResolvedValue({ success: true });

      await generateResearchFile(mockTask);

      expect(logger.error).toHaveBeenCalledWith('RESEARCH.md is too short. Research phase incomplete.');
      expect(fs.rmSync).toHaveBeenCalled();
    });

    test('should warn and continue if research fails', async () => {
      const logger = require('../../utils/logger');

      fs.existsSync.mockImplementation((filePath) => {
        if(filePath.includes('RESEARCH.md')) return false;
        if(filePath.includes('TODO.md')) return true;
        if(filePath.includes('research-prompt.md')) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if(filePath.includes('research-prompt.md')) {
          return '## RESEARCH PHASE: Deep Context Analysis\n\nYou are about to execute the task at: {{todoPath}}';
        }
        return '';
      });

      executeClaude.mockRejectedValue(new Error('Claude execution failed'));

      await generateResearchFile(mockTask);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Research phase failed'));
      expect(logger.warn).toHaveBeenCalledWith('Continuing without research file - execution may be less informed');
    });
  });
});
