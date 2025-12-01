const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { askClarificationQuestions } = require('../../../../shared/services/prompt-reader');
const { startFresh } = require('../../services/file-manager');

/**
 * Step 0: Generate clarification questions (if needed)
 * This is the FIRST step - it explores the codebase and asks clarification questions if needed
 */
const step0 = async (sameBranch = false, promptText = null) => {
    const task = promptText;
    const folder = (file) => path.join(state.claudiomiroFolder, file);

    if (!task || task.trim().length < 10) {
        logger.error('Please provide more details (at least 10 characters)');
        process.exit(0);
    }

    startFresh(true);
    fs.writeFileSync(folder('INITIAL_PROMPT.md'), task);

    // Create marker file if this is a new branch (not same branch)
    // This is used by step7 to verify this branch was created by Claudiomiro
    if (!sameBranch) {
        fs.writeFileSync(folder('newbranch.txt'), 'true');
    }

    // Determine branch step based on mode
    // Determine branch step based on mode
    let branchStep = '';
    // Branch creation is now handled in cli.js before step0 is called
    // We just need to ensure step0 doesn't try to create it again via prompt
    if (!sameBranch) {
        // In single-repo mode, we used to ask Claude to create the branch.
        // Now we create it via shell in cli.js, so we don't need to ask Claude.
        branchStep = '';
    }

    const replace = (text) => {
        return text.replace('{{TASK}}', task).replaceAll('{{claudiomiroFolder}}', `${state.claudiomiroFolder}`);
    };

    // Check if clarification questions already exist (skip if resuming)
    const clarificationAnswersPath = folder('CLARIFICATION_ANSWERS.json');
    const pendingClarificationPath = folder('PENDING_CLARIFICATION.flag');

    if (fs.existsSync(clarificationAnswersPath)) {
        logger.success('Clarification answers already exist, skipping question generation');

        // Remove PENDING_CLARIFICATION.flag if it exists
        if (fs.existsSync(pendingClarificationPath)) {
            fs.unlinkSync(pendingClarificationPath);
            logger.info('Resuming from clarification phase...');
            logger.newline();
        }

        return;
    }

    // Generate clarification questions
    logger.newline();
    logger.startSpinner('Exploring codebase and generating clarification questions...');

    await executeClaude(
        'If the repository uses Husky, lint-staged, or any other Git hooks, verify that they are properly configured and functioning.' +
        'If no such hooks exist, take no action.',
    );

    const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
    await executeClaude(replace(branchStep + prompt));

    logger.stopSpinner();

    // Check if clarification questions were generated
    const clarificationQuestionsPath = folder('CLARIFICATION_QUESTIONS.json');

    if (fs.existsSync(clarificationQuestionsPath)) {
        // Questions were generated
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

            // Create PENDING_CLARIFICATION.flag so --continue can detect it
            fs.writeFileSync(folder('PENDING_CLARIFICATION.flag'), 'pending');

            process.exit(1);
        }
    } else {
        // No questions were generated - create empty answers file to proceed
        fs.writeFileSync(clarificationAnswersPath, '[]');
    }
};

module.exports = { step0 };
