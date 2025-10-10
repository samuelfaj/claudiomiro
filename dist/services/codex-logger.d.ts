export interface CodexItem {
    type?: string;
    text?: string;
    command?: string;
    exit_code?: number;
    aggregated_output?: string;
    path?: string;
    display_name?: string;
    tool_name?: string;
    query?: string;
}
export interface CodexEvent {
    item?: CodexItem;
    prompt?: string;
    msg?: {
        text?: string;
        type?: string;
    };
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cached_input_tokens?: number;
    };
    error?: {
        message?: string;
    } | string;
    eventType?: string;
}
export declare class CodexLogger {
    /**
     * Processes Codex events and returns formatted text for display
     * @param line - JSON line to process
     * @returns Formatted text or null if no content
     */
    static processEvent(line: string): string | null;
}
//# sourceMappingURL=codex-logger.d.ts.map