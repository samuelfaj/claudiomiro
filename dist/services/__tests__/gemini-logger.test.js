"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gemini_logger_1 = require("../gemini-logger");
describe('GeminiLogger', () => {
    describe('processMessage', () => {
        it('should return trimmed content for valid lines', () => {
            const result = gemini_logger_1.GeminiLogger.processMessage('  Hello world  ');
            expect(result).toBe('Hello world');
        });
        it('should return null for empty lines', () => {
            const result = gemini_logger_1.GeminiLogger.processMessage('');
            expect(result).toBeNull();
        });
        it('should return null for whitespace-only lines', () => {
            const result = gemini_logger_1.GeminiLogger.processMessage('   \n\t  ');
            expect(result).toBeNull();
        });
        it('should return null for deprecation warnings', () => {
            const result1 = gemini_logger_1.GeminiLogger.processMessage('DEP0040: Something deprecated');
            const result2 = gemini_logger_1.GeminiLogger.processMessage('punycode is deprecated');
            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });
        it('should return null for help/option output', () => {
            const result1 = gemini_logger_1.GeminiLogger.processMessage('Options:');
            const result2 = gemini_logger_1.GeminiLogger.processMessage('--help');
            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });
        it('should return content for normal text', () => {
            const result = gemini_logger_1.GeminiLogger.processMessage('This is normal output');
            expect(result).toBe('This is normal output');
        });
        it('should handle lines with mixed content', () => {
            const result = gemini_logger_1.GeminiLogger.processMessage('  Normal text with spaces  ');
            expect(result).toBe('Normal text with spaces');
        });
    });
});
//# sourceMappingURL=gemini-logger.test.js.map