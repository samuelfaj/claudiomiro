"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAGExecutor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const logger_1 = __importDefault(require("../../logger"));
const state_1 = __importDefault(require("../config/state"));
const index_1 = require("../steps/index");
const validation_1 = require("../utils/validation");
const parallel_state_manager_1 = __importDefault(require("./parallel-state-manager"));
const parallel_ui_renderer_1 = __importDefault(require("./parallel-ui-renderer"));
const terminal_renderer_1 = require("../utils/terminal-renderer");
const progress_calculator_1 = require("../utils/progress-calculator");
class DAGExecutor {
    constructor(tasks, allowedSteps = null, maxConcurrent = null, noLimit = false, maxAttemptsPerTask = 20) {
        this.tasks = tasks; // { TASK1: {deps: [], status: 'pending'}, ... }
        this.allowedSteps = allowedSteps; // null = todos os steps, ou array de números
        this.noLimit = noLimit; // Se true, remove limite de ciclos por tarefa
        this.maxAttemptsPerTask = maxAttemptsPerTask; // Limite customizável de ciclos por tarefa (padrão: 20)
        // 2 por core, máximo 5, ou valor customizado via --maxConcurrent
        const defaultMax = Math.min(5, (os_1.default.cpus().length || 1) * 2);
        this.maxConcurrent = maxConcurrent || Math.max(1, defaultMax);
        this.running = new Set(); // Tasks atualmente em execução
        // Initialize ParallelStateManager
        this.stateManager = new parallel_state_manager_1.default();
        this.stateManager.initialize(tasks);
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
        if (!this.allowedSteps)
            return true;
        return this.allowedSteps.includes(stepNumber);
    }
    /**
     * Retorna tasks que podem rodar agora:
     * - status === 'pending'
     * - todas as dependências foram completadas
     */
    getReadyTasks() {
        return Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'pending' &&
            task.deps.every(dep => this.tasks[dep] && this.tasks[dep].status === 'completed'))
            .map(([name]) => name);
    }
    /**
     * Executa uma "onda" de tasks em paralelo
     * @returns {boolean} true se executou pelo menos uma task
     */
    async executeWave() {
        const ready = this.getReadyTasks();
        const availableSlots = this.maxConcurrent - this.running.size;
        const toExecute = ready.slice(0, availableSlots);
        if (toExecute.length === 0) {
            return false;
        }
        // Marca como running
        toExecute.forEach(task => {
            this.tasks[task].status = 'running';
            this.running.add(task);
        });
        // Executa em paralelo
        const promises = toExecute.map(task => this.executeTask(task));
        await Promise.allSettled(promises);
        return true;
    }
    /**
     * Executa o ciclo completo de uma task: step2 → step3 → step4
     * (step1 foi incorporado ao step0 e já criou PROMPT.md)
     */
    async executeTask(taskName) {
        try {
            // Update status to running
            this.stateManager.updateTaskStatus(taskName, 'running');
            const taskPath = path_1.default.join(state_1.default.claudiomiroFolder, taskName);
            const todoPath = path_1.default.join(taskPath, 'TODO.md');
            const codeReviewPath = path_1.default.join(taskPath, 'CODE_REVIEW.md');
            const isTaskApproved = () => {
                if (!fs_1.default.existsSync(todoPath)) {
                    return false;
                }
                return validation_1.Validation.isFullyImplemented(todoPath) && validation_1.Validation.hasApprovedCodeReview(codeReviewPath);
            };
            // Verifica se já está completa
            if (isTaskApproved()) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.tasks[taskName].status = 'completed';
                this.running.delete(taskName);
                return;
            }
            // PROMPT.md já foi criado pelo step0, então começamos direto no step2
            // Step 2: Planejamento (PROMPT.md → TODO.md)
            if (!fs_1.default.existsSync(todoPath)) {
                if (!this.shouldRunStep(2)) {
                    this.stateManager.updateTaskStatus(taskName, 'completed');
                    this.tasks[taskName].status = 'completed';
                    this.running.delete(taskName);
                    return;
                }
                this.stateManager.updateTaskStep(taskName, 'Step 2 - Research and planning');
                await (0, index_1.step2)(taskName);
            }
            // Se step 2 foi executado e não devemos executar step 3, para aqui
            if (!this.shouldRunStep(3)) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.tasks[taskName].status = 'completed';
                this.running.delete(taskName);
                return;
            }
            // Loop até implementação completa
            let maxAttempts = this.noLimit ? Infinity : this.maxAttemptsPerTask; // Limite de segurança (customizável via --limit, infinito com --no-limit)
            let attempts = 0;
            while (attempts < maxAttempts) {
                attempts++;
                // Step 3: Implementação
                if (!fs_1.default.existsSync(todoPath) || !validation_1.Validation.isFullyImplemented(todoPath)) {
                    this.stateManager.updateTaskStep(taskName, `Step 3 - Implementing tasks (attempt ${attempts})`);
                    await (0, index_1.step3)(taskName);
                    continue; // Volta para verificar se está implementado
                }
                // Se step 3 foi executado e não devemos executar step 4, para aqui
                if (!this.shouldRunStep(4)) {
                    this.stateManager.updateTaskStatus(taskName, 'completed');
                    this.tasks[taskName].status = 'completed';
                    this.running.delete(taskName);
                    return;
                }
                // Step 4: Code review final
                if (!validation_1.Validation.hasApprovedCodeReview(codeReviewPath)) {
                    this.stateManager.updateTaskStep(taskName, 'Step 4 - Code review');
                    await (0, index_1.step4)(taskName);
                    // Se ainda não foi aprovado, continua o loop
                    if (!isTaskApproved()) {
                        continue;
                    }
                }
                // Se chegou aqui, task aprovada!
                break;
            }
            if (attempts >= maxAttempts) {
                this.stateManager.updateTaskStatus(taskName, 'failed');
                throw new Error(`Maximum attempts (${maxAttempts}) reached for ${taskName}`);
            }
            this.stateManager.updateTaskStatus(taskName, 'completed');
            this.tasks[taskName].status = 'completed';
            this.running.delete(taskName);
            logger_1.default.success(`✅ ${taskName} completed successfully`);
        }
        catch (error) {
            this.stateManager.updateTaskStatus(taskName, 'failed');
            this.tasks[taskName].status = 'failed';
            this.running.delete(taskName);
            logger_1.default.error(`❌ ${taskName} failed: ${error.message}`);
            throw error; // Propaga o erro
        }
    }
    /**
     * Executa todas as tasks respeitando dependências
     */
    async run() {
        const coreCount = Math.max(1, os_1.default.cpus().length);
        const defaultMax = Math.min(5, coreCount * 2);
        const isCustom = this.maxConcurrent !== defaultMax;
        logger_1.default.info(`Starting DAG executor with max ${this.maxConcurrent} concurrent tasks${isCustom ? ' (custom)' : ` (${coreCount} cores × 2, capped at 5)`}`);
        logger_1.default.newline();
        // Initialize and start UI renderer
        const terminalRenderer = new terminal_renderer_1.TerminalRenderer();
        const uiRenderer = new parallel_ui_renderer_1.default(terminalRenderer);
        uiRenderer.start(this.getStateManager(), { calculateProgress: progress_calculator_1.ProgressCalculator.calculateProgress });
        while (true) {
            const hasMore = await this.executeWave();
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
        logger_1.default.newline();
        if (failed.length > 0) {
            logger_1.default.error(`Failed tasks: ${failed.join(', ')}`);
        }
        if (pending.length > 0) {
            logger_1.default.info(`Tasks still pending (check dependencies): ${pending.join(', ')}`);
        }
        const completed = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'completed')
            .map(([name]) => name);
        logger_1.default.success(`Completed ${completed.length}/${Object.keys(this.tasks).length} tasks`);
    }
    /**
     * Executa apenas o step2 (planejamento) para todas as tasks em paralelo
     */
    async runStep2() {
        const coreCount = Math.max(1, os_1.default.cpus().length);
        const defaultMax = Math.min(5, coreCount * 2);
        const isCustom = this.maxConcurrent !== defaultMax;
        logger_1.default.info(`Starting step 2 (planning) with max ${this.maxConcurrent} concurrent tasks${isCustom ? ' (custom)' : ` (${coreCount} cores × 2, capped at 5)`}`);
        logger_1.default.newline();
        // Initialize and start UI renderer
        const terminalRenderer = new terminal_renderer_1.TerminalRenderer();
        const uiRenderer = new parallel_ui_renderer_1.default(terminalRenderer);
        uiRenderer.start(this.getStateManager(), { calculateProgress: progress_calculator_1.ProgressCalculator.calculateProgress });
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
        logger_1.default.newline();
        if (failed.length > 0) {
            logger_1.default.error(`Failed tasks: ${failed.join(', ')}`);
        }
        if (pending.length > 0) {
            logger_1.default.info(`Tasks still pending (check dependencies): ${pending.join(', ')}`);
        }
        const completed = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'completed')
            .map(([name]) => name);
        logger_1.default.success(`Completed ${completed.length}/${Object.keys(this.tasks).length} tasks`);
    }
    /**
     * Executa uma "onda" de tasks para step2 em paralelo
     * @returns {boolean} true se executou pelo menos uma task
     */
    async executeStep2Wave() {
        // Step 2: ignora dependências - todas as tarefas podem planejar em paralelo
        const ready = Object.entries(this.tasks)
            .filter(([, task]) => task.status === 'pending')
            .map(([name]) => name);
        const availableSlots = this.maxConcurrent - this.running.size;
        const toExecute = ready.slice(0, availableSlots);
        if (toExecute.length === 0) {
            return false;
        }
        // Marca como running
        toExecute.forEach(task => {
            this.tasks[task].status = 'running';
            this.running.add(task);
        });
        // Executa em paralelo
        const promises = toExecute.map(task => this.executeStep2Task(task));
        await Promise.allSettled(promises);
        return true;
    }
    /**
     * Executa apenas o step2 para uma task específica
     */
    async executeStep2Task(taskName) {
        try {
            // Update status to running
            this.stateManager.updateTaskStatus(taskName, 'running');
            const taskPath = path_1.default.join(state_1.default.claudiomiroFolder, taskName);
            const todoPath = path_1.default.join(taskPath, 'TODO.md');
            // Verifica se já tem TODO.md
            if (fs_1.default.existsSync(todoPath)) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.tasks[taskName].status = 'completed';
                this.running.delete(taskName);
                return;
            }
            // Step 2: Planejamento (PROMPT.md → TODO.md)
            if (!this.shouldRunStep(2)) {
                this.stateManager.updateTaskStatus(taskName, 'completed');
                this.tasks[taskName].status = 'completed';
                this.running.delete(taskName);
                return;
            }
            this.stateManager.updateTaskStep(taskName, 'Step 2 - Research and planning');
            await (0, index_1.step2)(taskName);
            this.stateManager.updateTaskStatus(taskName, 'completed');
            this.tasks[taskName].status = 'completed';
            this.running.delete(taskName);
            logger_1.default.success(`✅ ${taskName} step 2 completed successfully`);
        }
        catch (error) {
            this.stateManager.updateTaskStatus(taskName, 'failed');
            this.tasks[taskName].status = 'failed';
            this.running.delete(taskName);
            logger_1.default.error(`❌ ${taskName} failed: ${error.message}`);
            throw error; // Propaga o erro
        }
    }
}
exports.DAGExecutor = DAGExecutor;
//# sourceMappingURL=dag-executor.js.map