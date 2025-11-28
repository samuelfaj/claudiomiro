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
                type: 'unknown',
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
                        { type: 'text', text: 'Hello, I am GLM' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('Hello, I am GLM');
        });

        test('should process tool_use with Bash tool', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'Run tests' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('🔧 Bash: Run tests');
        });

        test('should process tool_use with Read tool', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/path/to/test.js' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('📖 Read: Reading test.js');
        });

        test('should process tool_use with Write tool', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Write', input: { file_path: '/path/to/output.js' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✍️ Write: Writing output.js');
        });

        test('should process tool_use with Edit tool', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Edit', input: { file_path: '/path/to/modify.js' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('📝 Edit: Editing modify.js');
        });

        test('should process tool_use without description', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: {} },
                    ],
                },
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
                        { type: 'tool_use', name: 'Bash', input: { description: 'Test command' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('Running command:');
            expect(result).toContain('🔧 Bash: Test command');
        });

        test('should handle empty content array', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBeNull();
        });

        test('should handle missing message or content', () => {
            const testCases = [
                { type: 'assistant' },
                { type: 'assistant', message: {} },
                { type: 'assistant', message: { content: null } },
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
                        { type: 'tool_use', name: 'Edit', input: { file_path: 'file2.js' } },
                    ],
                },
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
                        { type: 'tool_use', name: 'UnknownTool', input: {} },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('🛠️ UnknownTool');
        });

        test('should handle text with empty string', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('');
        });

        test('should handle file paths with directories', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/very/deep/path/to/example.js' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('📖 Read: Reading example.js');
            expect(result).not.toContain('/very/deep/path/to');
        });

        test('should handle tool_use with different file operations', () => {
            const testCases = [
                { tool: 'Read', file: 'config.json', expected: 'Reading config.json' },
                { tool: 'Write', file: 'output.txt', expected: 'Writing output.txt' },
                { tool: 'Edit', file: 'modify.md', expected: 'Editing modify.md' },
            ];

            testCases.forEach(({ tool, file, expected }) => {
                const input = JSON.stringify({
                    type: 'assistant',
                    message: {
                        content: [
                            { type: 'tool_use', name: tool, input: { file_path: `/path/to/${file}` } },
                        ],
                    },
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
                message: 'Some user input',
            });

            expect(processGlmMessage(input)).toBeNull();
        });

        test('should return null for tool results', () => {
            const input = JSON.stringify({
                type: 'user',
                message: {
                    content: [
                        { type: 'tool_result', content: 'Result data' },
                    ],
                },
            });

            expect(processGlmMessage(input)).toBeNull();
        });
    });

    describe('System Message Processing', () => {
        test('should handle init subtype', () => {
            const input = JSON.stringify({
                type: 'system',
                subtype: 'init',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('🚀 Starting GLM...');
        });

        test('should return null for other subtypes', () => {
            const input = JSON.stringify({
                type: 'system',
                subtype: 'other',
            });

            expect(processGlmMessage(input)).toBeNull();
        });

        test('should return null for system message without subtype', () => {
            const input = JSON.stringify({
                type: 'system',
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
                total_cost_usd: 0.1234,
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✅ Completed in 5.0s');
            expect(result).toContain('($0.1234)');
        });

        test('should handle success without cost', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'success',
                duration_ms: 3500,
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✅ Completed in 3.5s');
            expect(result).not.toContain('$');
        });

        test('should handle error message', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
                error: 'Something went wrong',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: Something went wrong');
        });

        test('should handle error without message', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: Unknown error');
        });

        test('should handle null cost', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'success',
                duration_ms: 2000,
                total_cost_usd: null,
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✅ Completed in 2.0s');
            expect(result).not.toContain('$');
        });

        test('should handle very small duration', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'success',
                duration_ms: 123,
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✅ Completed in 0.1s');
        });

        test('should handle very large duration', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'success',
                duration_ms: 123456,
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✅ Completed in 123.5s');
        });

        test('should format cost with 4 decimal places', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'success',
                duration_ms: 1000,
                total_cost_usd: 0.000123,
            });

            const result = processGlmMessage(input);
            expect(result).toContain('($0.0001)');
        });

        test('should return null for unknown result subtype', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'unknown',
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
                'WebSearch': '🔎',
            };

            Object.entries(toolIcons).forEach(([tool, icon]) => {
                const input = JSON.stringify({
                    type: 'assistant',
                    message: {
                        content: [
                            { type: 'tool_use', name: tool, input: {} },
                        ],
                    },
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
                        { type: 'tool_use', name: 'UnknownTool', input: {} },
                    ],
                },
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
                        { type: 'tool_use', name: 'Bash', input: { description: 'Run tests' } },
                    ],
                },
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
                        { type: 'text', text: '' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('📖 Read');
        });

        test('should handle complex nested paths correctly', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/very/deep/nested/path/to/some/file/example.test.js' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('Reading example.test.js');
            expect(result).not.toContain('/very/deep/nested');
        });

        test('should handle mixed message flow', () => {
            const messages = [
                {
                    type: 'system',
                    subtype: 'init',
                },
                {
                    type: 'assistant',
                    message: {
                        content: [
                            { type: 'text', text: 'I will help you with that.' },
                        ],
                    },
                },
                {
                    type: 'user',
                    message: 'tool result',
                },
                {
                    type: 'result',
                    subtype: 'success',
                    duration_ms: 1000,
                },
            ];

            const results = messages.map(msg => processGlmMessage(JSON.stringify(msg)));

            expect(results[0]).toBe('🚀 Starting GLM...');
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
                '"just a string"',
            ];

            malformedInputs.forEach(input => {
                expect(processGlmMessage(input)).toBeNull();
            });
        });

        test('should handle JSON with missing required properties', () => {
            const incompleteInputs = [
                { message: { content: [] } }, // Missing type
                { type: 'assistant' }, // Missing message
                { type: 'assistant', message: {} }, // Missing content
            ];

            incompleteInputs.forEach(input => {
                expect(processGlmMessage(JSON.stringify(input))).toBeNull();
            });
        });
    });

    describe('Chinese Language Model Features', () => {
        test('should process Chinese text messages correctly', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '你好！我是GLM助手，我可以帮助您处理编程任务。' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('你好！我是GLM助手，我可以帮助您处理编程任务。');
        });

        test('should handle mixed Chinese-English text in GLM responses', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '我将帮助您完成这个 coding task，请稍等 a moment...' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('我将帮助您完成这个 coding task，请稍等 a moment...');
        });

        test('should handle Chinese characters in GLM tool descriptions', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: '执行测试命令' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('🔧 Bash: 执行测试命令');
        });

        test('should process code with Chinese comments for GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '```python\n# 这是一个数据处理函数\ndef process_data(data):\n    return data.transform()\n```' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('这是一个数据处理函数');
        });

        test('should handle Chinese filenames in GLM tool operations', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/src/模块/数据处理.py' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('📖 Read: Reading 数据处理.py');
        });

        test('should handle mixed language GLM workflows', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '开始处理数据集：' },
                        { type: 'tool_use', name: 'Glob', input: { pattern: '**/*.csv' } },
                        { type: 'text', text: '\nFound CSV files. 现在读取数据：' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '数据集.csv' } },
                        { type: 'text', text: '\nData analysis completed. 数据处理完成！' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('开始处理数据集');
            expect(result).toContain('🔍 Glob');
            expect(result).toContain('Found CSV files. 现在读取数据');
            expect(result).toContain('📖 Read: Reading 数据集.csv');
            expect(result).toContain('Data analysis completed. 数据处理完成！');
        });

        test('should handle Chinese error messages in GLM results', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
                error: '数据库连接失败',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: 数据库连接失败');
        });

        test('should handle mixed language error context in GLM', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
                error: 'Memory insufficient. 内存不足，请减少数据量',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: Memory insufficient. 内存不足，请减少数据量');
        });
    });

    describe('GLM-Specific Chinese Language Features', () => {
        test('should handle Chinese file paths with directory extraction', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Write', input: { file_path: '/项目/文档/需求说明.md' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('✍️ Write: Writing 需求说明.md');
            expect(result).not.toContain('/项目/文档');
        });

        test('should handle unknown tools with Chinese names in GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: '中文分析工具', input: {} },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('🛠️ 中文分析工具');
        });

        test('should handle emoji and Chinese character combinations in GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '🎯 任务开始！GLM正在处理中... 📊 数据分析完成！' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('🎯 任务开始！GLM正在处理中... 📊 数据分析完成！');
        });

        test('should handle complex Unicode sequences for GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM支持多语言：English Français Español 中文日本語 한국어' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('GLM支持多语言：English Français Español 中文日本語 한국어');
        });

        test('should handle Chinese punctuation and special characters', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM的功能包括：自然语言处理、代码生成、数据分析等。' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('GLM的功能包括：自然语言处理、代码生成、数据分析等。');
        });

        test('should handle both Traditional and Simplified Chinese in GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM支援簡體中文和繁體中文 - GLM支持简体中文和繁体中文' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('GLM支援簡體中文和繁體中文 - GLM支持简体中文和繁体中文');
        });

        test('should handle Chinese whitespace and formatting', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM处理中文文本时的全角空格　和半角空格 混合处理' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('GLM处理中文文本时的全角空格　和半角空格 混合处理');
        });
    });

    describe('GLM Multilingual Content Processing', () => {
        test('should handle complex multilingual GLM workflows', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM开始分析项目结构：' },
                        { type: 'tool_use', name: 'Glob', input: { pattern: '**/*.js' } },
                        { type: 'text', text: '\nJavaScript files found. 检查配置文件：' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/config/glm.json' } },
                        { type: 'text', text: '\nConfiguration loaded. 运行GLM模型：' },
                        { type: 'tool_use', name: 'Bash', input: { description: 'python glm_model.py' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('GLM开始分析项目结构');
            expect(result).toContain('🔍 Glob');
            expect(result).toContain('JavaScript files found. 检查配置文件');
            expect(result).toContain('📖 Read: Reading glm.json');
            expect(result).toContain('Configuration loaded. 运行GLM模型');
            expect(result).toContain('🔧 Bash: python glm_model.py');
        });

        test('should handle Chinese characters in complex nested GLM input objects', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        {
                            type: 'tool_use',
                            name: 'Edit',
                            input: {
                                file_path: '/src/语言模型/glm处理器.py',
                                old_string: '模型输入 = 处理文本(原始文本)',
                                new_string: '模型输入 = 处理文本(原始文本)\n中文分词 = 中文文本处理器(原始文本)',
                            },
                        },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('📝 Edit: Editing glm处理器.py');
        });

        test('should preserve mixed language formatting integrity for GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM处理完成！Processing complete. 模型推理成功。Model inference successful.' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('GLM处理完成！Processing complete. 模型推理成功。Model inference successful.');
        });
    });

    describe('GLM-Specific Encoding and Performance Edge Cases', () => {
        test('should handle extremely long Chinese text content for GLM', () => {
            const longChineseText = 'GLM处理中文字符'.repeat(800);
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: longChineseText },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe(longChineseText);
        });

        test('should handle Unicode and special characters in GLM tool descriptions', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'GLM测试：特殊字符处理 émojis 🚀 🎉 中文：测试通过' } },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('🔧 Bash: GLM测试：特殊字符处理 émojis 🚀 🎉 中文：测试通过');
        });

        test('should handle content with mixed language formatting in GLM', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM第一行\nSecond line\n  第三行缩进\t制表符中文内容' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toBe('GLM第一行\nSecond line\n  第三行缩进\t制表符中文内容');
        });

        test('should handle GLM-specific model configuration messages', () => {
            const input = JSON.stringify({
                type: 'system',
                subtype: 'init',
                message: 'GLM-4模型初始化完成，支持中英文混合处理',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('🚀 Starting GLM...');
        });

        test('should handle GLM response with mixed content types', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'GLM分析结果：' },
                        { type: 'tool_use', name: 'WebSearch', input: { query: 'GLM-4 model capabilities' } },
                        { type: 'text', text: '\n搜索完成。GLM具备强大的中文理解能力。' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('GLM分析结果');
            expect(result).toContain('🔎 WebSearch');
            expect(result).toContain('搜索完成。GLM具备强大的中文理解能力');
        });
    });

    describe('GLM Model-Specific Error Handling', () => {
        test('should handle GLM model-specific error messages', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
                error: 'GLM模型加载失败：模型文件不存在',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: GLM模型加载失败：模型文件不存在');
        });

        test('should handle GLM token limit errors', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
                error: 'Token limit exceeded. 超出最大token限制，请缩短输入文本',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: Token limit exceeded. 超出最大token限制，请缩短输入文本');
        });

        test('should handle GLM Chinese text processing errors', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'error',
                error: '中文编码错误：UTF-8解码失败',
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n❌ Error: 中文编码错误：UTF-8解码失败');
        });

        test('should handle GLM success messages with Chinese context', () => {
            const input = JSON.stringify({
                type: 'result',
                subtype: 'success',
                duration_ms: 3500,
                total_cost_usd: 0.0256,
            });

            const result = processGlmMessage(input);
            expect(result).toBe('\n✅ Completed in 3.5s ($0.0256)');
        });

        test('should handle Unicode characters in malformed GLM JSON safely', () => {
            const maliciousWithChinese = '{"type": "assistant", "message": {"content": [{"type": "text", "text": "GLM正常内容"}]}, "注入": "恶意代码"}';
            const result = processGlmMessage(maliciousWithChinese);
            expect(result).toContain('GLM正常内容');
            expect(result).not.toContain('注入');
        });

        test('should handle GLM-specific warning scenarios', () => {
            const warningScenarios = [
                'GLM warning: 接近内存使用上限',
                'GLM caution: 模型响应时间较长',
                'GLM alert: 检测到异常输入模式',
            ];

            warningScenarios.forEach(warning => {
                const input = JSON.stringify({
                    type: 'result',
                    subtype: 'error',
                    error: warning,
                });

                const result = processGlmMessage(input);
                expect(result).toContain(`❌ Error: ${warning}`);
            });
        });
    });

    describe('GLM Advanced Multilingual Scenarios', () => {
        test('should handle GLM code generation with Chinese comments', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '```python\nclass GLM处理器:\n    """GLM文本处理器类"""\n    def __init__(self):\n        self.支持中文 = True  # 支持中文处理\n        self.model_name = "GLM-4"  # 模型名称\n\n    def 处理文本(self, text):\n        """处理中英文混合文本"""\n        return self.模型推理(text)\n```' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('GLM文本处理器类');
            expect(result).toContain('支持中文处理');
            expect(result).toContain('模型名称');
            expect(result).toContain('处理中英文混合文本');
        });

        test('should handle GLM data analysis with Chinese labels', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '数据分析结果：\n准确率：95.2%\n精确率：93.8%\n召回率：96.1%\nF1分数：94.9%' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('数据分析结果');
            expect(result).toContain('准确率：95.2%');
            expect(result).toContain('精确率：93.8%');
            expect(result).toContain('召回率：96.1%');
            expect(result).toContain('F1分数：94.9%');
        });

        test('should handle GLM documentation generation in Chinese', () => {
            const input = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '# GLM API文档\n\n## 功能介绍\nGLM是一个支持中英文的预训练语言模型。\n\n## 主要特性\n- 强大的中文理解能力\n- 代码生成和分析\n- 多轮对话支持\n\n## 使用示例\n```python\nfrom glm import GLM\n\nmodel = GLM("GLM-4")\nresponse = model.chat("你好，请介绍一下你的功能")\n```' },
                    ],
                },
            });

            const result = processGlmMessage(input);
            expect(result).toContain('GLM API文档');
            expect(result).toContain('功能介绍');
            expect(result).toContain('GLM是一个支持中英文的预训练语言模型');
            expect(result).toContain('强大的中文理解能力');
            expect(result).toContain('代码生成和分析');
            expect(result).toContain('多轮对话支持');
        });
    });
});
