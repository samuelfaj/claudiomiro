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

export interface ClaudeMessage {
    type: 'assistant' | 'user' | 'system' | 'result';
    message?: {
        content: MessageContent[];
    };
    subtype?: string;
    duration_ms?: number;
    total_cost_usd?: number;
    error?: string;
}

export class ClaudeLogger {
    /**
     * Icons for different tool types
     */
    private static readonly TOOL_ICONS: Record<string, string> = {
        'Bash': '🔧',
        'Read': '📖',
        'Write': '✍️',
        'Edit': '📝',
        'Glob': '🔍',
        'Grep': '🔎',
        'Task': '📋',
        'TodoWrite': '✅',
        'WebFetch': '🌐',
        'WebSearch': '🔎',
        'default': '🛠️'
    };

    /**
     * Formats tool name for friendly display
     */
    private static formatToolName(name: string): string {
        const icon = ClaudeLogger.TOOL_ICONS[name] || ClaudeLogger.TOOL_ICONS.default;
        return `${icon} ${name}`;
    }

    /**
     * Formats tool description for display
     */
    private static formatToolDescription(toolName: string, input?: ToolInput): string {
        if (toolName === 'Bash' && input?.description) {
            return input.description;
        }
        if (toolName === 'Read' && input?.file_path) {
            const fileName = input.file_path.split('/').pop();
            return `Reading ${fileName}`;
        }
        if (toolName === 'Write' && input?.file_path) {
            const fileName = input.file_path.split('/').pop();
            return `Writing ${fileName}`;
        }
        if (toolName === 'Edit' && input?.file_path) {
            const fileName = input.file_path.split('/').pop();
            return `Editing ${fileName}`;
        }
        return '';
    }

    /**
     * Processes assistant messages (Claude)
     */
    private static processAssistantMessage(json: ClaudeMessage): string | null {
        if (!json.message || !json.message.content) return null;

        let output = '';

        for (const msg of json.message.content) {
            // Claude's text
            if (msg.type === 'text' && msg.text) {
                output += msg.text;
            }
            // Tool calls
            else if (msg.type === 'tool_use') {
                const toolDisplay = ClaudeLogger.formatToolName(msg.name || '');
                const description = ClaudeLogger.formatToolDescription(msg.name || '', msg.input);

                if (description) {
                    output += `\n${toolDisplay}: ${description}`;
                } else {
                    output += `\n${toolDisplay}`;
                }
            }
        }

        return output || null;
    }

    /**
     * Processes user messages (tool results)
     */
    private static processUserMessage(): null {
        // For now, we don't show tool results to avoid clutter
        // Claude already shows what's important in its text
        return null;
    }

    /**
     * Processes system messages
     */
    private static processSystemMessage(json: ClaudeMessage): string | null {
        if (json.subtype === 'init') {
            return '🚀 Starting Claude...';
        }
        return null;
    }

    /**
     * Processes final result messages
     */
    private static processResultMessage(json: ClaudeMessage): string | null {
        if (json.subtype === 'success') {
            const duration = ((json.duration_ms || 0) / 1000).toFixed(1);
            const cost = json.total_cost_usd ? `$${json.total_cost_usd.toFixed(4)}` : '';

            let output = `\n✅ Completed in ${duration}s`;
            if (cost) output += ` (${cost})`;

            return output;
        }
        if (json.subtype === 'error') {
            return `\n❌ Error: ${json.error || 'Unknown error'}`;
        }
        return null;
    }

    /**
     * Processes Claude JSON and returns formatted text for display
     * @param line - JSON line to process
     * @returns Formatted text or null if no content
     */
    public static processMessage(line: string): string | null {
        try {
            const json: ClaudeMessage = JSON.parse(line);

            // Process different message types
            switch (json.type) {
                case 'assistant':
                    return ClaudeLogger.processAssistantMessage(json);
                case 'user':
                    return ClaudeLogger.processUserMessage();
                case 'system':
                    return ClaudeLogger.processSystemMessage(json);
                case 'result':
                    return ClaudeLogger.processResultMessage(json);
                default:
                    return null;
            }
        } catch (e) {
            // If not valid JSON, ignore (probably junk in the stream)
            return null;
        }
    }
}