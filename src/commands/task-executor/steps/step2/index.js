const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getLocalLLMService } = require('../../../../shared/services/local-llm');
const { buildOptimizedContextAsync } = require('../../../../shared/services/context-cache/context-collector');
const { generateLegacySystemContext } = require('../../../../shared/services/legacy-system/context-generator');
const { runValidation } = require('./decomposition-json-validator');
const { getStepModel } = require('../../utils/model-config');

/**
 * Step 2: Task Decomposition
 * Decomposes AI_PROMPT.md into individual tasks (TASK0, TASK1, etc.)
 * With decomposition analysis validation and Local LLM quality check
 */
const step2 = async () => {
    const folder = (file) => path.join(state.claudiomiroFolder, file);
    const analysisPath = folder('DECOMPOSITION_ANALYSIS.json');

    logger.newline();
    logger.startSpinner('Creating tasks...');

    // Build context once for all tasks
    const legacyContext = generateLegacySystemContext();
    let optimizedContext = '';
    try {
        const result = await buildOptimizedContextAsync(
            state.claudiomiroFolder,
            null, // No specific task yet - we're decomposing
            state.folder,
            'task decomposition',
        );
        optimizedContext = result.context || '';
    } catch (error) {
        // Fallback to empty context if building fails
        logger.debug(`[Step2] Context building failed: ${error.message}`);
    }

    // Build multi-repo context if enabled
    let multiRepoContext = '';
    if (state.isMultiRepo()) {
        const repos = [];
        const backendPath = state.getRepository('backend');
        const frontendPath = state.getRepository('frontend');
        if (backendPath) repos.push(`- **Backend:** \`${backendPath}\``);
        if (frontendPath) repos.push(`- **Frontend:** \`${frontendPath}\``);

        multiRepoContext = `
## 🚨 MULTI-REPO MODE ACTIVE 🚨

**THIS PROJECT IS IN MULTI-REPO MODE.** Every BLUEPRINT.md MUST include an \`@scope\` tag.

**Configured repositories:**
${repos.join('\n')}
**Git mode:** ${state.getGitMode() || 'unknown'}

**MANDATORY:** Add \`@scope backend\`, \`@scope frontend\`, or \`@scope integration\` to EVERY BLUEPRINT.md file.

**Failure to add @scope will cause task execution to fail.**

---
`;
    }

    const replace = (text) => {
        return text
            .replaceAll('{{claudiomiroFolder}}', `${state.claudiomiroFolder}`)
            .replaceAll('{{legacySystemContext}}', legacyContext || 'None - no legacy systems configured')
            .replaceAll('{{optimizedContext}}', optimizedContext || '')
            .replaceAll('{{multiRepoContext}}', multiRepoContext);
    };

    const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');

    // Track success/failure for cleanup
    let decompositionSuccess = false;

    try {
        // Task decomposition - use step2 model (default: hard)
        await executeClaude(replace(prompt), null, { model: getStepModel(2) });

        logger.stopSpinner();
        logger.success('Tasks created successfully');

        // Check if tasks were created, but only in non-test environment
        if (process.env.NODE_ENV !== 'test') {
            const task0BlueprintExists = fs.existsSync(path.join(state.claudiomiroFolder, 'TASK0', 'BLUEPRINT.md'));
            const task1BlueprintExists = fs.existsSync(path.join(state.claudiomiroFolder, 'TASK1', 'BLUEPRINT.md'));

            if (!task0BlueprintExists && !task1BlueprintExists) {
                throw new Error('Error creating tasks');
            }

            // Validate decomposition analysis document
            logger.startSpinner('Validating decomposition analysis...');
            runValidation(state.claudiomiroFolder);
            logger.stopSpinner();
            logger.success('Decomposition analysis validated');

            // Validate decomposition with Local LLM (if available)
            await validateDecompositionWithLLM();
        }

        decompositionSuccess = true;
    } catch (error) {
        logger.stopSpinner();
        decompositionSuccess = false;
        throw error;
    } finally {
        // Cleanup DECOMPOSITION_ANALYSIS.json based on success/failure
        if (fs.existsSync(analysisPath)) {
            if (decompositionSuccess) {
                // Delete on success - reasoning artifacts no longer needed
                fs.unlinkSync(analysisPath);
                logger.debug('DECOMPOSITION_ANALYSIS.json deleted (success)');
            } else {
                // Preserve on failure for debugging
                logger.info('DECOMPOSITION_ANALYSIS.json preserved for debugging');
            }
        }
    }
};

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
            .sort((a, b) => {
                // TASKΩ should always be last
                if (a.includes('Ω')) return 1;
                if (b.includes('Ω')) return -1;
                return a.localeCompare(b, undefined, { numeric: true });
            });

        if (taskFolders.length < 2) return; // No validation needed for single task

        const tasks = [];
        for (const taskFolder of taskFolders) {
            const blueprintPath = path.join(state.claudiomiroFolder, taskFolder, 'BLUEPRINT.md');
            if (!fs.existsSync(blueprintPath)) continue;

            const content = fs.readFileSync(blueprintPath, 'utf-8');

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
                dependencies,
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

/**
 * Cleanup decomposition analysis artifacts after step2 completion
 * Called externally if step2 needs to be re-run
 * @param {boolean} preserveOnError - Whether to keep DECOMPOSITION_ANALYSIS.json on error
 */
const cleanupDecompositionArtifacts = (preserveOnError = true) => {
    const analysisPath = path.join(state.claudiomiroFolder, 'DECOMPOSITION_ANALYSIS.json');

    if (fs.existsSync(analysisPath)) {
        if (!preserveOnError) {
            fs.unlinkSync(analysisPath);
            logger.debug('DECOMPOSITION_ANALYSIS.json cleaned up');
        }
    }
};

module.exports = { step2, cleanupDecompositionArtifacts };
