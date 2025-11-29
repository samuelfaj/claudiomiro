const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { getMultilineInput, askClarificationQuestions } = require('../../../../shared/services/prompt-reader');
const { startFresh } = require('../../services/file-manager');

/**
 * Generates a branch name from task description
 * @param {string} task - Task description
 * @returns {string} Branch name
 */
const generateBranchName = (task) => {
    // Extract first meaningful words from task to create branch name
    const slug = task
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join('-')
        .substring(0, 50);
    return `claudiomiro/${slug || 'task'}`;
};

/**
 * Creates git branches in appropriate repositories based on multi-repo configuration
 * @param {string} branchName - Name of the branch to create
 */
const createBranches = (branchName) => {
    if (!state.isMultiRepo()) {
        // Single-repo mode: branch creation is handled by Claude prompt
        return;
    }

    const gitMode = state.getGitMode();

    const createBranchInRepo = (repoPath, repoName) => {
        try {
            execSync(`git checkout -b ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
            logger.info(`Created branch ${branchName} in ${repoName}`);
        } catch (error) {
            const errorMsg = error.stderr ? error.stderr.toString() : error.message;
            if (errorMsg.includes('already exists')) {
                execSync(`git checkout ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
                logger.info(`Branch ${branchName} already exists in ${repoName}, switched to it`);
            } else {
                throw new Error(`Failed to create branch in ${repoName}: ${errorMsg}`);
            }
        }
    };

    if (gitMode === 'monorepo') {
        // Monorepo: create branch once (same git root for both)
        createBranchInRepo(state.folder, 'monorepo');
    } else if (gitMode === 'separate') {
        // Separate repos: create branch in both
        createBranchInRepo(state.getRepository('backend'), 'backend repo');
        createBranchInRepo(state.getRepository('frontend'), 'frontend repo');
    }
};

/**
 * Step 0: Generate clarification questions (if needed)
 * This is the FIRST step - it explores the codebase and asks clarification questions if needed
 */
const step0 = async (sameBranch = false, promptText = null) => {
    const task = promptText || await getMultilineInput();
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
    let branchStep = '';
    if (!sameBranch) {
        if (state.isMultiRepo()) {
            // Multi-repo mode: create branches programmatically
            const branchName = generateBranchName(task);
            createBranches(branchName);
            // branchStep remains empty - branches already created
        } else {
            // Single-repo mode: let Claude create the branch via prompt
            branchStep = '## FIRST STEP: \n\nCreate a git branch for this task\n\n';
        }
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

module.exports = { step0, createBranches, generateBranchName };
