const fs = require('fs');
const path = require('path');
const state = require('../config/state');
const logger = require('../../logger');
const { executeClaude } = require('../services/claude-executor');
const { getMultilineInput, askClarificationQuestions } = require('../services/prompt-reader');
const { startFresh } = require('../services/file-manager');

const step0 = async (sameBranch = false, promptText = null, mode = 'auto') => {
    const task = promptText || await getMultilineInput();
    const folder = (file) => path.join(state.claudiomiroFolder, file);


    if (!task || task.trim().length < 10) {
        logger.error('Please provide more details (at least 10 characters)');
        process.exit(0);
    }

    startFresh(true);
    fs.writeFileSync(folder('INITIAL_PROMPT.md'), task);

    const branchStep = sameBranch
        ? ''
        : '## FIRST STEP: \n\nCreate a git branch for this task\n\n';

    const replace = (text) => {
        return text.replace('{{TASK}}', task).replaceAll(`{{claudiomiroFolder}}`, `${state.claudiomiroFolder}`);
    }

    // ========================================
    // STEP 0.0: Check if CLARIFICATION_ANSWERS.json exists
    // If it exists, skip to step 0.1 (AI_PROMPT.md creation)
    // If not, run step 0.0 (question generation)
    // ========================================

    const clarificationAnswersPath = folder('CLARIFICATION_ANSWERS.json');
    const aiPromptPath = folder('AI_PROMPT.md');

    if (!fs.existsSync(clarificationAnswersPath)) {
        // ========================================
        // STEP 0.0: Exploration & Question Generation
        // ========================================
        logger.newline();
        logger.startSpinner('Exploring codebase and generating clarification questions...');

        await executeClaude(
            `If the repository uses Husky, lint-staged, or any other Git hooks, verify that they are properly configured and functioning.` +
            `If no such hooks exist, take no action.`
        );

        const prompt00 = fs.readFileSync(path.join(__dirname, 'step0.0.md'), 'utf-8');
        await executeClaude(replace(branchStep + prompt00));

        logger.stopSpinner();

        // Check if clarification questions were generated
        const clarificationQuestionsPath = folder('CLARIFICATION_QUESTIONS.json');

        if (fs.existsSync(clarificationQuestionsPath)) {
            // Step 0.0 completed - questions were generated
            logger.success('Clarification questions generated');
            logger.newline();

            // Read questions and ask interactively
            const questionsContent = fs.readFileSync(clarificationQuestionsPath, 'utf-8');

            try {
                const answersJson = await askClarificationQuestions(questionsContent);

                // Save answers to file
                fs.writeFileSync(clarificationAnswersPath, answersJson);

                logger.success('Answers saved');
                logger.newline();

            } catch (error) {
                logger.error('Error collecting answers: ' + error.message);
                logger.newline();
                logger.info('Questions have been saved to:');
                logger.info(`  ${clarificationQuestionsPath}`);
                logger.newline();
                logger.info('You can answer them manually in:');
                logger.info(`  ${clarificationAnswersPath}`);
                logger.newline();
                logger.info('Then run: claudiomiro --continue');
                process.exit(1);
            }
        } else {
            // No questions were generated - create empty answers file to proceed
            fs.writeFileSync(clarificationAnswersPath, '[]');
        }
    }

    // ========================================
    // STEP 0.1: AI_PROMPT.md Generation
    // (Only runs if AI_PROMPT.md doesn't exist yet)
    // ========================================

    if (!fs.existsSync(aiPromptPath)) {
        logger.startSpinner('Generating AI_PROMPT.md with clarifications...');

        const answers = fs.readFileSync(clarificationAnswersPath, 'utf-8');
        const prompt01 = fs.readFileSync(path.join(__dirname, 'step0.1.md'), 'utf-8');

        await executeClaude(replace(branchStep + prompt01));

        logger.stopSpinner();
        logger.success('AI_PROMPT.md created successfully');

        if (!fs.existsSync(aiPromptPath)) {
            throw new Error('Error creating AI_PROMPT.md file');
        }
    } else {
        logger.success('AI_PROMPT.md already exists, skipping generation');
    }

    // ========================================
    // Task Decomposition (step0.2)
    // ========================================

    logger.newline();
    logger.startSpinner('Creating tasks...');

    const prompt2 = fs.readFileSync(path.join(__dirname, 'step0.2.md'), 'utf-8');
    await executeClaude(replace(prompt2));

    logger.stopSpinner();
    logger.success('Tasks created successfully');

    // Check if tasks were created, but only in non-test environment
    if (process.env.NODE_ENV !== 'test') {
        if(
            !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK0')) &&
            !fs.existsSync(path.join(state.claudiomiroFolder, 'TASK1'))
        ){
            throw new Error('Error creating tasks')
        }
    }
}

module.exports = { step0 };
