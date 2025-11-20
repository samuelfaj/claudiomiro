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

  describe('Google AI SDK Specific Output Filtering', () => {
    test('should filter different Node.js deprecation warning codes', () => {
      const deprecationWarnings = [
        'Node.js DeprecationWarning [DEP0040]: Using a domain property in MakeCallback is deprecated.',
        'Node.js DeprecationWarning [DEP0005]: Buffer() constructor is deprecated.',
        'Node.js DeprecationWarning [DEP0018]: Unhandled promise rejections are deprecated.',
        'Node.js DeprecationWarning [DEP0012]: Attempting to assign to readonly property.'
      ];

      deprecationWarnings.forEach(warning => {
        const result = processGeminiMessage(warning);
        expect(result).toBeNull();
      });
    });

    test('should handle multiple deprecation warnings in single line', () => {
      const multipleWarnings = 'DEP0040: Domain warning DEP0005: Buffer warning - both should be filtered';
      const result = processGeminiMessage(multipleWarnings);
      expect(result).toBeNull();
    });

    test('should filter command line tool help output variations', () => {
      const helpOutputs = [
        'Usage: myapp [options] <command>',
        'Help: For more information see --help',
        'Options: -h, --help, -v, --version',
        'Common commands: init, build, test, deploy',
        'Syntax: command [--flag=value] [arguments]'
      ];

      helpOutputs.forEach(helpOutput => {
        const result = processGeminiMessage(helpOutput);
        expect(result).toBeNull();
      });
    });

    test('should filter version information output', () => {
      const versionOutputs = [
        'Version: 1.2.3',
        'v2.0.1-alpha.1',
        'build: 2024.01.15',
        'Release: stable'
      ];

      versionOutputs.forEach(versionOutput => {
        const result = processGeminiMessage(versionOutput);
        expect(result).toBeNull();
      });
    });

    test('should filter Google AI API debug messages', () => {
      const apiDebugMessages = [
        'Google AI: Initializing model gemini-pro...',
        'API: Sending request to generativelanguage.googleapis.com',
        'DEBUG: Authentication token acquired',
        'INFO: Rate limit: 60 requests per minute',
        'DEBUG: Streaming response started',
        'Google AI SDK: Model response received'
      ];

      apiDebugMessages.forEach(debugMsg => {
        const result = processGeminiMessage(debugMsg);
        expect(result).toBeNull();
      });
    });

    test('should filter network retry and timeout messages', () => {
      const networkMessages = [
        'Retrying request (attempt 2/3)...',
        'Network timeout, retrying...',
        'Connection failed, will retry in 5 seconds',
        'Backoff: waiting 1000ms before retry'
      ];

      networkMessages.forEach(networkMsg => {
        const result = processGeminiMessage(networkMsg);
        expect(result).toBeNull();
      });
    });

    test('should filter API key and quota warnings', () => {
      const warningMessages = [
        'Warning: API key will expire in 7 days',
        'API quota usage: 80% (8000/10000 requests)',
        'Rate limit warning: approaching daily quota',
        'Security: Consider using environment variables for API keys'
      ];

      warningMessages.forEach(warning => {
        const result = processGeminiMessage(warning);
        expect(result).toBeNull();
      });
    });
  });

  describe('Real Gemini Output Patterns', () => {
    test('should pass through legitimate Gemini responses with code blocks', () => {
      const geminiResponse = `I'll help you understand this concept:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

This function calculates the nth Fibonacci number.`;

      const result = processGeminiMessage(geminiResponse);
      expect(result).toBe(geminiResponse);
    });

    test('should pass through responses with embedded tool calls', () => {
      const responseWithTools = `Let me search for that information and then analyze it.

<function_calls>
<invoke name="search_web">
<parameter name="query">JavaScript async await best practices</parameter>
</invoke>
</function_calls>

Based on the search results, here's what I found...`;

      const result = processGeminiMessage(responseWithTools);
      expect(result).toBe(responseWithTools);
    });

    test('should pass through partial streaming responses', () => {
      const partialResponses = [
        'I think the best approach would be',
        ' to use a recursive algorithm that',
        ' handles edge cases properly.'
      ];

      partialResponses.forEach(partial => {
        const result = processGeminiMessage(partial);
        expect(result).toBe(partial.trim());
      });
    });

    test('should pass through error messages from Google AI API', () => {
      const apiErrors = [
        'The model is overloaded. Please try again later.',
        'Invalid argument: prompt must not be empty.',
        'Permission denied: API key invalid.',
        'Resource exhausted: quota exceeded.'
      ];

      apiErrors.forEach(error => {
        const result = processGeminiMessage(error);
        expect(result).toBe(error);
      });
    });

    test('should pass through response metadata and timing info', () => {
      const metadataResponses = [
        'Response generated in 1.2 seconds',
        'Tokens used: 256 (prompt), 128 (completion)',
        'Model temperature: 0.7, top_p: 0.9',
        'Safety filters: triggered for hate speech - blocked'
      ];

      metadataResponses.forEach(metadata => {
        const result = processGeminiMessage(metadata);
        expect(result).toBe(metadata);
      });
    });
  });

  describe('Unicode and Character Encoding Support', () => {
    test('should preserve Unicode content in different languages', () => {
      const multilingualContent = 'English français Español Português 中文日本語 한국어 العربية';
      const result = processGeminiMessage(multilingualContent);
      expect(result).toBe(multilingualContent);
    });

    test('should preserve emoji and special characters', () => {
      const emojiContent = '🚀 Launch successful! 🎉 Celebration time 🎯 Target hit! ⭐ Great work!';
      const result = processGeminiMessage(emojiContent);
      expect(result).toBe(emojiContent);
    });

    test('should handle special characters and escape sequences', () => {
      const specialChars = 'Special chars: \\n \\t \\" \\\' \\$ \\@ \\# \\% \\& \\*';
      const result = processGeminiMessage(specialChars);
      expect(result).toBe(specialChars);
    });

    test('should handle multi-byte character sequences', () => {
      const multiByteContent = 'Café résumé naïve façonde';
      const result = processGeminiMessage(multiByteContent);
      expect(result).toBe(multiByteContent);
    });

    test('should handle mathematical and scientific symbols', () => {
      const scientificContent = 'Mathematical symbols: ∑ ∏ ∫ √ ∞ ≈ ≠ ≤ ≥ ± ÷ ×';
      const result = processGeminiMessage(scientificContent);
      expect(result).toBe(scientificContent);
    });
  });

  describe('Edge Cases in Line Processing', () => {
    test('should handle extremely long lines', () => {
      const longLine = 'A'.repeat(1000) + ' END';
      const result = processGeminiMessage(longLine);
      expect(result).toBe(longLine);
    });

    test('should handle lines with only special characters', () => {
      const specialCharLine = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
      const result = processGeminiMessage(specialCharLine);
      expect(result).toBe(specialCharLine);
    });

    test('should handle lines that look like warnings but are legitimate content', () => {
      const warningLikeContent = [
        'The code shows a deprecation pattern in the legacy system',
        'Help: I need assistance with this warning message',
        'Usage: Warning - this API method is deprecated in newer versions',
        'Warning: This is not actually a system warning, just content'
      ];

      warningLikeContent.forEach(content => {
        const result = processGeminiMessage(content);
        expect(result).toBe(content);
      });
    });

    test('should handle color codes and ANSI escape sequences', () => {
      const ansiContent = '\u001b[31mError in red\u001b[0m \u001b[32mSuccess in green\u001b[0m';
      const result = processGeminiMessage(ansiContent);
      expect(result).toBe(ansiContent);
    });

    test('should handle malformed UTF-8 sequences gracefully', () => {
      const malformedUTF8 = 'Valid text \xC0\x80 malformed sequence \xFF\xFE more text';
      const result = processGeminiMessage(malformedUTF8);
      expect(result).toBe(malformedUTF8);
    });

    test('should handle lines with null bytes and control characters', () => {
      const controlChars = 'Text\x00with\x01null\x02bytes\x03and\x04control\x05chars';
      const result = processGeminiMessage(controlChars);
      expect(result).toBe(controlChars);
    });
  });

  describe('Integration and Performance Scenarios', () => {
    test('should handle lines containing both content and system messages', () => {
      const mixedContent = 'User response: This is helpful Help: Next command would be...';
      const result = processGeminiMessage(mixedContent);
      expect(result).toBe(mixedContent);
    });

    test('should handle multi-line warning patterns that should not be filtered', () => {
      const multilineWarning = `Warning: Custom application warning
This is a legitimate warning from the application logic
It should not be filtered out like system warnings`;

      const result = processGeminiMessage(multilineWarning);
      expect(result).toBe(multilineWarning);
    });

    test('should handle warnings with dynamic content (timestamps, PIDs)', () => {
      const dynamicWarnings = [
        '[2024-01-15 10:30:45] User warning: File not found',
        '[PID: 12345] Application alert: Memory usage high',
        '[Thread-1] Custom warning: Connection timeout'
      ];

      dynamicWarnings.forEach(warning => {
        const result = processGeminiMessage(warning);
        expect(result).toBe(warning);
      });
    });

    test('should handle high-volume processing without memory leaks', () => {
      const lines = Array(100).fill().map((_, i) => `Line ${i}: This is test content with some unicode: café résumé ${i}`);

      lines.forEach(line => {
        const result = processGeminiMessage(line);
        expect(result).toBe(line);
      });
    });
  });

  describe('Robustness and Error Handling', () => {
    test('should handle non-string input gracefully', () => {
      const nonStringInputs = [null, undefined, 123, {}, [], true];

      nonStringInputs.forEach(input => {
        expect(() => {
          processGeminiMessage(input);
        }).not.toThrow();
      });
    });

    test('should handle empty strings and various whitespace combinations', () => {
      const whitespaceInputs = [
        '',
        '   ',
        '\t\t\t',
        '\n\n\n',
        '  \t  \n  \t  ',
        '\r\n\r\n'
      ];

      whitespaceInputs.forEach(input => {
        const result = processGeminiMessage(input);
        expect(result).toBeNull(); // processGeminiMessage returns null for empty/whitespace-only lines
      });
    });

    test('should handle input types that are not strings', () => {
      const testInputs = [
        123,
        true,
        false,
        null,
        undefined,
        { text: 'object' },
        ['array'],
        new Date()
      ];

      testInputs.forEach(input => {
        expect(() => processGeminiMessage(input)).not.toThrow();
      });
    });
  });
});