/**
 * Icons for different tool types
 */
const TOOL_ICONS = {
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
const formatToolName = (name) => {
    const icon = TOOL_ICONS[name] || TOOL_ICONS.default;
    return `${icon} ${name}`;
};

/**
 * Formats tool description for display
 */
const formatToolDescription = (toolName, input) => {
    if (toolName === 'Bash' && input.description) {
        return input.description;
    }
    if (toolName === 'Read' && input.file_path) {
        const fileName = input.file_path.split('/').pop();
        return `Reading ${fileName}`;
    }
    if (toolName === 'Write' && input.file_path) {
        const fileName = input.file_path.split('/').pop();
        return `Writing ${fileName}`;
    }
    if (toolName === 'Edit' && input.file_path) {
        const fileName = input.file_path.split('/').pop();
        return `Editing ${fileName}`;
    }
    return '';
};

/**
 * Processes assistant messages (Claude)
 */
const processAssistantMessage = (json) => {
    if (!json.message || !json.message.content) return null;

    let output = '';

    for (const msg of json.message.content) {
        // Claude's text
        if (msg.type === 'text' && msg.text) {
            output += msg.text;
        }
        // Tool calls
        else if (msg.type === 'tool_use') {
            const toolDisplay = formatToolName(msg.name);
            const description = formatToolDescription(msg.name, msg.input);

            if (description) {
                output += `\n${toolDisplay}: ${description}`;
            } else {
                output += `\n${toolDisplay}`;
            }
        }
    }

    return output || null;
};

/**
 * Processes user messages (tool results)
 */
const processUserMessage = () => {
    // For now, we don't show tool results to avoid clutter
    // Claude already shows what's important in its text
    return null;
};

/**
 * Processes system messages
 */
const processSystemMessage = (json) => {
    if (json.subtype === 'init') {
        return '🚀 Starting Claude...';
    }
    return null;
};

/**
 * Processes final result messages
 */
const processResultMessage = (json) => {
    if (json.subtype === 'success') {
        const duration = (json.duration_ms / 1000).toFixed(1);
        const cost = json.total_cost_usd ? `$${json.total_cost_usd.toFixed(4)}` : '';

        let output = `\n✅ Completed in ${duration}s`;
        if (cost) output += ` (${cost})`;

        return output;
    }
    if (json.subtype === 'error') {
        return `\n❌ Error: ${json.error || 'Unknown error'}`;
    }
    return null;
};

/**
 * Processes Claude JSON and returns formatted text for display
 * @param {string} line - JSON line to process
 * @returns {string|null} - Formatted text or null if no content
 */
const processClaudeMessage = (line) => {
    try {
        const json = JSON.parse(line);

        // Process different message types
        switch (json.type) {
            case 'assistant':
                return processAssistantMessage(json);
            case 'user':
                return processUserMessage(json);
            case 'system':
                return processSystemMessage(json);
            case 'result':
                return processResultMessage(json);
            default:
                return null;
        }
    } catch (e) {
        // If not valid JSON, ignore (probably junk in the stream)
        return null;
    }
};

module.exports = { processClaudeMessage };
