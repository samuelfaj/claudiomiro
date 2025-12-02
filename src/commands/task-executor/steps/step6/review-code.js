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
 * Validates that task is ready for code review
 * @param {Object} execution - Parsed execution.json content
 * @returns {{ ready: boolean, reason?: string }}
 */
const validateCompletionForReview = (execution) => {
    // Check all phases completed
    const phases = execution?.phases || [];
    const incompletePhases = phases.filter(p => p.status !== 'completed');
    if (incompletePhases.length > 0) {
        return { ready: false, reason: `Incomplete phases: ${incompletePhases.map(p => p.name).join(', ')}` };
    }

    // Check cleanup flags
    const cleanup = execution?.beyondTheBasics?.cleanup;
    if (!cleanup) {
        return { ready: false, reason: 'Missing beyondTheBasics.cleanup in execution.json' };
    }

    const missingCleanup = [];
    if (!cleanup.debugLogsRemoved) missingCleanup.push('debugLogsRemoved');
    if (!cleanup.formattingConsistent) missingCleanup.push('formattingConsistent');
    if (!cleanup.deadCodeRemoved) missingCleanup.push('deadCodeRemoved');

    if (missingCleanup.length > 0) {
        return { ready: false, reason: `Cleanup not complete: ${missingCleanup.join(', ')}` };
    }

    return { ready: true };
};

/**
 * Extracts CONTEXT CHAIN section from BLUEPRINT.md
 * @param {string} blueprint - Raw BLUEPRINT.md content
 * @returns {string[]} List of context file paths
 */
const extractContextChain = (blueprint) => {
    // Match ## 2. CONTEXT CHAIN section
    const contextChainMatch = blueprint.match(/##\s*2\.\s*CONTEXT CHAIN[\s\S]*?(?=##\s*3\.|$)/i);
    if (!contextChainMatch) {
        return [];
    }

    const section = contextChainMatch[0];
    const files = [];

    // Split by lines and look for file paths after - or *
    const lines = section.split('\n');
    const fileExtensions = /\.(js|ts|json|md|jsx|tsx|py|go|rs|java|rb|php|c|cpp|h|hpp|css|scss|html)$/i;

    lines.forEach(line => {
        // Match lines starting with - or * followed by optional backticks and a file path
        const match = line.match(/^\s*[-*]\s*`?([^`\n]+?)`?\s*$/);
        if (match && match[1]) {
            const path = match[1].trim();
            if (fileExtensions.test(path)) {
                files.push(path);
            }
        }
    });

    return files;
};

/**
 * Builds review context from BLUEPRINT.md and execution.json
 * @param {string} blueprint - Raw BLUEPRINT.md content
 * @param {Object} execution - Parsed execution.json
 * @returns {Object} Review context with taskDefinition, contextFiles, modifiedFiles, completionSummary
 */
const buildReviewContext = (blueprint, execution) => {
    const contextChain = extractContextChain(blueprint);
    const artifacts = (execution?.artifacts || []).map(a => `${(a.type || 'file').toUpperCase()}: ${a.path}`);

    return {
        taskDefinition: blueprint,
        contextFiles: contextChain,
        modifiedFiles: artifacts,
        completionSummary: execution?.completion?.summary || [],
    };
};

/**
 * Performs code review using the old flow (backward compatibility)
 * Uses buildOptimizedContextAsync for context building
 *
 * @param {string} task - Task identifier
 * @param {function} folder - Helper function to build file paths
 * @param {string} projectFolder - Working directory
 * @param {string} taskDescription - Task description text
 * @returns {Promise} Result of Claude execution
 */
const reviewWithOldFlow = async (task, folder, projectFolder, taskDescription) => {
    logger.debug('[Step6] Using legacy flow (backward compatibility)');

    // Try optimized context with Local LLM (40-60% token reduction)
    let consolidatedContext;
    try {
        const optimizedResult = await buildOptimizedContextAsync(
            state.claudiomiroFolder,
            task,
            projectFolder,
            taskDescription,
            { maxFiles: 8, minRelevance: 0.4, summarize: true },
        );
        consolidatedContext = optimizedResult.context;

        if (optimizedResult.method === 'llm-optimized' && optimizedResult.tokenSavings > 0) {
            logger.debug(`[Step6] Context optimized: ~${optimizedResult.tokenSavings} tokens saved`);
        }
    } catch {
        // Fallback to standard consolidated context
        consolidatedContext = await buildConsolidatedContextAsync(
            state.claudiomiroFolder,
            task,
            projectFolder,
            taskDescription,
        );
    }

    // Get minimal reference file paths (for detailed reading if needed)
    const contextFilePaths = [
        path.join(state.claudiomiroFolder, 'AI_PROMPT.md'),
        path.join(state.claudiomiroFolder, 'INITIAL_PROMPT.md'),
    ].filter(f => fs.existsSync(f));

    // Add current task's files
    if (fs.existsSync(folder('RESEARCH.md'))) {
        contextFilePaths.push(folder('RESEARCH.md'));
    }
    if (fs.existsSync(folder('CONTEXT.md'))) {
        contextFilePaths.push(folder('CONTEXT.md'));
    }

    // Add context files from other tasks (minimal list)
    const otherContextPaths = getContextFilePaths(state.claudiomiroFolder, task, {
        includeContext: true,
        includeResearch: false,
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
    return await executeClaude(
        promptTemplate + '\n\n' + shellCommandRule,
        task,
        projectFolder !== state.folder ? { cwd: projectFolder } : undefined,
    );
};

/**
 * Performs code review using the new BLUEPRINT flow
 * Uses BLUEPRINT.md + execution.json without buildOptimizedContextAsync
 *
 * @param {string} task - Task identifier
 * @param {function} folder - Helper function to build file paths
 * @param {string} projectFolder - Working directory
 * @returns {Promise} Result of Claude execution
 */
const reviewWithBlueprintFlow = async (task, folder, projectFolder) => {
    logger.debug('[Step6] Using BLUEPRINT flow');

    // Read BLUEPRINT.md and execution.json
    const blueprint = fs.readFileSync(folder('BLUEPRINT.md'), 'utf-8');
    let execution;
    try {
        execution = JSON.parse(fs.readFileSync(folder('execution.json'), 'utf-8'));
    } catch (error) {
        throw new Error(`Failed to parse execution.json: ${error.message}`);
    }

    // Validate completion
    const validationResult = validateCompletionForReview(execution);
    logger.debug('[Step6] Completion validation:', validationResult);
    if (!validationResult.ready) {
        throw new Error(`Task not ready for review: ${validationResult.reason}`);
    }

    // Build review context from BLUEPRINT + execution (NO buildOptimizedContextAsync)
    const reviewContext = buildReviewContext(blueprint, execution);
    logger.debug('[Step6] Building review context from BLUEPRINT + execution.json');
    logger.debug('[Step6] Context files:', reviewContext.contextFiles.length);

    // Build context section from BLUEPRINT data
    const contextSection = `\n\n## 📚 CONTEXT SUMMARY FOR REVIEW

### Task Definition (from BLUEPRINT.md)
${reviewContext.taskDefinition.substring(0, 2000)}${reviewContext.taskDefinition.length > 2000 ? '\n... (truncated)' : ''}

### Modified Files (from execution.json)
${reviewContext.modifiedFiles.length > 0 ? reviewContext.modifiedFiles.map(f => `- ${f}`).join('\n') : '- No artifacts recorded'}

### Completion Summary
${reviewContext.completionSummary.length > 0 ? reviewContext.completionSummary.map(s => `- ${s}`).join('\n') : '- Task completed'}

## REFERENCE FILES (read if more detail needed):
${reviewContext.contextFiles.map(f => `- ${f}`).join('\n') || '- No additional context files'}

These provide:
- Original requirements and user intent
- Architectural decisions from previous tasks
- Code patterns and conventions used
- Integration points and contracts
\n`;

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-review.md'), 'utf-8');

    // Build research section (BLUEPRINT may still have research info)
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
    return await executeClaude(
        promptTemplate + '\n\n' + shellCommandRule,
        task,
        projectFolder !== state.folder ? { cwd: projectFolder } : undefined,
    );
};

/**
 * Performs systematic code review of implemented task
 * Verifies completeness, correctness, testing, and adherence to requirements
 *
 * Token-optimized: Uses consolidated context for efficient token usage
 * Supports both new BLUEPRINT flow and legacy backward compatibility
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @returns {Promise} Result of Claude execution
 */
const reviewCode = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    if (fs.existsSync(folder('CODE_REVIEW.md'))) {
        fs.rmSync(folder('CODE_REVIEW.md'));
    }

    if (fs.existsSync(folder('GITHUB_PR.md'))) {
        fs.rmSync(folder('GITHUB_PR.md'));
    }

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

    // Check for BLUEPRINT.md to determine flow
    if (fs.existsSync(folder('BLUEPRINT.md'))) {
        return await reviewWithBlueprintFlow(task, folder, projectFolder);
    }

    // Backward compatibility: use old flow if BLUEPRINT.md doesn't exist
    return await reviewWithOldFlow(task, folder, projectFolder, taskDescription);
};

module.exports = {
    reviewCode,
    // Export for testing
    validateCompletionForReview,
    extractContextChain,
    buildReviewContext,
};
