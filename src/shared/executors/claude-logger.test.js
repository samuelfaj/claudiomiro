const { processClaudeMessage } = require('./claude-logger');

describe('Claude Logger', () => {
    describe('Helper Functions - formatToolName', () => {
        test('should return Bash with tool icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'Test command' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔧 Bash');
        });

        test('should return Read with tool icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/test/file.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📖 Read');
        });

        test('should return Write with tool icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Write', input: { file_path: '/test/file.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✍️ Write');
        });

        test('should return Edit with tool icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Edit', input: { file_path: '/test/file.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📝 Edit');
        });

        test('should return default icon for unknown tool', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'UnknownTool', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🛠️ UnknownTool');
        });

        test('should handle Glob tool with icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Glob', input: { pattern: '*.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔍 Glob');
        });

        test('should handle Grep tool with icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Grep', input: { pattern: 'test' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔎 Grep');
        });

        test('should handle Task tool with icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Task', input: { description: 'Test task' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📋 Task');
        });

        test('should handle TodoWrite tool with icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'TodoWrite', input: { todos: [] } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ TodoWrite');
        });

        test('should handle WebFetch tool with icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'WebFetch', input: { url: 'http://example.com' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🌐 WebFetch');
        });

        test('should handle WebSearch tool with icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'WebSearch', input: { query: 'test' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔎 WebSearch');
        });
    });

    describe('Helper Functions - formatToolDescription', () => {
        test('should format Bash description from input.description', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'Run tests' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Run tests');
        });

        test('should format Read description with filename', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/path/to/test.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Reading test.js');
        });

        test('should format Write description with filename', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Write', input: { file_path: '/path/to/output.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Writing output.js');
        });

        test('should format Edit description with filename', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Edit', input: { file_path: '/path/to/modify.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Editing modify.js');
        });

        test('should return empty description for unknown tools', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'UnknownTool', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n🛠️ UnknownTool');
        });

        test('should handle Bash without description', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n🔧 Bash');
        });

        test('should handle Read without file_path', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n📖 Read');
        });

        test('should handle Write without file_path', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Write', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n✍️ Write');
        });

        test('should handle Edit without file_path', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Edit', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n📝 Edit');
        });
    });

    describe('processAssistantMessage', () => {
        test('should process text message', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Hello, I am Claude' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('Hello, I am Claude');
        });

        test('should process tool_use message', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'List files' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔧 Bash');
            expect(result).toContain('List files');
        });

        test('should process multiple content blocks', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Running command:' },
                        { type: 'tool_use', name: 'Bash', input: { description: 'Test command' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Running command:');
            expect(result).toContain('🔧 Bash');
            expect(result).toContain('Test command');
        });

        test('should handle empty content array', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should handle null content', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: null,
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should handle missing message', () => {
            const json = {
                type: 'assistant',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should format output with tool icons and descriptions', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/test/file.js' } },
                        { type: 'tool_use', name: 'Write', input: { file_path: '/test/output.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📖 Read: Reading file.js');
            expect(result).toContain('✍️ Write: Writing output.js');
        });

        test('should handle text content with empty string', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should handle mixed text and tool_use blocks', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'First, I will read the file.' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/test.js' } },
                        { type: 'text', text: ' Then I will edit it.' },
                        { type: 'tool_use', name: 'Edit', input: { file_path: '/test.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('First, I will read the file.');
            expect(result).toContain('📖 Read: Reading test.js');
            expect(result).toContain(' Then I will edit it.');
            expect(result).toContain('📝 Edit: Editing test.js');
        });
    });

    describe('processUserMessage', () => {
        test('should return null for user messages', () => {
            const json = {
                type: 'user',
                message: {
                    content: 'Some user input',
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should return null for tool results', () => {
            const json = {
                type: 'user',
                message: {
                    content: [
                        { type: 'tool_result', content: 'Result data' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });
    });

    describe('processSystemMessage', () => {
        test('should handle init subtype', () => {
            const json = {
                type: 'system',
                subtype: 'init',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('🚀 Starting Claude...');
        });

        test('should return null for other subtypes', () => {
            const json = {
                type: 'system',
                subtype: 'other',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should return null for system message without subtype', () => {
            const json = {
                type: 'system',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });
    });

    describe('processResultMessage', () => {
        test('should handle success with duration and cost', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 5000,
                total_cost_usd: 0.1234,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed in 5.0s');
            expect(result).toContain('($0.1234)');
        });

        test('should handle success without cost', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 3500,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed in 3.5s');
            expect(result).not.toContain('$');
        });

        test('should handle error message', () => {
            const json = {
                type: 'result',
                subtype: 'error',
                error: 'Something went wrong',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n❌ Error: Something went wrong');
        });

        test('should handle error without message', () => {
            const json = {
                type: 'result',
                subtype: 'error',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n❌ Error: Unknown error');
        });

        test('should handle null cost', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 2000,
                total_cost_usd: null,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed in 2.0s');
            expect(result).not.toContain('$');
        });

        test('should handle undefined cost', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 1500,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed in 1.5s');
            expect(result).not.toContain('$');
        });

        test('should handle very small duration', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 123,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed in 0.1s');
        });

        test('should handle very large duration', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 123456,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed in 123.5s');
        });

        test('should format cost with 4 decimal places', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 1000,
                total_cost_usd: 0.000123,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('($0.0001)');
        });

        test('should return null for unknown result subtype', () => {
            const json = {
                type: 'result',
                subtype: 'unknown',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });
    });

    describe('processClaudeMessage - Main Entry Point', () => {
        test('should route to assistant processor', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Hello' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('Hello');
        });

        test('should route to user processor', () => {
            const json = {
                type: 'user',
                message: 'User input',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should route to system processor', () => {
            const json = {
                type: 'system',
                subtype: 'init',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('🚀 Starting Claude...');
        });

        test('should route to result processor', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 1000,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('✅ Completed');
        });

        test('should handle JSON parsing errors', () => {
            const result = processClaudeMessage('invalid json {');
            expect(result).toBeNull();
        });

        test('should handle malformed JSON', () => {
            const result = processClaudeMessage('{ "type": "assistant", "message": }');
            expect(result).toBeNull();
        });

        test('should handle empty string input', () => {
            const result = processClaudeMessage('');
            expect(result).toBeNull();
        });

        test('should handle unknown message type', () => {
            const json = {
                type: 'unknown',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBeNull();
        });

        test('should handle null input', () => {
            const result = processClaudeMessage('null');
            expect(result).toBeNull();
        });

        test('should handle array input', () => {
            const result = processClaudeMessage('[]');
            expect(result).toBeNull();
        });

        test('should handle string input', () => {
            const result = processClaudeMessage('"just a string"');
            expect(result).toBeNull();
        });

        test('should handle number input', () => {
            const result = processClaudeMessage('123');
            expect(result).toBeNull();
        });
    });

    describe('Complex Message Scenarios', () => {
        test('should handle multiple tool uses in single message', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/file1.js' } },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/file2.js' } },
                        { type: 'tool_use', name: 'Edit', input: { file_path: '/file3.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📖 Read: Reading file1.js');
            expect(result).toContain('📖 Read: Reading file2.js');
            expect(result).toContain('📝 Edit: Editing file3.js');
        });

        test('should handle mixed text and multiple tool_use content', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Starting analysis...' },
                        { type: 'tool_use', name: 'Glob', input: { pattern: '*.js' } },
                        { type: 'text', text: 'Found files, now reading...' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/test.js' } },
                        { type: 'text', text: 'Done!' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Starting analysis...');
            expect(result).toContain('🔍 Glob');
            expect(result).toContain('Found files, now reading...');
            expect(result).toContain('📖 Read: Reading test.js');
            expect(result).toContain('Done!');
        });

        test('should handle real-world message with path formatting', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Let me check the configuration file.' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/Users/dev/project/config.json' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Let me check the configuration file.');
            expect(result).toContain('📖 Read: Reading config.json');
        });

        test('should concatenate output strings correctly', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Part 1' },
                        { type: 'text', text: ' Part 2' },
                        { type: 'text', text: ' Part 3' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('Part 1 Part 2 Part 3');
        });

        test('should handle workflow with all tool types', () => {
            const json = {
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
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Starting workflow:');
            expect(result).toContain('🔍 Glob');
            expect(result).toContain('🔎 Grep');
            expect(result).toContain('📖 Read');
            expect(result).toContain('📝 Edit');
            expect(result).toContain('✍️ Write');
            expect(result).toContain('🔧 Bash');
        });

        test('should handle empty text blocks correctly', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: '' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/file.js' } },
                        { type: 'text', text: '' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📖 Read: Reading file.js');
        });

        test('should handle tool_use without description gracefully', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Task', input: {} },
                        { type: 'tool_use', name: 'TodoWrite', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📋 Task');
            expect(result).toContain('✅ TodoWrite');
        });

        test('should handle complex nested paths', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: '/very/deep/nested/path/to/some/file/example.test.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('Reading example.test.js');
            expect(result).not.toContain('/very/deep/nested');
        });

        test('should handle messages with only tool uses (no text)', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'npm install' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n🔧 Bash: npm install');
        });
    });

    describe('AI-Specific Streaming Scenarios', () => {
        test('should handle streaming message concatenation with partial chunks', () => {
            const partialMessage1 = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'I will help you' },
                    ],
                },
            };
            const partialMessage2 = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: ' implement this feature.' },
                    ],
                },
            };

            const result1 = processClaudeMessage(JSON.stringify(partialMessage1));
            const result2 = processClaudeMessage(JSON.stringify(partialMessage2));

            expect(result1).toBe('I will help you');
            expect(result2).toBe(' implement this feature.');
        });

        test('should handle complex nested tool workflows with reasoning', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Let me analyze the codebase structure first.' },
                        { type: 'tool_use', name: 'Glob', input: { pattern: '**/*.js' } },
                        { type: 'text', text: '\nFound JavaScript files. Now examining the main entry point:' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/src/index.js' } },
                        { type: 'text', text: '\nI can see the issue. Let me check the dependencies:' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/package.json' } },
                        { type: 'text', text: '\nNow I\'ll fix the import statement:' },
                        { type: 'tool_use', name: 'Edit', input: { file_path: '/src/index.js' } },
                        { type: 'text', text: '\nLet\'s run the tests to verify:' },
                        { type: 'tool_use', name: 'Bash', input: { description: 'npm test' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));

            expect(result).toContain('analyze the codebase structure');
            expect(result).toContain('🔍 Glob');
            expect(result).toContain('📖 Read: Reading index.js');
            expect(result).toContain('📖 Read: Reading package.json');
            expect(result).toContain('📝 Edit: Editing index.js');
            expect(result).toContain('🔧 Bash: npm test');
        });

        test('should handle streaming tool use with dynamic content', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Processing file ' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/var/log/app.log' } },
                        { type: 'text', text: ' and analyzing errors...' },
                        { type: 'tool_use', name: 'Grep', input: { pattern: 'ERROR' } },
                        { type: 'text', text: ' Found 5 issues.' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));

            expect(result).toContain('Processing file');
            expect(result).toContain('📖 Read: Reading app.log');
            expect(result).toContain('analyzing errors');
            expect(result).toContain('🔎 Grep');
            expect(result).toContain('Found 5 issues');
        });
    });

    describe('Claude-Specific Response Format Edge Cases', () => {
        test('should handle tool_use with complex nested input objects', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        {
                            type: 'tool_use',
                            name: 'Edit',
                            input: {
                                file_path: '/src/components/UserProfile.jsx',
                                old_string: 'const [user, setUser] = useState(null);',
                                new_string: 'const [user, setUser] = useState(null);\nconst [loading, setLoading] = useState(false);',
                            },
                        },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('📝 Edit: Editing UserProfile.jsx');
        });

        test('should handle WebFetch and WebSearch tools properly', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'WebSearch', input: { query: 'JavaScript async await best practices' } },
                        { type: 'text', text: '\nBased on the search results, let me fetch the documentation:' },
                        { type: 'tool_use', name: 'WebFetch', input: { url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔎 WebSearch');
            expect(result).toContain('🌐 WebFetch');
        });

        test('should handle unknown tools gracefully with default icon', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'CustomAnalyzer', input: { data: 'complex analysis' } },
                        { type: 'tool_use', name: 'DataProcessor', input: { items: [1, 2, 3] } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🛠️ CustomAnalyzer');
            expect(result).toContain('🛠️ DataProcessor');
        });

        test('should handle system initialization messages', () => {
            const json = {
                type: 'system',
                subtype: 'init',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('🚀 Starting Claude...');
        });

        test('should handle result success messages with duration and cost', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 2500,
                total_cost_usd: 0.0142,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n✅ Completed in 2.5s ($0.0142)');
        });

        test('should handle result success messages with duration only', () => {
            const json = {
                type: 'result',
                subtype: 'success',
                duration_ms: 1200,
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n✅ Completed in 1.2s');
        });

        test('should handle result error messages', () => {
            const json = {
                type: 'result',
                subtype: 'error',
                error: 'API rate limit exceeded',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n❌ Error: API rate limit exceeded');
        });

        test('should handle result error messages without error text', () => {
            const json = {
                type: 'result',
                subtype: 'error',
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n❌ Error: Unknown error');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle extremely long text content gracefully', () => {
            const longText = 'A'.repeat(10000);
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: longText },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe(longText);
        });

        test('should handle messages with null or undefined content blocks', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Valid content' },
                        { type: 'text', text: null },
                        { type: 'text', text: undefined },
                        { type: 'text', text: 'More valid content' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('Valid contentMore valid content');
        });

        test('should handle tool_use with missing input property', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: {} },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('\n🔧 Bash');
        });

        test('should handle content blocks with missing type property', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { text: 'Content without type' },
                        { type: 'tool_use', name: 'Read', input: { file_path: '/test.js' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            // Content without type is ignored, only tool_use is processed
            expect(result).toContain('📖 Read');
            expect(result).not.toContain('Content without type');
        });

        test('should handle malformed JSON gracefully', () => {
            const malformedJson = '{"type": "assistant", "message": {"content": [{"type": "text", "text": "test"}';
            const result = processClaudeMessage(malformedJson);
            expect(result).toBeNull();
        });

        test('should handle JSON injection attempts safely', () => {
            const maliciousInput = '{"type": "assistant", "message": {"content": [{"type": "text", "text": " legit content"}]}, "injected": "bad data"}';
            const result = processClaudeMessage(maliciousInput);
            expect(result).toContain('legit content');
            expect(result).not.toContain('injected');
        });

        test('should handle Unicode and special characters in tool descriptions', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash', input: { description: 'Test with émojis: 🚀 🎉 and special chars: ñáü' } },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toContain('🔧 Bash: Test with émojis: 🚀 🎉 and special chars: ñáü');
        });

        test('should handle content with newline characters and various whitespace', () => {
            const json = {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Line 1\nLine 2\n  Indented line 3\tTabbed content' },
                    ],
                },
            };
            const result = processClaudeMessage(JSON.stringify(json));
            expect(result).toBe('Line 1\nLine 2\n  Indented line 3\tTabbed content');
        });
    });
});
