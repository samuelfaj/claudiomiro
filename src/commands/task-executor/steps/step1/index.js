const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { generateLegacySystemContext } = require('../../../../shared/services/legacy-system');

/**
 * Generates multi-repository context section for AI_PROMPT.md
 * @returns {string} Multi-repo context markdown or empty string for single-repo mode
 */
const generateMultiRepoContext = () => {
    if (!state.isMultiRepo()) {
        return '';
    }

    return `
## Multi-Repository Context

This project uses multiple repositories:

- **Backend Repository:** \`${state.getRepository('backend')}\`
- **Frontend Repository:** \`${state.getRepository('frontend')}\`
- **Git Mode:** ${state.getGitMode()}

### Task Scope Requirements

**IMPORTANT:** Every task MUST include an \`@scope\` tag on the second line of TASK.md:

\`\`\`markdown
@dependencies [TASK0]
@scope backend

# Task Title
...
\`\`\`

Valid scopes:
- \`@scope backend\` - Task modifies only backend code
- \`@scope frontend\` - Task modifies only frontend code
- \`@scope integration\` - Task requires changes to both repositories or verifies integration

Tasks without @scope will fail validation in multi-repo mode.
`;
};

/**
 * Step 1: Generate AI_PROMPT.md
 * Transforms user request + clarification answers into complete AI_PROMPT.md
 */
const step1 = async (sameBranch = false) => {
    const folder = (file) => path.join(state.claudiomiroFolder, file);

    const aiPromptPath = folder('AI_PROMPT.md');

    // Skip if AI_PROMPT.md already exists
    if (fs.existsSync(aiPromptPath)) {
        logger.success('AI_PROMPT.md already exists, skipping generation');
        return;
    }

    logger.newline();
    logger.startSpinner('Generating AI_PROMPT.md with clarifications...');

    // In multi-repo mode, branches are already created programmatically in step0
    const branchStep = (sameBranch || state.isMultiRepo())
        ? ''
        : '## FIRST STEP: \n\nCreate a git branch for this task\n\n';

    const taskContent = fs.existsSync(folder('INITIAL_PROMPT.md'))
        ? fs.readFileSync(folder('INITIAL_PROMPT.md'), 'utf-8')
        : '';

    const replace = (text) => {
        return text.replace('{{TASK}}', taskContent).replaceAll('{{claudiomiroFolder}}', `${state.claudiomiroFolder}`);
    };

    const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
    const multiRepoContext = generateMultiRepoContext();
    const legacyContext = generateLegacySystemContext();

    await executeClaude(replace(branchStep + prompt + multiRepoContext + legacyContext));

    logger.stopSpinner();

    if (!fs.existsSync(aiPromptPath)) {
        logger.error('AI_PROMPT.md was not created');
        throw new Error('Error creating AI_PROMPT.md file');
    }

    logger.success('AI_PROMPT.md created successfully');
};

module.exports = { step1, generateMultiRepoContext };
