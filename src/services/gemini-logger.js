/**
 * Processes Gemini JSON output and returns formatted text for display
 * @param {string} line - JSON line to process
 * @returns {string|null} - Formatted text or null if no content
 */
const processGeminiMessage = (line) => {
    try {
        const json = JSON.parse(line);

        // Gemini JSON structure typically has 'response' field
        if (json.response && json.response.text) {
            return json.response.text;
        }

        // Handle other potential JSON structures
        if (json.text) {
            return json.text;
        }

        // Handle stats/usage information
        if (json.stats) {
            const { input_tokens, output_tokens } = json.stats;
            if (input_tokens && output_tokens) {
                return `📊 Tokens: ${input_tokens} in, ${output_tokens} out`;
            }
        }

        // If no recognizable content, return null
        return null;

    } catch (e) {
        // If not valid JSON, check if it's plain text
        if (line.trim() && !line.startsWith('{') && !line.startsWith('[')) {
            return line.trim();
        }
        // If not valid JSON and not plain text, ignore
        return null;
    }
};

module.exports = { processGeminiMessage };