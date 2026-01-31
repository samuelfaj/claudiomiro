const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');
const { step4, step5, step6, step7 } = require('../steps');
const { isCompletedFromExecution, isEffectivelyBlocked, hasApprovedCodeReview, canProceedWithBlockedCriteria } = require('../utils/validation');
const { safeJsonParse } = require('../utils/schema-validator');
const ParallelStateManager = require('../../../shared/executors/parallel-state-manager');
const ParallelUIRenderer = require('./parallel-ui-renderer');
const TerminalRenderer = require('../utils/terminal-renderer');
const { calculateProgress } = require('../utils/progress-calculator');
const { resolveDeadlock } = require('./deadlock-resolver');
const { detectFileConflicts, autoResolveConflicts } = require('./file-conflict-detector');
const { AUTO_ADJUST_THRESHOLD, prepareExecutionForAutoAdjust, getStrategyGuidance } = require('../utils/adaptive-retry');
const { generateLimitations, shouldGenerateLimitations } = require('../steps/step5/utils/limitations-generator');

// New resilient execution services
const { checkProgress, determineAction, createSnapshot, GuardianAction } = require('./progress-guardian');
const { getCurrentStrategy, shouldSwitchStrategy, applyStrategySwitch, getStrategyInstructions, StrategyType } = require('./strategy-manager');
const { shouldSplitTask, splitTaskMidExecution } = require('./task-splitter');

const CORE_COUNT = Math.max(1, os.cpus().length);

/**
 * Get default concurrency from environment variable or calculated default
 * Default: CPU cores * 2
 * @returns {number} Default concurrency limit
 */
const getDefaultConcurrency = () => {
    const envConcurrency = process.env.CLAUDIOMIRO_CONCURRENCY;
    if (envConcurrency) {
        const parsed = parseInt(envConcurrency, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    // Default: CPU cores * 2
    return CORE_COUNT * 2;
};

const DEFAULT_CONCURRENCY = getDefaultConcurrency();

class DAGExecutor {
    constructor(tasks, allowedSteps = null, maxConcurrent = null, noLimit = false, maxAttemptsPerTask = 20) {
        this.tasks = tasks; // { TASK1: {deps: [], status: 'pending', files: []}, ... }
        this.allowedSteps = allowedSteps; // null = todos os steps, ou array de números
        this.noLimit = noLimit; // Se true, remove limite de ciclos por tarefa
        this.maxAttemptsPerTask = maxAttemptsPerTask; // Limite customizável de ciclos por tarefa (padrão: 20)
        this.maxConcurrent = maxConcurrent || DEFAULT_CONCURRENCY;
        this._fileConflictsResolved = false; // Track if file conflicts have been resolved
        this.running = new Set(); // Tasks atualmente em execução

        // Scope-aware concurrency tracking
        this.runningByScope = { backend: 0, frontend: 0, integration: 0 };

        // Deadlock detection state
        this._deadlockCounter = 0;
        this._deadlockResolutionAttempts = 0;
        this._lastPendingTasksLog = 0; // Throttle for pending tasks log

        // Initialize task scopes from TASK.md files
        this._initializeTasks(tasks);

        // Initialize ParallelStateManager
        this.stateManager = new ParallelStateManager();
        this.stateManager.initialize(tasks);
    }

    /**
     * Initialize tasks with scope information
     * @param {Object} tasks - Task object { TASKN: { deps: [], status: 'pending' } }
     */
    _initializeTasks(tasks) {
        for (const taskName of Object.keys(tasks)) {
            tasks[taskName].scope = 'integration';
        }
    }

    /**
     * Returns total number of running tasks across all scopes
     * @returns {number} Total running tasks
     */
    totalRunning() {
        return Object.values(this.runningByScope).reduce((a, b) => a + b, 0);
    }

    /**
     * Check if a task can execute based on scope-aware concurrency
     * @param {string} taskName - Name of the task
     * @returns {boolean} True if task can execute
     */
    canExecute(taskName) {
        const task = this.tasks[taskName];
        if (!task) return false;

        // Check dependencies are complete
        const depsComplete = task.deps.every(dep =>
            this.tasks[dep] && this.tasks[dep].status === 'completed',
        );
        if (!depsComplete) return false;

        // CRITICAL: Always enforce global maxConcurrent limit first
        // This prevents the bug where multi-repo mode could run
        // maxConcurrent * 3 tasks (backend + frontend + integration)
        if (this.totalRunning() >= this.maxConcurrent) {
            return false;
        }

        const scope = task.scope || 'integration';

        // Single-repo mode: global limit already checked above
        if (!state.isMultiRepo()) {
            return true;
        }

        // Multi-repo mode: also check per-scope limits
        // This allows better distribution across scopes while respecting global limit
        if (scope === 'integration') {
            // Integration tasks don't have additional per-scope limits
            return true;
        }

        // Backend/frontend tasks respect both global AND per-scope limits
        // Per-scope limit prevents one scope from monopolizing all slots
        const perScopeLimit = Math.max(1, Math.floor(this.maxConcurrent / 2));
        return this.runningByScope[scope] < perScopeLimit;
    }

    /**
     * Mark a task as running and update scope counter
     * @param {string} taskName - Name of the task
     */
    markRunning(taskName) {
        const task = this.tasks[taskName];
        if (!task) return;

        task.status = 'running';
        this.running.add(taskName);

        const scope = task.scope || 'integration';
        if (this.runningByScope[scope] !== undefined) {
            this.runningByScope[scope]++;
        }
    }

    /**
     * Mark a task as completed and update scope counter
     * @param {string} taskName - Name of the task
     * @param {string} status - Final status ('completed' or 'failed')
     */
    markComplete(taskName, status = 'completed') {
        const task = this.tasks[taskName];
        if (!task) return;

        task.status = status;
        this.running.delete(taskName);

        const scope = task.scope || 'integration';
        if (this.runningByScope[scope] !== undefined && this.runningByScope[scope] > 0) {
            this.runningByScope[scope]--;
        }
    }

    /**
     * Returns the state manager instance
     */
    getStateManager() {
        return this.stateManager;
    }

    /**
     * Detects and auto-resolves file conflicts between tasks.
     * If two tasks can run in parallel but modify the same file,
     * automatically adds a dependency to serialize them.
     * @returns {Object[]} Array of resolutions applied
     */
    _resolveFileConflicts() {
        if (this._fileConflictsResolved) {
            return []; // Already resolved
        }

        const conflicts = detectFileConflicts(this.tasks);

        if (conflicts.length === 0) {
            this._fileConflictsResolved = true;
            return [];
        }

        logger.warning('');
        logger.warning('⚠️  FILE CONFLICTS DETECTED - Auto-resolving:');

        const resolutions = autoResolveConflicts(this.tasks, conflicts);

        for (const resolution of resolutions) {
            logger.warning(`   ${resolution.task1} ↔ ${resolution.task2}: ${resolution.files.join(', ')}`);
            logger.warning(`   → ${resolution.resolution}`);
        }

        logger.warning('');
        logger.warning('✅ Conflicts resolved. Tasks will run sequentially to prevent overwrites.');
        logger.warning('');

        this._fileConflictsResolved = true;
        return resolutions;
    }

    /**
   * Verifica se um step deve ser executado
   */
    shouldRunStep(stepNumber) {
        if (!this.allowedSteps) return true;
        return this.allowedSteps.includes(stepNumber);
    }

    /**
   * Retorna tasks que podem rodar agora:
   * - status === 'pending'
   * - todas as dependências foram completadas
   */
    getReadyTasks() {
        return Object.entries(this.tasks)
            .filter(([_name, task]) =>
                task.status === 'pending' &&
                task.deps.every(dep => this.tasks[dep] && this.tasks[dep].status === 'completed'),
            )
            .map(([name]) => name);
    }

    /**
   * Updates tasks from a new graph while preserving running/completed status.
   * Handles adding new tasks, updating dependencies, and removing obsolete tasks.
   * @param {Object} newGraph - The new task graph from buildTaskGraph()
   * @returns {boolean} - True if any changes were made
   */
    _updateTasksFromGraph(newGraph) {
        if (!newGraph) return false;

        let hasChanges = false;

        // Update tasks with new graph while preserving running/completed status
        for (const [_taskName, taskData] of Object.entries(newGraph)) {
            if (!this.tasks[_taskName]) {
                // New task (e.g., from split) - add it
                this.tasks[_taskName] = taskData;
                this.tasks[_taskName].scope = 'integration';

                this.stateManager.taskStates.set(_taskName, {
                    status: taskData.status,
                    step: null,
                    message: null,
                });
                if (!this.stateManager.isUIRendererActive()) {
                    logger.info(`📥 Added new task: ${_taskName} (deps: ${taskData.deps.join(', ') || 'none'}, scope: ${this.tasks[_taskName].scope})`);
                }
                hasChanges = true;
            } else {
                // Existing task - update deps but preserve status if running/completed
                const oldDeps = this.tasks[_taskName].deps.join(',');
                const newDeps = taskData.deps.join(',');
                if (oldDeps !== newDeps) {
                    if (!this.stateManager.isUIRendererActive()) {
                        logger.info(`🔄 Updated deps for ${_taskName}: [${oldDeps}] → [${newDeps}]`);
                    }
                    hasChanges = true;
                }
                this.tasks[_taskName].deps = taskData.deps;
                // Update status from graph if task is still pending (e.g., completed in background)
                if (this.tasks[_taskName].status === 'pending' && taskData.status === 'completed') {
                    this.tasks[_taskName].status = 'completed';
                    this.stateManager.updateTaskStatus(_taskName, 'completed');
                    if (!this.stateManager.isUIRendererActive()) {
                        logger.info(`✅ ${_taskName} marked as completed from graph`);
                    }
                    hasChanges = true;
                }
            }
        }

        // Remove tasks that no longer exist in the graph (e.g., parent task that was split)
        for (const _taskName of Object.keys(this.tasks)) {
            if (!newGraph[_taskName] && this.tasks[_taskName].status === 'pending') {
                if (!this.stateManager.isUIRendererActive()) {
                    logger.info(`🗑️ Removed task no longer in graph: ${_taskName}`);
                }
                delete this.tasks[_taskName];
                this.stateManager.taskStates.delete(_taskName);
                hasChanges = true;
            }
        }

        return hasChanges;
    }

    /**
   * Executa uma "onda" de tasks em paralelo
   * @returns {boolean} true se executou pelo menos uma task
   */
    async executeWave() {
        const ready = this.getReadyTasks();

        // Filter by canExecute (scope-aware concurrency)
        const toExecute = ready.filter(taskName => this.canExecute(taskName));

        if (toExecute.length === 0) {
            return false;
        }

        // Mark as running using scope-aware method, respecting capacity limit
        const tasksToRun = [];
        for (const task of toExecute) {
            // Re-check capacity before each task (markRunning increases the count)
            if (this.totalRunning() >= this.maxConcurrent) {
                break;
            }
            this.markRunning(task);
            tasksToRun.push(task);
        }

        if (tasksToRun.length === 0) {
            return false;
        }

        // Execute in parallel with Promise.allSettled
        const promises = tasksToRun.map(task => this.executeTask(task));

        // Wait for all to complete
        await Promise.allSettled(promises);

        return true;
    }

    /**
   * Executa o ciclo completo de uma task: step4 → step5 → step6 → step7
   * (step0-3 já foram executados: questões, AI_PROMPT, decomposição, dependências)
   */
    async executeTask(taskName) {
        try {
            // Update status to running
            this.stateManager.updateTaskStatus(taskName, 'running');

            const taskPath = path.join(state.claudiomiroFolder, taskName);
            const codeReviewPath = path.join(taskPath, 'CODE_REVIEW.md');
            const executionPath = path.join(taskPath, 'execution.json');

            const isTaskApproved = () => {
                if (!fs.existsSync(executionPath)) {
                    return false;
                }

                const completionResult = isCompletedFromExecution(executionPath);
                return completionResult.completed && hasApprovedCodeReview(codeReviewPath);
            };

            // Verifica se já está completa
            if (await isTaskApproved()) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.markComplete(taskName, 'completed');
                return;
            }

            // BLUEPRINT.md was created by steps 0-3, step 4 generates execution.json

            // Step 4: Planning (BLUEPRINT.md → execution.json)
            if (!fs.existsSync(executionPath)) {
                if (!this.shouldRunStep(4)) {
                    this.stateManager.updateTaskStatus(taskName, 'completed');
                    this.markComplete(taskName, 'completed');
                    return;
                }
                this.stateManager.updateTaskStep(taskName, 'Step 4 - Research and planning');
                await step4(taskName);

                // Check if task was split (original folder no longer exists)
                if (!fs.existsSync(taskPath)) {
                    this.stateManager.updateTaskStatus(taskName, 'completed');
                    this.markComplete(taskName, 'completed');
                    logger.info(`✅ ${taskName} was split into subtasks`);
                    return;
                }
            }

            // If step 4 ran and we shouldn't run step 5, stop here
            if (!this.shouldRunStep(5)) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.markComplete(taskName, 'completed');
                return;
            }

            // Loop until implementation complete
            let maxAttempts = this.noLimit ? Infinity : this.maxAttemptsPerTask; // Safety limit (customizable via --limit, infinite with --no-limit)
            let attempts = 0;
            let lastStep5Error = null;

            // Resilient execution state tracking
            let stuckCount = 0;
            let lastExecutionSnapshot = null;
            let samePhaseAttempts = 0;
            let lastPhaseId = null;

            while (attempts < maxAttempts) {
                attempts++;

                // Load current execution state for progress tracking
                let currentExecution = null;
                if (fs.existsSync(executionPath)) {
                    try {
                        // Use safeJsonParse to handle control characters in AI-generated JSON
                        currentExecution = safeJsonParse(fs.readFileSync(executionPath, 'utf-8'));
                    } catch (parseError) {
                        logger.warning(`${taskName}: Could not parse execution.json: ${parseError.message}`);
                    }
                }

                // Check progress using Progress Guardian (after first attempt)
                if (lastExecutionSnapshot && currentExecution) {
                    const progressCheck = checkProgress(lastExecutionSnapshot, currentExecution);

                    if (!progressCheck.madeProgress) {
                        stuckCount++;
                        logger.warning(`${taskName}: No progress detected (stuck count: ${stuckCount})`);

                        // Track same phase attempts
                        const currentPhase = currentExecution.phases?.find(p => p.status === 'in_progress');
                        if (currentPhase && currentPhase.id === lastPhaseId) {
                            samePhaseAttempts++;
                        } else {
                            samePhaseAttempts = 1;
                            lastPhaseId = currentPhase?.id;
                        }

                        // Determine action based on stuck count
                        const action = determineAction(currentExecution, stuckCount);

                        switch (action.type) {
                            case GuardianAction.SWITCH_STRATEGY: {
                            // Check if we should switch strategy
                                const switchCheck = shouldSwitchStrategy(currentExecution);
                                if (switchCheck.shouldSwitch && switchCheck.toStrategy) {
                                    logger.info(`${taskName}: Switching strategy from ${getCurrentStrategy(currentExecution)} to ${switchCheck.toStrategy}`);
                                    const updatedExecution = applyStrategySwitch(currentExecution, switchCheck.toStrategy);

                                    // Add strategy instructions to execution
                                    updatedExecution.strategyInstructions = getStrategyInstructions(switchCheck.toStrategy);

                                    fs.writeFileSync(executionPath, JSON.stringify(updatedExecution, null, 2), 'utf-8');
                                    stuckCount = 0; // Reset stuck count after strategy switch
                                    logger.info(`${taskName}: Strategy switched successfully. Instructions: ${updatedExecution.strategyInstructions.substring(0, 100)}...`);
                                }
                                break;
                            }
                            case GuardianAction.SPLIT_TASK: {
                            // Check if task should be split
                                const splitCheck = shouldSplitTask(currentExecution, { samePhaseAttempts });
                                if (splitCheck.shouldSplit && splitCheck.splitPlan) {
                                    logger.info(`${taskName}: Splitting task - ${splitCheck.reason}`);
                                    const splitResult = splitTaskMidExecution(
                                        taskName,
                                        currentExecution,
                                        splitCheck.splitPlan,
                                        { claudiomiroFolder: state.claudiomiroFolder },
                                    );

                                    if (splitResult.success) {
                                        logger.success(`${taskName}: Task split into subtasks: ${splitResult.subtasks.join(', ')}`);
                                        // Mark parent task as completed (split)
                                        this.stateManager.updateTaskStatus(taskName, 'completed');
                                        this.markComplete(taskName, 'completed');
                                        return; // Subtasks will be picked up by DAG
                                    } else {
                                        logger.warning(`${taskName}: Task split failed: ${splitResult.error}`);
                                    }
                                }
                                break;
                            }
                            case GuardianAction.PARTIAL_COMPLETE: {
                            // Mark completed phases and document incomplete ones
                                logger.info(`${taskName}: Attempting partial completion`);
                                if (currentExecution) {
                                    currentExecution.partialCompletion = {
                                        enabledAt: new Date().toISOString(),
                                        completedPhases: currentExecution.phases?.filter(p => p.status === 'completed').length || 0,
                                        totalPhases: currentExecution.phases?.length || 0,
                                    };
                                    fs.writeFileSync(executionPath, JSON.stringify(currentExecution, null, 2), 'utf-8');
                                }
                                break;
                            }
                            case GuardianAction.NOTIFY_USER:
                                logger.error(`${taskName}: STUCK - Task has not made progress in ${stuckCount} attempts`);
                                logger.error(`${taskName}: Manual intervention may be required`);
                                // Don't throw yet, let it continue to maxAttempts
                                break;
                            default:
                            // CONTINUE - do nothing special
                                break;
                        }
                    } else {
                        // Progress was made! Reset stuck counter
                        stuckCount = 0;
                        if (progressCheck.progressTypes.length > 0) {
                            logger.info(`${taskName}: Progress detected - ${progressCheck.progressTypes.join(', ')}`);
                        }
                    }
                }

                // Create snapshot for next iteration comparison
                if (currentExecution) {
                    lastExecutionSnapshot = createSnapshot(currentExecution);
                }

                // Check if task is effectively blocked (after 3 attempts to give Claude a chance)
                if (attempts >= 3) {
                    const blockedCheck = isEffectivelyBlocked(executionPath);
                    if (blockedCheck.blocked) {
                        // Check if we can proceed despite blocked status (criteria with workarounds)
                        const canProceed = canProceedWithBlockedCriteria(executionPath);

                        if (canProceed.canProceed) {
                            // Task has blocked criteria but they are properly documented
                            logger.info(`${taskName}: Task has ${canProceed.blockedCount} blocked criteria with workarounds, continuing...`);
                        } else if (blockedCheck.reason === 'status is blocked' && attempts <= AUTO_ADJUST_THRESHOLD) {
                            // Status is blocked but we haven't reached auto-adjust threshold yet
                            // Don't throw - give auto-adjust mode a chance to kick in
                            logger.warning(`${taskName}: Task blocked at attempt ${attempts}, will enable auto-adjust at attempt ${AUTO_ADJUST_THRESHOLD + 1}`);
                        } else {
                            // Truly blocked - no way to proceed
                            this.stateManager.updateTaskStatus(taskName, 'failed');
                            this.markComplete(taskName, 'failed');
                            throw new Error(`${taskName} is blocked and cannot proceed: ${blockedCheck.reason}`);
                        }
                    }
                }

                // Enable auto-adjust mode after threshold attempts
                // This allows criteria to be marked as "blocked" with documentation
                if (attempts > AUTO_ADJUST_THRESHOLD && fs.existsSync(executionPath)) {
                    try {
                        // Use safeJsonParse to handle control characters in AI-generated JSON
                        const execution = safeJsonParse(fs.readFileSync(executionPath, 'utf-8'));
                        if (!execution.autoAdjustMode) {
                            const updatedExecution = prepareExecutionForAutoAdjust(execution, attempts);
                            fs.writeFileSync(executionPath, JSON.stringify(updatedExecution, null, 2), 'utf-8');
                            logger.info(`${taskName}: Auto-adjust mode enabled after ${attempts} attempts (threshold: ${AUTO_ADJUST_THRESHOLD})`);

                            // Log strategy guidance for debugging
                            const guidance = getStrategyGuidance(attempts, lastStep5Error?.message);
                            logger.info(`${taskName}: Strategy phase: ${guidance.phase}`);
                        }
                    } catch (autoAdjustError) {
                        logger.warning(`${taskName}: Could not enable auto-adjust mode: ${autoAdjustError.message}`);
                    }
                }

                // Step 5: Implementation (with current strategy)
                const completionCheck = isCompletedFromExecution(executionPath);
                if (!fs.existsSync(executionPath) || !completionCheck.completed) {
                    try {
                        const strategy = currentExecution ? getCurrentStrategy(currentExecution) : StrategyType.ORIGINAL;
                        this.stateManager.updateTaskStep(taskName, `Step 5 - Implementing (attempt ${attempts}, strategy: ${strategy})`);
                        await step5(taskName);
                        lastStep5Error = null; // Clear any previous error on success
                    } catch (error) {
                        // If step5 fails, we should continue the loop to retry
                        lastStep5Error = error;
                        logger.warning(`${taskName} Step 5 failed (attempt ${attempts}): ${error.message}`);

                        // Record error in execution.json for strategy analysis
                        if (fs.existsSync(executionPath)) {
                            try {
                                // Use safeJsonParse to handle control characters in AI-generated JSON
                                const execution = safeJsonParse(fs.readFileSync(executionPath, 'utf-8'));
                                execution.errorHistory = execution.errorHistory || [];
                                execution.errorHistory.push({
                                    message: error.message,
                                    attempt: attempts,
                                    timestamp: new Date().toISOString(),
                                });
                                fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf-8');
                            } catch (_recordError) {
                                // Ignore error recording failures
                            }
                        }

                        // Add a small delay before retry to avoid rapid failures
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    continue; // Volta para verificar se está implementado
                }

                // Se step 5 foi executado e não devemos executar step 6, para aqui
                if (!this.shouldRunStep(6)) {
                    this.stateManager.updateTaskStatus(taskName, 'completed');
                    this.markComplete(taskName, 'completed');
                    return;
                }

                // Step 6: Code review final
                if (!hasApprovedCodeReview(codeReviewPath)) {
                    this.stateManager.updateTaskStep(taskName, 'Step 6 - Code review');

                    const shouldPush = !process.argv.some(arg => arg === '--push=false');

                    try {
                        await step6(taskName, shouldPush);
                    } catch (step6Error) {
                        // If step6 says task is not ready for review, it means phases are incomplete
                        // Reset completion status and go back to step5
                        if (step6Error.message.includes('Task not ready for review')) {
                            logger.warning(`${taskName} Step 6: Task not ready for review, returning to Step 5`);
                            logger.warning(`  Reason: ${step6Error.message}`);

                            // Reset the completion status in execution.json so step5 re-executes
                            try {
                                // Use safeJsonParse to handle control characters in AI-generated JSON
                                const execution = safeJsonParse(fs.readFileSync(executionPath, 'utf-8'));
                                execution.status = 'in_progress';
                                if (execution.completion) {
                                    execution.completion.status = 'pending_validation';
                                }
                                fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf-8');
                                logger.info(`${taskName}: Reset execution.json status to in_progress`);
                            } catch (resetError) {
                                logger.warning(`${taskName}: Could not reset execution.json: ${resetError.message}`);
                            }

                            // Small delay before retry
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue; // Go back to step5
                        }

                        // For other step6 errors, log and continue the loop
                        logger.warning(`${taskName} Step 6 failed (attempt ${attempts}): ${step6Error.message}`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }

                    // Se ainda não foi aprovado, continua o loop
                    if (!(await isTaskApproved())) {
                        continue;
                    }
                }

                // Step 7 agora é executado globalmente após todas as tasks
                // Se chegou aqui, task aprovada!
                break;
            }

            if (attempts >= maxAttempts) {
                this.stateManager.updateTaskStatus(taskName, 'failed');
                this.markComplete(taskName, 'failed');
                const errorMessage = lastStep5Error
                    ? `Maximum attempts (${maxAttempts}) reached for ${taskName}. Last error: ${lastStep5Error.message}`
                    : `Maximum attempts (${maxAttempts}) reached for ${taskName}`;
                throw new Error(errorMessage);
            }

            // Generate LIMITATIONS.md if there are blocked criteria
            try {
                if (fs.existsSync(executionPath)) {
                    // Use safeJsonParse to handle control characters in AI-generated JSON
                    const execution = safeJsonParse(fs.readFileSync(executionPath, 'utf-8'));
                    if (shouldGenerateLimitations(execution)) {
                        const result = generateLimitations(execution, taskPath);
                        if (result.generated) {
                            logger.warning(`${taskName}: Generated LIMITATIONS.md with ${result.blockedCount} blocked criteria`);
                        }
                    }
                }
            } catch (limitationsError) {
                logger.warning(`${taskName}: Could not generate LIMITATIONS.md: ${limitationsError.message}`);
            }

            this.stateManager.updateTaskStatus(taskName, 'completed');
            this.markComplete(taskName, 'completed');
            logger.success(`✅ ${taskName} completed successfully`);
        } catch (error) {
            this.stateManager.updateTaskStatus(taskName, 'failed');
            this.markComplete(taskName, 'failed');
            logger.error(`❌ ${taskName} failed: ${error.message}`);
            throw error; // Propaga o erro
        }
    }

    /**
   * Executa todas as tasks respeitando dependências
   */
    async run(buildTaskGraph) {
        const coreCount = CORE_COUNT;
        const envConcurrency = process.env.CLAUDIOMIRO_CONCURRENCY;
        const isFromEnv = !!envConcurrency;
        const isCustom = this.maxConcurrent !== DEFAULT_CONCURRENCY;

        let concurrencySource = '';
        if (isCustom && !isFromEnv) {
            concurrencySource = ' (custom)';
        } else if (isFromEnv) {
            concurrencySource = ' (from CLAUDIOMIRO_CONCURRENCY)';
        } else {
            concurrencySource = ` (${coreCount} cores × 2)`;
        }

        logger.info(`Starting DAG executor with max ${this.maxConcurrent} concurrent tasks${concurrencySource}`);

        // Detect and auto-resolve file conflicts before execution
        this._resolveFileConflicts();
        if (state.isMultiRepo()) {
            logger.info(`Multi-repo mode: ${state.getGitMode()}, backend and frontend tasks can run in parallel`);
        }
        logger.newline();

        // Initialize and start UI renderer
        const terminalRenderer = new TerminalRenderer();
        const uiRenderer = new ParallelUIRenderer(terminalRenderer);
        uiRenderer.start(this.getStateManager(), { calculateProgress });

        // Mantém controle das tasks em execução com promises individuais
        const runningPromises = new Map();

        while (true) {
            // Rebuild task graph to capture any changes in dependencies (if provided)
            if (buildTaskGraph && typeof buildTaskGraph === 'function') {
                const newGraph = buildTaskGraph();
                this._updateTasksFromGraph(newGraph);
            }

            // Debug: show pending tasks and their dependencies (throttled to once every 10 seconds)
            const now = Date.now();
            if (now - this._lastPendingTasksLog >= 10000) {
                const pendingTasksDebug = Object.entries(this.tasks)
                    .filter(([, t]) => t.status === 'pending')
                    .map(([name, t]) => {
                        const missingDeps = t.deps.filter(d => !this.tasks[d] || this.tasks[d].status !== 'completed');
                        return `${name}(waiting: ${missingDeps.join(',') || 'ready!'})`;
                    });
                if (pendingTasksDebug.length > 0 && this.running.size === 0 && !this.stateManager.isUIRendererActive()) {
                    logger.info(`⏳ Pending tasks: ${pendingTasksDebug.join(', ')}`);
                    this._lastPendingTasksLog = now;
                }
            }

            // Verifica se há slots disponíveis e tasks prontas (scope-aware)
            const ready = this.getReadyTasks();
            const toExecute = ready.filter(taskName => this.canExecute(taskName));

            // Inicia novas tasks se houver slots disponíveis
            if (toExecute.length > 0) {
                for (const taskName of toExecute) {
                    // Re-check capacity before each task (markRunning increases the count)
                    if (this.totalRunning() >= this.maxConcurrent) {
                        break;
                    }

                    this.markRunning(taskName);

                    // Cria a promise da task e armazena no mapa
                    const taskPromise = this.executeTask(taskName)
                        .finally(() => {
                            // Note: markComplete is called in executeTask
                            runningPromises.delete(taskName);
                        });

                    runningPromises.set(taskName, taskPromise);
                }
            }

            // Verifica se todas as tasks foram completadas
            const allTasksCompleted = Object.values(this.tasks).every(task =>
                task.status === 'completed' || task.status === 'failed',
            );

            if (allTasksCompleted && this.running.size === 0) {
                break; // Todas as tasks foram processadas
            }

            // Se ainda há tasks rodando, aguarda um pouco antes de verificar novamente
            if (this.running.size > 0) {
                this._deadlockCounter = 0; // Reset counter when tasks are running
                await new Promise(resolve => setTimeout(resolve, 500)); // Reduzido para resposta mais rápida
            } else if (ready.length === 0) {
                // Não há tasks prontas e nenhuma rodando - possivelmente dependências não satisfeitas
                this._deadlockCounter++;

                // After 5 seconds of no progress, attempt to resolve deadlock
                if (this._deadlockCounter >= 5) {
                    uiRenderer.stop();
                    logger.newline();
                    logger.warning('🔒 DEADLOCK DETECTED - No tasks can proceed');
                    logger.newline();

                    // Show detailed diagnostics
                    const pendingTasks = Object.entries(this.tasks)
                        .filter(([, t]) => t.status === 'pending');

                    for (const [taskName, task] of pendingTasks) {
                        const missingDeps = task.deps.filter(d => {
                            if (!this.tasks[d]) return true; // Dependency doesn't exist
                            return this.tasks[d].status !== 'completed';
                        });

                        if (missingDeps.length > 0) {
                            logger.warning(`  ⏳ ${taskName} waiting for:`);
                            for (const dep of missingDeps) {
                                if (!this.tasks[dep]) {
                                    logger.warning(`     - ${dep} (DOES NOT EXIST IN GRAPH!)`);
                                } else {
                                    logger.warning(`     - ${dep} (status: ${this.tasks[dep].status})`);
                                }
                            }
                        }
                    }

                    logger.newline();

                    // Attempt AI-powered resolution
                    this._deadlockResolutionAttempts++;

                    if (this._deadlockResolutionAttempts > 3) {
                        logger.error('❌ Maximum deadlock resolution attempts (3) reached');
                        logger.error('💡 Manual intervention required. Check the @dependencies in TASK.md files.');
                        throw new Error('Deadlock could not be resolved after 3 attempts');
                    }

                    logger.info(`🤖 Attempting AI-powered deadlock resolution (attempt ${this._deadlockResolutionAttempts}/3)...`);
                    logger.newline();

                    const resolved = await resolveDeadlock(this.tasks, pendingTasks);

                    if (resolved) {
                        logger.newline();
                        logger.success('✅ Deadlock resolution completed - rebuilding task graph...');
                        logger.newline();

                        // Reset deadlock counters after successful resolution
                        this._deadlockCounter = 0;
                        this._deadlockResolutionAttempts = 0;

                        // Rebuild task graph after resolution
                        if (buildTaskGraph && typeof buildTaskGraph === 'function') {
                            const newGraph = buildTaskGraph();
                            this._updateTasksFromGraph(newGraph);
                        }

                        // Restart UI renderer
                        uiRenderer.start(this.getStateManager(), { calculateProgress });

                        // Continue loop to check for ready tasks
                        continue;
                    } else {
                        logger.error('❌ AI could not resolve the deadlock');
                        logger.error('💡 Manual intervention required. Check the @dependencies in TASK.md files.');
                        throw new Error('Deadlock could not be resolved by AI');
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Garante que todas as promises pendentes foram resolvidas
        if (runningPromises.size > 0) {
            await Promise.allSettled(Array.from(runningPromises.values()));
        }

        // Stop UI renderer
        uiRenderer.stop();

        // Verifica se alguma task falhou
        const failed = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'failed')
            .map(([name]) => name);

        // Step 7: Critical Bug Sweep (global) - só roda se não houve falhas
        if (failed.length === 0 && this.shouldRunStep(7)) {
            logger.newline();
            logger.info('🔍 Running Step 7: Critical Bug Sweep (global)...');

            try {
                // Pass noLimit and maxAttemptsPerTask to step7
                const maxIterations = this.noLimit ? Infinity : this.maxAttemptsPerTask;
                await step7(maxIterations);
                logger.success('✅ Step 7 completed - No critical bugs found');
            } catch (error) {
                logger.newline();
                logger.error('❌ STEP 7 FAILED: Critical bugs remain after maximum iterations');
                logger.error('');

                const bugsPath = path.join(state.claudiomiroFolder, 'BUGS.md');
                if (fs.existsSync(bugsPath)) {
                    logger.error('📋 Check the following file for details:');
                    logger.error(`   ${bugsPath}`);
                    logger.error('');
                    logger.error('💡 Next steps:');
                    logger.error('   1. Review BUGS.md to see which critical bugs were found');
                    logger.error('   2. Fix the bugs manually');
                    logger.error('   3. Run Claudiomiro again to verify fixes');
                } else {
                    logger.error('⚠️  BUGS.md was not created by the analysis.');
                    logger.error('');
                    logger.error('💡 This could mean:');
                    logger.error('   1. Claude failed to execute properly during the bug sweep');
                    logger.error('   2. There was an issue with the analysis prompt or git diff');
                    logger.error('   3. The AI could not complete the analysis within the iteration limit');
                    logger.error('');
                    const logPath = path.join(state.claudiomiroRoot, 'log.txt');
                    if (fs.existsSync(logPath)) {
                        logger.error('📄 Check Claude execution log for details:');
                        logger.error(`   ${logPath}`);
                        logger.error('');
                    }
                    logger.error('💡 Next steps:');
                    logger.error('   1. Check the log.txt file above to see Claude output');
                    logger.error('   2. Check git diff manually: git diff main...HEAD');
                    logger.error('   3. Run Claudiomiro again with --debug flag for more details');
                }
                logger.newline();
                throw error; // Propaga erro para impedir step8 e parar o processo
            }
        }

        const pending = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'pending')
            .map(([name]) => name);

        logger.newline();
        if (failed.length > 0) {
            logger.error(`Failed tasks: ${failed.join(', ')}`);
        }

        if (pending.length > 0) {
            logger.info(`Tasks still pending (check dependencies): ${pending.join(', ')}`);
        }

        const completed = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'completed')
            .map(([name]) => name);

        logger.success(`Completed ${completed.length}/${Object.keys(this.tasks).length} tasks`);
    }

    /**
   * Executa apenas o step4 (planejamento/TODO) para todas as tasks em paralelo
   */
    async runStep2() {
        const coreCount = CORE_COUNT;
        const envConcurrency = process.env.CLAUDIOMIRO_CONCURRENCY;
        const isFromEnv = !!envConcurrency;
        const isCustom = this.maxConcurrent !== DEFAULT_CONCURRENCY;

        let concurrencySource = '';
        if (isCustom && !isFromEnv) {
            concurrencySource = ' (custom)';
        } else if (isFromEnv) {
            concurrencySource = ' (from CLAUDIOMIRO_CONCURRENCY)';
        } else {
            concurrencySource = ` (${coreCount} cores × 2)`;
        }

        logger.info(`Starting step 4 (planning) with max ${this.maxConcurrent} concurrent tasks${concurrencySource}`);
        logger.newline();

        // Initialize and start UI renderer
        const terminalRenderer = new TerminalRenderer();
        const uiRenderer = new ParallelUIRenderer(terminalRenderer);
        uiRenderer.start(this.getStateManager(), { calculateProgress });

        while (true) {
            const hasMore = await this.executeStep2Wave();

            if (!hasMore && this.running.size === 0) {
                // Não há mais tasks prontas e nenhuma está rodando
                break;
            }

            if (!hasMore && this.running.size > 0) {
                // Aguarda tasks em execução completarem
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Stop UI renderer
        uiRenderer.stop();

        // Verifica se alguma task falhou
        const failed = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'failed')
            .map(([name]) => name);

        const pending = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'pending')
            .map(([name]) => name);

        logger.newline();
        if (failed.length > 0) {
            logger.error(`Failed tasks: ${failed.join(', ')}`);
        }

        if (pending.length > 0) {
            logger.info(`Tasks still pending (check dependencies): ${pending.join(', ')}`);
        }

        const completed = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'completed')
            .map(([name]) => name);

        logger.success(`Completed ${completed.length}/${Object.keys(this.tasks).length} tasks`);
    }

    /**
   * Executa uma "onda" de tasks para step2 em paralelo
   * @returns {boolean} true se executou pelo menos uma task
   */
    async executeStep2Wave() {
        // Step 4: ignora dependências - todas as tarefas podem planejar em paralelo
        // But still respect scope-based concurrency in multi-repo mode
        const pending = Object.entries(this.tasks)
            .filter(([_name, task]) => task.status === 'pending')
            .map(([name]) => name);

        if (pending.length === 0) {
            return false;
        }

        // Mark as running using scope-aware method, respecting capacity limit
        const tasksToRun = [];
        for (const taskName of pending) {
            // Check capacity before each task (markRunning increases the count)
            if (this.totalRunning() >= this.maxConcurrent) {
                break;
            }

            const task = this.tasks[taskName];
            const scope = task.scope || 'integration';

            // In multi-repo mode, also check per-scope limits
            if (state.isMultiRepo() && scope !== 'integration') {
                const perScopeLimit = Math.max(1, Math.floor(this.maxConcurrent / 2));
                if (this.runningByScope[scope] >= perScopeLimit) {
                    continue; // Skip this task, try next one
                }
            }

            this.markRunning(taskName);
            tasksToRun.push(taskName);
        }

        if (tasksToRun.length === 0) {
            return false;
        }

        // Execute in parallel
        const promises = tasksToRun.map(task => this.executeStep2Task(task));
        await Promise.allSettled(promises);

        return true;
    }

    /**
   * Executa apenas o step4 para uma task específica
   */
    async executeStep2Task(_taskName) {
        try {
            // Update status to running
            this.stateManager.updateTaskStatus(_taskName, 'running');

            const taskPath = path.join(state.claudiomiroFolder, _taskName);
            const executionPath = path.join(taskPath, 'execution.json');

            // Check if already has execution.json
            if (fs.existsSync(executionPath)) {
                this.stateManager.updateTaskStatus(_taskName, 'completed');
                this.markComplete(_taskName, 'completed');
                return;
            }

            // Step 4: Planning (BLUEPRINT.md → execution.json)
            if (!this.shouldRunStep(4)) {
                this.stateManager.updateTaskStatus(_taskName, 'completed');
                this.markComplete(_taskName, 'completed');
                return;
            }

            this.stateManager.updateTaskStep(_taskName, 'Step 4 - Research and planning');
            await step4(_taskName);

            // Check if task was split (original folder no longer exists)
            if (!fs.existsSync(taskPath)) {
                this.stateManager.updateTaskStatus(_taskName, 'completed');
                this.markComplete(_taskName, 'completed');
                logger.info(`✅ ${_taskName} was split into subtasks`);
                return;
            }

            this.stateManager.updateTaskStatus(_taskName, 'completed');
            this.markComplete(_taskName, 'completed');
            logger.success(`✅ ${_taskName} step 4 completed successfully`);
        } catch (error) {
            this.stateManager.updateTaskStatus(_taskName, 'failed');
            this.markComplete(_taskName, 'failed');
            logger.error(`❌ ${_taskName} failed: ${error.message}`);
            throw error; // Propaga o erro
        }
    }
}

module.exports = { DAGExecutor, getDefaultConcurrency, DEFAULT_CONCURRENCY };
