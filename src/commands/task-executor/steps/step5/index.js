/**
 * Step 5: Task Execution
 *
 * Simplified 2-File Flow (BLUEPRINT.md + execution.json):
 * 1. Load BLUEPRINT.md and execution.json
 * 2. Verify pre-conditions
 * 3. Execute task via Claude
 * 4. Run validation layers
 * 5. Save progress (NOT reset on error)
 *
 * KEY FIX: On validation errors, we DON'T reset execution.json.
 * We record what failed so the AI can fix that specific part.
 */

const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { markTaskCompleted } = require('../../../../shared/services/context-cache');
const { parseTaskScope, validateScope } = require('../../utils/scope-parser');
const reflectionHook = require('./reflection-hook');
const { determineStep5Model } = require('../../utils/model-config');

// Utils
const {
    loadExecution,
    saveExecution,
    recordError,
} = require('./utils/execution-io');
const { enforcePhaseGate } = require('./utils/phase-gate');
const { estimateCodeChangeSize, VALID_STATUSES } = require('./utils/execution-helpers');

// Validators
const {
    verifyPreConditions,
    validateImplementationStrategy,
    validateSuccessCriteria,
    verifyChanges,
    validateReviewChecklist,
    validateCompletion,
} = require('./validators');

// Prompt Selector
const { selectPrompt } = require('./prompts/prompt-selector');

/**
 * Run all validation layers on execution.json
 * Returns { valid: boolean, failedValidation: string|null }
 */
const runValidationLayers = async (task, execution, cwd, _executionPath) => {
    const logger = require('../../../../shared/utils/logger');

    // Layer 1: Implementation Strategy (BLUEPRINT.md §4)
    logger.info('Validating Implementation Strategy...');
    try {
        const strategyResult = await validateImplementationStrategy(task, {
            claudiomiroFolder: state.claudiomiroFolder,
        });

        if (!strategyResult.valid) {
            return {
                valid: false,
                failedValidation: 'implementation-strategy',
                message: `${strategyResult.missing.length} phases/steps missing`,
                details: strategyResult.missing,
            };
        }
        logger.info(`✅ Implementation Strategy: ${strategyResult.expectedPhases} phases validated`);
    } catch (error) {
        if (!error.message.includes('not found')) {
            logger.warning(`Implementation Strategy validation error: ${error.message}`);
        }
    }

    // Layer 2: Success Criteria (BLUEPRINT.md §3.2)
    logger.info('Validating Success Criteria...');
    try {
        const criteriaResults = await validateSuccessCriteria(task, {
            cwd,
            claudiomiroFolder: state.claudiomiroFolder,
        });

        // Add to execution.json
        execution.successCriteria = criteriaResults;

        const failed = criteriaResults.filter(c => c.passed === false);
        if (failed.length > 0) {
            return {
                valid: false,
                failedValidation: 'success-criteria',
                message: `${failed.length} criteria failed`,
                details: failed.map(c => c.criterion),
            };
        }
        logger.info(`✅ Success Criteria: ${criteriaResults.length} passed`);
    } catch (error) {
        if (!error.message.includes('not found')) {
            logger.warning(`Success Criteria validation error: ${error.message}`);
        }
    }

    // Layer 3: Git Changes (warning only, not blocking)
    logger.info('Verifying git changes...');
    try {
        const diffCheck = await verifyChanges(execution, cwd);

        if (!diffCheck.valid) {
            execution.completion = execution.completion || {};
            execution.completion.deviations = [];

            if (diffCheck.undeclared.length > 0) {
                execution.completion.deviations.push(`Undeclared: ${diffCheck.undeclared.join(', ')}`);
            }
            if (diffCheck.missing.length > 0) {
                execution.completion.deviations.push(`Missing: ${diffCheck.missing.join(', ')}`);
            }
        }
    } catch (error) {
        logger.warning(`Git verification skipped: ${error.message}`);
    }

    // Layer 4: Review Checklist
    logger.info('Validating Review Checklist...');
    try {
        const checklistResult = await validateReviewChecklist(task, {
            claudiomiroFolder: state.claudiomiroFolder,
        });

        if (!checklistResult.valid) {
            return {
                valid: false,
                failedValidation: 'review-checklist',
                message: `${checklistResult.missing.length} artifacts missing checklist`,
                details: checklistResult.missing.map(m => m.artifact),
            };
        }
        logger.info(`✅ Review Checklist: ${checklistResult.totalChecklistItems} items validated`);
    } catch (error) {
        if (!error.message.includes('not found')) {
            logger.warning(`Review Checklist validation error: ${error.message}`);
        }
    }

    // Layer 5: Completion validation
    if (validateCompletion(execution)) {
        execution.completion = execution.completion || {};
        execution.completion.status = 'completed';
        execution.status = 'completed';
        logger.info('✅ Task completed successfully');
    } else {
        logger.warning('⚠️ Completion validation pending');
    }

    return { valid: true, failedValidation: null };
};

/**
 * Execute the task using BLUEPRINT.md and execution.json
 */
const executeTask = async (task, taskFolder, cwd) => {
    const logger = require('../../../../shared/utils/logger');
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
    const executionPath = path.join(taskFolder, 'execution.json');

    logger.info('=== Step5: Task Execution ===');

    // 1. Load BLUEPRINT.md
    if (!fs.existsSync(blueprintPath)) {
        throw new Error('BLUEPRINT.md not found');
    }
    const blueprintContent = fs.readFileSync(blueprintPath, 'utf8');
    if (!blueprintContent.trim()) {
        throw new Error('BLUEPRINT.md is empty');
    }

    // 2. Load execution.json (with auto-repair)
    const execution = loadExecution(executionPath);
    const attemptsBefore = execution.attempts || 0;

    logger.info(`Loaded: status=${execution.status}, phase=${execution.currentPhase?.id || 1}, attempts=${attemptsBefore}`);

    // 3. Check what failed last time (if any) - this guides the AI
    const pendingFixes = execution.pendingFixes || [];
    const lastError = execution.completion?.lastError;
    if (pendingFixes.length > 0) {
        logger.info(`Pending fixes from last attempt: ${pendingFixes.join(', ')}`);
        if (lastError) {
            logger.info(`Last error: ${lastError}`);
        }
    }

    // 4. Verify pre-conditions (HARD STOP if blocked)
    const { blocked } = await verifyPreConditions(execution);
    if (blocked) {
        saveExecution(executionPath, execution);
        throw new Error('Pre-conditions failed. Task blocked.');
    }

    // 5. Increment attempts (only after pre-conditions pass)
    execution.attempts = attemptsBefore + 1;

    // 6. Enforce phase gate (may reset currentPhase)
    const phaseGatePassed = enforcePhaseGate(execution);
    if (!phaseGatePassed) {
        logger.info('Phase gate reset currentPhase');
    }

    // 7. Update status and save before Claude execution
    execution.status = 'in_progress';
    saveExecution(executionPath, execution);

    // 8. Build prompt for Claude using prompt selector
    const { state: executionState, prompt: selectedPrompt } = selectPrompt(execution, {
        taskFolder,
        claudiomiroFolder: state.claudiomiroFolder,
    });

    logger.info(`Execution state: ${executionState}`);

    const shellCommandRule = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'),
        'utf-8',
    );

    const prompt = `${selectedPrompt}\n\n---\n\n## BLUEPRINT.md\n\n${blueprintContent}\n\n---\n\n${shellCommandRule}`;

    // 9. Determine model based on task complexity (dynamic)
    const model = determineStep5Model(execution, blueprintContent);
    logger.info(`Model selected: ${model}`);

    // 10. Execute Claude with dynamic model
    const result = await executeClaude(prompt, task, { cwd, model });
    markTaskCompleted(state.claudiomiroFolder, task);

    // 10. Reload execution.json (Claude may have updated it)
    const latestExecution = loadExecution(executionPath);

    // Preserve attempt count
    const currentAttempt = attemptsBefore + 1;
    latestExecution.attempts = Math.max(latestExecution.attempts || 0, currentAttempt);

    // Clear pending fixes (we're about to validate again)
    latestExecution.pendingFixes = [];

    // 11. Run all validation layers
    const validation = await runValidationLayers(task, latestExecution, cwd, executionPath);

    if (!validation.valid) {
        // DON'T RESET - just record what failed
        latestExecution.status = 'in_progress';
        latestExecution.completion = latestExecution.completion || {};
        latestExecution.completion.status = 'pending_validation';
        latestExecution.completion.failedValidation = validation.failedValidation;
        latestExecution.completion.lastError = validation.message;

        // Track what needs fixing for next attempt
        if (!latestExecution.pendingFixes) {
            latestExecution.pendingFixes = [];
        }
        if (!latestExecution.pendingFixes.includes(validation.failedValidation)) {
            latestExecution.pendingFixes.push(validation.failedValidation);
        }

        saveExecution(executionPath, latestExecution);

        logger.error(`❌ Validation failed: ${validation.failedValidation} - ${validation.message}`);
        throw new Error(`Validation failed: ${validation.failedValidation}`);
    }

    // 12. Save final state
    saveExecution(executionPath, latestExecution);
    logger.info(`Saved: status=${latestExecution.status}`);

    return result;
};

/**
 * Main step5 function
 */
const step5 = async (task) => {
    const logger = require('../../../../shared/utils/logger');
    const taskFolder = path.join(state.claudiomiroFolder, task);
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
    const executionPath = path.join(taskFolder, 'execution.json');

    // Verify BLUEPRINT.md exists
    if (!fs.existsSync(blueprintPath)) {
        throw new Error(`BLUEPRINT.md not found for task ${task}`);
    }

    // Parse scope for multi-repo support
    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
    const scope = parseTaskScope(blueprintContent);
    validateScope(scope, state.isMultiRepo());

    const cwd = state.isMultiRepo()
        ? state.getRepository(scope)
        : state.folder;

    try {
        const result = await executeTask(task, taskFolder, cwd);

        // Note: Review checklist is now generated in real-time during task execution
        // via the Step 2.5 protocol in the execution prompt (review-checklist-schema-v2)

        // Reflection hook
        try {
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
        } catch (error) {
            const ParallelStateManager = require('../../../../shared/executors/parallel-state-manager');
            const stateManager = ParallelStateManager.getInstance();
            if (!stateManager?.isUIRendererActive()) {
                logger.warning(`Reflection skipped: ${error.message}`);
            }
        }

        return result;

    } catch (error) {
        // KEY FIX: Don't reset execution.json on error!
        // Just record what failed so we can fix it on retry
        if (fs.existsSync(executionPath)) {
            try {
                recordError(executionPath, error, {
                    failedValidation: error.message.includes('Validation failed')
                        ? error.message.replace('Validation failed: ', '')
                        : 'unknown',
                });
            } catch (saveErr) {
                logger.warning(`Could not record error: ${saveErr.message}`);
            }
        }

        throw error;
    }
};

// Exports
module.exports = {
    step5,
    executeTask,
    runValidationLayers,
    VALID_STATUSES,
};
