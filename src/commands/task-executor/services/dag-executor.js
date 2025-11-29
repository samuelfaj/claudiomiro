const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');
const { step4, step5, step6, step7 } = require('../steps');
const { isFullyImplementedAsync, hasApprovedCodeReview } = require('../utils/validation');
const ParallelStateManager = require('./parallel-state-manager');
const ParallelUIRenderer = require('./parallel-ui-renderer');
const TerminalRenderer = require('../utils/terminal-renderer');
const { calculateProgress } = require('../utils/progress-calculator');
const { resolveDeadlock } = require('./deadlock-resolver');
const { parseTaskScope } = require('../utils/scope-parser');

const CORE_COUNT = Math.max(1, os.cpus().length);

class DAGExecutor {
    constructor(tasks, allowedSteps = null, maxConcurrent = null, noLimit = false, maxAttemptsPerTask = 20) {
        this.tasks = tasks; // { TASK1: {deps: [], status: 'pending'}, ... }
        this.allowedSteps = allowedSteps; // null = todos os steps, ou array de números
        this.noLimit = noLimit; // Se true, remove limite de ciclos por tarefa
        this.maxAttemptsPerTask = maxAttemptsPerTask; // Limite customizável de ciclos por tarefa (padrão: 20)
        const defaultMax = Math.max(1, CORE_COUNT);
        this.maxConcurrent = maxConcurrent || defaultMax;
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
     * Initialize tasks with scope information from TASK.md files
     * @param {Object} tasks - Task object { TASKN: { deps: [], status: 'pending' } }
     */
    _initializeTasks(tasks) {
        for (const taskName of Object.keys(tasks)) {
            try {
                const taskMdPath = path.join(state.claudiomiroFolder, taskName, 'TASK.md');
                if (fs.existsSync(taskMdPath)) {
                    const content = fs.readFileSync(taskMdPath, 'utf8');
                    const scope = parseTaskScope(content);
                    tasks[taskName].scope = scope || 'integration';
                } else {
                    logger.warning(`No TASK.md found for ${taskName}, defaulting to integration scope`);
                    tasks[taskName].scope = 'integration';
                }
            } catch (error) {
                logger.warning(`Error reading TASK.md for ${taskName}: ${error.message}, defaulting to integration scope`);
                tasks[taskName].scope = 'integration';
            }
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

        const scope = task.scope || 'integration';

        // Single-repo mode: use standard total limit
        if (!state.isMultiRepo()) {
            return this.totalRunning() < this.maxConcurrent;
        }

        // Multi-repo mode: scope-based limits
        if (scope === 'integration') {
            // Integration tasks respect global limit
            return this.totalRunning() < this.maxConcurrent;
        }

        // Backend/frontend tasks can run independently per scope
        return this.runningByScope[scope] < this.maxConcurrent;
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

                // Initialize scope for new task
                try {
                    const taskMdPath = path.join(state.claudiomiroFolder, _taskName, 'TASK.md');
                    if (fs.existsSync(taskMdPath)) {
                        const content = fs.readFileSync(taskMdPath, 'utf8');
                        const scope = parseTaskScope(content);
                        this.tasks[_taskName].scope = scope || 'integration';
                    } else {
                        this.tasks[_taskName].scope = 'integration';
                    }
                } catch {
                    this.tasks[_taskName].scope = 'integration';
                }

                this.stateManager.taskStates.set(_taskName, {
                    status: taskData.status,
                    step: null,
                    message: null,
                });
                logger.info(`📥 Added new task: ${_taskName} (deps: ${taskData.deps.join(', ') || 'none'}, scope: ${this.tasks[_taskName].scope})`);
                hasChanges = true;
            } else {
                // Existing task - update deps but preserve status if running/completed
                const oldDeps = this.tasks[_taskName].deps.join(',');
                const newDeps = taskData.deps.join(',');
                if (oldDeps !== newDeps) {
                    logger.info(`🔄 Updated deps for ${_taskName}: [${oldDeps}] → [${newDeps}]`);
                    hasChanges = true;
                }
                this.tasks[_taskName].deps = taskData.deps;
                // Update status from graph if task is still pending (e.g., completed in background)
                if (this.tasks[_taskName].status === 'pending' && taskData.status === 'completed') {
                    this.tasks[_taskName].status = 'completed';
                    this.stateManager.updateTaskStatus(_taskName, 'completed');
                    logger.info(`✅ ${_taskName} marked as completed from graph`);
                    hasChanges = true;
                }
            }
        }

        // Remove tasks that no longer exist in the graph (e.g., parent task that was split)
        for (const _taskName of Object.keys(this.tasks)) {
            if (!newGraph[_taskName] && this.tasks[_taskName].status === 'pending') {
                logger.info(`🗑️ Removed task no longer in graph: ${_taskName}`);
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

        // Mark as running using scope-aware method
        toExecute.forEach(task => {
            this.markRunning(task);
        });

        // Execute in parallel with Promise.allSettled
        const promises = toExecute.map(task => this.executeTask(task));

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
            const todoPath = path.join(taskPath, 'TODO.md');
            const todoOldPath = path.join(taskPath, 'TODO.old.md');

            if(
                fs.existsSync(codeReviewPath) &&
        !fs.existsSync(todoPath) &&
        fs.existsSync(todoOldPath)
            ) {
                fs.cpSync(todoOldPath, todoPath);
                fs.rmSync(todoOldPath, { force: true });
            }

            const isTaskApproved = async () => {
                if (!fs.existsSync(todoPath)) {
                    return false;
                }

                const completionResult = await isFullyImplementedAsync(todoPath);
                return completionResult.completed && hasApprovedCodeReview(codeReviewPath);
            };

            // Verifica se já está completa
            if (await isTaskApproved()) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.markComplete(taskName, 'completed');
                return;
            }

            // PROMPT.md já foi criado pelos steps 0-3, então começamos direto no step4

            // Step 4: Planejamento (PROMPT.md → TODO.md)
            if (!fs.existsSync(todoPath)) {
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

            // Se step 4 foi executado e não devemos executar step 5, para aqui
            if (!this.shouldRunStep(5)) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.markComplete(taskName, 'completed');
                return;
            }

            // Loop até implementação completa
            let maxAttempts = this.noLimit ? Infinity : this.maxAttemptsPerTask; // Limite de segurança (customizável via --limit, infinito com --no-limit)
            let attempts = 0;
            let lastStep5Error = null;

            while (attempts < maxAttempts) {
                attempts++;

                // Step 5: Implementação
                const completionCheck = await isFullyImplementedAsync(todoPath);
                if (!fs.existsSync(todoPath) || !completionCheck.completed) {
                    try {
                        this.stateManager.updateTaskStep(taskName, `Step 5 - Implementing tasks (attempt ${attempts})`);
                        await step5(taskName);
                        lastStep5Error = null; // Clear any previous error on success
                    } catch (error) {
                        // If step5 fails, we should continue the loop to retry
                        lastStep5Error = error;
                        logger.warning(`${taskName} Step 5 failed (attempt ${attempts}): ${error.message}`);
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
                    await step6(taskName, shouldPush);

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
        const defaultMax = CORE_COUNT;
        const isCustom = this.maxConcurrent !== defaultMax;

        logger.info(`Starting DAG executor with max ${this.maxConcurrent} concurrent tasks${isCustom ? ' (custom)' : ` (${coreCount} cores × 2, capped at 5)`}`);
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
                if (pendingTasksDebug.length > 0 && this.running.size === 0) {
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
                    const logPath = path.join(state.claudiomiroFolder, 'log.txt');
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
        const defaultMax = CORE_COUNT;
        const isCustom = this.maxConcurrent !== defaultMax;

        logger.info(`Starting step 4 (planning) with max ${this.maxConcurrent} concurrent tasks${isCustom ? ' (custom)' : ` (${coreCount} cores × 2, capped at 5)`}`);
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

        // Filter by scope-aware capacity (ignores dependency check for step2)
        const toExecute = pending.filter(taskName => {
            const task = this.tasks[taskName];
            const scope = task.scope || 'integration';

            if (!state.isMultiRepo()) {
                return this.totalRunning() < this.maxConcurrent;
            }

            if (scope === 'integration') {
                return this.totalRunning() < this.maxConcurrent;
            }

            return this.runningByScope[scope] < this.maxConcurrent;
        });

        if (toExecute.length === 0) {
            return false;
        }

        // Mark as running using scope-aware method
        toExecute.forEach(task => {
            this.markRunning(task);
        });

        // Execute in parallel
        const promises = toExecute.map(task => this.executeStep2Task(task));
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
            const todoPath = path.join(taskPath, 'TODO.md');

            // Verifica se já tem TODO.md
            if (fs.existsSync(todoPath)) {
                this.stateManager.updateTaskStatus(_taskName, 'completed');
                this.markComplete(_taskName, 'completed');
                return;
            }

            // Step 4: Planejamento (PROMPT.md → TODO.md)
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

module.exports = { DAGExecutor };
