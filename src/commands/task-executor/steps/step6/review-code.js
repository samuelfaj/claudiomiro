const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const {
  buildConsolidatedContextAsync,
  buildOptimizedContextAsync,
  getContextFilePaths
} = require('../../../../shared/services/context-cache');
const { getLocalLLMService } = require('../../../../shared/services/local-llm');

/**
 * Performs systematic code review of implemented task
 * Verifies completeness, correctness, testing, and adherence to requirements
 *
 * Token-optimized: Uses Local LLM for context summarization and pre-screening
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @returns {Promise} Result of Claude execution
 */
const reviewCode = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    if(fs.existsSync(folder('CODE_REVIEW.md'))){
      fs.rmSync(folder('CODE_REVIEW.md'));
    }

    if (fs.existsSync(folder('GITHUB_PR.md'))) {
      fs.rmSync(folder('GITHUB_PR.md'));
    }

    // Read task description for code-index symbol search
    const taskMdPath = folder('TASK.md');
    const taskDescription = fs.existsSync(taskMdPath)
      ? fs.readFileSync(taskMdPath, 'utf-8').substring(0, 500)
      : task;

    // Try Local LLM pre-screening to catch obvious issues early
    let prescreenSection = '';
    const llm = getLocalLLMService();
    if (llm) {
      try {
        await llm.initialize();
        if (llm.isAvailable()) {
          // Read recently modified files for pre-screening
          const contextMdPath = folder('CONTEXT.md');
          if (fs.existsSync(contextMdPath)) {
            const contextContent = fs.readFileSync(contextMdPath, 'utf-8');
            // Extract file paths from CONTEXT.md
            const fileMatches = contextContent.match(/`([^`]+\.(js|ts|py|go|java|rb))`/g);
            if (fileMatches && fileMatches.length > 0) {
              const filesToCheck = fileMatches.slice(0, 3).map(m => m.replace(/`/g, ''));
              for (const filePath of filesToCheck) {
                const fullPath = path.join(state.folder, filePath);
                if (fs.existsSync(fullPath)) {
                  const code = fs.readFileSync(fullPath, 'utf-8');
                  const prescreenResult = await llm.prescreenCode(code);
                  if (!prescreenResult.passed || prescreenResult.issues.length > 0) {
                    prescreenSection += `\n### Pre-screen: ${filePath}\n`;
                    prescreenSection += prescreenResult.issues.map(i =>
                      `- [${i.severity}] ${i.type}: ${i.message}`
                    ).join('\n');
                  }
                }
              }
            }
          }
          if (prescreenSection) {
            logger.debug(`[Step6] Pre-screening found issues to focus on`);
          }
        }
      } catch (error) {
        // Pre-screening failed, continue with normal review
      }
    }

    // Try optimized context with Local LLM (40-60% token reduction)
    let consolidatedContext;
    try {
      const optimizedResult = await buildOptimizedContextAsync(
        state.claudiomiroFolder,
        task,
        state.folder,
        taskDescription,
        { maxFiles: 8, minRelevance: 0.4, summarize: true }
      );
      consolidatedContext = optimizedResult.context;

      if (optimizedResult.method === 'llm-optimized' && optimizedResult.tokenSavings > 0) {
        logger.debug(`[Step6] Context optimized: ~${optimizedResult.tokenSavings} tokens saved`);
      }
    } catch (error) {
      // Fallback to standard consolidated context
      consolidatedContext = await buildConsolidatedContextAsync(
        state.claudiomiroFolder,
        task,
        state.folder,
        taskDescription
      );
    }

    // Get minimal reference file paths (for detailed reading if needed)
    const contextFilePaths = [
      path.join(state.claudiomiroFolder, 'AI_PROMPT.md'),
      path.join(state.claudiomiroFolder, 'INITIAL_PROMPT.md')
    ].filter(f => fs.existsSync(f));

    // Add current task's files
    if(fs.existsSync(folder('RESEARCH.md'))){
      contextFilePaths.push(folder('RESEARCH.md'));
    }
    if(fs.existsSync(folder('CONTEXT.md'))){
      contextFilePaths.push(folder('CONTEXT.md'));
    }

    // Add context files from other tasks (minimal list)
    const otherContextPaths = getContextFilePaths(state.claudiomiroFolder, task, {
      includeContext: true,
      includeResearch: false, // Skip research from other tasks to save tokens
      includeTodo: false,
      onlyCompleted: true
    });
    contextFilePaths.push(...otherContextPaths);

    // Build optimized context section with summary + reference paths
    // Include pre-screen results if available (helps focus the review)
    const prescreenInfo = prescreenSection
      ? `\n## 🔍 PRE-SCREENING RESULTS (Local LLM)\n*Issues detected before full review - focus on these:*${prescreenSection}\n`
      : '';

    const contextSection = `\n\n## 📚 CONTEXT SUMMARY FOR REVIEW
${consolidatedContext}
${prescreenInfo}
## REFERENCE FILES (read if more detail needed):
${contextFilePaths.map(f => `- ${f}`).join('\n')}

These provide:
- Original requirements and user intent
- Architectural decisions from previous tasks
- Code patterns and conventions used
- Integration points and contracts
\n`;

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-review.md'), 'utf-8');

    // Build research section
    const researchSection = fs.existsSync(folder('RESEARCH.md'))
      ? `4. **${folder('RESEARCH.md')}** → Pre-implementation analysis and execution strategy`
      : '';

    // Replace placeholders
    promptTemplate = promptTemplate
      .replace(/\{\{contextSection\}\}/g, contextSection)
      .replace(/\{\{promptMdPath\}\}/g, folder('PROMPT.md'))
      .replace(/\{\{taskMdPath\}\}/g, folder('TASK.md'))
      .replace(/\{\{todoMdPath\}\}/g, folder('TODO.md'))
      .replace(/\{\{codeReviewMdPath\}\}/g, folder('CODE_REVIEW.md'))
      .replace(/\{\{researchMdPath\}\}/g, folder('RESEARCH.md'))
      .replace(/\{\{researchSection\}\}/g, researchSection);

    const execution = await executeClaude(promptTemplate, task);

    return execution;
};

module.exports = { reviewCode };
