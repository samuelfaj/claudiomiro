const ITEM_ICONS = {
    agent_message: '💬',
    reasoning: '🧠',
    command_execution: '🔧',
    file_change: '📝',
    mcp_tool_call: '🔌',
    web_search: '🌐',
    default: '🛠️'
};

const formatCommandExecution = (item) => {
    if (!item.command) {
        return null;
    }

    let output = `${ITEM_ICONS.command_execution} ${item.command}`;

    if (typeof item.exit_code === 'number') {
        output += ` (exit ${item.exit_code})`;
    }

    const aggregated = item.aggregated_output ? item.aggregated_output.trimEnd() : '';
    if (aggregated) {
        output += `\n${aggregated}`;
    }

    return output;
};

const formatFileChange = (item) => {
    const target = item.path || item.display_name || 'File change';
    return `${ITEM_ICONS.file_change} ${target}`;
};

const formatReasoning = (item) => {
    if (!item.text) {
        return null;
    }
    return `${ITEM_ICONS.reasoning} ${item.text}`;
};

const formatAgentMessage = (item) => {
    return item.text || null;
};

const formatMcpToolCall = (item) => {
    const name = item.tool_name || 'Tool';
    return `${ITEM_ICONS.mcp_tool_call} ${name}`;
};

const formatWebSearch = (item) => {
    const query = item.query || 'Web search';
    return `${ITEM_ICONS.web_search} ${query}`;
};

const formatItem = (item, eventType) => {
    if (!item || eventType !== 'item.completed') {
        return null;
    }

    switch (item.type) {
        case 'agent_message':
            return formatAgentMessage(item);
        case 'reasoning':
            return formatReasoning(item);
        case 'command_execution':
            return formatCommandExecution(item);
        case 'file_change':
            return formatFileChange(item);
        case 'mcp_tool_call':
            return formatMcpToolCall(item);
        case 'web_search':
            return formatWebSearch(item);
        default:
            return null;
    }
};

const formatTurnCompleted = (event) => {
    if (!event.usage) {
        return '✅ Turn completed';
    }

    const { input_tokens, output_tokens, cached_input_tokens } = event.usage;
    const parts = [];

    if (typeof input_tokens === 'number') {
        parts.push(`in ${input_tokens}`);
    }

    if (typeof cached_input_tokens === 'number') {
        parts.push(`cached ${cached_input_tokens}`);
    }

    if (typeof output_tokens === 'number') {
        parts.push(`out ${output_tokens}`);
    }

    const suffix = parts.length ? ` (tokens: ${parts.join(', ')})` : '';
    return `✅ Turn completed${suffix}`;
};

const formatTurnFailed = (event) => {
    const error = event.error?.message || event.error || 'Unknown error';
    return `❌ Turn failed: ${error}`;
};

const processCodexEvent = (line) => {
    if (!line || !line.trim()) {
        return null;
    }

    let json;
    try {
        json = JSON.parse(line);
    } catch (error) {
        return null;
    }

    // Return null for empty JSON objects only
    if (!json || typeof json !== 'object' || Array.isArray(json) || Object.keys(json).length === 0) {
        return null;
    }

    if(json.item){
        // Return empty strings as-is (not null)
        if(json.item.text !== undefined){
            return json.item.text;
        }
        if(json.item.command !== undefined){
            return `> ` + json.item.command;
        }
        // If item exists but has no text or command, fall through to truncation
    }

    if(json.prompt !== undefined){
        return json.prompt;
    }

    if(json.msg){
        if(json.msg.text !== undefined){
            return json.msg.text;
        }
        if(json.msg.type !== undefined && json.msg.type !== null){
            const type = json.msg.type;

            if(type && type.includes('token_count')){
                return null;
            }

            if(type && type.includes('exec_command')){
                return `Executing command...`;
            }

            if(type && type.includes('agent_reasoning')){
                return `Agent reasoning...`;
            }

            return type;
        }
        // If msg exists but has no text or type, return null
        return null;
    }

    // Truncate for valid, unrecognized JSON objects with content
    return JSON.stringify(json).substring(0, 160) + '...';
};

module.exports = { processCodexEvent };
