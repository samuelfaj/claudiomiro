"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexLogger = void 0;
class CodexLogger {
    /**
     * Processes Codex events and returns formatted text for display
     * @param line - JSON line to process
     * @returns Formatted text or null if no content
     */
    static processEvent(line) {
        if (!line || !line.trim()) {
            return null;
        }
        let json;
        try {
            json = JSON.parse(line);
        }
        catch (error) {
            return null;
        }
        // Handle item-based events
        if (json.item) {
            if (json.item.text) {
                return json.item.text;
            }
            if (json.item.command) {
                return `> ` + json.item.command;
            }
        }
        // Handle prompt events
        if (json.prompt) {
            return json.prompt;
        }
        // Handle message events
        if (json.msg && json.msg.text) {
            return json.msg.text;
        }
        // Handle message type events
        if (json.msg && json.msg.type) {
            const type = json.msg.type;
            if (type.includes('token_count')) {
                return null;
            }
            if (type.includes('exec_command')) {
                return `Executing command...`;
            }
            if (type.includes('agent_reasoning')) {
                return `Agent reasoning...`;
            }
            return type;
        }
        // Fallback: stringify the JSON
        return JSON.stringify(json).substring(0, 160) + '...';
    }
}
exports.CodexLogger = CodexLogger;
//# sourceMappingURL=codex-logger.js.map