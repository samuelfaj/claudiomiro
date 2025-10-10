declare const executeClaude: (text: string, taskName?: string | null) => Promise<void>;
declare class ClaudeExecutor {
    /**
     * Execute Claude with the given text
     * @param text The text to execute with Claude
     * @param taskName Optional task name for parallel execution
     * @returns Promise resolving when execution completes
     */
    static execute(text: string, taskName?: string | null): Promise<void>;
}
export { executeClaude, ClaudeExecutor };
//# sourceMappingURL=claude-executor.d.ts.map