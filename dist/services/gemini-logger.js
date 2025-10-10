"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiLogger = void 0;
class GeminiLogger {
    /**
     * Processes Gemini output and returns formatted text for display
     * @param line - Text line to process
     * @returns Formatted text or null if no content
     */
    static processMessage(line) {
        // Skip empty lines
        if (!line.trim())
            return null;
        // Skip deprecation warnings
        if (line.includes('DEP0040') || line.includes('punycode'))
            return null;
        // Skip help/option output
        if (line.includes('Options:') || line.includes('--help'))
            return null;
        // Return the actual content
        return line.trim();
    }
}
exports.GeminiLogger = GeminiLogger;
//# sourceMappingURL=gemini-logger.js.map