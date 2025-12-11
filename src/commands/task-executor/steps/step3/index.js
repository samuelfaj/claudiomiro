const fs = require('fs');
const path = require('path');
const logger = require('../../../../shared/utils/logger');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getStepModel } = require('../../utils/model-config');

/**
 * Step 3: Analyze task dependencies
 * Determines which tasks depend on each other for optimal parallel execution
 * Always uses deep reasoning (hard mode) for comprehensive analysis
 */
const step3 = async () => {
    logger.newline();
    logger.startSpinner('Analyzing task dependencies...');

    const tasks = fs
        .readdirSync(state.claudiomiroFolder)
        .filter(name => {
            const fullPath = path.join(state.claudiomiroFolder, name);
            // Only include task folders (TASK0, TASK1, TASKΩ, etc.), exclude cache and other directories
            return fs.statSync(fullPath).isDirectory() && /^TASK(\d+|Ω)/.test(name);
        })
        .sort((a, b) => {
            // TASKΩ should always be last
            if (a.includes('Ω')) return 1;
            if (b.includes('Ω')) return -1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

    if (tasks.length === 0) {
        logger.stopSpinner();
        logger.info('No tasks found for dependency analysis');
        return;
    }

    // Handle single task case
    if (tasks.length === 1) {
        const taskPath = path.join(state.claudiomiroFolder, tasks[0], 'BLUEPRINT.md');
        if (fs.existsSync(taskPath)) {
            const taskContent = fs.readFileSync(taskPath, 'utf-8');

            // Only add dependencies if not already present
            if (!taskContent.match(/^\s*@dependencies/mi)) {
                logger.info('Single task detected, adding empty dependencies');
                fs.writeFileSync(
                    taskPath,
                    `@dependencies []\n${taskContent}`,
                    'utf-8',
                );
                logger.stopSpinner();
                logger.success('Empty dependencies added to single task');
                return;
            }
        }
        logger.stopSpinner();
        return;
    }

    // Build task descriptions for analysis
    const taskDescriptions = tasks.map(task => {
        const taskMdPath = path.join(state.claudiomiroFolder, task, 'BLUEPRINT.md');
        const promptMdPath = path.join(state.claudiomiroFolder, task, 'PROMPT.md');

        const taskContent = fs.existsSync(taskMdPath)
            ? fs.readFileSync(taskMdPath, 'utf-8')
            : '';
        const promptContent = fs.existsSync(promptMdPath)
            ? fs.readFileSync(promptMdPath, 'utf-8')
            : '';

        return {
            name: task,
            content: `### ${task}\n\n${taskContent}\n\n${promptContent}`,
        };
    });

    // Generate deep analysis prompt
    const taskList = tasks.join(', ');
    const taskCount = tasks.length;

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');

    // Build task descriptions section
    let taskDescContent = '';
    taskDescriptions.forEach(({ content }) => {
        taskDescContent += content + '\n\n';
    });

    // Replace placeholders
    promptTemplate = promptTemplate
        .replace(/\{\{taskCount\}\}/g, taskCount)
        .replace(/\{\{taskList\}\}/g, taskList)
        .replace('{{taskDescriptions}}', taskDescContent);

    // Execute Claude to analyze dependencies - use step3 model (default: medium)
    await executeClaude(promptTemplate, null, { model: getStepModel(3) });

    logger.stopSpinner();
    logger.success('Task dependencies analyzed and configured');
};

module.exports = { step3 };
