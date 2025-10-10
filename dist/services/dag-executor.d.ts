import ParallelStateManager from './parallel-state-manager';
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
export declare class DAGExecutor {
    private tasks;
    private allowedSteps;
    private noLimit;
    private maxAttemptsPerTask;
    private maxConcurrent;
    private running;
    private stateManager;
    constructor(tasks: Record<string, TaskConfig>, allowedSteps?: number[] | null, maxConcurrent?: number | null, noLimit?: boolean, maxAttemptsPerTask?: number);
    /**
     * Returns the state manager instance
     */
    getStateManager(): ParallelStateManager;
    /**
     * Verifica se um step deve ser executado
     */
    shouldRunStep(stepNumber: number): boolean;
    /**
     * Retorna tasks que podem rodar agora:
     * - status === 'pending'
     * - todas as dependências foram completadas
     */
    getReadyTasks(): string[];
    /**
     * Executa uma "onda" de tasks em paralelo
     * @returns {boolean} true se executou pelo menos uma task
     */
    executeWave(): Promise<boolean>;
    /**
     * Executa o ciclo completo de uma task: step2 → step3 → step4
     * (step1 foi incorporado ao step0 e já criou PROMPT.md)
     */
    executeTask(taskName: string): Promise<void>;
    /**
     * Executa todas as tasks respeitando dependências
     */
    run(): Promise<void>;
    /**
     * Executa apenas o step2 (planejamento) para todas as tasks em paralelo
     */
    runStep2(): Promise<void>;
    /**
     * Executa uma "onda" de tasks para step2 em paralelo
     * @returns {boolean} true se executou pelo menos uma task
     */
    executeStep2Wave(): Promise<boolean>;
    /**
     * Executa apenas o step2 para uma task específica
     */
    executeStep2Task(taskName: string): Promise<void>;
}
//# sourceMappingURL=dag-executor.d.ts.map