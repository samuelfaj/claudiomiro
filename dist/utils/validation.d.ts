export declare class Validation {
    /**
     * Checks if a TODO file is fully implemented
     * @param file - Path to the TODO file
     * @returns true if the file contains "Fully implemented: YES" in the first 10 lines
     */
    static isFullyImplemented(file: string): boolean;
    /**
     * Checks if a file has an approved code review status
     * @param file - Path to the file to check
     * @returns true if the file contains "approved" in the status section
     */
    static hasApprovedCodeReview(file: string): boolean;
}
//# sourceMappingURL=validation.d.ts.map