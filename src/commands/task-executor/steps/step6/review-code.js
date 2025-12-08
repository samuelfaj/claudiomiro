const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
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
 * Builds review context from BLUEPRINT.md, execution.json, and optional review checklist
 * @param {string} blueprint - Raw BLUEPRINT.md content
 * @param {Object} execution - Parsed execution.json
 * @param {Object|null} reviewChecklist - Parsed review-checklist.json (optional)
 * @returns {Object} Review context with taskDefinition, contextFiles, modifiedFiles, completionSummary, reviewChecklist
 */
const buildReviewContext = (blueprint, execution, reviewChecklist = null) => {
    const contextChain = extractContextChain(blueprint);
    const artifacts = (execution?.artifacts || []).map(a => `${(a.type || 'file').toUpperCase()}: ${a.path}`);

    return {
        taskDefinition: blueprint,
        contextFiles: contextChain,
        modifiedFiles: artifacts,
        completionSummary: execution?.completion?.summary || [],
        reviewChecklist,
    };
};

/**
 * Performs code review using the new BLUEPRINT flow
 * Uses BLUEPRINT.md + execution.json without buildOptimizedContextAsync
 *
 * @param {string} task - Task identifier
 * @param {function} folder - Helper function to build file paths
 * @param {string} projectFolder - Working directory
 * @param {Object} options - Options object
 * @param {string} options.model - Model to use ('fast', 'medium', 'hard')
 * @returns {Promise} Result of Claude execution
 */
const reviewWithBlueprintFlow = async (task, folder, projectFolder, options = {}) => {
    logger.debug('[Step6] Using BLUEPRINT flow');

    // Read BLUEPRINT.md and execution.json
    const blueprint = fs.readFileSync(folder('BLUEPRINT.md'), 'utf-8');
    let execution;
    try {
        execution = JSON.parse(fs.readFileSync(folder('execution.json'), 'utf-8'));
    } catch (error) {
        throw new Error(`Failed to parse execution.json: ${error.message}`);
    }

    // Read review-checklist.json if available
    let reviewChecklist = null;
    const checklistPath = folder('review-checklist.json');
    if (fs.existsSync(checklistPath)) {
        try {
            reviewChecklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8'));
            logger.debug(`[Step6] Loaded review checklist with ${reviewChecklist.items?.length || 0} items`);
        } catch (error) {
            logger.warning(`[Step6] Failed to parse review-checklist.json: ${error.message}`);
        }
    }

    // Validate completion
    const validationResult = validateCompletionForReview(execution);
    logger.debug('[Step6] Completion validation:', validationResult);
    if (!validationResult.ready) {
        throw new Error(`Task not ready for review: ${validationResult.reason}`);
    }

    // Build review context from BLUEPRINT + execution + checklist
    const reviewContext = buildReviewContext(blueprint, execution, reviewChecklist);
    logger.debug('[Step6] Building review context from BLUEPRINT + execution.json');
    logger.debug('[Step6] Context files:', reviewContext.contextFiles.length);

    // Build review checklist section if available
    let reviewChecklistSection = '';
    if (reviewContext.reviewChecklist?.items?.length > 0) {
        const items = reviewContext.reviewChecklist.items;
        const groupedByFile = items.reduce((acc, item) => {
            if (!acc[item.file]) acc[item.file] = [];
            acc[item.file].push(item);
            return acc;
        }, {});

        reviewChecklistSection = `\n### Review Checklist (from Step 5)

The following verification items were generated based on the artifacts created/modified.
Use these as a guided verification framework. Mark items as verified or failed.

${Object.entries(groupedByFile).map(([file, fileItems]) => `
#### ${file}
${fileItems.map(item => `- [ ] **[${item.id}]** (${item.category}) ${item.description}${item.lines?.length ? ` [lines: ${item.lines.join(', ')}]` : ''}`).join('\n')}`).join('\n')}
`;
    }

    // Build context section from BLUEPRINT data
    const contextSection = `\n\n## 📚 CONTEXT SUMMARY FOR REVIEW

### Task Definition (from BLUEPRINT.md)
${reviewContext.taskDefinition.substring(0, 2000)}${reviewContext.taskDefinition.length > 2000 ? '\n... (truncated)' : ''}

### Modified Files (from execution.json)
${reviewContext.modifiedFiles.length > 0 ? reviewContext.modifiedFiles.map(f => `- ${f}`).join('\n') : '- No artifacts recorded'}

### Completion Summary
${reviewContext.completionSummary.length > 0 ? reviewContext.completionSummary.map(s => `- ${s}`).join('\n') : '- Task completed'}
${reviewChecklistSection}
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

    // Replace placeholders with new BLUEPRINT + execution.json flow
    promptTemplate = promptTemplate
        .replace(/\{\{contextSection\}\}/g, contextSection)
        .replace(/\{\{blueprintPath\}\}/g, folder('BLUEPRINT.md'))
        .replace(/\{\{executionJsonPath\}\}/g, folder('execution.json'))
        .replace(/\{\{codeReviewMdPath\}\}/g, folder('CODE_REVIEW.md'));

    const shellCommandRule = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'), 'utf-8');

    // Build Claude options
    const claudeOptions = {};
    if (projectFolder !== state.folder) {
        claudeOptions.cwd = projectFolder;
    }
    if (options.model) {
        claudeOptions.model = options.model;
        logger.info(`[Step6] Code review using model: ${options.model}`);
    }

    return await executeClaude(
        promptTemplate + '\n\n' + shellCommandRule,
        task,
        Object.keys(claudeOptions).length > 0 ? claudeOptions : undefined,
    );
};

/**
 * Performs systematic code review of implemented task
 * Verifies completeness, correctness, testing, and adherence to requirements
 *
 * Uses BLUEPRINT.md + execution.json flow
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @param {Object} options - Options object
 * @param {string} options.model - Model to use ('fast', 'medium', 'hard')
 * @returns {Promise} Result of Claude execution
 */
const reviewCode = async (task, options = {}) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    if (fs.existsSync(folder('CODE_REVIEW.md'))) {
        fs.rmSync(folder('CODE_REVIEW.md'));
    }

    if (fs.existsSync(folder('GITHUB_PR.md'))) {
        fs.rmSync(folder('GITHUB_PR.md'));
    }

    // Require BLUEPRINT.md to exist
    const blueprintPath = folder('BLUEPRINT.md');
    if (!fs.existsSync(blueprintPath)) {
        throw new Error(`BLUEPRINT.md not found for task ${task}. Cannot perform code review.`);
    }

    // Read BLUEPRINT.md and extract scope for multi-repo support
    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');

    // Determine working directory based on scope (multi-repo support)
    const scope = parseTaskScope(blueprintContent);
    validateScope(scope, state.isMultiRepo()); // Throws if scope missing in multi-repo mode
    const projectFolder = state.isMultiRepo() && scope
        ? state.getRepository(scope)
        : state.folder;

    return await reviewWithBlueprintFlow(task, folder, projectFolder, options);
};

module.exports = {
    reviewCode,
    // Export for testing
    validateCompletionForReview,
    extractContextChain,
    buildReviewContext,
};
