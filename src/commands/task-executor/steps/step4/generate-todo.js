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
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');

/**
 * Generates a comprehensive TODO.md file for a task
 * This file contains detailed implementation instructions, context references,
 * acceptance criteria, and verification steps
 *
 * Token-optimized: Uses Local LLM for context summarization when available
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2.1')
 * @returns {Promise} Result of Claude execution
 */
const generateTodo = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    // Keep template reference - Claude needs to see the structure
    const TODOtemplate = fs.readFileSync(path.join(__dirname, '../../templates', 'TODO.md'), 'utf-8');

    // Read task content and extract scope for multi-repo support
    const taskMdPath = folder('TASK.md');
    const taskMdContent = fs.existsSync(taskMdPath)
        ? fs.readFileSync(taskMdPath, 'utf-8')
        : '';
    const taskDescription = taskMdContent.substring(0, 500) || task;

    // Determine working directory based on scope (multi-repo support)
    const scope = parseTaskScope(taskMdContent);
    validateScope(scope, state.isMultiRepo()); // Throws if scope missing in multi-repo mode
    const projectFolder = state.isMultiRepo() && scope
        ? state.getRepository(scope)
        : state.folder;

    // Try optimized context with Local LLM (40-60% token reduction)
    // Falls back to consolidated context if LLM not available
    let consolidatedContext;
    let tokenSavings = 0;

    try {
        const optimizedResult = await buildOptimizedContextAsync(
            state.claudiomiroFolder,
            task,
            projectFolder, // Use scope-aware folder for multi-repo support
            taskDescription,
            { maxFiles: 10, minRelevance: 0.3, summarize: true },
        );

        consolidatedContext = optimizedResult.context;
        tokenSavings = optimizedResult.tokenSavings;

        if (optimizedResult.method === 'llm-optimized' && tokenSavings > 0) {
            logger.debug(`[Step4] Context optimized: ~${tokenSavings} tokens saved (${optimizedResult.filesIncluded} relevant files)`);
        }
    } catch (error) {
    // Fallback to standard consolidated context
        consolidatedContext = await buildConsolidatedContextAsync(
            state.claudiomiroFolder,
            task,
            projectFolder, // Use scope-aware folder for multi-repo support
            taskDescription,
        );
    }

    // Get minimal reference paths (not content)
    const contextFilePaths = getContextFilePaths(state.claudiomiroFolder, task, {
        includeContext: true,
        includeResearch: true,
        includeTodo: true,
        onlyCompleted: true,
    });

    // Build optimized context section with summary + reference paths
    const contextSection = `\n\n## CONTEXT SUMMARY:
${consolidatedContext}

## REFERENCE FILES (read only if you need more detail):
- ${path.join(state.claudiomiroFolder, 'AI_PROMPT.md')} (full environment context)
${contextFilePaths.map(f => `- ${f}`).join('\n')}
\n`;

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-generate-todo.md'), 'utf-8');

    // Replace placeholders
    promptTemplate = promptTemplate
        .replace(/\{\{contextSection\}\}/g, contextSection)
        .replace(/\{\{taskMdPath\}\}/g, folder('TASK.md'))
        .replace(/\{\{promptMdPath\}\}/g, folder('PROMPT.md'))
        .replace(/\{\{todoMdPath\}\}/g, folder('TODO.md'))
        .replace(/\{\{aiPromptPath\}\}/g, path.join(state.claudiomiroFolder, 'AI_PROMPT.md'))
        .replace(/\{\{todoTemplate\}\}/g, TODOtemplate);

    return executeClaude(promptTemplate, task, projectFolder !== state.folder ? { cwd: projectFolder } : undefined);
};

module.exports = { generateTodo };
