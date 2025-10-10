export declare class GeminiExecutor {
    /**
     * Execute Gemini with the given text
     * @param text The text to execute with Gemini
     * @param taskName Optional task name for parallel execution
     * @returns Promise resolving when execution completes
     */
    static execute(text: string, taskName?: string | null): Promise<void>;
}
declare const executeGemini: (text: string, taskName?: string | null) => Promise<void>;
export { executeGemini };
//# sourceMappingURL=gemini-executor.d.ts.map