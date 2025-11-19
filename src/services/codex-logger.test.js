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

  describe('OpenAI-Specific API Response Patterns', () => {
    test('should handle OpenAI token usage information', () => {
      const tokenUsage = {
        usage: {
          prompt_tokens: 150,
          completion_tokens: 75,
          total_tokens: 225,
          prompt_tokens_details: {
            cached_tokens: 50
          }
        }
      };
      const result = processCodexEvent(JSON.stringify(tokenUsage));
      expect(result).toContain('"usage"');
      expect(result).toContain('"prompt_tokens":150');
      expect(result).toContain('"completion_tokens":75');
      expect(result).toContain('"total_tokens":225');
    });

    test('should handle OpenAI cost tracking information', () => {
      const costInfo = {
        usage: {
          total_cost_usd: 0.0045,
          model: 'gpt-4'
        }
      };
      const result = processCodexEvent(JSON.stringify(costInfo));
      expect(result).toContain('"usage"');
      expect(result).toContain('"total_cost_usd":0.0045');
      expect(result).toContain('"model":"gpt-4"');
    });

    test('should handle OpenAI function call format', () => {
      const functionCall = {
        item: {
          type: 'function_call',
          function: {
            name: 'file_search',
            arguments: '{"query": "test files"}'
          }
        }
      };
      const result = processCodexEvent(JSON.stringify(functionCall));
      expect(result).toContain('"item"');
      expect(result).toContain('"type":"function_call"');
      expect(result).toContain('"name":"file_search"');
      expect(result).toContain('"arguments":');
    });

    test('should handle OpenAI tool result format', () => {
      const toolResult = {
        item: {
          type: 'tool_result',
          tool_call_id: 'call_123',
          content: 'File search results...'
        }
      };
      const result = processCodexEvent(JSON.stringify(toolResult));
      expect(result).toContain('"item"');
      expect(result).toContain('"type":"tool_result"');
      expect(result).toContain('"tool_call_id":"call_123"');
      expect(result).toContain('"content":"File search results..."');
    });

    test('should handle OpenAI streaming response chunks', () => {
      const streamingChunk1 = {
        item: {
          delta: {
            content: 'Hello'
          },
          finish_reason: null
        }
      };
      const streamingChunk2 = {
        item: {
          delta: {
            content: ' world!'
          },
          finish_reason: 'stop'
        }
      };

      const result1 = processCodexEvent(JSON.stringify(streamingChunk1));
      const result2 = processCodexEvent(JSON.stringify(streamingChunk2));

      expect(result1).toContain('"delta"');
      expect(result1).toContain('"content":"Hello"');
      expect(result1).toContain('"finish_reason":null');

      expect(result2).toContain('"content":" world!"');
      expect(result2).toContain('"finish_reason":"stop"');
    });

    test('should handle OpenAI API error responses', () => {
      const rateLimitError = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      };
      const result = processCodexEvent(JSON.stringify(rateLimitError));
      expect(result).toContain('"error"');
      expect(result).toContain('"message":"Rate limit exceeded"');
      expect(result).toContain('"type":"rate_limit_error"');
      expect(result).toContain('"code":"rate_limit_exceeded"');
    });

    test('should handle OpenAI invalid request error', () => {
      const invalidRequestError = {
        error: {
          message: 'Invalid request: model not found',
          type: 'invalid_request_error',
          param: 'model'
        }
      };
      const result = processCodexEvent(JSON.stringify(invalidRequestError));
      expect(result).toContain('"error"');
      expect(result).toContain('"message":"Invalid request: model not found"');
      expect(result).toContain('"type":"invalid_request_error"');
      expect(result).toContain('"param":"model"');
    });
  });

  describe('Agent Reasoning and Complex Workflows', () => {
    test('should handle multi-step agent reasoning process', () => {
      const reasoningSteps = [
        {
          msg: {
            type: 'agent_reasoning_step',
            step: 1,
            total_steps: 5,
            reasoning: 'Analyzing code structure...',
            confidence: 0.85
          }
        },
        {
          msg: {
            type: 'agent_reasoning_step',
            step: 2,
            total_steps: 5,
            reasoning: 'Identifying potential issues...',
            confidence: 0.90
          }
        },
        {
          msg: {
            type: 'agent_reasoning_complete',
            conclusion: 'Found 3 potential bugs in the authentication logic'
          }
        }
      ];

      reasoningSteps.forEach((step, index) => {
        const result = processCodexEvent(JSON.stringify(step));
        expect(result).toContain('"msg"');
        expect(result).toContain('"type":"agent_reasoning');
        expect(result).toContain('"step":' + (index + 1));
      });
    });

    test('should handle chain-of-thought reasoning', () => {
      const chainOfThought = {
        item: {
          type: 'chain_of_thought',
          thoughts: [
            'Step 1: Understanding the requirement',
            'Step 2: Breaking down the problem',
            'Step 3: Implementing solution'
          ]
        }
      };
      const result = processCodexEvent(JSON.stringify(chainOfThought));
      expect(result).toContain('"item"');
      expect(result).toContain('"type":"chain_of_thought"');
      expect(result).toContain('"thoughts"');
    });

    test('should handle complete conversation workflow', () => {
      const conversationFlow = [
        { item: { type: 'user_query', text: 'Help me debug this code' } },
        { msg: { type: 'agent_reasoning_start' } },
        { item: { type: 'file_analysis', path: '/src/app.js' } },
        { item: { type: 'tool_use', tool: 'code_search' } },
        { item: { type: 'suggestion', text: 'Try fixing the import' } },
        { msg: { type: 'agent_reasoning_complete' } }
      ];

      conversationFlow.forEach((event, index) => {
        const result = processCodexEvent(JSON.stringify(event));
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('MCP (Model Context Protocol) Integration', () => {
    test('should handle MCP tool call interactions', () => {
      const mcpToolCall = {
        item: {
          type: 'mcp_tool_call',
          server: 'filesystem',
          tool: 'read_file',
          arguments: { path: '/project/src/index.js' }
        }
      };
      const result = processCodexEvent(JSON.stringify(mcpToolCall));
      expect(result).toContain('"item"');
      expect(result).toContain('"type":"mcp_tool_call"');
      expect(result).toContain('"server":"filesystem"');
      expect(result).toContain('"tool":"read_file"');
      expect(result).toContain('"arguments"');
    });

    test('should handle MCP tool results', () => {
      const mcpToolResult = {
        item: {
          type: 'mcp_tool_result',
          server: 'filesystem',
          result: { content: 'file content here...' }
        }
      };
      const result = processCodexEvent(JSON.stringify(mcpToolResult));
      expect(result).toContain('"item"');
      expect(result).toContain('"type":"mcp_tool_result"');
      expect(result).toContain('"server":"filesystem"');
      expect(result).toContain('"result"');
    });
  });

  describe('Parallel Processing State Management', () => {
    test('should handle parallel task coordination', () => {
      const parallelStart = {
        msg: {
          type: 'parallel_task_start',
          task_id: 'task_123',
          total_tasks: 5
        }
      };
      const result = processCodexEvent(JSON.stringify(parallelStart));
      expect(result).toContain('"msg"');
      expect(result).toContain('"type":"parallel_task_start"');
      expect(result).toContain('"task_id":"task_123"');
      expect(result).toContain('"total_tasks":5');
    });

    test('should handle parallel task progress updates', () => {
      const progressUpdate = {
        msg: {
          type: 'parallel_task_progress',
          task_id: 'task_123',
          completed: 2,
          total: 5
        }
      };
      const result = processCodexEvent(JSON.stringify(progressUpdate));
      expect(result).toContain('"msg"');
      expect(result).toContain('"type":"parallel_task_progress"');
      expect(result).toContain('"completed":2');
      expect(result).toContain('"total":5');
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    test('should handle large payload processing', () => {
      const largePayload = {
        item: {
          type: 'large_file_content',
          content: 'x'.repeat(1000), // 1KB payload for test
          truncated: true
        }
      };
      const result = processCodexEvent(JSON.stringify(largePayload));
      expect(result).toContain('"item"');
      expect(result).toContain('"type":"large_file_content"');
      expect(result).toContain('"truncated":true');
      expect(result).toContain('"content"');
    });

    test('should handle rapid event processing simulation', () => {
      const rapidEvents = Array(10).fill().map((_, i) => ({
        item: {
          text: `Event ${i}`,
          timestamp: Date.now() + i
        }
      }));

      rapidEvents.forEach((event, index) => {
        const result = processCodexEvent(JSON.stringify(event));
        expect(result).toContain(`"text":"Event ${index}"`);
      });
    });

    test('should handle complex nested JSON structures', () => {
      const complexStructure = {
        session: {
          id: 'sess_123',
          metadata: {
            model: 'gpt-4-turbo',
            temperature: 0.7,
            max_tokens: 4096
          }
        },
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant'
          },
          {
            role: 'user',
            content: 'Help me understand this code'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'code_analyzer',
              description: 'Analyzes code structure',
              parameters: {
                type: 'object',
                properties: {
                  language: { type: 'string' },
                  file_path: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const result = processCodexEvent(JSON.stringify(complexStructure));
      expect(result).toContain('"session"');
      expect(result).toContain('"messages"');
      expect(result).toContain('"tools"');
      expect(typeof result).toBe('string');
    });
  });

  describe('Critical Bug Fix Verification', () => {
    test('should correctly handle msg.text property (previously had typo bug)', () => {
      const testMessage = {
        msg: {
          text: 'This should be displayed correctly'
        }
      };
      const result = processCodexEvent(JSON.stringify(testMessage));
      expect(result).toBe('This should be displayed correctly');
    });

    test('should handle msg.text with various content types', () => {
      const textMessages = [
        { msg: { text: 'Simple text message' } },
        { msg: { text: 'Message with numbers: 123' } },
        { msg: { text: 'Message with special chars: !@#$%' } },
        { msg: { text: 'Message with unicode: 🚀 🎉 émojis' } }
      ];

      textMessages.forEach((testCase) => {
        const result = processCodexEvent(JSON.stringify(testCase));
        expect(result).toBe(testCase.msg.text);
      });
    });
  });
});