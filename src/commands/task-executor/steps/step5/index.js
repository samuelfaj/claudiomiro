const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { markTaskCompleted } = require('../../../../shared/services/context-cache');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const { validateExecutionJson } = require('../../utils/schema-validator');
const reflectionHook = require('./reflection-hook');

const exec = promisify(execCallback);

// Valid execution statuses
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];

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
 * 2-File Flow (BLUEPRINT.md + execution.json):
 * 1. Requires BLUEPRINT.md to exist
 * 2. Verifies pre-conditions with HARD STOP behavior
 * 3. Enforces phase gates (Phase N requires Phase N-1 completed)
 * 4. Executes task using BLUEPRINT.md as context
 * 5. Updates execution.json with progress, artifacts, completion
 *
 * This is the core implementation step where actual code changes happen.
 */

/**
 * Estimates the code change size from BLUEPRINT.md content
 * @param {string} blueprintPath - Path to BLUEPRINT.md
 * @returns {number} Estimated line count
 */
const estimateCodeChangeSize = (blueprintPath) => {
    if (!fs.existsSync(blueprintPath)) return 0;
    const content = fs.readFileSync(blueprintPath, 'utf8');
    return content.split('\n').length;
};

/**
 * Load execution.json with schema validation
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

    // Validate against schema
    const validation = validateExecutionJson(execution);
    if (!validation.valid) {
        throw new Error(`Invalid execution.json: ${validation.errors.join('; ')}`);
    }

    return execution;
};

/**
 * Save execution.json with schema validation
 * @param {string} executionPath - Path to execution.json
 * @param {Object} execution - Execution object to save
 * @throws {Error} if validation fails
 */
const saveExecution = (executionPath, execution) => {
    // Validate against schema before save
    const validation = validateExecutionJson(execution);
    if (!validation.valid) {
        throw new Error(`Cannot save execution.json: ${validation.errors.join('; ')}`);
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

    // Check all phases completed
    for (const phase of execution.phases || []) {
        if (phase.status !== 'completed') {
            logger.info(`Completion validation: failed - Phase ${phase.id} (${phase.name}) not completed (status: ${phase.status})`);
            return false;
        }

        // Check all items in phase completed (if items exist)
        for (const item of phase.items || []) {
            if (item.completed !== true) {
                logger.info(`Completion validation: failed - Phase ${phase.id} item not completed: ${item.description}`);
                return false;
            }
        }

        // Check all pre-conditions passed
        for (const pc of phase.preConditions || []) {
            if (pc.passed !== true) {
                logger.info(`Completion validation: failed - Phase ${phase.id} pre-condition not passed: ${pc.check}`);
                return false;
            }
        }
    }

    // Check all artifacts verified
    for (const artifact of execution.artifacts || []) {
        if (artifact.verified !== true) {
            logger.info(`Completion validation: failed - artifact not verified: ${artifact.path}`);
            return false;
        }
    }

    // Check all success criteria passed (if they exist)
    for (const criterion of execution.successCriteria || []) {
        if (criterion.passed !== true) {
            logger.info(`Completion validation: failed - success criterion not passed: ${criterion.criterion}`);
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

    // Track attempts for diagnostics
    execution.attempts = (execution.attempts || 0) + 1;
    const attemptsBeforeClaude = execution.attempts;

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

    // Load step5 prompt with execution.json tracking instructions
    const step5PromptPath = path.join(__dirname, 'prompt.md');
    const step5Prompt = fs.existsSync(step5PromptPath)
        ? fs.readFileSync(step5PromptPath, 'utf-8')
        : '';

    // Load shell command rule
    const shellCommandRule = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'),
        'utf-8',
    );

    // Combine: step5 instructions + BLUEPRINT + shell rules
    const prompt = step5Prompt
        ? `${step5Prompt}\n\n---\n\n## BLUEPRINT.md (Your Implementation Spec)\n\n${blueprintContent}\n\n---\n\n${shellCommandRule}`
        : `${blueprintContent}\n\n${shellCommandRule}`;
    const result = await executeClaude(prompt, task, { cwd });

    // Mark task as completed in cache
    markTaskCompleted(state.claudiomiroFolder, task);

    // Reload execution.json to include Claude's updates before persisting
    const latestExecution = loadExecution(executionPath);

    // Preserve incremented attempt count if Claude rewrites execution.json
    const latestAttempts = Number.isInteger(latestExecution.attempts)
        ? latestExecution.attempts
        : 0;
    latestExecution.attempts = Math.max(latestAttempts, attemptsBeforeClaude);

    // 🆕 LAYER 1.5: Validate Implementation Strategy (BLUEPRINT.md §4)
    logger.info('Validating Implementation Strategy from BLUEPRINT.md §4...');
    const { validateImplementationStrategy } = require('./validate-implementation-strategy');
    try {
        const strategyValidation = await validateImplementationStrategy(task, {
            claudiomiroFolder: state.claudiomiroFolder,
        });

        if (!strategyValidation.valid) {
            logger.error(`❌ Implementation Strategy validation failed: ${strategyValidation.missing.length} issues`);
            strategyValidation.missing.forEach((issue, idx) => {
                logger.error(`   ${idx + 1}. Phase ${issue.phaseId}: ${issue.reason}`);
                if (issue.item) {
                    logger.error(`      Item: "${issue.item}"`);
                }
                if (issue.expectedSteps !== undefined) {
                    logger.error(`      Expected ${issue.expectedSteps} steps, found ${issue.actualItems || 0} items`);
                }
            });

            // Force re-execution
            latestExecution.status = 'in_progress';
            latestExecution.completion.status = 'pending_validation';
            saveExecution(executionPath, latestExecution);

            throw new Error(`Implementation Strategy validation failed: ${strategyValidation.missing.length} steps missing or incomplete`);
        }

        logger.info(`✅ Implementation Strategy validated: ${strategyValidation.expectedPhases} phases, all steps tracked`);
    } catch (error) {
        // If validateImplementationStrategy itself throws (e.g., parsing error), check if it's validation failure
        if (error.message.includes('Implementation Strategy validation failed')) {
            throw error; // Re-throw validation failures
        }
        logger.warning(`Implementation Strategy validation skipped: ${error.message}`);
    }

    // 🆕 LAYER 2: Run automated success criteria validation
    logger.info('Running success criteria validation from BLUEPRINT.md §3.2...');
    const { validateSuccessCriteria } = require('./validate-success-criteria');
    try {
        const criteriaResults = await validateSuccessCriteria(task, {
            cwd,
            claudiomiroFolder: state.claudiomiroFolder,
        });

        // Add success criteria results to execution.json
        latestExecution.successCriteria = criteriaResults;

        const failedCriteria = criteriaResults.filter(c => !c.passed);
        if (failedCriteria.length > 0) {
            logger.error(`❌ ${failedCriteria.length} success criteria failed!`);
            failedCriteria.forEach(c => {
                logger.error(`   - ${c.criterion}`);
                logger.error(`     Command: ${c.command}`);
                logger.error(`     Evidence: ${c.evidence.substring(0, 100)}`);
            });

            // Force re-execution
            latestExecution.status = 'in_progress';
            latestExecution.completion.status = 'pending_validation';
            saveExecution(executionPath, latestExecution);

            throw new Error(`Success criteria validation failed: ${failedCriteria.map(c => c.criterion).join(', ')}`);
        }

        logger.info(`✅ All ${criteriaResults.length} success criteria passed`);
    } catch (error) {
        // If validateSuccessCriteria itself throws (e.g., parsing error), log and continue
        if (error.message.includes('Success criteria validation failed')) {
            throw error; // Re-throw if it's the validation failure
        }
        logger.warning(`Success criteria validation skipped: ${error.message}`);
    }

    // 🆕 LAYER 4: Verify git changes match declared artifacts
    logger.info('Verifying git changes match declared artifacts...');
    const { verifyChanges } = require('./verify-changes');
    try {
        const diffCheck = await verifyChanges(latestExecution, cwd);

        if (!diffCheck.valid) {
            logger.warning('⚠️  Git diff discrepancies detected');

            // Record deviations in completion
            latestExecution.completion.deviations = latestExecution.completion.deviations || [];

            if (diffCheck.undeclared.length > 0) {
                const deviation = `Undeclared changes in git: ${diffCheck.undeclared.join(', ')}`;
                latestExecution.completion.deviations.push(deviation);
                logger.warning(`   ${deviation}`);
            }

            if (diffCheck.missing.length > 0) {
                const deviation = `Declared in artifacts but not modified: ${diffCheck.missing.join(', ')}`;
                latestExecution.completion.deviations.push(deviation);
                logger.warning(`   ${deviation}`);
            }
        } else {
            logger.info('✅ Git changes match declared artifacts');
        }
    } catch (error) {
        logger.warning(`Git verification skipped: ${error.message}`);
    }

    // 🆕 LAYER 5: Validate Review Checklist
    logger.info('Validating review-checklist.json...');
    const { validateReviewChecklist } = require('./validate-review-checklist');
    try {
        const checklistValidation = await validateReviewChecklist(task, {
            claudiomiroFolder: state.claudiomiroFolder,
        });

        if (!checklistValidation.valid) {
            logger.error(`❌ Review checklist validation failed: ${checklistValidation.missing.length} artifacts missing`);
            checklistValidation.missing.forEach((issue, idx) => {
                logger.error(`   ${idx + 1}. ${issue.artifact}: ${issue.reason}`);
            });

            // Force re-execution
            latestExecution.status = 'in_progress';
            latestExecution.completion.status = 'pending_validation';
            saveExecution(executionPath, latestExecution);

            throw new Error(`Review checklist validation failed: ${checklistValidation.missing.length} artifacts missing checklist entries`);
        }

        logger.info(`✅ Review checklist validated: ${checklistValidation.totalChecklistItems} items for ${checklistValidation.totalArtifacts} artifacts`);
    } catch (error) {
        // If validateReviewChecklist itself throws, check if it's validation failure
        if (error.message.includes('Review checklist validation failed')) {
            throw error; // Re-throw validation failures
        }
        logger.warning(`Review checklist validation skipped: ${error.message}`);
    }

    // Validate completion (with enhanced checks for phase items, success criteria)
    if (validateCompletion(latestExecution)) {
        latestExecution.completion.status = 'completed';
        latestExecution.status = 'completed';
        logger.info('✅ Task completed successfully');
    } else {
        logger.warning('⚠️  Completion validation failed - task remains in_progress');
    }

    logger.info(`Saved execution.json: status=${latestExecution.status}`);
    saveExecution(executionPath, latestExecution);

    return result;
};

const step5 = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    const taskFolder = path.join(state.claudiomiroFolder, task);
    const logger = require('../../../../shared/utils/logger');

    // Require BLUEPRINT.md to exist
    const blueprintPath = folder('BLUEPRINT.md');
    if (!fs.existsSync(blueprintPath)) {
        throw new Error(`BLUEPRINT.md not found for task ${task}. Step 3 must generate BLUEPRINT.md before execution.`);
    }

    // Read and parse scope from BLUEPRINT.md for multi-repo support
    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
    const scope = parseTaskScope(blueprintContent);

    // Validate scope in multi-repo mode (throws if missing)
    validateScope(scope, state.isMultiRepo());

    // Determine working directory based on scope
    const cwd = state.isMultiRepo()
        ? state.getRepository(scope)
        : state.folder;

    try {
        const result = await executeNewFlow(task, taskFolder, cwd);

        // Generate review checklist for step6
        try {
            const { generateReviewChecklist } = require('./generate-review-checklist');
            const checklistResult = await generateReviewChecklist(task, { cwd });
            if (checklistResult.success && checklistResult.checklistPath) {
                logger.info(`[Step5] Generated review-checklist.json with ${checklistResult.itemCount} items`);
            }
        } catch (checklistError) {
            const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
            const stateManager = ParallelStateManager.getInstance();
            if (!stateManager || !stateManager.isUIRendererActive()) {
                logger.warning(`[Step5] Review checklist generation skipped: ${checklistError.message}`);
            }
        }

        // Reflection hook
        try {
            const executionPath = folder('execution.json');
            const execution = fs.existsSync(executionPath)
                ? JSON.parse(fs.readFileSync(executionPath, 'utf8'))
                : null;

            const metrics = {
                attempts: execution?.attempts || 1,
                hasErrors: Boolean(execution?.uncertainties?.length > 0),
                codeChangeSize: estimateCodeChangeSize(blueprintPath),
                taskComplexity: 'medium',
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
    isDangerousCommand,
    estimateCodeChangeSize,
    VALID_STATUSES,
};
