export interface PromptReaderInterface {
    getMultilineInput(): Promise<string>;
}
export declare class PromptReader {
    /**
     * Reads multiline input from the user with proper formatting and handling
     * @returns Promise resolving to the user input string
     */
    static getMultilineInput(): Promise<string>;
}
export default PromptReader;
//# sourceMappingURL=prompt-reader.d.ts.map