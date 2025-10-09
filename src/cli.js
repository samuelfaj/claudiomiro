const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const state = require('./config/state');
const { startFresh } = require('./services/file-manager');
const { step1, step5 } = require('./steps');
const { step0 } = require('./steps/step0');
const { DAGExecutor } = require('./services/dag-executor');

const chooseAction = async (i) => {
    // Verifica se --prompt foi passado e extrai o valor
    const promptArg = process.argv.find(arg => arg.startsWith('--prompt='));
    const promptText = promptArg ? promptArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : null;

    // Verifica se --maxCycles foi passado e extrai o valor
    const maxCyclesArg = process.argv.find(arg => arg.startsWith('--maxCycles='));
    const maxCycles = maxCyclesArg ? parseInt(maxCyclesArg.split('=')[1], 10) : 15;

    // Verifica se --fresh foi passado (ou se --prompt foi usado, que automaticamente ativa --fresh)
    const shouldStartFresh = process.argv.includes('--fresh') || promptText !== null;

    // Verifica se --push=false foi passado
    const shouldPush = !process.argv.some(arg => arg === '--push=false');

    // Verifica se --same-branch foi passado
    const sameBranch = process.argv.includes('--same-branch');

    // Verifica se --no-limit foi passado
    const noLimit = process.argv.includes('--no-limit');

    // Verifica se --mode foi passado (auto ou hard)
    const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
    const mode = modeArg ? modeArg.split('=')[1] : 'auto'; // default: auto

    // Verifica se --codex, --claude ou --gemini foi passado
    const codexFlag = process.argv.includes('--codex');
    const claudeFlag = process.argv.includes('--claude');
    const geminiFlag = process.argv.includes('--gemini');

    const executorFlags = [codexFlag, claudeFlag, geminiFlag].filter(Boolean);
    if (executorFlags.length > 1) {
        logger.error('Use only one executor flag: --claude, --codex, or --gemini');
        process.exit(1);
    }

    const executorType = codexFlag ? 'codex' : geminiFlag ? 'gemini' : 'claude';
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
    const shouldRunStep = (stepNumber) => {
        if (!allowedSteps) return true; // Se --steps não foi passado, executa tudo
        return allowedSteps.includes(stepNumber);
    };

    // Filtra os argumentos para pegar apenas o diretório
    const args = process.argv.slice(2).filter(arg =>
        arg !== '--fresh' &&
        !arg.startsWith('--push') &&
        arg !== '--same-branch' &&
        !arg.startsWith('--prompt') &&
        !arg.startsWith('--maxCycles') &&
        !arg.startsWith('--maxConcurrent') &&
        !arg.startsWith('--steps') &&
        !arg.startsWith('--step=') &&
        arg !== '--no-limit' &&
        !arg.startsWith('--mode') &&
        arg !== '--codex' &&
        arg !== '--claude' &&
        arg !== '--gemini'
    );
    const folderArg = args[0] || process.cwd();

    // Resolve o caminho absoluto e define a variável global
    state.setFolder(folderArg);

    if (!fs.existsSync(state.folder)) {
        logger.error(`Folder does not exist: ${state.folder}`);
        process.exit(1);
    }

    logger.path(`Working directory: ${state.folder}`);
    logger.newline();

    const executorDisplay = executorType === 'codex' ? 'Codex' : executorType === 'gemini' ? 'Gemini' : 'Claude';
    logger.info(`Executor selected: ${executorDisplay}`);
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
    if(!fs.existsSync(state.claudiomiroFolder)){
        if (!shouldRunStep(0)) {
            logger.info('Step 0 skipped (not in --steps list)');
            return { done: true };
        }
        return { step: step0(sameBranch, promptText, mode), maxCycles: noLimit ? Infinity : maxCycles };
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

    // STEP 1: Analisar dependências (adiciona @dependencies em cada TASK.md)
    const allHavePrompt = tasks.every(task =>
        fs.existsSync(path.join(state.claudiomiroFolder, task, 'PROMPT.md'))
    );

    const noneHaveDependencies = tasks.every(task => {
        const taskMdPath = path.join(state.claudiomiroFolder, task, 'TASK.md');
        if (!fs.existsSync(taskMdPath)) return true;
        const content = fs.readFileSync(taskMdPath, 'utf-8');
        return !content.match(/@dependencies/);
    });

    // Se todas têm PROMPT.md mas nenhuma tem @dependencies, roda step1
    if (allHavePrompt && noneHaveDependencies && tasks.length > 0) {
        if (!shouldRunStep(1)) {
            logger.info('Step 1 skipped (not in --steps list)');
            return { done: true };
        }
        logger.step(tasks.length, tasks.length, 1, 'Analyzing task dependencies');
        return { step: step1(mode), maxCycles: noLimit ? Infinity : maxCycles };
    }

    // ATIVAR DAG EXECUTOR: Se já temos @dependencies definidas, usar execução paralela
    const taskGraph = buildTaskGraph();

    if (taskGraph) {
        // Verifica se algum dos steps 2, 3 ou 4 deve ser executado
        const shouldRunDAG = shouldRunStep(2) || shouldRunStep(3) || shouldRunStep(4);

        if (!shouldRunDAG) {
            logger.info('Steps 2-4 skipped (not in --steps list)');

            // Pula para step 5 se estiver na lista
            if (!fs.existsSync(path.join(state.folder, 'GITHUB_PR.md')) && shouldRunStep(5)) {
                logger.newline();
                logger.step(tasks.length, tasks.length, 5, 'Creating pull request and committing');
                await step5(tasks, shouldPush);
            }

            return { done: true };
        }

        // Todas as tasks têm dependências definidas, usar DAG executor
        logger.info('Switching to parallel execution mode with DAG executor');
        logger.newline();

        const executor = new DAGExecutor(taskGraph, allowedSteps, maxConcurrent);
        await executor.run();

        // Após DAG executor, criar PR final
        if (!fs.existsSync(path.join(state.folder, 'GITHUB_PR.md')) && shouldRunStep(5)) {
            logger.newline();
            logger.step(tasks.length, tasks.length, 5, 'Creating pull request and committing');
            await step5(tasks, shouldPush);
        }

        logger.success('All tasks completed!');
        return { done: true };
    }

    // Fallback: Se o grafo não pode ser construído (dependencies incompletas ou inválidas),
    // regenerar @dependencies executando step1
    logger.info('Dependency graph incomplete or invalid. Regenerating dependencies...');
    if (!shouldRunStep(1)) {
        logger.info('Step 1 skipped (not in --steps list)');
        return { done: true };
    }
    logger.newline();
    logger.step(tasks.length, tasks.length, 1, 'Analyzing task dependencies');
    return { step: step1(mode), maxCycles: noLimit ? Infinity : maxCycles };
}

/**
 * Constrói o grafo de tasks lendo as dependências de cada TASK.md
 * @returns {Object|null} Grafo de tasks { TASK1: {deps: [], status: 'pending'}, ... } ou null se não houver @dependencies
 */
const buildTaskGraph = () => {
    if (!fs.existsSync(state.claudiomiroFolder)) {
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

    const graph = {};
    let hasAnyDependencyTag = false;

    for (const task of tasks) {
        const taskMdPath = path.join(state.claudiomiroFolder, task, 'TASK.md');

        if (!fs.existsSync(taskMdPath)) {
            // Task sem TASK.md ainda, não pode construir grafo
            return null;
        }

        const taskMd = fs.readFileSync(taskMdPath, 'utf-8');

        // Parse @dependencies do arquivo (primeira linha)
        // Formato: @dependencies [TASK1, TASK2] ou @dependencies []
        const depsMatch = taskMd.match(/@dependencies\s*\[(.*?)\]/);

        if (!depsMatch) {
            // Se alguma task não tem @dependencies, grafo incompleto
            return null;
        }

        hasAnyDependencyTag = true;

        const deps = depsMatch[1].split(',').map(d => d.trim()).filter(Boolean);

        graph[task] = {
            deps,
            status: fs.existsSync(path.join(state.claudiomiroFolder, task, 'GITHUB_PR.md'))
                ? 'completed'
                : 'pending'
        };
    }

    // Retorna o grafo se todas as tasks têm @dependencies
    return hasAnyDependencyTag ? graph : null;
}

const init = async () => {
    logger.banner();

    // Inicializa o state.folder antes de usá-lo
    const args = process.argv.slice(2).filter(arg => arg !== '--fresh' && !arg.startsWith('--push') && arg !== '--same-branch' && !arg.startsWith('--prompt') && !arg.startsWith('--maxCycles') && !arg.startsWith('--maxConcurrent') && arg !== '--no-limit' && !arg.startsWith('--mode'));
    const folderArg = args[0] || process.cwd();
    state.setFolder(folderArg);

    if(fs.existsSync(path.join(state.folder, 'GITHUB_PR.md'))){
        startFresh();
    }

    const noLimit = process.argv.includes('--no-limit');

    let i = 0;
    let maxCycles = noLimit ? Infinity : 100;

    while(i < maxCycles){
        const result = await chooseAction(i);

        // Se retornou { done: true }, significa que completou via DAG executor
        if (result && result.done) {
            return;
        }

        // Atualiza maxCycles se necessário
        if (result && result.maxCycles) {
            maxCycles = result.maxCycles;
        }

        // Executa step se retornado
        if (result && result.step) {
            await result.step;
        }

        i++;
    }

    logger.error(`Maximum iteration limit reached (${maxCycles} cycles)`);
    logger.box(`The agent has completed ${maxCycles} cycles. Please review the progress and restart if needed.`, {
        borderColor: 'yellow',
        title: 'Limit Reached'
    });
}

module.exports = { init };
