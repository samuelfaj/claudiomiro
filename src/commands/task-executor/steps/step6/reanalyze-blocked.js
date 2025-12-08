const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

/**
 * Deep re-analysis when task is blocked multiple times
 * Updates execution.json with new strategy based on BLUEPRINT.md
 *
 * @param {string} task - Task identifier
 * @param {Object} options - Options object
 * @param {string} options.model - Model to use ('fast', 'medium', 'hard')
 * @returns {Promise} Result of Claude execution
 */
const reanalyzeBlocked = async (task, options = {}) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    const logger = require('../../../../shared/utils/logger');

    const executionPath = folder('execution.json');
    const blueprintPath = folder('BLUEPRINT.md');

    // Require both files to exist
    if (!fs.existsSync(executionPath)) {
        throw new Error(`execution.json not found for task ${task}`);
    }
    if (!fs.existsSync(blueprintPath)) {
        throw new Error(`BLUEPRINT.md not found for task ${task}`);
    }

    // Load current execution state
    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
    const blueprint = fs.readFileSync(blueprintPath, 'utf-8');

    // Build failure history from execution.json
    let failureHistory = '';
    if (execution.errorHistory && execution.errorHistory.length > 0) {
        failureHistory = `\n\n## 📊 FAILURE PATTERN ANALYSIS\nThis task has been attempted ${execution.attempts} times. Learn from past errors:\n`;
        execution.errorHistory.slice(-3).forEach((err, idx) => {
            failureHistory += `\n### Attempt ${idx + 1} (${err.timestamp}):\n${err.message}\n`;
        });
        failureHistory += '\n**CRITICAL**: Analyze why these approaches failed and take a DIFFERENT strategy.\n';
    }

    // Build uncertainty history
    let uncertaintySection = '';
    if (execution.uncertainties && execution.uncertainties.length > 0) {
        uncertaintySection = '\n\n## ⚠️ UNRESOLVED UNCERTAINTIES\n';
        execution.uncertainties.forEach(u => {
            if (!u.resolution) {
                uncertaintySection += `- **${u.id}**: ${u.topic} - ${u.assumption} (Confidence: ${u.confidence})\n`;
            }
        });
    }

    // Build context section
    const contextFiles = [
        path.join(state.claudiomiroFolder, 'AI_PROMPT.md'),
    ].filter(f => fs.existsSync(f));

    const contextSection = contextFiles.length > 0
        ? `\n\n## 📚 CONTEXT FILES:\n${contextFiles.map(f => `- ${f}`).join('\n')}\n\nRead these to understand original intent.\n`
        : '';

    const prompt = `# DEEP RE-ANALYSIS: Task Blocked

## 🎯 YOUR ROLE
You are a **Senior Software Engineer** performing deep re-analysis of a blocked task.
The task has failed ${execution.attempts} times. You must find a DIFFERENT approach.

## 📋 CURRENT STATE

### BLUEPRINT.md (Task Definition):
${blueprint}

### Current Phase: ${execution.currentPhase?.name || 'Unknown'} (ID: ${execution.currentPhase?.id || 'N/A'})
### Status: ${execution.status}

${failureHistory}
${uncertaintySection}
${contextSection}

## 📝 REQUIRED ACTIONS

1. **Analyze Failures**: Read the error history and understand WHY previous approaches failed
2. **Identify Root Cause**: What is the underlying issue that keeps blocking progress?
3. **New Strategy**: Propose a DIFFERENT approach that avoids previous failure patterns
4. **Update execution.json**:
   - Reset blocked phases to 'pending'
   - Add notes about the new strategy to completion.forFutureTasks
   - Increment attempts counter
   - Clear or update uncertainties with new information

## 🎯 OUTPUT

Update the execution.json file at: ${executionPath}

The file MUST include:
- status: 'pending' (reset from blocked)
- phases: reset blocked phases to 'pending'
- completion.forFutureTasks: notes about new strategy
- attempts: incremented

DO NOT create new files. Only update execution.json.
`;

    const shellCommandRule = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'shared', 'templates', 'SHELL-COMMAND-RULE.md'),
        'utf-8',
    );

    logger.debug(`[Step6] Re-analyzing blocked task ${task} (attempt ${execution.attempts})`);

    // Deep re-analysis uses hard model by default (requires complex reasoning)
    const claudeOptions = {};
    if (options.model) {
        claudeOptions.model = options.model;
        logger.debug(`[Step6] Re-analysis using model: ${options.model}`);
    } else {
        claudeOptions.model = 'hard'; // Default to hard for deep analysis
    }

    const result = await executeClaude(
        prompt + '\n\n' + shellCommandRule,
        task,
        Object.keys(claudeOptions).length > 0 ? claudeOptions : undefined,
    );

    // Verify execution.json was updated
    if (fs.existsSync(executionPath)) {
        const updatedExecution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
        if (updatedExecution.status === 'blocked') {
            logger.warning(`[Step6] Task ${task} still blocked after re-analysis`);
        } else {
            logger.info(`[Step6] Task ${task} re-analyzed, new status: ${updatedExecution.status}`);
        }
    }

    return result;
};

module.exports = { reanalyzeBlocked };
