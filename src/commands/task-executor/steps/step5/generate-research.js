const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const {
    getReusableResearch,
    indexResearch,
} = require('../../../../shared/services/research-manager');

/**
 * Generates RESEARCH.md file with deep context analysis
 * Performs comprehensive codebase exploration to find similar patterns,
 * reusable components, and integration points before task execution
 *
 * Token-optimized: Reuses similar research when available (80%+ similarity)
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2')
 * @param {Object} options - Optional parameters
 * @param {string} options.cwd - Working directory for Claude execution (multi-repo support)
 * @returns {Promise<void>}
 */
const generateResearchFile = async (task, options = {}) => {
    const { cwd } = options;
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    // Skip if RESEARCH.md already exists (already analyzed)
    if (fs.existsSync(folder('RESEARCH.md'))) {
        return;
    }

    // Skip if TODO.md doesn't exist
    if (!fs.existsSync(folder('TODO.md'))) {
        return;
    }

    const logger = require('../../../../shared/utils/logger');

    // Try to reuse similar research first (token optimization)
    const taskContent = fs.existsSync(folder('TASK.md'))
        ? fs.readFileSync(folder('TASK.md'), 'utf8')
        : '';

    const reusableResearch = getReusableResearch(state.claudiomiroFolder, taskContent);

    if (reusableResearch) {
        logger.info(`Reusing research from ${reusableResearch.sourceTask} (${Math.round(reusableResearch.similarity * 100)}% similar)`);

        // Add adaptation note to reused research
        const adaptedContent = `# RESEARCH.md (Adapted from ${reusableResearch.sourceTask})

> ${reusableResearch.adaptationNote}

${reusableResearch.content}

---
## Task-Specific Additions

Review the content above and adapt as needed for this specific task.
`;

        fs.writeFileSync(folder('RESEARCH.md'), adaptedContent, 'utf8');
        logger.success('Reused similar research (saved ~15K+ tokens)');
        return;
    }

    logger.startSpinner('Analyzing task and gathering context...');

    try {
    // Load research prompt template
        let promptTemplate = fs.readFileSync(path.join(__dirname, 'research-prompt.md'), 'utf-8');

        // Replace placeholders
        const prompt = promptTemplate
            .replace(/\{\{todoPath\}\}/g, folder('TODO.md'))
            .replace(/\{\{taskPath\}\}/g, folder('TASK.md'))
            .replace(/\{\{promptPath\}\}/g, folder('PROMPT.md'))
            .replace(/\{\{researchPath\}\}/g, folder('RESEARCH.md'))
            .replace(/\{\{researchGuidePath\}\}/g, path.join(__dirname, 'research.md'))
            .replace(/\{\{aiPromptPath\}\}/g, path.join(state.claudiomiroFolder, 'AI_PROMPT.md'))
            .replace(/\{\{task\}\}/g, task);

        const shellCommandRule = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'), 'utf-8');
        await executeClaude(prompt + '\n\n' + shellCommandRule, task, cwd ? { cwd } : undefined);

        logger.stopSpinner();

        // Validate RESEARCH.md was created
        if (!fs.existsSync(folder('RESEARCH.md'))) {
            logger.error('RESEARCH.md was not created. Research phase failed.');
            throw new Error('Research phase failed: RESEARCH.md not generated');
        }

        // Validate RESEARCH.md has minimum content
        const researchContent = fs.readFileSync(folder('RESEARCH.md'), 'utf8');
        if (researchContent.length < 200) {
            logger.error('RESEARCH.md is too short. Research phase incomplete.');
            fs.rmSync(folder('RESEARCH.md'));
            throw new Error('Research phase incomplete: insufficient analysis');
        }

        // Index the research for future reuse (token optimization)
        indexResearch(state.claudiomiroFolder, task, taskContent, researchContent);

        logger.success('Research completed and saved to RESEARCH.md');
    } catch (error) {
        logger.stopSpinner();
        logger.error('Research phase failed: ' + error.message);
        // Don't block execution if research fails, but warn user
        logger.warning('Continuing without research file - execution may be less informed');
    }
};

module.exports = { generateResearchFile };
