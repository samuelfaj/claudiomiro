export declare class DeepSeekExecutor {
    /**
     * Execute DeepSeek with the given text
     * @param text The text to execute with DeepSeek
     * @param taskName Optional task name for parallel execution
     * @returns Promise resolving when execution completes
     */
    static execute(text: string, taskName?: string | null): Promise<void>;
}
declare const executeDeepSeek: (text: string, taskName?: string | null) => Promise<void>;
export { executeDeepSeek };
//# sourceMappingURL=deep-seek-executor.d.ts.map