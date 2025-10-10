export interface Step0Options {
    sameBranch?: boolean;
    promptText?: string | null;
    mode?: 'auto' | 'hard';
}
export interface Step0Result {
    success: boolean;
    message?: string;
    error?: Error;
}
export declare class Step0 {
    /**
     * Execute step0 - Initialize task and create tasks structure
     * @param options Step0 configuration options
     * @returns Promise resolving to step execution result
     */
    static execute(options?: Step0Options): Promise<Step0Result>;
}
export default Step0;
//# sourceMappingURL=step0.d.ts.map