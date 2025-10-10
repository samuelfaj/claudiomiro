import chalk from 'chalk';
import ora from 'ora';
import logSymbols from 'log-symbols';
import boxen from 'boxen';
import gradient from 'gradient-string';

class Logger {
    constructor() {
        this.spinner = null;
        this.indentLevel = 0;
    }

    async shouldSuppressOutput() {
        try {
            const managerModule = await import('./src/services/parallel-state-manager');
            const ParallelStateManager = managerModule.ParallelStateManager || managerModule;
            const instance = ParallelStateManager && ParallelStateManager.instance;
            return Boolean(instance && typeof instance.isUIRendererActive === 'function' && instance.isUIRendererActive());
        } catch (error) {
            return false;
        }
    }

    async withOutput(action) {
        if (await this.shouldSuppressOutput()) {
            return;
        }
        action();
    }

    getIndent() {
        return '  '.repeat(this.indentLevel);
    }

    // Banner inicial
    async banner() {
        const title = gradient.pastel.multiline([
            '╔═══════════════════════════════════════╗',
            '║                                       ║',
            '║           CLAUDIOMIRO v1.3            ║',
            '║     AI-Powered Development Agent      ║',
            '║                                       ║',
            '╚═══════════════════════════════════════╝'
        ].join('\n'));
        await this.withOutput(() => {
            console.log('\n' + title + '\n');
        });
    }

    // Logs básicos
    async info(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.info} ${chalk.cyan(message)}`);
        });
    }

    async success(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.success} ${chalk.green(message)}`);
        });
    }

    async warning(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.warning} ${chalk.yellow(message)}`);
        });
    }

    async error(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${logSymbols.error} ${chalk.red(message)}`);
        });
    }

    // Log de step/fase
    async step(task, tasks, number, message) {
        const tasksText = chalk.bold.white(`[TASK ${task}/${tasks}]`);

        const stepText = chalk.bold.white(`[STEP ${number}]`);
        const arrow = chalk.gray('→');
        await this.withOutput(() => {
            console.log(`\n${tasksText} ${stepText} ${arrow} ${chalk.cyan(message)}\n`);
        });
    }

    // Box para mensagens importantes
    async box(message, options = {}) {
        const boxConfig = {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            ...options
        };
        await this.withOutput(() => {
            console.log(boxen(message, boxConfig));
        });
    }

    // Spinner para operações em progresso
    async startSpinner(text) {
        if (await this.shouldSuppressOutput()) {
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

    async updateSpinner(text) {
        if (await this.shouldSuppressOutput()) {
            return;
        }
        if (this.spinner) {
            this.spinner.text = chalk.cyan(text);
        }
    }

    async succeedSpinner(text) {
        if (this.spinner) {
            if (await this.shouldSuppressOutput()) {
                this.spinner.stop();
            } else {
                this.spinner.succeed(chalk.green(text));
            }
            this.spinner = null;
        }
    }

    async failSpinner(text) {
        if (this.spinner) {
            if (await this.shouldSuppressOutput()) {
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
    async path(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${chalk.gray('📁')} ${chalk.blue(message)}`);
        });
    }

    // Log de comando executado
    async command(cmd) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${chalk.gray('$')} ${chalk.magenta(cmd)}`);
        });
    }

    // Separador visual
    async separator() {
        await this.withOutput(() => {
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
    async task(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}${chalk.gray('▸')} ${chalk.white(message)}`);
        });
    }

    // Log de subtarefa
    async subtask(message) {
        await this.withOutput(() => {
            console.log(`${this.getIndent()}  ${chalk.gray('•')} ${chalk.gray(message)}`);
        });
    }

    // Log de progresso
    async progress(current, total, message = '') {
        const percentage = Math.round((current / total) * 100);
        const bar = this.createProgressBar(percentage);
        const msg = message ? ` ${chalk.gray(message)}` : '';
        await this.withOutput(() => {
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
    async clear() {
        if (await this.shouldSuppressOutput()) {
            return;
        }
        console.clear();
    }

    // Nova linha
    async newline() {
        await this.withOutput(() => {
            console.log();
        });
    }
}

export default new Logger();
