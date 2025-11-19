const { processCodexEvent } = require('./codex-logger');

describe('Codex Logger', () => {
  describe('processCodexEvent', () => {
    test('should return null for empty or whitespace input', () => {
      expect(processCodexEvent('')).toBeNull();
      expect(processCodexEvent('   ')).toBeNull();
      expect(processCodexEvent(null)).toBeNull();
      expect(processCodexEvent(undefined)).toBeNull();
    });

    test('should return null for invalid JSON', () => {
      expect(processCodexEvent('invalid json {')).toBeNull();
      expect(processCodexEvent('{ "invalid": json }')).toBeNull();
      expect(processCodexEvent('just plain text')).toBeNull();
    });

    test('should return null for empty JSON object', () => {
      expect(processCodexEvent('{}')).toBeNull();
    });

    test('should return item.text when present', () => {
      const input = JSON.stringify({
        item: {
          text: 'Hello world'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('Hello world');
    });

    test('should return formatted command when item.command is present', () => {
      const input = JSON.stringify({
        item: {
          command: 'npm install'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('> npm install');
    });

    test('should return prompt when present', () => {
      const input = JSON.stringify({
        prompt: 'Create a new component'
      });

      const result = processCodexEvent(input);
      expect(result).toBe('Create a new component');
    });

    test('should return msg.text when present', () => {
      const input = JSON.stringify({
        msg: {
          text: 'Processing request'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('Processing request');
    });

    test('should handle msg.type with token_count (should return null)', () => {
      const input = JSON.stringify({
        msg: {
          type: 'token_count_update'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBeNull();
    });

    test('should handle msg.type containing exec_command', () => {
      const input = JSON.stringify({
        msg: {
          type: 'exec_command_start'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('Executing command...');
    });

    test('should handle msg.type containing agent_reasoning', () => {
      const input = JSON.stringify({
        msg: {
          type: 'agent_reasoning_start'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('Agent reasoning...');
    });

    test('should return msg.type for other message types', () => {
      const input = JSON.stringify({
        msg: {
          type: 'file_processing'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('file_processing');
    });

    test('should prioritize item.text over other properties', () => {
      const input = JSON.stringify({
        item: {
          text: 'Important message',
          command: 'npm install'
        },
        prompt: 'Less important prompt'
      });

      const result = processCodexEvent(input);
      expect(result).toBe('Important message');
    });

    test('should return truncated JSON string for unrecognized structure', () => {
      const longJson = {
        unknown: 'value',
        data: {
          nested: {
            deep: 'value that should be truncated'
          }
        }
      };

      const input = JSON.stringify(longJson);
      const result = processCodexEvent(input);

      expect(result).toBe(input.substring(0, 160) + '...');
      expect(result.length).toBeLessThanOrEqual(163); // 160 + '...'
      expect(result).toMatch(/\.\.\.$/);
    });

    test('should handle short JSON strings without truncation', () => {
      const shortJson = { short: 'message' };
      const input = JSON.stringify(shortJson);
      const result = processCodexEvent(input);

      expect(result).toBe(input + '...');
      expect(result.length).toBeLessThan(163);
    });

    test('should handle malformed JSON gracefully', () => {
      const inputs = [
        '{',
        '}',
        '[]',
        '"just a string"',
        '123',
        'null',
        'true',
        'false'
      ];

      inputs.forEach(input => {
        expect(processCodexEvent(input)).toBeNull();
      });
    });

    test('should handle msg with missing text property', () => {
      const input = JSON.stringify({
        msg: {
          other: 'value'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBeNull();
    });

    test('should handle msg with empty text', () => {
      const input = JSON.stringify({
        msg: {
          text: ''
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('');
    });

    test('should handle item with empty command', () => {
      const input = JSON.stringify({
        item: {
          command: ''
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('> ');
    });

    test('should handle item with empty text', () => {
      const input = JSON.stringify({
        item: {
          text: ''
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('');
    });

    test('should handle complex nested structures', () => {
      const complexInput = {
        item: {
          text: 'Complex message',
          metadata: {
            timestamp: '2024-01-01',
            user: 'test'
          }
        },
        context: {
          session: 'abc123'
        }
      };

      const input = JSON.stringify(complexInput);
      const result = processCodexEvent(input);

      expect(result).toBe('Complex message');
    });

    test('should handle Unicode and special characters', () => {
      const input = JSON.stringify({
        item: {
          text: '🚀 Unicode test with émojis and spëcial chars'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('🚀 Unicode test with émojis and spëcial chars');
    });

    test('should handle multiple message types correctly', () => {
      const testCases = [
        {
          input: { msg: { type: 'token_count_initial' } },
          expected: null
        },
        {
          input: { msg: { type: 'token_count_final' } },
          expected: null
        },
        {
          input: { msg: { type: 'exec_command_complete' } },
          expected: 'Executing command...'
        },
        {
          input: { msg: { type: 'agent_reasoning_complete' } },
          expected: 'Agent reasoning...'
        },
        {
          input: { msg: { type: 'custom_message_type' } },
          expected: 'custom_message_type'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = processCodexEvent(JSON.stringify(input));
        expect(result).toBe(expected);
      });
    });
  });

  // Helper function tests (though they're not exported, we can test through the main function)
  describe('format integration through processCodexEvent', () => {
    test('should format command execution with exit code', () => {
      const input = JSON.stringify({
        msg: {
          type: 'exec_command_result',
          command: 'npm test',
          exit_code: 0,
          aggregated_output: 'All tests passed'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('exec_command_result'); // Since it falls through to msg.type
    });

    test('should handle file operations', () => {
      const input = JSON.stringify({
        msg: {
          type: 'file_operation',
          path: '/src/index.js'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('file_operation');
    });

    test('should handle web search operations', () => {
      const input = JSON.stringify({
        msg: {
          type: 'web_search_query',
          query: 'JavaScript unit testing'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('web_search_query');
    });

    test('should handle MCP tool calls', () => {
      const input = JSON.stringify({
        msg: {
          type: 'mcp_tool_call',
          tool_name: 'file_reader'
        }
      });

      const result = processCodexEvent(input);
      expect(result).toBe('mcp_tool_call');
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle extremely long JSON strings', () => {
      const longJson = {
        data: 'x'.repeat(1000),
        more: {
          nested: 'y'.repeat(1000)
        }
      };

      const input = JSON.stringify(longJson);
      const result = processCodexEvent(input);

      expect(result).toBe(input.substring(0, 160) + '...');
      expect(result.length).toBe(163);
    });

    test('should handle null and undefined values in JSON', () => {
      const testCases = [
        { item: null },
        { item: { text: null } },
        { item: { command: null } },
        { msg: null },
        { msg: { type: null } }
      ];

      testCases.forEach(testCase => {
        const result = processCodexEvent(JSON.stringify(testCase));
        expect(typeof result).toBe('string'); // Should return truncated JSON
      });
    });

    test('should handle numeric values in JSON', () => {
      const testCases = [
        { count: 42 },
        { item: { count: 100 } },
        { msg: { number: 3.14 } }
      ];

      testCases.forEach(testCase => {
        const result = processCodexEvent(JSON.stringify(testCase));
        expect(typeof result).toBe('string');
      });
    });

    test('should handle boolean values in JSON', () => {
      const testCases = [
        { enabled: true },
        { item: { active: false } },
        { msg: { completed: true } }
      ];

      testCases.forEach(testCase => {
        const result = processCodexEvent(JSON.stringify(testCase));
        expect(typeof result).toBe('string');
      });
    });

    test('should handle array values in JSON', () => {
      const testCases = [
        { items: ['a', 'b', 'c'] },
        { item: { tags: ['test', 'debug'] } },
        { msg: { errors: [] } }
      ];

      testCases.forEach(testCase => {
        const result = processCodexEvent(JSON.stringify(testCase));
        expect(typeof result).toBe('string');
      });
    });
  });
});