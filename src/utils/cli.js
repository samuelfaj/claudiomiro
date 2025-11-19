const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const state = require('../config/state');
const { startFresh } = require('../services/file-manager');
const { step0, step1, step2, step3, step4, step5, step6, step7, step8 } = require('../steps');
const { DAGExecutor } = require('../services/dag-executor');
const { isFullyImplemented, hasApprovedCodeReview } = require('./validation');
const { fixCommand } = require('../services/fix-command');
const { checkForUpdatesAsync } = require('./auto-update');

const isTaskApproved = (taskName) => {
    if (!state.claudiomiroFolder) {
        return false;
    }

    const taskFolder = path.join(state.claudiomiroFolder, taskName);
    const todoPath = path.join(taskFolder, 'TODO.md');
    const codeReviewPath = path.join(taskFolder, 'CODE_REVIEW.md');

    if (!fs.existsSync(todoPath)) {
        return false;
    }

    if (!isFullyImplemented(todoPath)) {
        return false;
    }

    return hasApprovedCodeReview(codeReviewPath);
};

const hasCriticalReviewPassed = () => {
    if (!state.claudiomiroFolder) {
        return false;
    }

    const criticalReviewPassedPath = path.join(state.claudiomiroFolder, 'CRITICAL_REVIEW_PASSED.md');
    return fs.existsSync(criticalReviewPassedPath);
};

// Função para encontrar todas as subtasks de uma task principal
function findSubtasks(mainTask, allTasks) {
    return allTasks.filter(task => {
        // Verifica se a task atual é uma subtask da mainTask
        // Ex: TASK2.1 é subtask de TASK2, TASK2.1.1 é subtask de TASK2.1
        return task.startsWith(mainTask + '.') &&
               task.slice(mainTask.length + 1).match(/^\d+(\.\d+)*$/);
    });
}

const chooseAction = async (i) => {
    // Verifica se --continue foi passado (para continuar após responder perguntas de clarificação)
    const continueFlag = process.argv.includes('--continue');

    // Verifica se --prompt foi passado e extrai o valor
    const promptArg = process.argv.find(arg => arg.startsWith('--prompt='));
    const promptText = promptArg ? promptArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : null;


    // Verifica se --fresh foi passado (ou se --prompt foi usado, que automaticamente ativa --fresh)
    // IMPORTANTE: --continue não deve ativar --fresh
    const shouldStartFresh = !continueFlag && (process.argv.includes('--fresh') || promptText !== null);

    // Verifica se --push=false foi passado
    const shouldPush = !process.argv.some(arg => arg === '--push=false');

    // Verifica se --same-branch foi passado
    const sameBranch = process.argv.includes('--same-branch');

    // Verifica se --no-limit foi passado
    const noLimit = process.argv.includes('--no-limit');

    // Verifica se --limit foi passado
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

    // Verifica se --fix-command foi passado
    const fixCommandArg = process.argv.find(arg => arg.startsWith('--fix-command='));
    const fixCommandText = fixCommandArg ? fixCommandArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : null;

    // Verifica se --codex ou --claude foi passado
    const codexFlag = process.argv.includes('--codex');
    const claudeFlag = process.argv.includes('--claude');
    const deepSeekFlag = process.argv.includes('--deep-seek');
    const glmFlag = process.argv.includes('--glm');
    const gemini = process.argv.includes('--gemini');

    let executorType = 'claude';

    if(codexFlag){
        executorType = 'codex'
    }

    if(deepSeekFlag){
        executorType = 'deep-seek'
    }

    if(glmFlag){
        executorType = 'glm'
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
    const shouldRunStep = (stepNumber) => {
        if (!allowedSteps) return true; // Se --steps não foi passado, executa tudo
        return allowedSteps.includes(stepNumber);
    };

    // Filtra os argumentos para pegar apenas o diretório
    const args = process.argv.slice(2).filter(arg =>
        arg !== '--fresh' &&
        arg !== '--continue' &&
        !arg.startsWith('--push') &&
        arg !== '--same-branch' &&
        !arg.startsWith('--prompt') &&
        !arg.startsWith('--maxConcurrent') &&
        !arg.startsWith('--steps') &&
        !arg.startsWith('--step=') &&
        arg !== '--no-limit' &&
        !arg.startsWith('--limit=') &&
        !arg.startsWith('--fix-command=') &&
        arg !== '--codex' &&
        arg !== '--claude' &&
        arg !== '--deep-seek' &&
        arg !== '--glm' &&
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

    logger.info(`Executor selected: ${executorType}`);
    logger.newline();

    if(fixCommandArg){
        logger.info(`Fixing command: ${fixCommandText} (max attempts per task: ${noLimit ? 'no limit' : maxAttemptsPerTask})`);
        await fixCommand(fixCommandText, noLimit ? Infinity : maxAttemptsPerTask);
        process.exit(1);
    }

    // Mostra quais steps serão executados se --steps foi especificado
    if (allowedSteps && i === 0) {
        logger.info(`Running only steps: ${allowedSteps.join(', ')}`);
        logger.newline();
    }

    // Handle --continue flag (resuming after clarification)
    if (continueFlag && i === 0) {
        const pendingClarificationPath = path.join(state.claudiomiroFolder, 'PENDING_CLARIFICATION.flag');
        const clarificationAnswersPath = path.join(state.claudiomiroFolder, 'CLARIFICATION_ANSWERS.json');

        if (!fs.existsSync(pendingClarificationPath)) {
            logger.error('No pending clarification found. Use --continue only after answering CLARIFICATION_QUESTIONS.json');
            process.exit(1);
        }

        if (!fs.existsSync(clarificationAnswersPath)) {
            logger.error('Please create CLARIFICATION_ANSWERS.json with your responses before continuing.');
            logger.info(`Expected location: ${clarificationAnswersPath}`);
            process.exit(1);
        }

        logger.info('Resuming from clarification phase...');
        logger.newline();

        // Continue with step0 - it will detect the answers and proceed to Phase 2
        return { step: step0(sameBranch, null) };
    }

    if(shouldStartFresh && i === 0){
        if(fs.existsSync(state.claudiomiroFolder)){
            if(!fs.existsSync(path.join(state.claudiomiroFolder, 'done.txt'))){
                // last execution not finished, user need to confirm
                const confirm = await logger.confirm(`It seems the last execution in ${state.claudiomiroFolder} was not finished. Starting fresh will delete this folder and all its contents. Do you want to continue?`);
                if(!confirm){
                    logger.info('Operation cancelled by user.');
                    process.exit(0);
                }
             }
        }

        startFresh();
    }

    // STEP 0: Criar todas as tasks (TASK.md + PROMPT.md)
    if(!fs.existsSync(state.claudiomiroFolder)){
        if (!shouldRunStep(0)) {
            logger.info('Step 0 skipped (not in --steps list)');
            return { done: true };
        }
        return { step: step0(sameBranch, promptText) };
    }

    const tasks = fs
    .readdirSync(state.claudiomiroFolder)
    .filter(name => {
        const fullPath = path.join(state.claudiomiroFolder, name);
        return fs.statSync(fullPath).isDirectory();
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (tasks.length === 0) {
        // Check if we need to run step1 (generate AI_PROMPT.md)
        const aiPromptPath = path.join(state.claudiomiroFolder, 'AI_PROMPT.md');
        const clarificationAnswersPath = path.join(state.claudiomiroFolder, 'CLARIFICATION_ANSWERS.json');

        // If clarification answers exist but no AI_PROMPT.md yet, run step1
        if (fs.existsSync(clarificationAnswersPath) && !fs.existsSync(aiPromptPath)) {
            if (!shouldRunStep(1)) {
                logger.info('Step 1 skipped (not in --steps list)');
                return { done: true };
            }
            return { step: step1(sameBranch) };
        }

        // If AI_PROMPT.md exists but no tasks yet, run step2
        if (fs.existsSync(aiPromptPath)) {
            if (!shouldRunStep(2)) {
                logger.info('Step 2 skipped (not in --steps list)');
                return { done: true };
            }
            return { step: step2() };
        }

        // Otherwise, run step0 (initial setup)
        if (!shouldRunStep(0)) {
            logger.info('Step 0 skipped (not in --steps list)');
            return { done: true };
        }

        return { step: step0(sameBranch, promptText) };
    }

    // ATIVAR DAG EXECUTOR: Se já temos @dependencies definidas, usar execução paralela
    let taskGraph = buildTaskGraph();

    if(!allHasTodo()){
        const shouldRunDAG = shouldRunStep(4);

        if(!shouldRunDAG){
            // Run step 7 if needed (before step 8)
            if (shouldRunStep(7) && !hasCriticalReviewPassed()) {
                logger.newline();
                logger.info('🔍 Running Step 7: Critical Bug Sweep (global)...');

                try {
                    const maxIterations = noLimit ? Infinity : maxAttemptsPerTask;
                    await step7(maxIterations);
                    logger.success('✅ Step 7 completed - No critical bugs found');
                } catch (error) {
                    logger.newline();
                    logger.error('❌ STEP 7 FAILED: Critical bugs remain after maximum iterations');
                    logger.error('');
                    logger.error('📋 Check the following file for details:');
                    logger.error(`   ${path.join(state.claudiomiroFolder, 'BUGS.md')}`);
                    logger.error('');
                    logger.error('💡 Next steps:');
                    logger.error('   1. Review BUGS.md to see which critical bugs were found');
                    logger.error('   2. Fix the bugs manually');
                    logger.error('   3. Run Claudiomiro again to verify fixes');
                    logger.newline();
                    process.exit(1);
                }
            }

            if (shouldRunStep(8)) {
                const criticalReviewPassed = hasCriticalReviewPassed();

                if (!criticalReviewPassed && !shouldRunStep(7)) {
                    logger.warning('⚠️  Step 7 (Critical Bug Sweep) was skipped via --steps flag');
                    logger.warning('⚠️  Proceeding to Step 8 WITHOUT critical bug validation');
                    logger.warning('⚠️  This may introduce production bugs. Use at your own risk.');
                    logger.newline();
                }

                if (criticalReviewPassed || !shouldRunStep(7)) {
                    logger.newline();
                    logger.step(tasks.length, tasks.length, 8, 'Finalizing review and committing');
                    await step8(tasks, shouldPush);
                } else {
                    logger.error('❌ Cannot proceed to Step 8: Critical review has not passed');
                    logger.info('💡 Run step 7 first to perform critical bug sweep');
                }
            }
            return { done: true };
        }

        if (!taskGraph) {
            logger.error('Cannot proceed: no dependency graph. Run step 3 first.');
            process.exit(1);
        }

        const executor = new DAGExecutor(taskGraph, allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);
        await executor.runStep2();
    }

    taskGraph = buildTaskGraph();

    if (taskGraph) {
        // Verifica se algum dos steps 4, 5 ou 6 deve ser executado
        const shouldRunDAG = shouldRunStep(4) || shouldRunStep(5) || shouldRunStep(6);

        if (!shouldRunDAG) {
            logger.info('Steps 4-6 skipped (not in --steps list)');

            // Run step 7 if needed (before step 8)
            // NOTE: Step 7 analyzes ALL code changes globally, not individual tasks
            // So it runs even if tasks are not approved yet
            if (shouldRunStep(7) && !hasCriticalReviewPassed()) {
                logger.newline();
                logger.info('🔍 Running Step 7: Critical Bug Sweep (global)...');

                try {
                    const maxIterations = noLimit ? Infinity : maxAttemptsPerTask;
                    await step7(maxIterations);
                    logger.success('✅ Step 7 completed - No critical bugs found');
                } catch (error) {
                    logger.newline();
                    logger.error('❌ STEP 7 FAILED: Critical bugs remain after maximum iterations');
                    logger.error('');
                    logger.error('📋 Check the following file for details:');
                    logger.error(`   ${path.join(state.claudiomiroFolder, 'BUGS.md')}`);
                    logger.error('');
                    logger.error('💡 Next steps:');
                    logger.error('   1. Review BUGS.md to see which critical bugs were found');
                    logger.error('   2. Fix the bugs manually');
                    logger.error('   3. Run Claudiomiro again to verify fixes');
                    logger.newline();
                    process.exit(1);
                }
            }

            // Pula para step 8 se estiver na lista
            const allTasksApproved = tasks.every(isTaskApproved);
            const criticalReviewPassed = hasCriticalReviewPassed();

            if (!criticalReviewPassed && !shouldRunStep(7)) {
                logger.warning('⚠️  Step 7 (Critical Bug Sweep) was skipped via --steps flag');
                logger.warning('⚠️  Proceeding to Step 8 WITHOUT critical bug validation');
                logger.warning('⚠️  This may introduce production bugs. Use at your own risk.');
                logger.newline();
            }

            if (shouldRunStep(8) && allTasksApproved && (criticalReviewPassed || !shouldRunStep(7))) {
                logger.newline();
                logger.step(tasks.length, tasks.length, 8, 'Finalizing review and committing');
                await step8(tasks, shouldPush);
            } else if (shouldRunStep(8) && !criticalReviewPassed) {
                logger.error('❌ Cannot proceed to Step 8: Critical review has not passed');
                logger.info('💡 Run step 7 first to perform critical bug sweep');
            }

            return { done: true };
        }

        // Todas as tasks têm dependências definidas, usar DAG executor
        logger.info('Switching to parallel execution mode with DAG executor');
        logger.newline();

        const executor = new DAGExecutor(taskGraph, allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);

        try {
            await executor.run(buildTaskGraph);
        } catch (error) {
            // Se o DAG executor falhou (incluindo step7), parar execução
            logger.newline();
            logger.error('❌ Execution failed. Please check the errors above.');
            process.exit(1);
        }

        if(fs.existsSync(path.join(state.claudiomiroFolder, 'done.txt'))){
            logger.info(`✅ Claudiomiro has been successfully executed. Check out: ${state.folder}`);
            process.exit(0);
        }

        // Após DAG executor, criar PR final
        const allTasksApproved = tasks.every(isTaskApproved);
        const criticalReviewPassed = hasCriticalReviewPassed();

        if (!criticalReviewPassed && !shouldRunStep(7)) {
            logger.warning('⚠️  Step 7 (Critical Bug Sweep) was skipped via --steps flag');
            logger.warning('⚠️  Proceeding to Step 8 WITHOUT critical bug validation');
            logger.warning('⚠️  This may introduce production bugs. Use at your own risk.');
            logger.newline();
        }

        if (shouldRunStep(8) && allTasksApproved && (criticalReviewPassed || !shouldRunStep(7))) {
            logger.newline();
            logger.step(tasks.length, tasks.length, 8, 'Finalizing review and committing');
            await step8(tasks, shouldPush);
        } else if (shouldRunStep(8) && !criticalReviewPassed) {
            logger.error('❌ Cannot proceed to Step 8: Critical review has not passed');
            logger.info('💡 CRITICAL_REVIEW_PASSED.md not found - Step 7 may have failed or not completed');
        }

        logger.success('All tasks completed!');
        return { done: true };
    } else {
        if (!shouldRunStep(3)) {
            logger.error('Cannot proceed: no dependency graph. Run step 3 first.');
            process.exit(1);
        }

        logger.newline();
        logger.startSpinner('Analyzing task dependencies...');
        return { step: step3() };
    }
}

const allHasTodo = () => {
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

        // Adiciona todas as subtasks das dependências
        const allDepsWithSubtasks = [];
        for (const dep of uniqueDeps) {
            const subtasks = findSubtasks(dep, tasks);
            allDepsWithSubtasks.push(...subtasks);

            if(fs.existsSync(path.join(state.claudiomiroFolder, dep))){
                allDepsWithSubtasks.push(dep);
            }
        }

        // Remove duplicatas e previne auto-dependencia novamente
        const finalDeps = Array.from(new Set(allDepsWithSubtasks)).filter(d => d !== task);

        graph[task] = {
          deps: finalDeps,
          status: isTaskApproved(task) ? 'completed' : 'pending',
        };
    }

    // Retorna o grafo se todas as tasks têm @dependencies
    return hasAnyDependencyTag ? graph : null;
}

const init = async () => {
    logger.banner();

    // Verifica atualizações de forma assíncrona (não bloqueia a execução)
    checkForUpdatesAsync('claudiomiro');

    // Inicializa o state.folder antes de usá-lo
    const args = process.argv.slice(2).filter(arg => arg !== '--fresh' && !arg.startsWith('--push') && arg !== '--same-branch' && !arg.startsWith('--prompt') && !arg.startsWith('--maxConcurrent') && arg !== '--no-limit' && !arg.startsWith('--limit='));
    const folderArg = args[0] || process.cwd();
    state.setFolder(folderArg);

    // Executa chooseAction até completar
    // Step 0 → Step 1 → Step 2 → Step 3 → DAGExecutor (com maxAttempts=20 POR TAREFA) → Step 7
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

module.exports = { init };
