/**
 * Step5 - GitHub PR generation and commit step
 */
export declare class Step5 {
    /**
     * Execute git commit with optional push
     * @param text - Commit message
     * @param shouldPush - Whether to push to remote
     * @returns Promise resolving when commit completes
     */
    private static gitCommit;
    /**
     * Execute step5 - Generate GitHub PR and commit changes
     * @param tasks - Array of task names
     * @param shouldPush - Whether to push to remote (default: true)
     * @returns Promise resolving when step completes
     */
    static execute(tasks: string[], shouldPush?: boolean): Promise<void>;
}
export default Step5;
//# sourceMappingURL=step5.d.ts.map