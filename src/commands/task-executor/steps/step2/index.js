const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getLocalLLMService } = require('../../../../shared/services/local-llm');

/**
 * Step 2: Task Decomposition
 * Decomposes AI_PROMPT.md into individual tasks (TASK0, TASK1, etc.)
 * With Local LLM validation for quality check
 */
const step2 = async () => {
    const folder = (file) => path.join(state.claudiomiroFolder, file);

    logger.newline();
    logger.startSpinner('Creating tasks...');

    const replace = (text) => {
        return text.replaceAll(`{{claudiomiroFolder}}`, `${state.claudiomiroFolder}`);
    }

    const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
    await executeClaude(replace(prompt));

    logger.stopSpinner();
    logger.success('Tasks created successfully');

    // Check if tasks were created, but only in non-test environment
    if (process.env.NODE_ENV !== 'test') {
        if (
            !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK0')) &&
            !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK1'))
        ) {
            throw new Error('Error creating tasks')
        }

        // Validate decomposition with Local LLM (if available)
        await validateDecompositionWithLLM();
    }
}

/**
 * Validates task decomposition using Local LLM
 * Checks for circular dependencies, task granularity, and missing dependencies
 */
const validateDecompositionWithLLM = async () => {
    const llm = getLocalLLMService();
    if (!llm) return;

    try {
        await llm.initialize();
        if (!llm.isAvailable()) return;

        // Collect all tasks
        const taskFolders = fs.readdirSync(state.claudiomiroFolder)
            .filter(f => f.startsWith('TASK') && fs.statSync(path.join(state.claudiomiroFolder, f)).isDirectory())
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (taskFolders.length < 2) return; // No validation needed for single task

        const tasks = [];
        for (const taskFolder of taskFolders) {
            const taskMdPath = path.join(state.claudiomiroFolder, taskFolder, 'TASK.md');
            if (!fs.existsSync(taskMdPath)) continue;

            const content = fs.readFileSync(taskMdPath, 'utf-8');

            // Extract dependencies
            const depsMatch = content.match(/@dependencies\s*\[?([^\]\n]*)\]?/i);
            const dependencies = depsMatch
                ? depsMatch[1].split(',').map(d => d.trim()).filter(d => d && d.toLowerCase() !== 'none')
                : [];

            // Extract description (first 200 chars after title)
            const description = content.slice(0, 300).replace(/^#.*\n/, '').trim();

            tasks.push({
                name: taskFolder,
                description,
                dependencies
            });
        }

        // Validate with LLM
        const validation = await llm.validateDecomposition(tasks);

        if (!validation.valid) {
            logger.newline();
            logger.warning('⚠️  Decomposition validation detected potential issues:');
            for (const issue of validation.issues || []) {
                logger.warning(`   - ${issue}`);
            }
            if (validation.suggestions && validation.suggestions.length > 0) {
                logger.info('Suggestions:');
                for (const suggestion of validation.suggestions) {
                    logger.info(`   - ${suggestion}`);
                }
            }
            if (validation.circularDeps && validation.circularDeps.length > 0) {
                logger.error('Circular dependencies detected:');
                for (const cycle of validation.circularDeps) {
                    logger.error(`   ${cycle.join(' -> ')}`);
                }
            }
            logger.newline();
        } else {
            logger.debug('[Step2] Decomposition validated successfully');
        }
    } catch (error) {
        // Validation failed, continue without it
        logger.debug(`[Step2] Decomposition validation skipped: ${error.message}`);
    }
};

module.exports = { step2 };
