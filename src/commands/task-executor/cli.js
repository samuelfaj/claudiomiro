const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { startFresh } = require('./services/file-manager');
const { step0, step1, step2, step3, step7, step8 } = require('./steps');
const { DAGExecutor } = require('./services/dag-executor');
const { isFullyImplemented, hasApprovedCodeReview } = require('./utils/validation');
const { detectGitConfiguration } = require('../../shared/services/git-detector');
const { getMultilineInput, getSimpleInput } = require('../../shared/services/prompt-reader');
const { createBranches, getCurrentBranch } = require('../../shared/services/git-manager');

// Note: This uses the sync version (heuristic-based) for building the initial task graph.
// The async version with Local LLM support is used in dag-executor.js for critical execution checks.
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

// Function to find all subtasks of a main task
function findSubtasks(mainTask, allTasks) {
    return allTasks.filter(task => {
        // Check if the current task is a subtask of mainTask
        // Ex: TASK2.1 is subtask of TASK2, TASK2.1.1 is subtask of TASK2.1
        return task.startsWith(mainTask + '.') &&
            task.slice(mainTask.length + 1).match(/^\d+(\.\d+)*$/);
    });
}

const chooseAction = async (i, args) => {
    // Check if --continue was passed (to continue after answering clarification questions)
    const continueFlag = args.includes('--continue');

    // Check if --prompt was passed and extract the value
    const promptArg = args.find(arg => arg.startsWith('--prompt='));
    const promptText = promptArg ? promptArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : null;

    // Check if --backend and --frontend were passed for multi-repo mode
    const backendArg = args.find(arg => arg.startsWith('--backend='));
    const frontendArg = args.find(arg => arg.startsWith('--frontend='));

    // Check if --fresh was passed
    // IMPORTANT: --continue should not activate --fresh
    // IMPORTANT: --prompt should NOT automatically activate --fresh (user must explicitly use --fresh if they want to start fresh)
    const shouldStartFresh = !continueFlag && args.includes('--fresh');

    // Check if --push=false was passed
    const shouldPush = !args.some(arg => arg === '--push=false');

    // Check if --same-branch was passed
    const sameBranch = args.includes('--same-branch');

    // Check if --no-limit was passed
    const noLimit = args.includes('--no-limit');

    // Check if --limit was passed
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

    // Check if --codex or --claude was passed
    const codexFlag = args.includes('--codex');
    const deepSeekFlag = args.includes('--deep-seek');
    const glmFlag = args.includes('--glm');
    const gemini = args.includes('--gemini');

    let executorType = 'claude';

    if (codexFlag) {
        executorType = 'codex';
    }

    if (deepSeekFlag) {
        executorType = 'deep-seek';
    }

    if (glmFlag) {
        executorType = 'glm';
    }

    if (gemini) {
        executorType = 'gemini';
    }

    state.setExecutorType(executorType);

    // Check if --steps= or --step= was passed (which steps to execute)
    const stepsArg = args.find(arg => arg.startsWith('--steps=') || arg.startsWith('--step='));
    const _allowedSteps = stepsArg
        ? stepsArg.split('=')[1].split(',').map(s => parseInt(s.trim(), 10))
        : null; // null = execute all steps

    // Check if --maxConcurrent was passed
    const maxConcurrentArg = args.find(arg => arg.startsWith('--maxConcurrent='));
    const maxConcurrent = maxConcurrentArg ? parseInt(maxConcurrentArg.split('=')[1], 10) : null;

    // Helper to check if a step should be executed
    const shouldRunStep = (stepNumber) => {
        if (!_allowedSteps) return true; // If --steps was not passed, execute all
        return _allowedSteps.includes(stepNumber);
    };

    // Filter args to get only the directory
    const filteredArgs = args.filter(arg =>
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
        arg !== '--codex' &&
        arg !== '--claude' &&
        arg !== '--deep-seek' &&
        arg !== '--glm' &&
        arg !== '--gemini' &&
        !arg.startsWith('--backend=') &&
        !arg.startsWith('--frontend='),
    );
    const folderArg = filteredArgs[0] || process.cwd();

    // Resolve the absolute path and set the global variable
    state.setFolder(folderArg);

    // Initialize cache folder for token optimization
    state.initializeCache();

    // Configure multi-repo mode if both --backend and --frontend are provided
    if (backendArg && frontendArg) {
        const backendPath = backendArg.split('=').slice(1).join('=');
        const frontendPath = frontendArg.split('=').slice(1).join('=');

        // Validate paths exist
        if (!fs.existsSync(backendPath)) {
            logger.error(`Backend path does not exist: ${backendPath}`);
            process.exit(1);
        }
        if (!fs.existsSync(frontendPath)) {
            logger.error(`Frontend path does not exist: ${frontendPath}`);
            process.exit(1);
        }

        // Detect git configuration (may throw if paths are not in git repos)
        try {
            const gitConfig = detectGitConfiguration(backendPath, frontendPath);
            state.setMultiRepo(backendPath, frontendPath, gitConfig);

            // Persist configuration across all relevant workspaces
            const configPayload = {
                enabled: true,
                mode: gitConfig.mode,
                repositories: {
                    backend: path.resolve(backendPath),
                    frontend: path.resolve(frontendPath),
                },
                gitRoots: gitConfig.gitRoots,
            };

            const candidateDirs = new Set();
            const addDir = (dirPath) => {
                if (!dirPath) {
                    return;
                }
                const resolvedDir = path.resolve(dirPath);
                candidateDirs.add(resolvedDir);
            };

            addDir(state.workspaceClaudiomiroFolder);
            addDir(state.claudiomiroFolder);
            addDir(path.join(path.resolve(backendPath), '.claudiomiro', 'task-executor'));
            addDir(path.join(path.resolve(frontendPath), '.claudiomiro', 'task-executor'));

            const configString = JSON.stringify(configPayload, null, 2);

            for (const dir of candidateDirs) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(path.join(dir, 'multi-repo.json'), configString);
                } catch (error) {
                    logger.warning?.(`Failed to persist multi-repo configuration to ${dir}: ${error.message}`);
                }
            }

            logger.info(`Multi-repo mode: ${gitConfig.mode}`);
            logger.info(`Backend: ${backendPath}`);
            logger.info(`Frontend: ${frontendPath}`);
        } catch (error) {
            logger.error(`Invalid git configuration: ${error.message}`);
            logger.error('Ensure both paths are inside git repositories');
            process.exit(1);
        }
    }

    if (!fs.existsSync(state.folder)) {
        logger.error(`Folder does not exist: ${state.folder}`);
        process.exit(1);
    }

    logger.path(`Working directory: ${state.folder}`);
    logger.newline();

    logger.info(`Executor selected: ${executorType}`);
    logger.newline();

    // Show which steps will be executed if --steps was specified
    if (_allowedSteps && i === 0) {
        logger.info(`Running only steps: ${_allowedSteps.join(', ')}`);
        logger.newline();
    }

    // Handle --continue flag (resuming after clarification)
    if (continueFlag && i === 0) {
        // Load multi-repo config if exists (restore multi-repo mode on continue)
        const resolveMultiRepoConfigPath = () => {
            const visited = new Set();
            const candidates = [];

            const addCandidate = (filePath) => {
                if (!filePath) return;
                const resolved = path.resolve(filePath);
                if (visited.has(resolved)) return;
                visited.add(resolved);
                candidates.push(resolved);
            };

            // Current workspace-first storage (.claudiomiro/task-executor/multi-repo.json)
            addCandidate(state.workspaceClaudiomiroFolder && path.join(state.workspaceClaudiomiroFolder, 'multi-repo.json'));
            addCandidate(state.claudiomiroFolder && path.join(state.claudiomiroFolder, 'multi-repo.json'));

            // Legacy storage (.claudiomiro/multi-repo.json) for backward compatibility
            addCandidate(state.workspaceClaudiomiroRoot && path.join(state.workspaceClaudiomiroRoot, 'multi-repo.json'));
            addCandidate(state.claudiomiroRoot && path.join(state.claudiomiroRoot, 'multi-repo.json'));

            const migrateIfNeeded = (legacyPath) => {
                const preferredPath = state.workspaceClaudiomiroFolder
                    ? path.join(state.workspaceClaudiomiroFolder, 'multi-repo.json')
                    : (state.claudiomiroFolder ? path.join(state.claudiomiroFolder, 'multi-repo.json') : null);

                if (!preferredPath || preferredPath === legacyPath) {
                    return legacyPath;
                }

                try {
                    if (!fs.existsSync(preferredPath)) {
                        fs.mkdirSync(path.dirname(preferredPath), { recursive: true });
                        fs.copyFileSync(legacyPath, preferredPath);
                    }
                    return preferredPath;
                } catch {
                    // If migration fails, fall back to legacy location
                    return legacyPath;
                }
            };

            for (const candidate of candidates) {
                if (candidate && fs.existsSync(candidate)) {
                    const parentDir = path.basename(path.dirname(candidate));
                    if (parentDir === '.claudiomiro') {
                        return migrateIfNeeded(candidate);
                    }
                    return candidate;
                }
            }
            return null;
        };

        const multiRepoConfigPath = resolveMultiRepoConfigPath();
        if (multiRepoConfigPath) {
            try {
                const config = JSON.parse(fs.readFileSync(multiRepoConfigPath, 'utf-8'));
                if (config.enabled) {
                    const gitConfig = { mode: config.mode, gitRoots: config.gitRoots };
                    state.setMultiRepo(config.repositories.backend, config.repositories.frontend, gitConfig);
                    logger.info(`Restored multi-repo mode: ${config.mode}`);
                }
            } catch {
                // Invalid JSON, continue as single-repo mode
                logger.warning('Invalid multi-repo.json, continuing as single-repo mode');
            }
        }

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

    if (shouldStartFresh && i === 0) {
        if (fs.existsSync(state.claudiomiroFolder)) {
            if (!fs.existsSync(path.join(state.claudiomiroFolder, 'done.txt'))) {
                // last execution not finished, user need to confirm
                const confirm = await logger.confirm(`It seems the last execution in ${state.claudiomiroFolder} was not finished. Starting fresh will delete this folder and all its contents. Do you want to continue?`);
                if (!confirm) {
                    logger.info('Operation cancelled by user.');
                    process.exit(0);
                }
            }
        }

        startFresh();
    }

    // STEP 0: Create all tasks (TASK.md + PROMPT.md)
    if (!fs.existsSync(state.claudiomiroFolder)) {
        if (!shouldRunStep(0)) {
            logger.info('Step 0 skipped (not in --steps list)');
            return { done: true };
        }

        // New Task: Ask for details here
        const task = promptText || await getMultilineInput();

        if (!task || task.trim().length < 10) {
            logger.error('Please provide more details (at least 10 characters)');
            process.exit(0);
        }

        if (!sameBranch) {
            const currentBranch = getCurrentBranch();
            const promptMessage = currentBranch
                ? `Branch name (press Enter to use current branch "${currentBranch}"): `
                : 'Branch name (press Enter to use current branch): ';

            const userBranchName = await getSimpleInput(promptMessage);

            // Only create a new branch if user entered something
            if (userBranchName.trim()) {
                createBranches(userBranchName.trim());
            } else {
                logger.info(`Using current branch: ${currentBranch || '(default)'}`);
            }
        }

        return { step: step0(sameBranch, task) };
    }

    const tasks = fs
        .readdirSync(state.claudiomiroFolder)
        .filter(name => {
            const fullPath = path.join(state.claudiomiroFolder, name);
            // Only include task folders (TASK0, TASK1, etc.), exclude cache and other directories
            return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
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

        // New Task (folder exists but empty/invalid): Ask for details here
        const task = promptText || await getMultilineInput();

        if (!task || task.trim().length < 10) {
            logger.error('Please provide more details (at least 10 characters)');
            process.exit(0);
        }

        if (!sameBranch) {
            const currentBranch = getCurrentBranch();
            const promptMessage = currentBranch
                ? `Branch name (press Enter to use current branch "${currentBranch}"): `
                : 'Branch name (press Enter to use current branch): ';

            const userBranchName = await getSimpleInput(promptMessage);

            // Only create a new branch if user entered something
            if (userBranchName.trim()) {
                createBranches(userBranchName.trim());
            } else {
                logger.info(`Using current branch: ${currentBranch || '(default)'}`);
            }
        }

        return { step: step0(sameBranch, task) };
    }

    // ACTIVATE DAG EXECUTOR: If we already have @dependencies defined, use parallel execution
    let taskGraph = buildTaskGraph();

    if (!allHasTodo()) {
        const shouldRunDAG = shouldRunStep(4);

        if (!shouldRunDAG) {
            // Run step 7 if needed (before step 8)
            if (shouldRunStep(7) && !hasCriticalReviewPassed()) {
                logger.newline();
                logger.info('Running Step 7: Critical Bug Sweep (global)...');

                try {
                    const maxIterations = noLimit ? Infinity : maxAttemptsPerTask;
                    await step7(maxIterations);
                    logger.success('Step 7 completed - No critical bugs found');
                } catch (error) {
                    logger.newline();
                    logger.error('STEP 7 FAILED: Critical bugs remain after maximum iterations');
                    logger.error('');

                    const bugsPath = path.join(state.claudiomiroFolder, 'BUGS.md');
                    if (fs.existsSync(bugsPath)) {
                        logger.error('Check the following file for details:');
                        logger.error(`   ${bugsPath}`);
                        logger.error('');
                        logger.error('Next steps:');
                        logger.error('   1. Review BUGS.md to see which critical bugs were found');
                        logger.error('   2. Fix the bugs manually');
                        logger.error('   3. Run Claudiomiro again to verify fixes');
                    } else {
                        logger.error('BUGS.md was not created by the analysis.');
                        logger.error('');
                        logger.error('This could mean:');
                        logger.error('   1. Claude failed to execute properly during the bug sweep');
                        logger.error('   2. There was an issue with the analysis prompt or git diff');
                        logger.error('   3. The AI could not complete the analysis within the iteration limit');
                        logger.error('');
                        const logPath = path.join(state.claudiomiroRoot, 'log.txt');
                        if (fs.existsSync(logPath)) {
                            logger.error('Check Claude execution log for details:');
                            logger.error(`   ${logPath}`);
                            logger.error('');
                        }
                        logger.error('Next steps:');
                        logger.error('   1. Check the log.txt file above to see Claude output');
                        logger.error('   2. Check git diff manually: git diff main...HEAD');
                        logger.error('   3. Run Claudiomiro again with --debug flag for more details');
                    }
                    logger.newline();
                    process.exit(1);
                }
            }

            if (shouldRunStep(8)) {
                const criticalReviewPassed = hasCriticalReviewPassed();

                if (!criticalReviewPassed && !shouldRunStep(7)) {
                    logger.warning('Step 7 (Critical Bug Sweep) was skipped via --steps flag');
                    logger.warning('Proceeding to Step 8 WITHOUT critical bug validation');
                    logger.warning('This may introduce production bugs. Use at your own risk.');
                    logger.newline();
                }

                if (criticalReviewPassed || !shouldRunStep(7)) {
                    logger.newline();
                    logger.step(tasks.length, tasks.length, 8, 'Finalizing review and committing');
                    await step8(tasks, shouldPush);
                } else {
                    logger.error('Cannot proceed to Step 8: Critical review has not passed');
                    logger.info('Run step 7 first to perform critical bug sweep');
                }
            }
            return { done: true };
        }

        if (!taskGraph) {
            // Step 3 hasn't run yet - run it to create dependencies
            if (!shouldRunStep(3)) {
                logger.error('Cannot proceed: no dependency graph. Run step 3 first.');
                process.exit(1);
            }

            logger.newline();
            logger.startSpinner('Analyzing task dependencies...');
            await step3();
            logger.stopSpinner();

            // Rebuild task graph after step 3
            taskGraph = buildTaskGraph();

            if (!taskGraph) {
                logger.error('Failed to create dependency graph after step 3.');
                process.exit(1);
            }
        }

        const executor = new DAGExecutor(taskGraph, _allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);
        await executor.runStep2();
    }

    taskGraph = buildTaskGraph();

    if (taskGraph) {
        // Check if any of steps 4, 5 or 6 should be executed
        const shouldRunDAG = shouldRunStep(4) || shouldRunStep(5) || shouldRunStep(6);

        if (!shouldRunDAG) {
            logger.info('Steps 4-6 skipped (not in --steps list)');

            // Run step 7 if needed (before step 8)
            // NOTE: Step 7 analyzes ALL code changes globally, not individual tasks
            // So it runs even if tasks are not approved yet
            if (shouldRunStep(7) && !hasCriticalReviewPassed()) {
                logger.newline();
                logger.info('Running Step 7: Critical Bug Sweep (global)...');

                try {
                    const maxIterations = noLimit ? Infinity : maxAttemptsPerTask;
                    await step7(maxIterations);
                    logger.success('Step 7 completed - No critical bugs found');
                } catch (error) {
                    logger.newline();
                    logger.error('STEP 7 FAILED: Critical bugs remain after maximum iterations');
                    logger.error('');

                    const bugsPath = path.join(state.claudiomiroFolder, 'BUGS.md');
                    if (fs.existsSync(bugsPath)) {
                        logger.error('Check the following file for details:');
                        logger.error(`   ${bugsPath}`);
                        logger.error('');
                        logger.error('Next steps:');
                        logger.error('   1. Review BUGS.md to see which critical bugs were found');
                        logger.error('   2. Fix the bugs manually');
                        logger.error('   3. Run Claudiomiro again to verify fixes');
                    } else {
                        logger.error('BUGS.md was not created by the analysis.');
                        logger.error('');
                        logger.error('This could mean:');
                        logger.error('   1. Claude failed to execute properly during the bug sweep');
                        logger.error('   2. There was an issue with the analysis prompt or git diff');
                        logger.error('   3. The AI could not complete the analysis within the iteration limit');
                        logger.error('');
                        const logPath = path.join(state.claudiomiroRoot, 'log.txt');
                        if (fs.existsSync(logPath)) {
                            logger.error('Check Claude execution log for details:');
                            logger.error(`   ${logPath}`);
                            logger.error('');
                        }
                        logger.error('Next steps:');
                        logger.error('   1. Check the log.txt file above to see Claude output');
                        logger.error('   2. Check git diff manually: git diff main...HEAD');
                        logger.error('   3. Run Claudiomiro again with --debug flag for more details');
                    }
                    logger.newline();
                    process.exit(1);
                }
            }

            // Skip to step 8 if it's in the list
            const allTasksApproved = tasks.every(isTaskApproved);
            const criticalReviewPassed = hasCriticalReviewPassed();

            if (!criticalReviewPassed && !shouldRunStep(7)) {
                logger.warning('Step 7 (Critical Bug Sweep) was skipped via --steps flag');
                logger.warning('Proceeding to Step 8 WITHOUT critical bug validation');
                logger.warning('This may introduce production bugs. Use at your own risk.');
                logger.newline();
            }

            if (shouldRunStep(8) && allTasksApproved && (criticalReviewPassed || !shouldRunStep(7))) {
                logger.newline();
                logger.step(tasks.length, tasks.length, 8, 'Finalizing review and committing');
                await step8(tasks, shouldPush);
            } else if (shouldRunStep(8) && !criticalReviewPassed) {
                logger.error('Cannot proceed to Step 8: Critical review has not passed');
                logger.info('Run step 7 first to perform critical bug sweep');
            }

            return { done: true };
        }

        // All tasks have dependencies defined, use DAG executor
        logger.info('Switching to parallel execution mode with DAG executor');
        logger.newline();

        const executor = new DAGExecutor(taskGraph, _allowedSteps, maxConcurrent, noLimit, maxAttemptsPerTask);

        try {
            await executor.run(buildTaskGraph);
        } catch (error) {
            // If DAG executor failed (including step7), stop execution
            logger.newline();
            logger.error('Execution failed. Please check the errors above.');
            process.exit(1);
        }

        if (fs.existsSync(path.join(state.claudiomiroFolder, 'done.txt'))) {
            logger.info(`Claudiomiro has been successfully executed. Check out: ${state.folder}`);
            process.exit(0);
        }

        // After DAG executor, create final PR
        const allTasksApproved = tasks.every(isTaskApproved);
        const criticalReviewPassed = hasCriticalReviewPassed();

        if (!criticalReviewPassed && !shouldRunStep(7)) {
            logger.warning('Step 7 (Critical Bug Sweep) was skipped via --steps flag');
            logger.warning('Proceeding to Step 8 WITHOUT critical bug validation');
            logger.warning('This may introduce production bugs. Use at your own risk.');
            logger.newline();
        }

        if (shouldRunStep(8) && allTasksApproved && (criticalReviewPassed || !shouldRunStep(7))) {
            logger.newline();
            logger.step(tasks.length, tasks.length, 8, 'Finalizing review and committing');
            await step8(tasks, shouldPush);
        } else if (shouldRunStep(8) && !criticalReviewPassed) {
            logger.error('Cannot proceed to Step 8: Critical review has not passed');
            logger.info('CRITICAL_REVIEW_PASSED.md not found - Step 7 may have failed or not completed');
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
};

const allHasTodo = () => {
    if (!fs.existsSync(state.claudiomiroFolder)) {
        return null;
    }

    const tasks = fs
        .readdirSync(state.claudiomiroFolder)
        .filter(name => {
            const fullPath = path.join(state.claudiomiroFolder, name);
            // Only include task folders (TASK0, TASK1, etc.), exclude cache and other directories
            return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (tasks.length === 0) {
        return null;
    }

    for (const task of tasks) {
        if (!fs.existsSync(path.join(state.claudiomiroFolder, task, 'TODO.md'))) {
            return false;
        }

        if (!fs.existsSync(path.join(state.claudiomiroFolder, task, 'split.txt'))) {
            return false;
        }
    }

    return true;
};

/**
 * Builds the task graph by reading dependencies from each TASK.md
 * @returns {Object|null} Task graph { TASK1: {deps: [], status: 'pending'}, ... } or null if no @dependencies
 */
const buildTaskGraph = () => {
    if (!fs.existsSync(state.claudiomiroFolder)) {
        return null;
    }

    const tasks = fs
        .readdirSync(state.claudiomiroFolder)
        .filter(name => {
            const fullPath = path.join(state.claudiomiroFolder, name);
            // Only include task folders (TASK0, TASK1, etc.), exclude cache and other directories
            return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
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
            // Task without TASK.md yet, cannot build graph
            return null;
        }
        const taskMd = fs.readFileSync(taskMdPath, 'utf-8');

        // Find the first @dependencies line anywhere in the file.
        // Matches either:
        //   @dependencies [TASK1, TASK2, TASK3]
        // or
        //   @dependencies TASK1, TASK2, TASK3
        const depsMatch = taskMd.match(
            /^\s*@dependencies\s*(?:\[(.*?)\]|(.+))\s*$/mi,
        );

        if (!depsMatch) {
            // No @dependencies line -> incomplete graph
            return null;
        }

        hasAnyDependencyTag = true;

        // Prefer the content inside [...] if present (group 1), otherwise the free-form tail (group 2)
        const raw = (depsMatch[1] ?? depsMatch[2] ?? '').trim();

        // Allow empty: "@dependencies []" or "@dependencies" (if you want to permit it)
        const deps = raw
            ? raw.split(',').filter(s => (s || '').toLowerCase() != 'none').map(s => s.trim()).filter(Boolean)
            : [];

        // Optional: dedupe and prevent self-dependency
        const uniqueDeps = Array.from(new Set(deps)).filter(d => d !== task);

        // Add all subtasks of dependencies
        const allDepsWithSubtasks = [];
        for (const dep of uniqueDeps) {
            const subtasks = findSubtasks(dep, tasks);
            allDepsWithSubtasks.push(...subtasks);

            if (fs.existsSync(path.join(state.claudiomiroFolder, dep))) {
                allDepsWithSubtasks.push(dep);
            }
        }

        // Remove duplicates and prevent self-dependency again
        const finalDeps = Array.from(new Set(allDepsWithSubtasks)).filter(d => d !== task);

        graph[task] = {
            deps: finalDeps,
            status: isTaskApproved(task) ? 'completed' : 'pending',
        };
    }

    // Return the graph if all tasks have @dependencies
    return hasAnyDependencyTag ? graph : null;
};

const init = async (args) => {
    // Initialize state.folder before using it
    const filteredArgs = (args || []).filter(arg =>
        arg !== '--fresh' &&
        !arg.startsWith('--push') &&
        arg !== '--same-branch' &&
        !arg.startsWith('--prompt') &&
        !arg.startsWith('--maxConcurrent') &&
        arg !== '--no-limit' &&
        !arg.startsWith('--limit=') &&
        !arg.startsWith('--backend=') &&
        !arg.startsWith('--frontend='),
    );
    const folderArg = filteredArgs[0] || process.cwd();
    state.setFolder(folderArg);

    // Initialize cache folder for token optimization
    state.initializeCache();

    // Execute chooseAction until complete
    // Step 0 -> Step 1 -> Step 2 -> Step 3 -> DAGExecutor (with maxAttempts=20 PER TASK) -> Step 7
    // Maximum ~3-4 iterations in the main loop
    let i = 0;
    while (true) {
        const result = await chooseAction(i, args || []);

        // If returned { done: true }, finished
        if (result && result.done) {
            return;
        }

        // Execute step if returned (step0 or step1)
        if (result && result.step) {
            await result.step;
        }

        i++;
    }
};

module.exports = { init };
