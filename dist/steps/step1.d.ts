/**
 * Step 1: Analyzes all tasks created by step0 and defines which can run in parallel
 * based on file conflicts and logical dependencies
 */
export declare class Step1 {
    /**
     * Executes step1 to analyze task dependencies
     * @param mode - Analysis mode: 'auto' for automatic analysis, 'hard' for deep reasoning
     */
    static execute(mode?: 'auto' | 'hard'): Promise<void>;
    /**
     * Reads all task directories from the claudiomiro folder
     */
    private static readTasks;
    /**
     * Handles the case when there's only one task
     */
    private static handleSingleTask;
    /**
     * Reads the content of each task's TASK.md and PROMPT.md files
     */
    private static readTaskContents;
    /**
     * Builds a formatted description of all tasks for the prompt
     */
    private static buildTasksDescription;
    /**
     * Applies sequential dependencies as fallback
     */
    private static applySequentialDependencies;
    /**
     * Generates the prompt for automatic mode analysis
     */
    private static getAutoModePrompt;
    /**
     * Generates the prompt for hard mode analysis
     */
    private static getHardModePrompt;
}
//# sourceMappingURL=step1.d.ts.map