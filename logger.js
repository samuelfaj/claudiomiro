const chalk = require('chalk');
const ora = require('ora');
const logSymbols = require('log-symbols');
const boxen = require('boxen');
const gradient = require('gradient-string');
const readline = require('readline');
const packageJson = require('./package.json');

class Logger {
    constructor() {
        this.spinner = null;
        this.indentLevel = 0;
    }

    shouldSuppressOutput() {
        try {
            const managerModule = require('./src/services/parallel-state-manager');
            const ParallelStateManager = managerModule.ParallelStateManager || managerModule;
            const instance = ParallelStateManager && ParallelStateManager.instance;
            return Boolean(instance && typeof instance.isUIRendererActive === 'function' && instance.isUIRendererActive());
        } catch (error) {
            return false;
        }
    }

    withOutput(action) {
        if (this.shouldSuppressOutput()) {
            return;
        }
        action();
    }

    getIndent() {
        return '  '.repeat(this.indentLevel);
    }

    // Banner inicial
    banner() {
        const version = packageJson.version;
        const title = gradient.pastel.multiline([
            '╔═══════════════════════════════════════╗',
            '║                                       ║',
            `║          CLAUDIOMIRO v${version}           ║`,
            '║     AI-Powered Development Agent      ║',
            '║                                       ║',
            '╚═══════════════════════════════════════╝'
        ].join('\n'));
        this.withOutput(() => {
            console.log('\n' + title + '\n');
        });
    }

    // Logs básicos
    info(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.info} ${chalk.cyan(message)}`);
        });
    }

    success(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.success} ${chalk.green(message)}`);
        });
    }

    warning(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.warning} ${chalk.yellow(message)}`);
        });
    }

    error(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.error} ${chalk.red(message)}`);
        });
    }

    // Log de step/fase
    step(task, tasks, number, message) {
        const tasksText = chalk.bold.white(`[TASK ${task}/${tasks}]`);

        const stepText = chalk.bold.white(`[STEP ${number}]`);
        const arrow = chalk.gray('→');
        this.withOutput(() => {
            console.log(`\n${tasksText} ${stepText} ${arrow} ${chalk.cyan(message)}\n`);
        });
    }

    // Box para mensagens importantes
    box(message, options = {}) {
        const boxConfig = {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            ...options
        };
        this.withOutput(() => {
            console.log(boxen(message, boxConfig));
        });
    }

    // Spinner para operações em progresso
    startSpinner(text) {
        if (this.shouldSuppressOutput()) {
            this.stopSpinner();
            return;
        }
        if (this.spinner) {
            this.spinner.stop();
        }
        this.spinner = ora({
            text: chalk.cyan(text),
            color: 'cyan',
            spinner: 'dots'
        }).start();
    }

    updateSpinner(text) {
        if (this.shouldSuppressOutput()) {
            return;
        }
        if (this.spinner) {
            this.spinner.text = chalk.cyan(text);
        }
    }

    succeedSpinner(text) {
        if (this.spinner) {
            if (this.shouldSuppressOutput()) {
                this.spinner.stop();
            } else {
                this.spinner.succeed(chalk.green(text));
            }
            this.spinner = null;
        }
    }

    failSpinner(text) {
        if (this.spinner) {
            if (this.shouldSuppressOutput()) {
                this.spinner.stop();
            } else {
                this.spinner.fail(chalk.red(text));
            }
            this.spinner = null;
        }
    }

    stopSpinner() {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }

    // Log de diretório/arquivo
    path(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${chalk.gray('📁')} ${chalk.blue(message)}`);
        });
    }

    // Log de comando executado
    command(cmd) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${chalk.gray('$')} ${chalk.magenta(cmd)}`);
        });
    }

    // Separador visual
    separator() {
        this.withOutput(() => {
            console.log(chalk.gray('─'.repeat(50)));
        });
    }

    // Aumentar indentação
    indent() {
        this.indentLevel++;
    }

    // Diminuir indentação
    outdent() {
        this.indentLevel = Math.max(0, this.indentLevel - 1);
    }

    // Reset indentação
    resetIndent() {
        this.indentLevel = 0;
    }

    // Log de tarefa
    task(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}${chalk.gray('▸')} ${chalk.white(message)}`);
        });
    }

    // Log de subtarefa
    subtask(message) {
        this.withOutput(() => {
            console.log(`${this.getIndent()}  ${chalk.gray('•')} ${chalk.gray(message)}`);
        });
    }

    // Log de progresso
    progress(current, total, message = '') {
        const percentage = Math.round((current / total) * 100);
        const bar = this.createProgressBar(percentage);
        const msg = message ? ` ${chalk.gray(message)}` : '';
        this.withOutput(() => {
            console.log(`${this.getIndent()}${bar} ${chalk.cyan(`${percentage}%`)}${msg}`);
        });
    }

    createProgressBar(percentage) {
        const width = 20;
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }

    // Limpar console
    clear() {
        if (this.shouldSuppressOutput()) {
            return;
        }
        console.clear();
    }

    // Nova linha
    newline() {
        this.withOutput(() => {
            console.log();
        });
    }

    // Confirmação do usuário
    async confirm(message) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            this.withOutput(() => {
                rl.question(`${chalk.yellow('?')} ${message} ${chalk.gray('(y/N)')} `, (answer) => {
                    rl.close();
                    const normalized = answer.toLowerCase().trim();
                    resolve(normalized === 'y' || normalized === 'yes');
                });
            });
        });
    }
}

module.exports = new Logger();
