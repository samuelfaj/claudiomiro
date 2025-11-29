const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const {
    buildConsolidatedContextAsync,
    buildOptimizedContextAsync,
    getContextFilePaths,
} = require('../../../../shared/services/context-cache');

/**
 * Performs systematic code review of implemented task
 * Verifies completeness, correctness, testing, and adherence to requirements
 *
 * Token-optimized: Uses consolidated context for efficient token usage
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

    // Try optimized context with Local LLM (40-60% token reduction)
    let consolidatedContext;
    try {
        const optimizedResult = await buildOptimizedContextAsync(
            state.claudiomiroFolder,
            task,
            state.folder,
            taskDescription,
            { maxFiles: 8, minRelevance: 0.4, summarize: true },
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
            taskDescription,
        );
    }

    // Get minimal reference file paths (for detailed reading if needed)
    const contextFilePaths = [
        path.join(state.claudiomiroFolder, 'AI_PROMPT.md'),
        path.join(state.claudiomiroFolder, 'INITIAL_PROMPT.md'),
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
        onlyCompleted: true,
    });
    contextFilePaths.push(...otherContextPaths);

    // Build optimized context section with summary + reference paths
    const contextSection = `\n\n## 📚 CONTEXT SUMMARY FOR REVIEW
${consolidatedContext}

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

    const shellCommandRule = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'), 'utf-8');
    const execution = await executeClaude(promptTemplate + '\n\n' + shellCommandRule, task);

    return execution;
};

module.exports = { reviewCode };
