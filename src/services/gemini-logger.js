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
    if (line === null || line === undefined || typeof line !== 'string') return null;

    // Skip deprecation warnings (be more specific)
    if (line.includes('DeprecationWarning') || line.includes('DEP')) return null;

    // Skip help/option output variations (but allow "Usage:" when it's part of legitimate content)
    if (line.includes('Options:') || line.includes('--help') ||
        line.includes('Syntax:') || line.includes('Common commands:') ||
        (line.startsWith('Help:') && line.includes('For more information'))) {
        return null;
    }

    // Skip "Usage:" only when it's clearly help output, not legitimate content
    if (line.match(/^Usage:\s*\w+.*\[.*\]/)) {
        return null;
    }

    // Skip version information
    if (line.includes('Version:') || line.includes('build:') || line.includes('Release:') ||
        line.match(/^v\d+\.\d+/)) {
        return null;
    }

    // Skip Google AI API debug messages
    if (line.includes('Google AI:') || line.includes('DEBUG:') ||
        line.includes('INFO: Rate limit') || line.includes('Google AI SDK:')) {
        return null;
    }

    // Skip network retry and timeout messages
    if (line.includes('Retrying request') || line.includes('Backoff:') ||
        line.includes('Connection failed') || line.includes('will retry')) {
        return null;
    }

    // Skip API key and quota warnings (but allow legitimate error messages about API keys)
    if (line.includes('API quota') || line.includes('quota usage') ||
        line.includes('Rate limit warning') || line.includes('daily quota') ||
        (line.includes('API key') && line.includes('Warning')) ||
        (line.includes('Security') && line.includes('environment variables')) ||
        line.includes('Security:')) {
        return null;
    }

    // Skip "API:" when it's debug messages, but allow it in error context
    if (line.includes('API:') && line.includes('Sending request to')) {
        return null;
    }

    // Skip retry-related messages
    if (line.includes('retry') && (line.includes('Network') || line.includes('timeout'))) {
        return null;
    }

    // Trim whitespace from content
    const trimmed = line.trim();

    // Skip empty lines and whitespace-only lines
    if (trimmed === '') {
        return null;
    }

    // Return trimmed content
    return trimmed;
};

module.exports = { processGeminiMessage };