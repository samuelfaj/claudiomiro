const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

/**
 * Deep re-analysis when code review fails multiple times
 * Rewrites TODO.md from scratch with a different strategy
 *
 * @param {string} task - Task identifier
 * @returns {Promise} Result of Claude execution
 */
const reanalyzeFailed = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    const TODOtemplate = fs.readFileSync(path.join(__dirname, '../../templates', 'todo.md'), 'utf-8');

    // When we have been into a block state, too much failed code reviews
    if (fs.existsSync(folder('TODO.old.md'))) {
        return;
    }

    fs.cpSync(folder('TODO.md'), folder('TODO.old.md'));
    fs.cpSync(folder('TODO.md'), folder(`TODO.old.${(new Date()).getTime()}.md`));
    fs.rmSync(folder('TODO.md'), { force: true });

    // Collect context for deep re-analysis
    const contextFiles = [
        path.join(state.claudiomiroFolder, 'AI_PROMPT.md'),
    ];

    if (fs.existsSync(folder('RESEARCH.md'))) {
        contextFiles.push(folder('RESEARCH.md'));
    }

    // Check info.json for failure patterns
    let failureHistory = '';
    if (fs.existsSync(folder('info.json'))) {
        const info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        if (info.errorHistory && info.errorHistory.length > 0) {
            failureHistory = `\n\n## 📊 FAILURE PATTERN ANALYSIS\nThis task has failed ${info.attempts} times. Learn from past errors:\n`;
            info.errorHistory.slice(-3).forEach((err, _idx) => {
                failureHistory += `\n### Attempt ${err.attempt} (${err.timestamp}):\n${err.message}\n`;
            });
            failureHistory += '\n**CRITICAL**: Analyze why these approaches failed and take a DIFFERENT strategy.\n';
        }
    }

    const contextSection = contextFiles.length > 0
        ? `\n\n## 📚 CONTEXT FILES:\n${contextFiles.map(f => `- ${f}`).join('\n')}\n\nRead these to understand original intent and previous analysis.\n`
        : '';

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'reanalyze-prompt.md'), 'utf-8');

    // Replace placeholders
    const prompt = promptTemplate
        .replace(/\{\{promptPath\}\}/g, folder('PROMPT.md'))
        .replace(/\{\{taskPath\}\}/g, folder('TASK.md'))
        .replace(/\{\{todoOldPath\}\}/g, folder('TODO.old.md'))
        .replace(/\{\{todoPath\}\}/g, folder('TODO.md'))
        .replace(/\{\{failureHistory\}\}/g, failureHistory)
        .replace(/\{\{contextSection\}\}/g, contextSection)
        .replace(/\{\{todoTemplate\}\}/g, TODOtemplate);

    const execution = await executeClaude(prompt, task);

    if (!fs.existsSync(folder('TODO.md'))) {
        fs.cpSync(folder('TODO.old.md'), folder('TODO.md'));
        throw new Error('Error creating TODO.md file in deep re-analysis');
    }

    fs.rmSync(folder('TODO.old.md'), { force: true });

    return execution;
};

module.exports = { reanalyzeFailed };
