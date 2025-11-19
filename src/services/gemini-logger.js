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
 * Processes assistant messages (Gemini)
 */
const processAssistantMessage = (json) => {
    if (!json.message || !json.message.content) return null;

    let output = '';

    for (const msg of json.message.content) {
        // Gemini's text
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
    // Gemini already shows what's important in its text
    return null;
};

/**
 * Processes system messages
 */
const processSystemMessage = (json) => {
    if (json.subtype === 'init') {
        return '🚀 Starting Gemini...';
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
 * Processes Gemini output and returns formatted text for display
 * @param {string} line - Text line to process
 * @returns {string|null} - Formatted text or null if no content
 */
const processGeminiMessage = (line) => {
    // Handle null/undefined input
    if (!line || typeof line !== 'string') return null;

    // Skip empty lines
    if (!line.trim()) return null;

    // Skip deprecation warnings
    if (line.includes('DEP0040') || line.includes('punycode')) return null;

    // Skip help/option output
    if (line.includes('Options:') || line.includes('--help')) return null;

    // Return the actual content
    return line.trim();
};

module.exports = { processGeminiMessage };