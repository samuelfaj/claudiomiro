/**
 * Processes Gemini assistant messages
 */
const processAssistantMessage = (json) => {
    if (!json.candidates || !json.candidates[0] || !json.candidates[0].content) return null;

    let output = '';
    const content = json.candidates[0].content;

    for (const part of content.parts) {
        if (part.text) {
            output += part.text;
        }
    }

    return output || null;
};

/**
 * Processes Gemini system messages
 */
const processSystemMessage = (json) => {
    if (json.type === 'start') {
        return '🚀 Starting Gemini...';
    }
    return null;
};

/**
 * Processes Gemini final result messages
 */
const processResultMessage = (json) => {
    if (json.type === 'end') {
        const duration = json.duration_ms ? (json.duration_ms / 1000).toFixed(1) : 'unknown';
        return `\n✅ Completed in ${duration}s`;
    }
    if (json.type === 'error') {
        return `\n❌ Error: ${json.error || 'Unknown error'}`;
    }
    return null;
};

/**
 * Processes Gemini CLI output and returns formatted text for display
 * @param {string} line - Line to process
 * @returns {string|null} - Formatted text or null if no content
 */
const processGeminiMessage = (line) => {
    // Skip empty lines
    if (!line.trim()) {
        return null;
    }

    // Skip deprecation warnings and other system messages
    if (line.includes('DeprecationWarning') ||
        line.includes('punycode') ||
        line.includes('node --trace-deprecation')) {
        return null;
    }

    try {
        const json = JSON.parse(line);

        // Process different message types based on Gemini CLI output format
        if (json.candidates) {
            return processAssistantMessage(json);
        }
        if (json.type === 'start') {
            return processSystemMessage(json);
        }
        if (json.type === 'end' || json.type === 'error') {
            return processResultMessage(json);
        }

        return null;
    } catch (e) {
        // If not valid JSON, ignore (probably junk in the stream)
        return null;
    }
};

module.exports = { processGeminiMessage };