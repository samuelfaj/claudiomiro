const { processGlmMessage } = require('./glm-logger');

describe('GLM Logger', () => {
  describe('processGlmMessage', () => {
    test('should return null for invalid JSON', () => {
      expect(processGlmMessage('invalid json {')).toBeNull();
      expect(processGlmMessage('not json at all')).toBeNull();
      expect(processGlmMessage('')).toBeNull();
      expect(processGlmMessage(null)).toBeNull();
      expect(processGlmMessage(undefined)).toBeNull();
    });

    test('should return null for unknown message type', () => {
      const input = JSON.stringify({
        type: 'unknown'
      });

      expect(processGlmMessage(input)).toBeNull();
    });
  });

  describe('Assistant Message Processing', () => {
    test('should process simple text message', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello, I am GLM' }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toBe('Hello, I am GLM');
    });

    test('should process tool_use with Bash tool', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { description: 'Run tests' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('🔧 Bash: Run tests');
    });

    test('should process tool_use with Read tool', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/path/to/test.js' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('📖 Read: Reading test.js');
    });

    test('should process tool_use with Write tool', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: '/path/to/output.js' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('✍️ Write: Writing output.js');
    });

    test('should process tool_use with Edit tool', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Edit', input: { file_path: '/path/to/modify.js' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('📝 Edit: Editing modify.js');
    });

    test('should process tool_use without description', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: {} }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('🔧 Bash');
      expect(result).not.toContain(':');
    });

    test('should process mixed text and tool_use content', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Running command:' },
            { type: 'tool_use', name: 'Bash', input: { description: 'Test command' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('Running command:');
      expect(result).toContain('🔧 Bash: Test command');
    });

    test('should handle empty content array', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: []
        }
      });

      const result = processGlmMessage(input);
      expect(result).toBeNull();
    });

    test('should handle missing message or content', () => {
      const testCases = [
        { type: 'assistant' },
        { type: 'assistant', message: {} },
        { type: 'assistant', message: { content: null } }
      ];

      testCases.forEach(testCase => {
        const result = processGlmMessage(JSON.stringify(testCase));
        expect(result).toBeNull();
      });
    });

    test('should handle multiple tool_use calls', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: 'file1.js' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: 'file2.js' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('📖 Read: Reading file1.js');
      expect(result).toContain('📝 Edit: Editing file2.js');
    });

    test('should handle unknown tool with default icon', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'UnknownTool', input: {} }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('🛠️ UnknownTool');
    });

    test('should handle text with empty string', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '' }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toBe('');
    });

    test('should handle file paths with directories', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/very/deep/path/to/example.js' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('📖 Read: Reading example.js');
      expect(result).not.toContain('/very/deep/path/to');
    });

    test('should handle tool_use with different file operations', () => {
      const testCases = [
        { tool: 'Read', file: 'config.json', expected: 'Reading config.json' },
        { tool: 'Write', file: 'output.txt', expected: 'Writing output.txt' },
        { tool: 'Edit', file: 'modify.md', expected: 'Editing modify.md' }
      ];

      testCases.forEach(({ tool, file, expected }) => {
        const input = JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: tool, input: { file_path: `/path/to/${file}` } }
            ]
          }
        });

        const result = processGlmMessage(input);
        expect(result).toContain(expected);
      });
    });
  });

  describe('User Message Processing', () => {
    test('should return null for user messages', () => {
      const input = JSON.stringify({
        type: 'user',
        message: 'Some user input'
      });

      expect(processGlmMessage(input)).toBeNull();
    });

    test('should return null for tool results', () => {
      const input = JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', content: 'Result data' }
          ]
        }
      });

      expect(processGlmMessage(input)).toBeNull();
    });
  });

  describe('System Message Processing', () => {
    test('should handle init subtype', () => {
      const input = JSON.stringify({
        type: 'system',
        subtype: 'init'
      });

      const result = processGlmMessage(input);
      expect(result).toBe('🚀 Starting Glm...');
    });

    test('should return null for other subtypes', () => {
      const input = JSON.stringify({
        type: 'system',
        subtype: 'other'
      });

      expect(processGlmMessage(input)).toBeNull();
    });

    test('should return null for system message without subtype', () => {
      const input = JSON.stringify({
        type: 'system'
      });

      expect(processGlmMessage(input)).toBeNull();
    });
  });

  describe('Result Message Processing', () => {
    test('should handle success with duration and cost', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 5000,
        total_cost_usd: 0.1234
      });

      const result = processGlmMessage(input);
      expect(result).toContain('✅ Completed in 5.0s');
      expect(result).toContain('($0.1234)');
    });

    test('should handle success without cost', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 3500
      });

      const result = processGlmMessage(input);
      expect(result).toContain('✅ Completed in 3.5s');
      expect(result).not.toContain('$');
    });

    test('should handle error message', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error',
        error: 'Something went wrong'
      });

      const result = processGlmMessage(input);
      expect(result).toBe('\n❌ Error: Something went wrong');
    });

    test('should handle error without message', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error'
      });

      const result = processGlmMessage(input);
      expect(result).toBe('\n❌ Error: Unknown error');
    });

    test('should handle null cost', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 2000,
        total_cost_usd: null
      });

      const result = processGlmMessage(input);
      expect(result).toContain('✅ Completed in 2.0s');
      expect(result).not.toContain('$');
    });

    test('should handle very small duration', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 123
      });

      const result = processGlmMessage(input);
      expect(result).toContain('✅ Completed in 0.1s');
    });

    test('should handle very large duration', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 123456
      });

      const result = processGlmMessage(input);
      expect(result).toContain('✅ Completed in 123.5s');
    });

    test('should format cost with 4 decimal places', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 1000,
        total_cost_usd: 0.000123
      });

      const result = processGlmMessage(input);
      expect(result).toContain('($0.0001)');
    });

    test('should return null for unknown result subtype', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'unknown'
      });

      expect(processGlmMessage(input)).toBeNull();
    });
  });

  describe('Tool Icon Mapping', () => {
    test('should use correct icons for known tools', () => {
      const toolIcons = {
        'Bash': '🔧',
        'Read': '📖',
        'Write': '✍️',
        'Edit': '📝',
        'Glob': '🔍',
        'Grep': '🔎',
        'Task': '📋',
        'TodoWrite': '✅',
        'WebFetch': '🌐',
        'WebSearch': '🔎'
      };

      Object.entries(toolIcons).forEach(([tool, icon]) => {
        const input = JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: tool, input: {} }
            ]
          }
        });

        const result = processGlmMessage(input);
        expect(result).toContain(`${icon} ${tool}`);
      });
    });

    test('should use default icon for unknown tools', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'UnknownTool', input: {} }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('🛠️ UnknownTool');
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle workflow with all tool types', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Starting workflow:' },
            { type: 'tool_use', name: 'Glob', input: { pattern: '**/*.test.js' } },
            { type: 'tool_use', name: 'Grep', input: { pattern: 'describe' } },
            { type: 'tool_use', name: 'Read', input: { file_path: '/test/unit.test.js' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/test/unit.test.js' } },
            { type: 'tool_use', name: 'Write', input: { file_path: '/test/new.test.js' } },
            { type: 'tool_use', name: 'Bash', input: { description: 'Run tests' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('Starting workflow:');
      expect(result).toContain('🔍 Glob');
      expect(result).toContain('🔎 Grep');
      expect(result).toContain('📖 Read');
      expect(result).toContain('📝 Edit');
      expect(result).toContain('✍️ Write');
      expect(result).toContain('🔧 Bash');
    });

    test('should handle empty text blocks correctly', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/file.js' } },
            { type: 'text', text: '' }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('📖 Read');
    });

    test('should handle complex nested paths correctly', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/very/deep/nested/path/to/some/file/example.test.js' } }
          ]
        }
      });

      const result = processGlmMessage(input);
      expect(result).toContain('Reading example.test.js');
      expect(result).not.toContain('/very/deep/nested');
    });

    test('should handle mixed message flow', () => {
      const messages = [
        {
          type: 'system',
          subtype: 'init'
        },
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'I will help you with that.' }
            ]
          }
        },
        {
          type: 'user',
          message: 'tool result'
        },
        {
          type: 'result',
          subtype: 'success',
          duration_ms: 1000
        }
      ];

      const results = messages.map(msg => processGlmMessage(JSON.stringify(msg)));

      expect(results[0]).toBe('🚀 Starting Glm...');
      expect(results[1]).toBe('I will help you with that.');
      expect(results[2]).toBeNull(); // User messages return null
      expect(results[3]).toContain('✅ Completed in 1.0s');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', () => {
      const malformedInputs = [
        '{ "type": "assistant", "message": }',
        '{ incomplete json',
        '{"type": "assistant", "message": {"content": [}}',
        'null',
        'undefined',
        '[]',
        '"just a string"'
      ];

      malformedInputs.forEach(input => {
        expect(processGlmMessage(input)).toBeNull();
      });
    });

    test('should handle JSON with missing required properties', () => {
      const incompleteInputs = [
        { message: { content: [] } }, // Missing type
        { type: 'assistant' }, // Missing message
        { type: 'assistant', message: {} } // Missing content
      ];

      incompleteInputs.forEach(input => {
        expect(processGlmMessage(JSON.stringify(input))).toBeNull();
      });
    });
  });
});