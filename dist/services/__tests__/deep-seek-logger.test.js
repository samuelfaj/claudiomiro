"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deep_seek_logger_1 = require("../deep-seek-logger");
describe('DeepSeekLogger', () => {
    describe('processMessage', () => {
        it('should process assistant message with text content', () => {
            const message = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Hello from DeepSeek' }
                    ]
                }
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toBe('Hello from DeepSeek');
        });
        it('should process assistant message with tool calls', () => {
            const message = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'I will help you' },
                        {
                            type: 'tool_use',
                            name: 'Bash',
                            input: { description: 'Run command' }
                        }
                    ]
                }
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toContain('I will help you');
            expect(result).toContain('🔧 Bash: Run command');
        });
        it('should process system init message', () => {
            const message = {
                type: 'system',
                subtype: 'init'
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toBe('🚀 Starting DeepSeek...');
        });
        it('should process success result message', () => {
            const message = {
                type: 'result',
                subtype: 'success',
                duration_ms: 1500
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toContain('✅ Completed in 1.5s');
        });
        it('should process error result message', () => {
            const message = {
                type: 'result',
                subtype: 'error',
                error: 'DeepSeek error occurred'
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toBe('\n❌ Error: DeepSeek error occurred');
        });
        it('should return null for user messages', () => {
            const message = {
                type: 'user'
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toBeNull();
        });
        it('should return null for invalid JSON', () => {
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage('invalid json');
            expect(result).toBeNull();
        });
        it('should return null for empty message content', () => {
            const message = {
                type: 'assistant',
                message: {
                    content: []
                }
            };
            const result = deep_seek_logger_1.DeepSeekLogger.processMessage(JSON.stringify(message));
            expect(result).toBeNull();
        });
    });
    describe('formatToolName', () => {
        it('should format known tool names with icons', () => {
            expect(deep_seek_logger_1.DeepSeekLogger['formatToolName']('Bash')).toBe('🔧 Bash');
            expect(deep_seek_logger_1.DeepSeekLogger['formatToolName']('Read')).toBe('📖 Read');
            expect(deep_seek_logger_1.DeepSeekLogger['formatToolName']('Write')).toBe('✍️ Write');
        });
        it('should use default icon for unknown tools', () => {
            expect(deep_seek_logger_1.DeepSeekLogger['formatToolName']('UnknownTool')).toBe('🛠️ UnknownTool');
        });
    });
    describe('formatToolDescription', () => {
        it('should format Bash tool description', () => {
            const input = { description: 'Run npm install' };
            const result = deep_seek_logger_1.DeepSeekLogger['formatToolDescription']('Bash', input);
            expect(result).toBe('Run npm install');
        });
        it('should format Read tool description', () => {
            const input = { file_path: '/path/to/file.txt' };
            const result = deep_seek_logger_1.DeepSeekLogger['formatToolDescription']('Read', input);
            expect(result).toBe('Reading file.txt');
        });
        it('should format Write tool description', () => {
            const input = { file_path: '/path/to/config.json' };
            const result = deep_seek_logger_1.DeepSeekLogger['formatToolDescription']('Write', input);
            expect(result).toBe('Writing config.json');
        });
        it('should format Edit tool description', () => {
            const input = { file_path: '/path/to/script.js' };
            const result = deep_seek_logger_1.DeepSeekLogger['formatToolDescription']('Edit', input);
            expect(result).toBe('Editing script.js');
        });
        it('should return empty string for unknown tool or missing input', () => {
            expect(deep_seek_logger_1.DeepSeekLogger['formatToolDescription']('UnknownTool', {})).toBe('');
            expect(deep_seek_logger_1.DeepSeekLogger['formatToolDescription']('Bash', {})).toBe('');
        });
    });
});
//# sourceMappingURL=deep-seek-logger.test.js.map