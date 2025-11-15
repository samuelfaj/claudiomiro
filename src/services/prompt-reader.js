const readline = require('readline');
const chalk = require('chalk');
const logger = require('../../logger');

const getMultilineInput = () => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        let lines = [];
        let isFirstLine = true;

        console.log();
        console.log(chalk.bold.cyan('─────────────────────────────────────────────'));
        console.log(chalk.white('Describe what you need help with:'));
        console.log(chalk.bold.cyan('─────────────────────────────────────────────'));
        console.log(chalk.gray('✓ Write or paste your task description'));
        console.log(chalk.gray('✓ Paste code, URLs, or drag & drop file paths') );
        console.log(chalk.gray('✓ Press ENTER twice to submit') );
        console.log(chalk.gray('✓ Press Ctrl+C to cancel'));
        console.log(chalk.bold.cyan('─────────────────────────────────────────────'));
        console.log();
        process.stdout.write(chalk.cyan('🤖 > '));

        rl.on('line', (line) => {
            if (line.trim() === '' && lines.length > 0 && lines[lines.length - 1].trim() === '') {
                // Segunda linha vazia consecutiva - finaliza
                rl.close();
                const result = lines.slice(0, -1).join('\n').trim();
                resolve(result);
            } else {
                lines.push(line);
                if (!isFirstLine) {
                    process.stdout.write(chalk.cyan('    '));
                }
                isFirstLine = false;
            }
        });

        rl.on('SIGINT', () => {
            rl.close();
            console.log();
            logger.error('Operation cancelled');
            process.exit(0);
        });
    });
};

const getSimpleInput = (question) => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        rl.question(chalk.cyan(question), (answer) => {
            rl.close();
            resolve(answer.trim());
        });

        rl.on('SIGINT', () => {
            rl.close();
            console.log();
            logger.error('Operation cancelled');
            process.exit(0);
        });
    });
};

const askClarificationQuestions = async (questionsJson) => {
    console.log();
    console.log(chalk.bold.yellow('═══════════════════════════════════════════════════════'));
    console.log(chalk.bold.yellow('  📋 Clarification Questions'));
    console.log(chalk.bold.yellow('═══════════════════════════════════════════════════════'));
    console.log();
    console.log(chalk.white('The AI explored your codebase and needs clarification on the following:'));
    console.log();

    // Parse questions from JSON
    let questions;
    try {
        questions = typeof questionsJson === 'string' ? JSON.parse(questionsJson) : questionsJson;

        if (!Array.isArray(questions)) {
            throw new Error('Questions must be an array');
        }
    } catch (error) {
        logger.error('Failed to parse CLARIFICATION_QUESTIONS.json: ' + error.message);
        throw error;
    }

    const answers = [];

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionNum = q.id || (i + 1);

        console.log(chalk.bold.cyan(`─────────────────────────────────────────────────────────`));
        console.log(chalk.bold.white(`Question ${questionNum}/${questions.length}: ${q.title}`));
        if (q.category) {
            console.log(chalk.gray(`Category: ${q.category}`));
        }
        console.log(chalk.bold.cyan(`─────────────────────────────────────────────────────────`));
        console.log();

        if (q.context) {
            console.log(chalk.gray('Context:'));
            console.log(chalk.white(q.context.replace(/\\n/g, '\n')));
            console.log();
        }

        if (q.ambiguity) {
            console.log(chalk.gray('Ambiguity:'));
            console.log(chalk.white(q.ambiguity));
            console.log();
        }

        console.log(chalk.yellow(q.question));
        console.log();

        if (q.options && q.options.length > 0) {
            console.log(chalk.gray('Options:'));
            q.options.forEach((opt) => {
                console.log(chalk.white(`  ${opt.key}) ${opt.label}`));
                if (opt.description) {
                    console.log(chalk.gray(`     ${opt.description}`));
                }
            });
            console.log();
        }

        if (q.currentPatterns) {
            console.log(chalk.gray('Current patterns in codebase:'));
            console.log(chalk.white(q.currentPatterns));
            console.log();
        }

        // Get answer
        const answer = await getSimpleInput('Your answer: ');
        answers.push({
            questionId: questionNum,
            question: q.title,
            category: q.category || 'General',
            answer: answer
        });
        console.log();
    }

    console.log(chalk.bold.green('✓ All questions answered!'));
    console.log();

    // Return answers as JSON
    const answersData = {
        timestamp: new Date().toISOString(),
        answers: answers
    };

    return JSON.stringify(answersData, null, 2);
};

module.exports = { getMultilineInput, getSimpleInput, askClarificationQuestions };
