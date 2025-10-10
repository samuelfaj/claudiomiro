import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../logger';
import state from '../config/state';
import { step2, step3, step4 } from '../steps/index';
import { Validation } from '../utils/validation';
import ParallelStateManager from './parallel-state-manager';
import ParallelUIRenderer from './parallel-ui-renderer';
import { TerminalRenderer } from '../utils/terminal-renderer';
import { ProgressCalculator } from '../utils/progress-calculator';

// Type definitions
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskState {
  status: TaskStatus;
  deps: string[];
}

export interface TaskConfig {
  status: TaskStatus;
  deps: string[];
}

export interface DAGExecutorConfig {
  tasks: Record<string, TaskConfig>;
  allowedSteps?: number[] | null;
  maxConcurrent?: number | null;
  noLimit?: boolean;
  maxAttemptsPerTask?: number;
}

export class DAGExecutor {
  private tasks: Record<string, TaskConfig>;
  private allowedSteps: number[] | null;
  private noLimit: boolean;
  private maxAttemptsPerTask: number;
  private maxConcurrent: number;
  private running: Set<string>;
  private stateManager: ParallelStateManager;

  constructor(
    tasks: Record<string, TaskConfig>,
    allowedSteps: number[] | null = null,
    maxConcurrent: number | null = null,
    noLimit: boolean = false,
    maxAttemptsPerTask: number = 20
  ) {
    this.tasks = tasks; // { TASK1: {deps: [], status: 'pending'}, ... }
    this.allowedSteps = allowedSteps; // null = todos os steps, ou array de números
    this.noLimit = noLimit; // Se true, remove limite de ciclos por tarefa
    this.maxAttemptsPerTask = maxAttemptsPerTask; // Limite customizável de ciclos por tarefa (padrão: 20)
    // 2 por core, máximo 5, ou valor customizado via --maxConcurrent
    const defaultMax = Math.min(5, (os.cpus().length || 1) * 2);
    this.maxConcurrent = maxConcurrent || Math.max(1, defaultMax);
    this.running = new Set<string>(); // Tasks atualmente em execução

    // Initialize ParallelStateManager
    this.stateManager = new ParallelStateManager();
    this.stateManager.initialize(tasks);
  }

  /**
   * Returns the state manager instance
   */
  getStateManager(): ParallelStateManager {
    return this.stateManager;
  }

  /**
   * Verifica se um step deve ser executado
   */
  shouldRunStep(stepNumber: number): boolean {
    if (!this.allowedSteps) return true;
    return this.allowedSteps.includes(stepNumber);
  }

  /**
   * Retorna tasks que podem rodar agora:
   * - status === 'pending'
   * - todas as dependências foram completadas
   */
  getReadyTasks(): string[] {
    return Object.entries(this.tasks)
      .filter(([, task]) =>
        task.status === 'pending' &&
        task.deps.every(dep => this.tasks[dep] && this.tasks[dep].status === 'completed')
      )
      .map(([name]) => name);
  }

  /**
   * Executa uma "onda" de tasks em paralelo
   * @returns {boolean} true se executou pelo menos uma task
   */
  async executeWave(): Promise<boolean> {
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
  async executeTask(taskName: string): Promise<void> {
    try {
      // Update status to running
      this.stateManager.updateTaskStatus(taskName, 'running');

      const taskPath = path.join(state.claudiomiroFolder, taskName);
      const todoPath = path.join(taskPath, 'TODO.md');
      const codeReviewPath = path.join(taskPath, 'CODE_REVIEW.md');

      const isTaskApproved = (): boolean => {
        if (!fs.existsSync(todoPath)) {
          return false;
        }

        return Validation.isFullyImplemented(todoPath) && Validation.hasApprovedCodeReview(codeReviewPath);
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
      if (!fs.existsSync(todoPath)) {
        if (!this.shouldRunStep(2)) {
          this.stateManager.updateTaskStatus(taskName, 'completed');
          this.tasks[taskName].status = 'completed';
          this.running.delete(taskName);
          return;
        }
        this.stateManager.updateTaskStep(taskName, 'Step 2 - Research and planning');
        await step2(taskName);
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
        if (!fs.existsSync(todoPath) || !Validation.isFullyImplemented(todoPath)) {
          this.stateManager.updateTaskStep(taskName, `Step 3 - Implementing tasks (attempt ${attempts})`);
          await step3(taskName);
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
        if (!Validation.hasApprovedCodeReview(codeReviewPath)) {
          this.stateManager.updateTaskStep(taskName, 'Step 4 - Code review');
          await step4(taskName);

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
      logger.success(`✅ ${taskName} completed successfully`);
    } catch (error) {
      this.stateManager.updateTaskStatus(taskName, 'failed');
      this.tasks[taskName].status = 'failed';
      this.running.delete(taskName);
      logger.error(`❌ ${taskName} failed: ${error.message}`);
      throw error; // Propaga o erro
    }
  }

  /**
   * Executa todas as tasks respeitando dependências
   */
  async run(): Promise<void> {
    const coreCount = Math.max(1, os.cpus().length);
    const defaultMax = Math.min(5, coreCount * 2);
    const isCustom = this.maxConcurrent !== defaultMax;

    logger.info(`Starting DAG executor with max ${this.maxConcurrent} concurrent tasks${isCustom ? ' (custom)' : ` (${coreCount} cores × 2, capped at 5)`}`);
    logger.newline();

    // Initialize and start UI renderer
    const terminalRenderer = new TerminalRenderer();
    const uiRenderer = new ParallelUIRenderer(terminalRenderer);
    uiRenderer.start(this.getStateManager(), { calculateProgress: ProgressCalculator.calculateProgress });

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
   * Executa apenas o step2 (planejamento) para todas as tasks em paralelo
   */
  async runStep2(): Promise<void> {
    const coreCount = Math.max(1, os.cpus().length);
    const defaultMax = Math.min(5, coreCount * 2);
    const isCustom = this.maxConcurrent !== defaultMax;

    logger.info(`Starting step 2 (planning) with max ${this.maxConcurrent} concurrent tasks${isCustom ? ' (custom)' : ` (${coreCount} cores × 2, capped at 5)`}`);
    logger.newline();

    // Initialize and start UI renderer
    const terminalRenderer = new TerminalRenderer();
    const uiRenderer = new ParallelUIRenderer(terminalRenderer);
    uiRenderer.start(this.getStateManager(), { calculateProgress: ProgressCalculator.calculateProgress });

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
  async executeStep2Wave(): Promise<boolean> {
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
  async executeStep2Task(taskName: string): Promise<void> {
    try {
      // Update status to running
      this.stateManager.updateTaskStatus(taskName, 'running');

      const taskPath = path.join(state.claudiomiroFolder, taskName);
      const todoPath = path.join(taskPath, 'TODO.md');

      // Verifica se já tem TODO.md
      if (fs.existsSync(todoPath)) {
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
      await step2(taskName);

      this.stateManager.updateTaskStatus(taskName, 'completed');
      this.tasks[taskName].status = 'completed';
      this.running.delete(taskName);
      logger.success(`✅ ${taskName} step 2 completed successfully`);
    } catch (error) {
      this.stateManager.updateTaskStatus(taskName, 'failed');
      this.tasks[taskName].status = 'failed';
      this.running.delete(taskName);
      logger.error(`❌ ${taskName} failed: ${error.message}`);
      throw error; // Propaga o erro
    }
  }
}