import { ClaudeLogger, ClaudeMessage, ToolInput } from '../claude-logger';

describe('ClaudeLogger', () => {
  describe('processMessage', () => {
    it('should process assistant message with text content', () => {
      const message: ClaudeMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello world' }
          ]
        }
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toBe('Hello world');
    });

    it('should process assistant message with tool calls', () => {
      const message: ClaudeMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'I will help you' },
            {
              type: 'tool_use',
              name: 'Bash',
              input: { description: 'Run command' }
            }
          ]
        }
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toContain('I will help you');
      expect(result).toContain('🔧 Bash: Run command');
    });

    it('should process system init message', () => {
      const message: ClaudeMessage = {
        type: 'system',
        subtype: 'init'
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toBe('🚀 Starting Claude...');
    });

    it('should process success result message', () => {
      const message: ClaudeMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: 2500
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toContain('✅ Completed in 2.5s');
    });

    it('should process error result message', () => {
      const message: ClaudeMessage = {
        type: 'result',
        subtype: 'error',
        error: 'Something went wrong'
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toBe('\n❌ Error: Something went wrong');
    });

    it('should return null for user messages', () => {
      const message: ClaudeMessage = {
        type: 'user'
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = ClaudeLogger.processMessage('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for empty message content', () => {
      const message: ClaudeMessage = {
        type: 'assistant',
        message: {
          content: []
        }
      };

      const result = ClaudeLogger.processMessage(JSON.stringify(message));
      expect(result).toBeNull();
    });
  });

  describe('formatToolName', () => {
    it('should format known tool names with icons', () => {
      expect(ClaudeLogger['formatToolName']('Bash')).toBe('🔧 Bash');
      expect(ClaudeLogger['formatToolName']('Read')).toBe('📖 Read');
      expect(ClaudeLogger['formatToolName']('Write')).toBe('✍️ Write');
    });

    it('should use default icon for unknown tools', () => {
      expect(ClaudeLogger['formatToolName']('UnknownTool')).toBe('🛠️ UnknownTool');
    });
  });

  describe('formatToolDescription', () => {
    it('should format Bash tool description', () => {
      const input: ToolInput = { description: 'Run npm install' };
      const result = ClaudeLogger['formatToolDescription']('Bash', input);
      expect(result).toBe('Run npm install');
    });

    it('should format Read tool description', () => {
      const input: ToolInput = { file_path: '/path/to/file.txt' };
      const result = ClaudeLogger['formatToolDescription']('Read', input);
      expect(result).toBe('Reading file.txt');
    });

    it('should format Write tool description', () => {
      const input: ToolInput = { file_path: '/path/to/config.json' };
      const result = ClaudeLogger['formatToolDescription']('Write', input);
      expect(result).toBe('Writing config.json');
    });

    it('should format Edit tool description', () => {
      const input: ToolInput = { file_path: '/path/to/script.js' };
      const result = ClaudeLogger['formatToolDescription']('Edit', input);
      expect(result).toBe('Editing script.js');
    });

    it('should return empty string for unknown tool or missing input', () => {
      expect(ClaudeLogger['formatToolDescription']('UnknownTool', {})).toBe('');
      expect(ClaudeLogger['formatToolDescription']('Bash', {})).toBe('');
    });
  });
});