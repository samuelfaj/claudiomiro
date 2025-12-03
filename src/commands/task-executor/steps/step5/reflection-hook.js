const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { Reflector } = require('../../../../shared/services/reflection');
const insightsStore = require('../../../../shared/services/insights');

const DEFAULT_REFLECTION_FILE = 'REFLECTION.md';

const readIfExists = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return '';
    }
    return fs.readFileSync(filePath, 'utf8');
};

const buildReflectionTrajectory = (task, additionalNotes = '') => {
    const taskFolder = path.join(state.claudiomiroFolder, task);
    const sections = [];

    // New 2-file model: BLUEPRINT.md + execution.json
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
    const executionPath = path.join(taskFolder, 'execution.json');

    const blueprint = readIfExists(blueprintPath);
    if (blueprint) {
        sections.push(`## Task Blueprint (BLUEPRINT.md)\n${blueprint}`);
    }

    const executionContent = readIfExists(executionPath);
    if (executionContent) {
        try {
            const execution = JSON.parse(executionContent);
            const executionSummary = [
                `Status: ${execution.status}`,
                `Current Phase: ${execution.currentPhase?.name || 'N/A'}`,
                `Phases: ${(execution.phases || []).map(p => `${p.name}(${p.status})`).join(', ')}`,
                `Artifacts: ${(execution.artifacts || []).length} tracked`,
                `Uncertainties: ${(execution.uncertainties || []).length} logged`,
            ].join('\n');
            sections.push(`## Execution State (execution.json)\n${executionSummary}`);
        } catch (_e) {
            sections.push(`## Execution State (execution.json)\n${executionContent}`);
        }
    }

    if (additionalNotes) {
        sections.push(`## Additional Signals\n${additionalNotes}`);
    }

    return sections.join('\n\n---\n\n');
};

const shouldReflect = (task, metrics = {}) => {
    if (!task) {
        return { should: false };
    }

    const {
        attempts = 1,
        hasErrors = false,
        codeChangeSize = 0,
        taskComplexity = 'medium',
    } = metrics;

    if (hasErrors && attempts > 1) {
        return { should: true, trigger: 'error-pattern' };
    }

    if (attempts >= 2) {
        return { should: true, trigger: 'iteration-count' };
    }

    if (codeChangeSize > 500 || taskComplexity === 'high') {
        return { should: true, trigger: 'quality-threshold' };
    }

    return { should: false };
};

const createReflection = async (task, options = {}) => {
    const {
        trajectory,
        cwd,
        maxIterations = 2,
        reflectionPath,
        existingInsights = [],
    } = options;

    const taskFolder = path.join(state.claudiomiroFolder, task);
    const targetPath = reflectionPath || path.join(taskFolder, DEFAULT_REFLECTION_FILE);

    const finalTrajectory = trajectory || buildReflectionTrajectory(task);
    if (!finalTrajectory) {
        logger.debug('[reflection] Skipping reflection because trajectory is empty');
        return null;
    }

    let seedInsights = existingInsights;
    if (!seedInsights || seedInsights.length === 0) {
        const previous = insightsStore.getTaskReflection(task);
        if (previous && Array.isArray(previous.iterations) && previous.iterations.length > 0) {
            const lastIteration = previous.iterations[previous.iterations.length - 1];
            if (lastIteration && Array.isArray(lastIteration.insights)) {
                seedInsights = lastIteration.insights;
            }
        }
    }

    const reflector = new Reflector({
        executor: async ({ prompt }) => {
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { force: true });
            }

            await executeClaude(prompt, task, cwd ? { cwd } : undefined);

            const content = readIfExists(targetPath);
            return { content };
        },
    });

    const result = await reflector.reflect(task, {
        trajectory: finalTrajectory,
        maxIterations,
        existingInsights: seedInsights,
        extra: {
            reflectionPath: targetPath,
        },
    });

    return {
        ...result,
        reflectionPath: targetPath,
        trajectory: finalTrajectory,
    };
};

const storeReflection = async (task, reflectionResult, trigger) => {
    if (!reflectionResult || !Array.isArray(reflectionResult.insights) || reflectionResult.insights.length === 0) {
        return null;
    }

    const iterationPayload = {
        triggeredBy: trigger ? trigger.trigger || trigger : undefined,
        converged: reflectionResult.converged,
        iterationsCount: reflectionResult.iterations,
        insights: reflectionResult.insights,
        history: reflectionResult.history,
    };

    return insightsStore.addReflection(task, iterationPayload);
};

module.exports = {
    shouldReflect,
    createReflection,
    storeReflection,
    buildReflectionTrajectory,
};
