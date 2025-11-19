const { processGeminiMessage } = require('./gemini-logger');

describe('Gemini Logger', () => {
  describe('processGeminiMessage', () => {
    test('should return plain text content', () => {
      const result = processGeminiMessage('Hello world');
      expect(result).toBe('Hello world');
    });

    test('should skip empty lines', () => {
      const result = processGeminiMessage('');
      expect(result).toBeNull();
    });

    test('should skip whitespace-only lines', () => {
      const result = processGeminiMessage('   ');
      expect(result).toBeNull();
    });

    test('should skip deprecation warnings', () => {
      const result = processGeminiMessage('(node:12345) [DEP0040] DeprecationWarning: The `punycode` module is deprecated');
      expect(result).toBeNull();
    });

    test('should skip help/option output', () => {
      const result = processGeminiMessage('Options:');
      expect(result).toBeNull();
    });

    test('should skip --help output', () => {
      const result = processGeminiMessage('--help');
      expect(result).toBeNull();
    });

    test('should trim whitespace from valid content', () => {
      const result = processGeminiMessage('  Hello world  ');
      expect(result).toBe('Hello world');
    });

    test('should handle multi-line content', () => {
      const result1 = processGeminiMessage('Line 1');
      const result2 = processGeminiMessage('Line 2');
      expect(result1).toBe('Line 1');
      expect(result2).toBe('Line 2');
    });

    test('should handle JSON input as plain text (not parse it)', () => {
      const jsonString = '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}';
      const result = processGeminiMessage(jsonString);
      expect(result).toBe(jsonString);
    });
  });
});