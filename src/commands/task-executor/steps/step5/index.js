const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { generateResearchFile } = require('./generate-research');
const { generateContextFile } = require('./generate-context');
const {
    buildConsolidatedContextAsync,
    markTaskCompleted,
    getContextFilePaths,
} = require('../../../../shared/services/context-cache');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const reflectionHook = require('./reflection-hook');

const exec = promisify(execCallback);

// Valid execution statuses
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
const REQUIRED_FIELDS = ['status', 'phases', 'artifacts', 'completion'];

// Dangerous command patterns (security)
const DANGEROUS_PATTERNS = [
    /rm\s+-rf/i,
    /sudo\s+/i,
    />\s*\/dev\//i,
    /\|\s*sh\b/i,
    /\|\s*bash\b/i,
    /eval\s+/i,
    /curl.*\|\s*sh/i,
];

/**
 * Step 5: Task Execution
 *
 * New 2-File Flow (BLUEPRINT.md + execution.json):
 * 1. Checks for BLUEPRINT.md existence (new flow) or falls back to old flow
 * 2. Verifies pre-conditions with HARD STOP behavior
 * 3. Enforces phase gates (Phase N requires Phase N-1 completed)
 * 4. Executes task using BLUEPRINT.md as context
 * 5. Updates execution.json with progress, artifacts, completion
 *
 * Old Flow Fallback (TASK.md + TODO.md):
 * - Generates RESEARCH.md with codebase analysis
 * - Builds context from previous tasks
 * - Executes task using TODO.md as guide
 * - Generates CONTEXT.md post-completion
 *
 * This is the core implementation step where actual code changes happen.
 */

const _listFolders = (dir) => {
    return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory());
};

const estimateCodeChangeSize = (contextPath, todoPath) => {
    const readContent = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
    const context = readContent(contextPath);
    const todo = readContent(todoPath);
    return context.split('\n').length + Math.floor(todo.split('\n').length / 2);
};

const estimateTaskComplexity = (todoPath) => {
    if (!fs.existsSync(todoPath)) {
        return 'medium';
    }
    const content = fs.readFileSync(todoPath, 'utf8');
    if (/complexity:\s*high/i.test(content)) {
        return 'high';
    }
    if (/complexity:\s*low/i.test(content)) {
        return 'low';
    }
    const checklist = (content.match(/- \[ \]/g) || []).length;
    if (checklist >= 8) {
        return 'high';
    }
    if (checklist <= 3) {
        return 'low';
    }
    return 'medium';
};

/**
 * Load execution.json with validation
 * @param {string} executionPath - Path to execution.json
 * @returns {Object} Parsed execution object
 * @throws {Error} if file missing or invalid
 */
const loadExecution = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        throw new Error(`execution.json not found at ${executionPath}`);
    }

    let execution;
    try {
        execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
    } catch (err) {
        throw new Error(`Failed to parse execution.json: ${err.message}`);
    }

    // Validate required fields
    for (const field of REQUIRED_FIELDS) {
        if (!(field in execution)) {
            throw new Error(`execution.json missing required field: ${field}`);
        }
    }

    // Validate status enum
    if (!VALID_STATUSES.includes(execution.status)) {
        throw new Error(`Invalid execution status: ${execution.status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    return execution;
};

/**
 * Save execution.json with validation
 * @param {string} executionPath - Path to execution.json
 * @param {Object} execution - Execution object to save
 * @throws {Error} if validation fails
 */
const saveExecution = (executionPath, execution) => {
    // Validate required fields before save
    for (const field of REQUIRED_FIELDS) {
        if (!(field in execution)) {
            throw new Error(`Cannot save execution.json: missing required field: ${field}`);
        }
    }

    // Validate status enum
    if (!VALID_STATUSES.includes(execution.status)) {
        throw new Error(`Cannot save execution.json: invalid status: ${execution.status}`);
    }

    fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf8');
};

/**
 * Check if command contains dangerous patterns
 * @param {string} command - Command to check
 * @returns {boolean} true if dangerous
 */
const isDangerousCommand = (command) => {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
};

/**
 * Verify all pre-conditions for all phases
 * @param {Object} execution - execution.json content
 * @returns {Promise<{passed: boolean, blocked: boolean}>}
 * @throws {Error} if blocked
 */
const verifyPreConditions = async (execution) => {
    const logger = require('../../../../shared/utils/logger');

    for (const phase of execution.phases || []) {
        for (const pc of phase.preConditions || []) {
            logger.info(`Checking: ${pc.check} with command: ${pc.command}`);

            // Security check
            if (isDangerousCommand(pc.command)) {
                pc.passed = false;
                pc.evidence = 'Command rejected: contains dangerous patterns';
                logger.warning(`Pre-condition FAILED: ${pc.check}. Evidence: ${pc.evidence}`);
                execution.status = 'blocked';
                return { passed: false, blocked: true };
            }

            try {
                const { stdout } = await exec(pc.command, { timeout: 5000 });
                pc.evidence = stdout.trim();
                pc.passed = stdout.includes(pc.expected);
            } catch (error) {
                pc.evidence = error.killed
                    ? 'Command timed out after 5000ms'
                    : error.message;
                pc.passed = false;
            }

            if (!pc.passed) {
                logger.warning(`Pre-condition FAILED: ${pc.check}. Evidence: ${pc.evidence}`);
                execution.status = 'blocked';
                return { passed: false, blocked: true };
            }
        }
    }

    logger.info('All pre-conditions passed');
    return { passed: true, blocked: false };
};

/**
 * Enforce phase gate - Phase N requires Phase N-1 completed
 * @param {Object} execution - execution.json content
 * @throws {Error} if previous phase not completed
 */
const enforcePhaseGate = (execution) => {
    const logger = require('../../../../shared/utils/logger');
    const currentPhaseId = execution.currentPhase?.id;

    if (!currentPhaseId || currentPhaseId <= 1) {
        return; // Phase 1 or no phase, no gate check needed
    }

    const prevPhase = (execution.phases || []).find(p => p.id === currentPhaseId - 1);

    if (!prevPhase) {
        // Single-phase task or phases not sequential
        return;
    }

    logger.info(`Phase gate check: Phase ${currentPhaseId - 1} status is ${prevPhase.status}`);

    if (prevPhase.status !== 'completed') {
        logger.warning(`Phase gate BLOCKED: Phase ${currentPhaseId - 1} not completed`);
        throw new Error(`Phase ${currentPhaseId - 1} must be completed before Phase ${currentPhaseId}`);
    }
};

/**
 * Update phase progress
 * @param {Object} execution - execution.json content
 * @param {number} phaseId - Phase ID to update
 * @param {string} status - New status
 */
const updatePhaseProgress = (execution, phaseId, status) => {
    const phase = (execution.phases || []).find(p => p.id === phaseId);
    if (phase) {
        phase.status = status;
    }

    // Update currentPhase if advancing
    if (execution.currentPhase && execution.currentPhase.id < phaseId) {
        execution.currentPhase.id = phaseId;
        execution.currentPhase.name = phase?.name || `Phase ${phaseId}`;
    }
};

/**
 * Track artifacts in execution.json
 * @param {Object} execution - execution.json content
 * @param {string[]} createdFiles - Paths of created files
 * @param {string[]} modifiedFiles - Paths of modified files
 */
const trackArtifacts = (execution, createdFiles = [], modifiedFiles = []) => {
    const logger = require('../../../../shared/utils/logger');

    if (!execution.artifacts) {
        execution.artifacts = [];
    }

    for (const filePath of createdFiles) {
        execution.artifacts.push({
            type: 'created',
            path: filePath,
            verified: false,
        });
        logger.info(`Tracked artifact: created ${filePath}`);
    }

    for (const filePath of modifiedFiles) {
        execution.artifacts.push({
            type: 'modified',
            path: filePath,
            verified: false,
        });
        logger.info(`Tracked artifact: modified ${filePath}`);
    }
};

/**
 * Track uncertainty in execution.json
 * @param {Object} execution - execution.json content
 * @param {string} topic - Uncertainty topic
 * @param {string} assumption - Assumption made
 * @param {string} confidence - "LOW"|"MEDIUM"|"HIGH"
 */
const trackUncertainty = (execution, topic, assumption, confidence) => {
    const logger = require('../../../../shared/utils/logger');

    if (!execution.uncertainties) {
        execution.uncertainties = [];
    }

    const id = `U${execution.uncertainties.length + 1}`;
    execution.uncertainties.push({
        id,
        topic,
        assumption,
        confidence,
        resolution: null,
        resolvedConfidence: null,
    });

    logger.info(`Tracked uncertainty: ${id} - ${topic} (${confidence} confidence)`);
};

/**
 * Validate completion rules
 * @param {Object} execution - execution.json content
 * @returns {boolean} true if all validation rules pass
 */
const validateCompletion = (execution) => {
    const logger = require('../../../../shared/utils/logger');

    // Check all pre-conditions passed
    for (const phase of execution.phases || []) {
        for (const pc of phase.preConditions || []) {
            if (pc.passed !== true) {
                logger.info('Completion validation: failed - pre-condition not passed');
                return false;
            }
        }
    }

    // Check all artifacts verified
    for (const artifact of execution.artifacts || []) {
        if (artifact.verified !== true) {
            logger.info('Completion validation: failed - artifact not verified');
            return false;
        }
    }

    // Check beyondTheBasics cleanup flags
    const cleanup = execution.beyondTheBasics?.cleanup;
    if (cleanup) {
        if (cleanup.debugLogsRemoved === false ||
            cleanup.formattingConsistent === false ||
            cleanup.deadCodeRemoved === false) {
            logger.info('Completion validation: failed - cleanup not complete');
            return false;
        }
    }

    logger.info('Completion validation: passed');
    return true;
};

/**
 * Execute new 2-file flow (BLUEPRINT.md + execution.json)
 * @param {string} task - Task identifier
 * @param {string} taskFolder - Path to task folder
 * @param {string} cwd - Working directory
 * @returns {Promise<any>} Execution result
 */
const executeNewFlow = async (task, taskFolder, cwd) => {
    const logger = require('../../../../shared/utils/logger');
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
    const executionPath = path.join(taskFolder, 'execution.json');

    logger.info('Using new 2-file flow (BLUEPRINT.md)');

    // Load BLUEPRINT.md
    if (!fs.existsSync(blueprintPath)) {
        throw new Error('BLUEPRINT.md not found');
    }
    const blueprintContent = fs.readFileSync(blueprintPath, 'utf8');

    if (!blueprintContent || blueprintContent.trim().length === 0) {
        throw new Error('BLUEPRINT.md is empty');
    }

    // Load and validate execution.json
    const execution = loadExecution(executionPath);

    logger.info(`Loaded execution.json: status=${execution.status}, phase=${execution.currentPhase?.id || 1}`);

    // Phase 1: Pre-condition verification (HARD STOP)
    const { blocked } = await verifyPreConditions(execution);
    if (blocked) {
        saveExecution(executionPath, execution);
        throw new Error('Pre-conditions failed. Task blocked.');
    }

    // Phase gate enforcement
    enforcePhaseGate(execution);

    // Update status to in_progress
    execution.status = 'in_progress';
    saveExecution(executionPath, execution);

    // Execute with BLUEPRINT as context
    const shellCommandRule = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'),
        'utf-8',
    );

    const prompt = blueprintContent + '\n\n' + shellCommandRule;
    const result = await executeClaude(prompt, task, { cwd });

    // Mark task as completed in cache
    markTaskCompleted(state.claudiomiroFolder, task);

    // Validate completion
    if (validateCompletion(execution)) {
        execution.completion.status = 'completed';
    }

    logger.info(`Saved execution.json: status=${execution.status}`);
    saveExecution(executionPath, execution);

    return result;
};

/**
 * Execute old flow (TASK.md + TODO.md) - backward compatibility
 * @param {string} task - Task identifier
 * @param {string} taskFolder - Path function
 * @param {string} cwd - Working directory
 * @param {boolean} needsReResearch - Whether re-research is needed
 * @returns {Promise<any>} Execution result
 */
const executeOldFlow = async (task, folder, cwd, needsReResearch) => {
    const logger = require('../../../../shared/utils/logger');

    logger.info('Falling back to old flow (TASK.md + TODO.md)');

    // PHASE 1: Research and context gathering
    await generateResearchFile(task, { cwd });

    if (fs.existsSync(folder('CODE_REVIEW.md'))) {
        fs.rmSync(folder('CODE_REVIEW.md'));
    }

    // Read task description for code-index symbol search
    const taskMdContent = fs.existsSync(folder('TASK.md'))
        ? fs.readFileSync(folder('TASK.md'), 'utf8')
        : '';
    const taskDescription = taskMdContent.length > 0
        ? taskMdContent.substring(0, 500)
        : task;

    // Build consolidated context
    const consolidatedContext = await buildConsolidatedContextAsync(
        state.claudiomiroFolder,
        task,
        cwd,
        taskDescription,
    );

    // Get context file paths
    const contextFilePaths = getContextFilePaths(state.claudiomiroFolder, task, {
        includeContext: true,
        includeResearch: false,
        includeTodo: false,
        onlyCompleted: true,
    });

    // Add current task's RESEARCH.md if exists
    if (fs.existsSync(folder('RESEARCH.md'))) {
        contextFilePaths.push(folder('RESEARCH.md'));
    }

    // Update TODO.md with consolidated context
    if (fs.existsSync(folder('TODO.md'))) {
        let todo = fs.readFileSync(folder('TODO.md'), 'utf8');

        if (!todo.includes('## CONSOLIDATED CONTEXT:')) {
            const contextSection = `\n\n## CONSOLIDATED CONTEXT:
${consolidatedContext}

## REFERENCE FILES (read if more detail needed):
${contextFilePaths.map(f => `- ${f}`).join('\n')}
\n`;
            todo += contextSection;
            fs.writeFileSync(folder('TODO.md'), todo, 'utf8');
        }
    }

    // Update info.json
    if (fs.existsSync(folder('info.json'))) {
        let info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        info.attempts += 1;
        info.lastError = null;
        info.lastRun = new Date().toISOString();
        info.reResearched = needsReResearch || info.reResearched || false;

        if (!info.history) info.history = [];
        info.history.push({
            timestamp: new Date().toISOString(),
            attempt: info.attempts,
            reResearched: needsReResearch,
        });

        fs.writeFileSync(folder('info.json'), JSON.stringify(info, null, 2), 'utf8');
    } else {
        let info = {
            firstRun: new Date().toISOString(),
            lastRun: new Date().toISOString(),
            attempts: 1,
            lastError: null,
            reResearched: false,
            history: [{
                timestamp: new Date().toISOString(),
                attempt: 1,
                reResearched: false,
            }],
        };
        fs.writeFileSync(folder('info.json'), JSON.stringify(info, null, 2), 'utf8');
    }

    // Build execution context
    const researchSection = fs.existsSync(folder('RESEARCH.md'))
        ? `\n## RESEARCH CONTEXT:\nBEFORE starting, read ${folder('RESEARCH.md')} completely. It contains:\n- Files you need to read/modify\n- Code patterns to follow\n- Integration points\n- Test strategy\n- Potential challenges\n- Execution strategy\n\nThis research was done specifically for this task. Follow the execution strategy outlined there.\n\n---\n`
        : '';

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');

    // Replace placeholders
    promptTemplate = promptTemplate
        .replace(/\{\{todoPath\}\}/g, folder('TODO.md'))
        .replace(/\{\{researchSection\}\}/g, researchSection);

    const shellCommandRule = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'),
        'utf-8',
    );

    const result = await executeClaude(promptTemplate + '\n\n' + shellCommandRule, task, { cwd });

    // Generate CONTEXT.md after successful execution
    await generateContextFile(task);

    // Mark task as completed in cache
    markTaskCompleted(state.claudiomiroFolder, task);

    return result;
};

const step5 = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    const taskFolder = path.join(state.claudiomiroFolder, task);
    const logger = require('../../../../shared/utils/logger');

    // Read and parse scope from TASK.md for multi-repo support
    const taskMdPath = folder('TASK.md');
    const taskMdContent = fs.existsSync(taskMdPath)
        ? fs.readFileSync(taskMdPath, 'utf-8')
        : '';
    const scope = parseTaskScope(taskMdContent);

    // Validate scope in multi-repo mode (throws if missing)
    validateScope(scope, state.isMultiRepo());

    // Determine working directory based on scope
    const cwd = state.isMultiRepo()
        ? state.getRepository(scope)
        : state.folder;

    // Check for new 2-file flow (BLUEPRINT.md + execution.json)
    const blueprintPath = folder('BLUEPRINT.md');
    if (fs.existsSync(blueprintPath)) {
        // New flow: use BLUEPRINT.md + execution.json
        try {
            const result = await executeNewFlow(task, taskFolder, cwd);

            // Reflection hook for new flow
            try {
                const executionPath = folder('execution.json');
                const execution = fs.existsSync(executionPath)
                    ? JSON.parse(fs.readFileSync(executionPath, 'utf8'))
                    : null;

                const metrics = {
                    attempts: execution?.attempts || 1,
                    hasErrors: Boolean(execution?.uncertainties?.length > 0),
                    codeChangeSize: estimateCodeChangeSize(folder('BLUEPRINT.md'), executionPath),
                    taskComplexity: 'medium', // New flow doesn't use TODO.md
                };

                const decision = reflectionHook.shouldReflect(task, metrics);
                if (decision.should) {
                    const reflection = await reflectionHook.createReflection(task, { cwd });
                    if (reflection) {
                        await reflectionHook.storeReflection(task, reflection, decision);
                    }
                }
            } catch (reflectionError) {
                const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
                const stateManager = ParallelStateManager.getInstance();
                if (!stateManager || !stateManager.isUIRendererActive()) {
                    logger.warning(`[Step5] Reflection skipped: ${reflectionError.message}`);
                }
            }

            return result;
        } catch (error) {
            // Update execution.json with error if it exists
            const executionPath = folder('execution.json');
            if (fs.existsSync(executionPath)) {
                try {
                    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
                    if (!execution.errorHistory) execution.errorHistory = [];
                    execution.errorHistory.push({
                        timestamp: new Date().toISOString(),
                        message: error.message,
                        stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : null,
                    });
                    fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf8');
                } catch (_saveErr) {
                    // Ignore save errors
                }
            }
            throw error;
        }
    }

    // OLD FLOW: TASK.md + TODO.md (backward compatibility)

    // Check if we need to re-research due to multiple failures
    let needsReResearch = false;
    if (fs.existsSync(folder('info.json'))) {
        const info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        // Re-research if: 3+ attempts AND last attempt failed
        if (info.attempts >= 3 && info.lastError) {
            needsReResearch = true;
            const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
            const stateManager = ParallelStateManager.getInstance();
            if (!stateManager || !stateManager.isUIRendererActive()) {
                logger.warning(`Task has failed ${info.attempts} times. Re-analyzing approach...`);
            }
            // Remove old RESEARCH.md to force new analysis
            if (fs.existsSync(folder('RESEARCH.md'))) {
                fs.renameSync(folder('RESEARCH.md'), folder('RESEARCH.old.md'));
            }
        }
    }

    try {
        const result = await executeOldFlow(task, folder, cwd, needsReResearch);

        // Reflection hook for old flow
        try {
            const info = fs.existsSync(folder('info.json'))
                ? JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'))
                : null;

            const metrics = {
                attempts: info?.attempts || 1,
                hasErrors: Boolean(info?.errorHistory && info.errorHistory.length > 0),
                codeChangeSize: estimateCodeChangeSize(folder('CONTEXT.md'), folder('TODO.md')),
                taskComplexity: estimateTaskComplexity(folder('TODO.md')),
            };

            const decision = reflectionHook.shouldReflect(task, metrics);
            if (decision.should) {
                const reflection = await reflectionHook.createReflection(task, { cwd });
                if (reflection) {
                    await reflectionHook.storeReflection(task, reflection, decision);
                }
            }
        } catch (reflectionError) {
            const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
            const stateManager = ParallelStateManager.getInstance();
            if (!stateManager || !stateManager.isUIRendererActive()) {
                logger.warning(`[Step5] Reflection skipped: ${reflectionError.message}`);
            }
        }

        return result;
    } catch (error) {
        let info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        info.lastError = {
            message: error.message,
            timestamp: new Date().toISOString(),
            attempt: info.attempts,
        };

        // Add to error history
        if (!info.errorHistory) info.errorHistory = [];
        info.errorHistory.push({
            timestamp: new Date().toISOString(),
            attempt: info.attempts,
            message: error.message,
            stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : null,
        });

        fs.writeFileSync(folder('info.json'), JSON.stringify(info, null, 2), 'utf8');

        // If executeClaude fails, ensure TODO.md is marked as not fully implemented
        if (fs.existsSync(folder('TODO.md'))) {
            let todo = fs.readFileSync(folder('TODO.md'), 'utf8');
            const lines = todo.split('\n');

            // Update the first line to be "Fully implemented: NO" if it exists
            if (lines.length > 0) {
                lines[0] = 'Fully implemented: NO';
                todo = lines.join('\n');
                fs.writeFileSync(folder('TODO.md'), todo, 'utf8');
            }
        }

        // Re-throw the error so the dag-executor can handle it
        throw error;
    }
};

// Export helper functions for testing
module.exports = {
    step5,
    loadExecution,
    saveExecution,
    verifyPreConditions,
    enforcePhaseGate,
    updatePhaseProgress,
    trackArtifacts,
    trackUncertainty,
    validateCompletion,
    executeNewFlow,
    executeOldFlow,
    isDangerousCommand,
    VALID_STATUSES,
    REQUIRED_FIELDS,
};
