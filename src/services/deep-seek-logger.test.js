const { processDeepSeekMessage } = require('./deep-seek-logger');

describe('DeepSeek Logger', () => {
  describe('processDeepSeekMessage', () => {
    test('should return null for invalid JSON', () => {
      expect(processDeepSeekMessage('invalid json {')).toBeNull();
      expect(processDeepSeekMessage('not json at all')).toBeNull();
      expect(processDeepSeekMessage('')).toBeNull();
      expect(processDeepSeekMessage(null)).toBeNull();
      expect(processDeepSeekMessage(undefined)).toBeNull();
    });

    test('should return null for unknown message type', () => {
      const input = JSON.stringify({
        type: 'unknown'
      });

      expect(processDeepSeekMessage(input)).toBeNull();
    });
  });

  describe('Assistant Message Processing', () => {
    test('should process simple text message', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello, I am DeepSeek' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('Hello, I am DeepSeek');
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
      expect(result).toBeNull();
    });

    test('should handle missing message or content', () => {
      const testCases = [
        { type: 'assistant' },
        { type: 'assistant', message: {} },
        { type: 'assistant', message: { content: null } }
      ];

      testCases.forEach(testCase => {
        const result = processDeepSeekMessage(JSON.stringify(testCase));
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

        const result = processDeepSeekMessage(input);
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

      expect(processDeepSeekMessage(input)).toBeNull();
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

      expect(processDeepSeekMessage(input)).toBeNull();
    });
  });

  describe('System Message Processing', () => {
    test('should handle init subtype', () => {
      const input = JSON.stringify({
        type: 'system',
        subtype: 'init'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('🚀 Starting DeepSeek...');
    });

    test('should return null for other subtypes', () => {
      const input = JSON.stringify({
        type: 'system',
        subtype: 'other'
      });

      expect(processDeepSeekMessage(input)).toBeNull();
    });

    test('should return null for system message without subtype', () => {
      const input = JSON.stringify({
        type: 'system'
      });

      expect(processDeepSeekMessage(input)).toBeNull();
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

      const result = processDeepSeekMessage(input);
      expect(result).toContain('✅ Completed in 5.0s');
      expect(result).toContain('($0.1234)');
    });

    test('should handle success without cost', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 3500
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('✅ Completed in 3.5s');
      expect(result).not.toContain('$');
    });

    test('should handle error message', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error',
        error: 'Something went wrong'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('\n❌ Error: Something went wrong');
    });

    test('should handle error without message', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('\n❌ Error: Unknown error');
    });

    test('should handle null cost', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 2000,
        total_cost_usd: null
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('✅ Completed in 2.0s');
      expect(result).not.toContain('$');
    });

    test('should handle very small duration', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 123
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('✅ Completed in 0.1s');
    });

    test('should handle very large duration', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 123456
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('✅ Completed in 123.5s');
    });

    test('should format cost with 4 decimal places', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 1000,
        total_cost_usd: 0.000123
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('($0.0001)');
    });

    test('should return null for unknown result subtype', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'unknown'
      });

      expect(processDeepSeekMessage(input)).toBeNull();
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

        const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const result = processDeepSeekMessage(input);
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

      const results = messages.map(msg => processDeepSeekMessage(JSON.stringify(msg)));

      expect(results[0]).toBe('🚀 Starting DeepSeek...');
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
        expect(processDeepSeekMessage(input)).toBeNull();
      });
    });

    test('should handle JSON with missing required properties', () => {
      const incompleteInputs = [
        { message: { content: [] } }, // Missing type
        { type: 'assistant' }, // Missing message
        { type: 'assistant', message: {} } // Missing content
      ];

      incompleteInputs.forEach(input => {
        expect(processDeepSeekMessage(JSON.stringify(input))).toBeNull();
      });
    });
  });

  describe('Chinese/Multilingual Support', () => {
    test('should process Chinese text messages correctly', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '你好！我是DeepSeek助手，我可以帮助您处理编程任务。' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('你好！我是DeepSeek助手，我可以帮助您处理编程任务。');
    });

    test('should handle mixed Chinese-English text', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '我将帮助您完成这个 task，请稍等 a moment...' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('我将帮助您完成这个 task，请稍等 a moment...');
    });

    test('should handle Chinese characters in tool descriptions', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { description: '运行测试脚本' } }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('🔧 Bash: 运行测试脚本');
    });

    test('should process code with Chinese comments', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '```javascript\n// 这是一个计算函数\nconst calculate = (x, y) => x + y;\n```' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('这是一个计算函数');
    });

    test('should handle Chinese filenames in tool operations', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/src/组件/用户管理.js' } }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('📖 Read: Reading 用户管理.js');
    });

    test('should handle mixed language tool workflows', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '开始处理文件:' },
            { type: 'tool_use', name: 'Read', input: { file_path: '配置文件.json' } },
            { type: 'text', text: 'File processing completed successfully!' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('开始处理文件:');
      expect(result).toContain('📖 Read: Reading 配置文件.json');
      expect(result).toContain('File processing completed successfully!');
    });

    test('should handle Chinese error messages in results', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error',
        error: '文件不存在或无法访问'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('\n❌ Error: 文件不存在或无法访问');
    });

    test('should handle mixed language error context', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error',
        error: 'API limit exceeded. 请稍后再试'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('\n❌ Error: API limit exceeded. 请稍后再试');
    });

    test('should handle Unicode edge cases in malformed content', () => {
      const malformedWithChinese = '{"type": "assistant", "message": {"content": [{"type": "text", "text": "测试"}';

      expect(processDeepSeekMessage(malformedWithChinese)).toBeNull();
    });
  });

  describe('Chinese-Specific Tool Formatting Edge Cases', () => {
    test('should handle Chinese file paths with directory extraction', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: '/用户/文档/项目/说明文件.md' } }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('✍️ Write: Writing 说明文件.md');
      expect(result).not.toContain('/用户/文档/项目');
    });

    test('should handle unknown tools with Chinese names', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: '中文工具', input: {} }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('🛠️ 中文工具');
    });

    test('should handle emoji and Chinese character combinations', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '🎉 任务完成！所有测试都已通过 🚀' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('🎉 任务完成！所有测试都已通过 🚀');
    });

    test('should handle complex Unicode sequences', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '德语Français Español Português 中文日本語 한국어' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('德语Français Español Português 中文日本語 한국어');
    });

    test('should handle Chinese punctuation and special characters', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '这个函数的作用是：计算两个数字的和。返回值是整数。' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('这个函数的作用是：计算两个数字的和。返回值是整数。');
    });

    test('should handle both Traditional and Simplified Chinese', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '簡體中文 vs 繁體中文 - 同樣的文字，不同的寫法' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('簡體中文 vs 繁體中文 - 同樣的文字，不同的寫法');
    });

    test('should handle Chinese whitespace correctly', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '中文空格　是全角的，和英文空格 不同' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('中文空格　是全角的，和英文空格 不同');
    });
  });

  describe('Multilingual Content Processing', () => {
    test('should handle complex multilingual workflows', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '开始分析这个代码库：' },
            { type: 'tool_use', name: 'Glob', input: { pattern: '**/*.js' } },
            { type: 'text', text: '\nFound JavaScript files. 现在检查主文件：' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/src/index.js' } },
            { type: 'text', text: '\nThe code looks good. 让我们运行测试：' },
            { type: 'tool_use', name: 'Bash', input: { description: 'npm test' } }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('开始分析这个代码库');
      expect(result).toContain('🔍 Glob');
      expect(result).toContain('Found JavaScript files. 现在检查主文件');
      expect(result).toContain('📖 Read: Reading index.js');
      expect(result).toContain('The code looks good. 让我们运行测试');
      expect(result).toContain('🔧 Bash: npm test');
    });

    test('should handle Chinese characters in complex nested input objects', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: {
                file_path: '/src/组件/用户界面.jsx',
                old_string: 'const [用户, 设置用户] = useState(null);',
                new_string: 'const [用户, 设置用户] = useState(null);\nconst [加载中, 设置加载] = useState(false);'
              }
            }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('📝 Edit: Editing 用户界面.jsx');
    });

    test('should preserve mixed language formatting integrity', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '处理完成！Processing complete. 函数运行成功。Function executed successfully.' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('处理完成！Processing complete. 函数运行成功。Function executed successfully.');
    });
  });

  describe('Encoding and Performance Edge Cases', () => {
    test('should handle extremely long Chinese text content gracefully', () => {
      const longChineseText = '你好世界'.repeat(1000);
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: longChineseText }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe(longChineseText);
    });

    test('should handle Unicode and special characters in Chinese tool descriptions', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { description: '测试使用特殊字符：émojis 🚀 🎉 和中文：测试成功' } }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toContain('🔧 Bash: 测试使用特殊字符：émojis 🚀 🎉 和中文：测试成功');
    });

    test('should handle content with mixed language newline characters and whitespace', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '第一行\nSecond line\n  第三行缩进\t制表符内容' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('第一行\nSecond line\n  第三行缩进\t制表符内容');
    });

    test('should handle messages with null or undefined multilingual content blocks', () => {
      const input = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '有效内容 Valid content' },
            { type: 'text', text: null },
            { type: 'text', text: undefined },
            { type: 'text', text: '更多有效内容 More valid content' }
          ]
        }
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('有效内容 Valid contentnullundefined更多有效内容 More valid content');
    });
  });

  describe('Chinese Model-Specific Error Handling', () => {
    test('should handle Chinese error messages in system messages', () => {
      const input = JSON.stringify({
        type: 'system',
        subtype: 'init',
        message: '系统初始化中... System initializing...'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('🚀 Starting DeepSeek...');
    });

    test('should handle result success messages with Chinese cost tracking', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'success',
        duration_ms: 2500,
        total_cost_usd: 0.0142
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('\n✅ Completed in 2.5s ($0.0142)');
    });

    test('should handle mixed language error context gracefully', () => {
      const input = JSON.stringify({
        type: 'result',
        subtype: 'error',
        error: '网络连接失败 Network connection failed'
      });

      const result = processDeepSeekMessage(input);
      expect(result).toBe('\n❌ Error: 网络连接失败 Network connection failed');
    });

    test('should handle Unicode characters in malformed JSON safely', () => {
      const maliciousWithChinese = '{"type": "assistant", "message": {"content": [{"type": "text", "text": "正常内容"}]}, "注入": "恶意数据"}';
      const result = processDeepSeekMessage(maliciousWithChinese);
      expect(result).toContain('正常内容');
      expect(result).not.toContain('注入');
    });
  });
});