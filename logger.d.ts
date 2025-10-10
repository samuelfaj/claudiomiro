declare const _exports: Logger;
export = _exports;
declare class Logger {
    spinner: ora.Ora | null;
    indentLevel: number;
    shouldSuppressOutput(): boolean;
    withOutput(action: any): void;
    getIndent(): string;
    banner(): void;
    info(message: any): void;
    success(message: any): void;
    warning(message: any): void;
    error(message: any): void;
    step(task: any, tasks: any, number: any, message: any): void;
    box(message: any, options?: {}): void;
    startSpinner(text: any): void;
    updateSpinner(text: any): void;
    succeedSpinner(text: any): void;
    failSpinner(text: any): void;
    stopSpinner(): void;
    path(message: any): void;
    command(cmd: any): void;
    separator(): void;
    indent(): void;
    outdent(): void;
    resetIndent(): void;
    task(message: any): void;
    subtask(message: any): void;
    progress(current: any, total: any, message?: string): void;
    createProgressBar(percentage: any): string;
    clear(): void;
    newline(): void;
}
import ora = require("ora");
//# sourceMappingURL=logger.d.ts.map