import { DeepSeekLogger, DeepSeekMessage, ToolInput } from '../deep-seek-logger';

describe('DeepSeekLogger', () => {
  describe('processMessage', () => {
    it('should process assistant message with text content', () => {
      const message: DeepSeekMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello from DeepSeek' }
          ]
        }
      };

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toBe('Hello from DeepSeek');
    });

    it('should process assistant message with tool calls', () => {
      const message: DeepSeekMessage = {
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

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toContain('I will help you');
      expect(result).toContain('🔧 Bash: Run command');
    });

    it('should process system init message', () => {
      const message: DeepSeekMessage = {
        type: 'system',
        subtype: 'init'
      };

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toBe('🚀 Starting DeepSeek...');
    });

    it('should process success result message', () => {
      const message: DeepSeekMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: 1500
      };

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toContain('✅ Completed in 1.5s');
    });

    it('should process error result message', () => {
      const message: DeepSeekMessage = {
        type: 'result',
        subtype: 'error',
        error: 'DeepSeek error occurred'
      };

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toBe('\n❌ Error: DeepSeek error occurred');
    });

    it('should return null for user messages', () => {
      const message: DeepSeekMessage = {
        type: 'user'
      };

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = DeepSeekLogger.processMessage('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for empty message content', () => {
      const message: DeepSeekMessage = {
        type: 'assistant',
        message: {
          content: []
        }
      };

      const result = DeepSeekLogger.processMessage(JSON.stringify(message));
      expect(result).toBeNull();
    });
  });

  describe('formatToolName', () => {
    it('should format known tool names with icons', () => {
      expect(DeepSeekLogger['formatToolName']('Bash')).toBe('🔧 Bash');
      expect(DeepSeekLogger['formatToolName']('Read')).toBe('📖 Read');
      expect(DeepSeekLogger['formatToolName']('Write')).toBe('✍️ Write');
    });

    it('should use default icon for unknown tools', () => {
      expect(DeepSeekLogger['formatToolName']('UnknownTool')).toBe('🛠️ UnknownTool');
    });
  });

  describe('formatToolDescription', () => {
    it('should format Bash tool description', () => {
      const input: ToolInput = { description: 'Run npm install' };
      const result = DeepSeekLogger['formatToolDescription']('Bash', input);
      expect(result).toBe('Run npm install');
    });

    it('should format Read tool description', () => {
      const input: ToolInput = { file_path: '/path/to/file.txt' };
      const result = DeepSeekLogger['formatToolDescription']('Read', input);
      expect(result).toBe('Reading file.txt');
    });

    it('should format Write tool description', () => {
      const input: ToolInput = { file_path: '/path/to/config.json' };
      const result = DeepSeekLogger['formatToolDescription']('Write', input);
      expect(result).toBe('Writing config.json');
    });

    it('should format Edit tool description', () => {
      const input: ToolInput = { file_path: '/path/to/script.js' };
      const result = DeepSeekLogger['formatToolDescription']('Edit', input);
      expect(result).toBe('Editing script.js');
    });

    it('should return empty string for unknown tool or missing input', () => {
      expect(DeepSeekLogger['formatToolDescription']('UnknownTool', {})).toBe('');
      expect(DeepSeekLogger['formatToolDescription']('Bash', {})).toBe('');
    });
  });
});