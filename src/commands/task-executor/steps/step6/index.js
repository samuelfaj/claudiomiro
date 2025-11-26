const fs = require('fs');
const path = require('path');
const { reviewCode } = require('./review-code');
const { reanalyzeFailed } = require('./reanalyze-failed');
const { commitOrFix } = require('../../services/git-commit');
const { isFullyImplemented } = require('../../utils/validation');
const state = require('../../config/state');

/**
 * Step 6: Code Review
 *
 * Performs comprehensive code review of implemented tasks:
 * 1. Reviews code for completeness, correctness, and quality
 * 2. If review fails multiple times, performs deep re-analysis
 * 3. Commits approved changes to version control
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @param {boolean} shouldPush - Whether to push changes to remote
 * @returns {Promise} Result of the review process
 */
const step6 = async (task, shouldPush = true) => {
  const folder = (file) => path.join(state.claudiomiroFolder, task, file);

  // Perform main code review
  const execution = await reviewCode(task);

  // Check if implementation is complete and approved
  if (isFullyImplemented(folder('TODO.md'))) {
    try {
      await commitOrFix(
        `git add . and git commit ${shouldPush ? 'and git push' : ''}`,
        task
      );
    } catch (error) {
      // Log but don't block execution
      console.warn('⚠️  Commit failed in step6, continuing anyway:', error.message);
    }
  } else {
    // If review failed, check if we need deep re-analysis
    if (fs.existsSync(folder('info.json'))) {
      const json = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
      // Every 3 attempts, rewrite TODO from scratch
      if (json.attempts % 3 === 0) {
        await reanalyzeFailed(task);
      }
    }
  }

  return execution;
};

module.exports = { step6 };
