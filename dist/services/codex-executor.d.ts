declare const executeCodex: (text: string, taskName?: string | null) => Promise<void>;
export declare class CodexExecutor {
    /**
     * Execute Codex with the given text
     * @param text The text to execute with Codex
     * @returns Promise resolving when execution completes
     */
    static execute(text: string): Promise<void>;
}
export { executeCodex };
//# sourceMappingURL=codex-executor.d.ts.map