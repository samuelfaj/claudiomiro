"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codex_logger_1 = require("../codex-logger");
describe('CodexLogger', () => {
    describe('processEvent', () => {
        it('should return null for empty lines', () => {
            const result = codex_logger_1.CodexLogger.processEvent('');
            expect(result).toBeNull();
        });
        it('should return null for whitespace-only lines', () => {
            const result = codex_logger_1.CodexLogger.processEvent('   \n\t  ');
            expect(result).toBeNull();
        });
        it('should return null for invalid JSON', () => {
            const result = codex_logger_1.CodexLogger.processEvent('invalid json');
            expect(result).toBeNull();
        });
        it('should handle item-based events with text', () => {
            const event = {
                item: {
                    text: 'Hello from Codex'
                }
            };
            const result = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event));
            expect(result).toBe('Hello from Codex');
        });
        it('should handle item-based events with command', () => {
            const event = {
                item: {
                    command: 'npm install'
                }
            };
            const result = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event));
            expect(result).toBe('> npm install');
        });
        it('should handle prompt events', () => {
            const event = {
                prompt: 'What would you like to do?'
            };
            const result = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event));
            expect(result).toBe('What would you like to do?');
        });
        it('should handle message events with text', () => {
            const event = {
                msg: {
                    text: 'Processing request'
                }
            };
            const result = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event));
            expect(result).toBe('Processing request');
        });
        it('should handle message type events', () => {
            const event1 = {
                msg: {
                    type: 'exec_command'
                }
            };
            const event2 = {
                msg: {
                    type: 'agent_reasoning'
                }
            };
            const event3 = {
                msg: {
                    type: 'token_count'
                }
            };
            const result1 = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event1));
            const result2 = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event2));
            const result3 = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event3));
            expect(result1).toBe('Executing command...');
            expect(result2).toBe('Agent reasoning...');
            expect(result3).toBeNull();
        });
        it('should return type for other message types', () => {
            const event = {
                msg: {
                    type: 'custom_type'
                }
            };
            const result = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event));
            expect(result).toBe('custom_type');
        });
        it('should fallback to JSON stringify for unknown events', () => {
            const event = {
                eventType: 'unknown',
                usage: {
                    input_tokens: 100,
                    output_tokens: 50
                }
            };
            const result = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event));
            expect(result).toContain('unknown');
            expect(result).toContain('input_tokens');
            expect(result).toContain('output_tokens');
            expect(result).toContain('...');
        });
        it('should handle error events', () => {
            const event1 = {
                error: 'Something went wrong'
            };
            const event2 = {
                error: {
                    message: 'Detailed error message'
                }
            };
            const result1 = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event1));
            const result2 = codex_logger_1.CodexLogger.processEvent(JSON.stringify(event2));
            expect(result1).toContain('Something went wrong');
            expect(result2).toContain('Detailed error message');
        });
    });
});
//# sourceMappingURL=codex-logger.test.js.map