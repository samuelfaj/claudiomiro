interface TaskGraph {
    [task: string]: {
        deps: string[];
        status: 'pending' | 'completed';
    };
}
declare const isTaskApproved: (taskName: string) => boolean;
declare const allHasTodo: () => boolean | null;
/**
 * Constrói o grafo de tasks lendo as dependências de cada TASK.md
 * @returns {Object|null} Grafo de tasks { TASK1: {deps: [], status: 'pending'}, ... } ou null se não houver @dependencies
 */
declare const buildTaskGraph: () => TaskGraph | null;
declare const init: () => Promise<void>;
export { init, isTaskApproved, allHasTodo, buildTaskGraph };
//# sourceMappingURL=cli.d.ts.map