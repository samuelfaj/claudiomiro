import fs from 'fs';
import path from 'path';
import logger from '../logger';
import state from './config/state';
import { DAGExecutor } from './services/index';
import { FileManager } from './services/file-manager';
import { step0, step1, step5 } from './steps/index';
import { Validation } from './utils/validation';

// Import startFresh from FileManager
const startFresh = FileManager.startFresh;

// Type definitions for CLI arguments
type ExecutorType = 'claude' | 'codex' | 'deep-seek' | 'gemini';
type ModeType = 'auto' | 'hard';

interface CLIResult {
  done?: boolean;
  step?: Promise<any>;
}

interface TaskGraph {
  [task: string]: {
    deps: string[];
    status: 'pending' | 'completed';
  };
}

const isTaskApproved = (taskName: string): boolean => {
    if (!state.claudiomiroFolder) {
        return false;
    }

    const taskFolder = path.join(state.claudiomiroFolder, taskName);
    const todoPath = path.join(taskFolder, 'TODO.md');
    const codeReviewPath = path.join(taskFolder, 'CODE_REVIEW.md');

    if (!fs.existsSync(todoPath)) {
        return false;
    }

    if (!Validation.isFullyImplemented(todoPath)) {
        return false;
    }

    return Validation.hasApprovedCodeReview(codeReviewPath);
};

const chooseAction = async (i: number): Promise<CLIResult> => {
    // Verifica se --prompt foi passado e extrai o valor
    const promptArg = process.argv.find(arg => arg.startsWith('--prompt='));
    const promptText = promptArg ? promptArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : null;

    // Verifica se --fresh foi passado (ou se --prompt foi usado, que automaticamente ativa --fresh)
    const shouldStartFresh = process.argv.includes('--fresh') || promptText !== null;

    // Verifica se --push=false foi passado
    const shouldPush = !process.argv.some(arg => arg === '--push=false');

    // Verifica se --same-branch foi passado
    const sameBranch = process.argv.includes('--same-branch');

    // Verifica se --no-limit foi passado
    const noLimit = process.argv.includes('--no-limit');

    // Verifica se --limit foi passado
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

    // Verifica se --mode foi passado (auto ou hard)
    const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
    const mode: ModeType = modeArg ? (modeArg.split('=')[1] as ModeType) : 'auto'; // default: auto

    // Verifica se --codex ou --claude foi passado
    const codexFlag = process.argv.includes('--codex');
    const deepSeekFlag = process.argv.includes('--deep-seek');
    const gemini = process.argv.includes('--gemini');

    let executorType: ExecutorType = 'claude';

    if(codexFlag){
        executorType = 'codex'
    }

    if(deepSeekFlag){
        executorType = 'deep-seek'
    }

    if(gemini){
        executorType = 'gemini'
    }

    state.setExecutorType(executorType);

    // Verifica se --steps= ou --step= foi passado (quais steps executar)
    const stepsArg = process.argv.find(arg => arg.startsWith('--steps=') || arg.startsWith('--step='));
    const allowedSteps = stepsArg
        ? stepsArg.split('=')[1].split(',').map(s => parseInt(s.trim(), 10))
        : null; // null = executa todos os steps

    // Verifica se --maxConcurrent foi passado
    const maxConcurrentArg = process.argv.find(arg => arg.startsWith('--maxConcurrent='));
    const maxConcurrent = maxConcurrentArg ? parseInt(maxConcurrentArg.split('=')[1], 10) : null;

    // Helper para verificar se um step deve ser executado
    const shouldRunStep = (stepNumber: number): boolean => {
        if (!allowedSteps) return true; // Se --steps não foi passado, executa tudo
        return allowedSteps.includes(stepNumber);
    };

    // Filtra os argumentos para pegar apenas o diretório
    const args = process.argv.slice(2).filter(arg =>
        arg !== '--fresh' &&
        !arg.startsWith('--push') &&
        arg !== '--same-branch' &&
        !arg.startsWith('--prompt') &&
        !arg.startsWith('--maxConcurrent') &&
        !arg.startsWith('--steps') &&
        !arg.startsWith('--step=') &&
        arg !== '--no-limit' &&
        !arg.startsWith('--limit=') &&
        !arg.startsWith('--mode') &&
        arg !== '--codex' &&
        arg !== '--claude' &&
        arg !== '--deep-seek' &&
        arg !== '--gemini'
    );
    const folderArg = args[0] || process.cwd();

    // Resolve o caminho absoluto e define a variável global
    state.setFolder(folderArg);

    if (!state.folder || !fs.existsSync(state.folder)) {
        logger.error(`Folder does not exist: ${state.folder}`);
        process.exit(1);
    }

    logger.path(`Working directory: ${state.folder}`);
    logger.newline();

    logger.info(`Executor selected: ${executorType}`);
    logger.newline();

    // Mostra quais steps serão executados se --steps foi especificado
    if (allowedSteps && i === 0) {
        logger.info(`Running only steps: ${allowedSteps.join(', ')}`);
        logger.newline();
    }

    if(shouldStartFresh && i === 0){
        startFresh();
    }

    // STEP 0: Criar todas as tasks (TASK.md + PROMPT.md)
    if(!state.claudiomiroFolder || !fs.existsSync(state.claudiomiroFolder)){
        if (!shouldRunStep(0)) {
            logger.info('Step 0 skipped (not in --steps list)');
            return { done: true };
        }
        return { step: step0({ sameBranch, promptText, mode }) };
    }

    // STEP 0: Criar todas as tasks (TASK.md + PROMPT.md)
    if(
        !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK0')) &&
        !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK1'))
    ){
        if (!shouldRunStep(0)) {
            logger.info('Step 0 skipped (not in --steps list)');
            return { done: true };
        }
        return { step: step0({ sameBranch, promptText, mode }) };
    }

    const tasks = fs
    .readdirSync(state.claudiomiroFolder)
    .filter(name => {
        const fullPath = path.join(state.claudiomiroFolder, name);
        return fs.statSync(fullPath).isDirectory();
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (tasks.length === 0) {
        logger.error('No tasks found in claudiomiro folder');
        process.exit(1);
    }

    // ATIVAR DAG EXECUTOR: Se já temos @dependencies definidas, usar execução paralela
    let taskGraph = buildTaskGraph();

    if(!allHasTodo()){
        const shouldRunDAG = shouldRunStep(2);

        if(!shouldRunDAG){
            logger.newline();
            logger.step(tasks.length, tasks.length, 5, 'Finalizing review and committing');
            await step5(tasks, shouldPush);
            return { done: true };
        }

        if (!taskGraph) {
            logger.error('Cannot proceed: no dependency graph. Run step 1 first.');
            process.exit(1);
        }

        const executor = new DAGExecutor(taskGraph, allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);
        await executor.runStep2();
    }

    taskGraph = buildTaskGraph();

    if (taskGraph) {
        // Verifica se algum dos steps 2, 3 ou 4 deve ser executado
        const shouldRunDAG = shouldRunStep(2) || shouldRunStep(3) || shouldRunStep(4);

        if (!shouldRunDAG) {
            logger.info('Steps 2-4 skipped (not in --steps list)');

            // Pula para step 5 se estiver na lista
            if (shouldRunStep(5) && tasks.every(isTaskApproved)) {
                logger.newline();
                logger.step(tasks.length, tasks.length, 5, 'Finalizing review and committing');
                await step5(tasks, shouldPush);
            }

            return { done: true };
        }

        // Todas as tasks têm dependências definidas, usar DAG executor
        logger.info('Switching to parallel execution mode with DAG executor');
        logger.newline();

        const executor = new DAGExecutor(taskGraph, allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);
        await executor.run();

        // Após DAG executor, criar PR final
        if (shouldRunStep(5) && tasks.every(isTaskApproved)) {
            logger.newline();
            logger.step(tasks.length, tasks.length, 5, 'Finalizing review and committing');
            await step5(tasks, shouldPush);
        }

        logger.success('All tasks completed!');
        return { done: true };
    } else {
        if (!shouldRunStep(1)) {
            logger.error('Cannot proceed: no dependency graph. Run step 1 first.');
            process.exit(1);
        }

        logger.newline();
        logger.startSpinner('Analyzing task dependencies...');
        return { step: step1(mode) };
    }
}

const allHasTodo = (): boolean | null => {
    if (!state.claudiomiroFolder || !fs.existsSync(state.claudiomiroFolder)) {
        return null;
    }

    const tasks = fs
        .readdirSync(state.claudiomiroFolder)
        .filter(name => {
            const fullPath = path.join(state.claudiomiroFolder, name);
            return fs.statSync(fullPath).isDirectory();
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (tasks.length === 0) {
        return null;
    }

    for (const task of tasks) {
        if(!fs.existsSync(path.join(state.claudiomiroFolder, task, 'TODO.md'))){
            return false;
        }

        if(!fs.existsSync(path.join(state.claudiomiroFolder, task, 'split.txt'))){
            return false;
        }
    }

    return true;
}

/**
 * Constrói o grafo de tasks lendo as dependências de cada TASK.md
 * @returns {Object|null} Grafo de tasks { TASK1: {deps: [], status: 'pending'}, ... } ou null se não houver @dependencies
 */
const buildTaskGraph = (): TaskGraph | null => {
    if (!state.claudiomiroFolder || !fs.existsSync(state.claudiomiroFolder)) {
        return null;
    }

    const tasks = fs
        .readdirSync(state.claudiomiroFolder)
        .filter(name => {
            const fullPath = path.join(state.claudiomiroFolder, name);
            return fs.statSync(fullPath).isDirectory();
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (tasks.length === 0) {
        return null;
    }

    const graph: TaskGraph = {};
    let hasAnyDependencyTag = false;

    for (const task of tasks) {
        const taskMdPath = path.join(state.claudiomiroFolder, task, 'TASK.md');

        if (!fs.existsSync(taskMdPath)) {
            // Task sem TASK.md ainda, não pode construir grafo
            return null;
        }
        const taskMd = fs.readFileSync(taskMdPath, 'utf-8');

        // Find the first @dependencies line anywhere in the file.
        // Matches either:
        //   @dependencies [TASK1, TASK2, TASK3]
        // or
        //   @dependencies TASK1, TASK2, TASK3
        const depsMatch = taskMd.match(
          /^\s*@dependencies\s*(?:\[(.*?)\]|(.+))\s*$/mi
        );

        if (!depsMatch) {
          // No @dependencies line → incomplete graph
          return null;
        }

        hasAnyDependencyTag = true;

        // Prefer the content inside [...] if present (group 1), otherwise the free-form tail (group 2)
        const raw = (depsMatch[1] ?? depsMatch[2] ?? '').trim();

        // Allow empty: "@dependencies []" or "@dependencies" (if you want to permit it)
        const deps = raw
          ? raw.split(',').filter( s => (s || '').toLowerCase() != 'none').map(s => s.trim()).filter(Boolean)
          : [];

        // Optional: dedupe and prevent self-dependency
        const uniqueDeps = Array.from(new Set(deps)).filter(d => d !== task);

        graph[task] = {
          deps: uniqueDeps,
          status: isTaskApproved(task) ? 'completed' : 'pending',
        };
    }

    // Retorna o grafo se todas as tasks têm @dependencies
    return hasAnyDependencyTag ? graph : null;
}

const init = async (): Promise<void> => {
    logger.banner();

    // Inicializa o state.folder antes de usá-lo
    const args = process.argv.slice(2).filter(arg => arg !== '--fresh' && !arg.startsWith('--push') && arg !== '--same-branch' && !arg.startsWith('--prompt') && !arg.startsWith('--maxConcurrent') && arg !== '--no-limit' && !arg.startsWith('--limit=') && !arg.startsWith('--mode'));
    const folderArg = args[0] || process.cwd();
    state.setFolder(folderArg);

    // Executa chooseAction até completar
    // Step 0 → Step 1 → DAGExecutor (com maxAttempts=20 POR TAREFA) → Step 5
    // Máximo ~3-4 iterações no loop principal
    let i = 0;
    while(true){
        const result = await chooseAction(i);

        // Se retornou { done: true }, terminou
        if (result && result.done) {
            return;
        }

        // Executa step se retornado (step0 ou step1)
        if (result && result.step) {
            await result.step;
        }

        i++;
    }
}

export { init, isTaskApproved, allHasTodo, buildTaskGraph };