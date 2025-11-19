const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const state = require('../../config/state');
const { executeClaude } = require('../../services/claude-executor');
const logger = require('../../utils/logger');

jest.mock('fs');
jest.mock('path');
jest.mock('child_process');
jest.mock('../../services/claude-executor');
jest.mock('../../config/state', () => ({
  claudiomiroFolder: '/test/.claudiomiro'
}));
jest.mock('../../utils/logger', () => ({
  startSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn()
}));

// Import after mocks
const { step7 } = require('./index');

describe('step7', () => {
  const bugsPath = '/test/.claudiomiro/BUGS.md';
  const passedPath = '/test/.claudiomiro/CRITICAL_REVIEW_PASSED.md';
  const newBranchMarkerPath = '/test/.claudiomiro/newbranch.txt';
  const aiPromptPath = '/test/.claudiomiro/AI_PROMPT.md';
  const promptPath = '/test/.claudiomiro/src/steps/step7/prompt.md';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default path.join mock
    path.join.mockImplementation((...args) => args.join('/'));

    // Default state
    state.claudiomiroFolder = '/test/.claudiomiro';
    state.branch = 'test-branch';

    // Default file mocks - nothing exists initially
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');

    // Default git mocks
    execSync.mockReturnValue('M src/test.js\nA src/new.js');
  });

  describe('Skip Conditions', () => {
    test('should skip if CRITICAL_REVIEW_PASSED.md already exists', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return true;
        return false;
      });

      await step7();

      expect(logger.info).toHaveBeenCalledWith('✅ Critical review already passed (CRITICAL_REVIEW_PASSED.md exists)');
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should skip if newbranch.txt does not exist (not Claudiomiro branch)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('newbranch.txt')) return false;
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        return true;
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Not running on a new branch created by Claudiomiro');
      expect(logger.info).toHaveBeenCalledWith('💡 Step 7 only runs on branches created with Claudiomiro (without --same-branch flag)');
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should skip if AI_PROMPT.md does not exist (incomplete session)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return false;
        return false;
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Incomplete Claudiomiro session');
      expect(logger.info).toHaveBeenCalledWith('💡 AI_PROMPT.md not found - session may be corrupted or step1 not executed');
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should skip if no code changes detected (git status clean + no commits)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      // Git status returns empty (no changes)
      execSync.mockImplementation((command) => {
        if (command.includes('git status --porcelain')) return '';
        if (command.includes('git rev-parse HEAD')) throw new Error('fatal: not a git repository');
        return '';
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: No code changes detected');
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should skip if not a git repository (git commands fail)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        return false;
      });

      execSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Not a git repository or git is not available');
      expect(logger.info).toHaveBeenCalledWith('💡 Step 7 requires git to analyze code changes');
      expect(executeClaude).not.toHaveBeenCalled();
    });
  });

  describe('Git Operations', () => {
    test('should proceed when git status shows uncommitted changes', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After execution, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 4) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js\nA src/new.js'); // Has changes

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7();

      expect(executeClaude).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalled();
    });

    test('should proceed when git status is clean but commits exist', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After execution, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 4) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockImplementation((command) => {
        if (command.includes('git status --porcelain')) return ''; // No uncommitted changes
        if (command.includes('git rev-parse HEAD')) return 'commit-hash'; // Has commits
        return '';
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7();

      expect(executeClaude).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalled();
    });

    test('should handle repository with no commits correctly', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockImplementation((command) => {
        if (command.includes('git status --porcelain')) return ''; // No uncommitted changes
        if (command.includes('git rev-parse HEAD')) throw new Error('fatal: not a git repository'); // No commits
        return '';
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: No code changes detected');
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should handle git command failures gracefully', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        return false;
      });

      execSync.mockImplementation(() => {
        throw new Error('git command failed');
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: Not a git repository or git is not available');
      expect(executeClaude).not.toHaveBeenCalled();
    });
  });

  describe('Iteration Loop', () => {
    test('should pass critical review on first iteration when no bugs found', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js'); // Has changes

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        return '';
      });

      // Mock CRITICAL_REVIEW_PASSED.md creation after first execution
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 4) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      executeClaude.mockResolvedValue();

      await step7();

      expect(executeClaude).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
    });

    test('should execute multiple iterations and pass when bugs fixed', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After second iteration, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 9) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          return 'Status: PENDING\nStatus: FIXED\nStatus: FIXED'; // 2 fixed bugs
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7(20);

      expect(executeClaude).toHaveBeenCalledTimes(2);
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
      expect(logger.info).toHaveBeenCalledWith('📊 Summary: 2 critical bug(s) fixed across 2 iteration(s)');
    });

    test('should continue iterations until CRITICAL_REVIEW_PASSED.md created', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After third iteration, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 11) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          return 'Status: PENDING\nStatus: FIXED'; // 1 pending, 1 fixed
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7(20);

      expect(executeClaude).toHaveBeenCalledTimes(3);
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
    });

    test('should throw error when max iterations reached with bugs remaining', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          return 'Status: PENDING\nStatus: PENDING'; // Still has pending bugs
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await expect(step7(2)).rejects.toThrow('Critical bugs still present after 2 iterations. Manual intervention required.');

      expect(executeClaude).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith('❌ Max iterations (2) reached with critical bugs remaining');
    });

    test('should track bugs correctly in BUGS.md (pending/fixed counts)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          return 'Status: PENDING\nSome other content\nStatus: FIXED\nStatus: FIXED\nMore content\nStatus: PENDING';
        }
        return '';
      });

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) {
          callCount++;
          return callCount > 6; // Pass on second iteration
        }
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      executeClaude.mockResolvedValue();

      await step7(20);

      // Should track bug counts correctly
      expect(logger.info).toHaveBeenCalledWith('📋 Bugs tracked: 2 fixed, 2 pending');
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
    });

    test('should handle unlimited iterations (maxIterations = Infinity)', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After third iteration, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 8) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          return 'Status: PENDING';
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7(Infinity);

      expect(executeClaude).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('🔄 Max iterations: unlimited (--no-limit)');
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
    });
  });

  describe('Error Handling', () => {
    test('should throw error when state.claudiomiroFolder is undefined', async () => {
      state.claudiomiroFolder = undefined;

      await expect(step7()).rejects.toThrow('state.claudiomiroFolder is not defined. Cannot run step7.');
    });

    test('should throw error when prompt.md template not found', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return false; // Template missing
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      await expect(step7()).rejects.toThrow('Step 7 prompt.md not found');
    });

    test('should throw error when executeClaude fails during iteration', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockReturnValue('Template content');

      executeClaude.mockRejectedValue(new Error('Claude execution failed'));

      await expect(step7()).rejects.toThrow('Step 7 failed during iteration 1: Claude execution failed');

      expect(logger.error).toHaveBeenCalledWith('⚠️  Claude execution failed on iteration 1: Claude execution failed');
      expect(logger.stopSpinner).toHaveBeenCalled();
    });

    test('should handle file read errors gracefully', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          throw new Error('Permission denied');
        }
        return '';
      });

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) {
          callCount++;
          return callCount > 4; // Pass on first iteration
        }
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      executeClaude.mockResolvedValue();

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Could not read BUGS.md for summary: Permission denied');
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
    });
  });

  describe('Edge Cases', () => {
    test('should handle repository with no commits (git rev-parse HEAD fails)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockImplementation((command) => {
        if (command.includes('git status --porcelain')) return ''; // No uncommitted changes
        if (command.includes('git rev-parse HEAD')) throw new Error('fatal: not a git repository'); // No commits
        return '';
      });

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Step 7 skipped: No code changes detected');
      expect(executeClaude).not.toHaveBeenCalled();
    });

    test('should handle BUGS.md with no bugs listed (0 pending, 0 fixed)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          return 'No bugs listed here'; // No Status: entries
        }
        return '';
      });

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) {
          callCount++;
          return callCount > 6; // Pass on second iteration
        }
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      executeClaude.mockResolvedValue();

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  BUGS.md exists but has no bugs listed - unexpected state');
      expect(logger.info).toHaveBeenCalledWith('📋 Bugs tracked: 0 fixed, 0 pending');
    });

    test('should handle BUGS.md read errors gracefully', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After execution, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 6) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        if (filePath.includes('BUGS.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        if (filePath.includes('BUGS.md')) {
          throw new Error('File read error');
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7();

      expect(logger.warning).toHaveBeenCalledWith('⚠️  Could not read BUGS.md: File read error');
      expect(logger.success).toHaveBeenCalledWith('✅ No critical bugs found - Review passed!');
    });

    test('should format iteration display correctly (limited vs unlimited)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      // Mock CRITICAL_REVIEW_PASSED.md creation
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return true;
        return false;
      });

      await step7(5);

      expect(logger.info).toHaveBeenCalledWith('🔄 Max iterations: 5');
      expect(logger.info).toHaveBeenCalledWith('\n🔄 Iteration 1/5');

      // Test unlimited
      jest.clearAllMocks();
      executeClaude.mockResolvedValue();

      await step7(Infinity);

      expect(logger.info).toHaveBeenCalledWith('🔄 Max iterations: unlimited (--no-limit)');
      expect(logger.info).toHaveBeenCalledWith('\n🔄 Iteration 1');
    });
  });

  describe('Parameter Tests', () => {
    test('should use default maxIterations when not provided', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After execution, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 4) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7(); // No maxIterations provided

      expect(logger.info).toHaveBeenCalledWith('🔄 Max iterations: 20');
      expect(logger.info).toHaveBeenCalledWith('\n🔄 Iteration 1/20');
    });

    test('should use custom maxIterations when provided', async () => {
      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // After execution, CRITICAL_REVIEW_PASSED.md exists
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md') && callCount > 4) return true;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('prompt.md')) {
          return 'Template content {{iteration}} {{maxIterations}} {{bugsPath}} {{passedPath}} {{claudiomiroFolder}} {{branch}}';
        }
        return '';
      });

      executeClaude.mockResolvedValue();

      await step7(10); // Custom maxIterations

      expect(logger.info).toHaveBeenCalledWith('🔄 Max iterations: 10');
      expect(logger.info).toHaveBeenCalledWith('\n🔄 Iteration 1/10');
    });

    test('should handle maxIterations = 0 (edge case)', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('CRITICAL_REVIEW_PASSED.md')) return false;
        if (filePath.includes('newbranch.txt')) return true;
        if (filePath.includes('AI_PROMPT.md')) return true;
        if (filePath.includes('prompt.md')) return true;
        return false;
      });

      execSync.mockReturnValue('M src/test.js');

      fs.readFileSync.mockReturnValue('Template content');

      executeClaude.mockResolvedValue();

      await expect(step7(0)).rejects.toThrow('Critical bugs still present after 0 iterations. Manual intervention required.');
    });
  });
});