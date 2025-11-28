const fs = require('fs');
const path = require('path');
const { reviewCode } = require('./review-code');
const { reanalyzeFailed } = require('./reanalyze-failed');
const { smartCommit } = require('../../../../shared/services/git-commit');
const { isFullyImplementedAsync } = require('../../utils/validation');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

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

  // Check if implementation is complete and approved (using Local LLM when available)
  const completionResult = await isFullyImplementedAsync(folder('TODO.md'));
  if (completionResult.completed) {
    try {
      // Use smartCommit: tries shell + Ollama first, falls back to Claude on error
      const commitResult = await smartCommit({
        taskName: task,
        shouldPush,
        createPR: false
      });

      if (commitResult.method === 'shell') {
        logger.debug(`[Step6] Commit via shell (saved Claude tokens)`);
      }
    } catch (error) {
      // Log but don't block execution
      logger.warning('⚠️  Commit failed in step6, continuing anyway:', error.message);
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
