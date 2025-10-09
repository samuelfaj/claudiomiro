const { processGeminiMessage } = require('../gemini-logger');

describe('gemini-logger', () => {
  describe('processGeminiMessage', () => {
    it('should return null for empty lines', () => {
      expect(processGeminiMessage('')).toBeNull();
      expect(processGeminiMessage('   ')).toBeNull();
      expect(processGeminiMessage('\n')).toBeNull();
    });

    it('should return null for deprecation warnings', () => {
      expect(processGeminiMessage('DeprecationWarning: something')).toBeNull();
      expect(processGeminiMessage('punycode is deprecated')).toBeNull();
      expect(processGeminiMessage('node --trace-deprecation')).toBeNull();
    });

    describe('assistant messages', () => {
      it('should extract text from valid Gemini assistant message', () => {
        const message = {
          candidates: [{
            content: {
              parts: [{ text: 'Hello world' }]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('Hello world');
      });

      it('should handle multiple text parts', () => {
        const message = {
          candidates: [{
            content: {
              parts: [
                { text: 'Hello ' },
                { text: 'world ' },
                { text: 'from Gemini' }
              ]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('Hello world from Gemini');
      });

      it('should return null for messages without candidates', () => {
        const message = { type: 'other' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });

      it('should return null for messages with empty candidates', () => {
        const message = { candidates: [] };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });

      it('should return null for messages with candidates but no content', () => {
        const message = { candidates: [{}] };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });

      it('should return null for messages with content but no parts', () => {
        const message = { candidates: [{ content: {} }] };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });

      it('should return null for messages with parts but no text', () => {
        const message = {
          candidates: [{
            content: {
              parts: [{ type: 'other' }]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });

      it('should handle mixed parts (text and non-text)', () => {
        const message = {
          candidates: [{
            content: {
              parts: [
                { text: 'Hello ' },
                { type: 'other', data: 'something' },
                { text: 'world' }
              ]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('Hello world');
      });
    });

    describe('system messages', () => {
      it('should return start message for system start type', () => {
        const message = { type: 'start' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('🚀 Starting Gemini...');
      });

      it('should return null for other system types', () => {
        const message = { type: 'system', subtype: 'other' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });
    });

    describe('result messages', () => {
      it('should return completion message for end type with duration', () => {
        const message = { type: 'end', duration_ms: 2500 };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('\n✅ Completed in 2.5s');
      });

      it('should return completion message for end type without duration', () => {
        const message = { type: 'end' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('\n✅ Completed in unknowns');
      });

      it('should return error message for error type', () => {
        const message = { type: 'error', error: 'Something went wrong' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('\n❌ Error: Something went wrong');
      });

      it('should return default error message for error type without error', () => {
        const message = { type: 'error' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe('\n❌ Error: Unknown error');
      });

      it('should return null for unknown result types', () => {
        const message = { type: 'result', subtype: 'unknown' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should return null for invalid JSON', () => {
        const result = processGeminiMessage('not json');
        expect(result).toBeNull();
      });

      it('should return null for malformed JSON', () => {
        const result = processGeminiMessage('{ "invalid": json }');
        expect(result).toBeNull();
      });

      it('should return null for JSON with unexpected structure', () => {
        const message = { unexpected: 'structure' };
        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBeNull();
      });

      it('should handle very long text content', () => {
        const longText = 'a'.repeat(1000);
        const message = {
          candidates: [{
            content: {
              parts: [{ text: longText }]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe(longText);
      });

      it('should handle special characters in text', () => {
        const specialText = 'Hello 🌍! Test with emoji: 🚀 and symbols: ©®™';
        const message = {
          candidates: [{
            content: {
              parts: [{ text: specialText }]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe(specialText);
      });

      it('should handle newlines in text content', () => {
        const multilineText = 'Line 1\nLine 2\nLine 3';
        const message = {
          candidates: [{
            content: {
              parts: [{ text: multilineText }]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(message));
        expect(result).toBe(multilineText);
      });
    });

    describe('integration scenarios', () => {
      it('should process realistic Gemini response', () => {
        const realisticMessage = {
          candidates: [{
            content: {
              parts: [
                { text: 'I\'m Gemini, an AI assistant. ' },
                { text: 'I can help you with various tasks. ' },
                { text: 'What would you like to know?' }
              ]
            }
          }]
        };

        const result = processGeminiMessage(JSON.stringify(realisticMessage));
        expect(result).toBe('I\'m Gemini, an AI assistant. I can help you with various tasks. What would you like to know?');
      });

      it('should handle streaming response chunks', () => {
        const chunk1 = {
          candidates: [{
            content: {
              parts: [{ text: 'Hello ' }]
            }
          }]
        };

        const chunk2 = {
          candidates: [{
            content: {
              parts: [{ text: 'world!' }]
            }
          }]
        };

        const result1 = processGeminiMessage(JSON.stringify(chunk1));
        const result2 = processGeminiMessage(JSON.stringify(chunk2));

        expect(result1).toBe('Hello ');
        expect(result2).toBe('world!');
      });

      it('should handle mixed message types in sequence', () => {
        const startMessage = { type: 'start' };
        const assistantMessage = {
          candidates: [{
            content: {
              parts: [{ text: 'Processing your request...' }]
            }
          }]
        };
        const endMessage = { type: 'end', duration_ms: 1500 };

        const result1 = processGeminiMessage(JSON.stringify(startMessage));
        const result2 = processGeminiMessage(JSON.stringify(assistantMessage));
        const result3 = processGeminiMessage(JSON.stringify(endMessage));

        expect(result1).toBe('🚀 Starting Gemini...');
        expect(result2).toBe('Processing your request...');
        expect(result3).toBe('\n✅ Completed in 1.5s');
      });

      it('should handle error scenario', () => {
        const startMessage = { type: 'start' };
        const errorMessage = { type: 'error', error: 'Connection timeout' };

        const result1 = processGeminiMessage(JSON.stringify(startMessage));
        const result2 = processGeminiMessage(JSON.stringify(errorMessage));

        expect(result1).toBe('🚀 Starting Gemini...');
        expect(result2).toBe('\n❌ Error: Connection timeout');
      });
    });
  });
});