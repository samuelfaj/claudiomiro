export interface ToolInput {
    description?: string;
    file_path?: string;
}
export interface MessageContent {
    type: string;
    text?: string;
    name?: string;
    input?: ToolInput;
}
export interface DeepSeekMessage {
    type: 'assistant' | 'user' | 'system' | 'result';
    message?: {
        content: MessageContent[];
    };
    subtype?: string;
    duration_ms?: number;
    total_cost_usd?: number;
    error?: string;
}
export declare class DeepSeekLogger {
    /**
     * Icons for different tool types
     */
    private static readonly TOOL_ICONS;
    /**
     * Formats tool name for friendly display
     */
    private static formatToolName;
    /**
     * Formats tool description for display
     */
    private static formatToolDescription;
    /**
     * Processes assistant messages (DeepSeek)
     */
    private static processAssistantMessage;
    /**
     * Processes user messages (tool results)
     */
    private static processUserMessage;
    /**
     * Processes system messages
     */
    private static processSystemMessage;
    /**
     * Processes final result messages
     */
    private static processResultMessage;
    /**
     * Processes DeepSeek JSON and returns formatted text for display
     * @param line - JSON line to process
     * @returns Formatted text or null if no content
     */
    static processMessage(line: string): string | null;
}
//# sourceMappingURL=deep-seek-logger.d.ts.map