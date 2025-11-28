/**
 * Ollama Client Tests
 * Self-contained tests following Claudiomiro conventions
 */

const OllamaClient = require('./ollama-client');
const http = require('http');
const { EventEmitter } = require('events');

// Mock http module
jest.mock('http');

// Mock response class
class MockResponse extends EventEmitter {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this._data = data;
  }

  emitData() {
    process.nextTick(() => {
      this.emit('data', JSON.stringify(this._data));
      this.emit('end');
    });
  }
}

// Mock request class
class MockRequest extends EventEmitter {
  constructor(response) {
    super();
    this._response = response;
    this._destroyed = false;
  }

  write(data) {
    this._writtenData = data;
  }

  end() {
    process.nextTick(() => {
      if (!this._destroyed) {
        this._response.emitData();
      }
    });
  }

  destroy() {
    this._destroyed = true;
  }
}

describe('OllamaClient', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMockRequest(statusCode, responseData, options = {}) {
    mockResponse = new MockResponse(statusCode, responseData);
    mockRequest = new MockRequest(mockResponse);

    http.request.mockImplementation((opts, callback) => {
      process.nextTick(() => callback(mockResponse));

      if (options.timeout) {
        process.nextTick(() => mockRequest.emit('timeout'));
      }
      if (options.error) {
        process.nextTick(() => mockRequest.emit('error', new Error(options.error)));
      }

      return mockRequest;
    });
  }

  describe('constructor', () => {
    test('should use default values (no default model)', () => {
      const client = new OllamaClient();

      expect(client.host).toBe('localhost');
      expect(client.port).toBe(11434);
      expect(client.model).toBeNull(); // No default model
      expect(client.timeout).toBe(30000);
    });

    test('should accept custom options', () => {
      const client = new OllamaClient({
        host: 'custom-host',
        port: 8080,
        model: 'codellama:7b',
        timeout: 60000
      });

      expect(client.host).toBe('custom-host');
      expect(client.port).toBe(8080);
      expect(client.model).toBe('codellama:7b');
      expect(client.timeout).toBe(60000);
    });

    test('should read host from environment variables', () => {
      const originalHost = process.env.OLLAMA_HOST;

      process.env.OLLAMA_HOST = 'env-host';

      const client = new OllamaClient();

      expect(client.host).toBe('env-host');
      // Model is not read from env - must be passed via options
      expect(client.model).toBeNull();

      process.env.OLLAMA_HOST = originalHost;
    });
  });

  describe('healthCheck', () => {
    test('should return available: true when server responds', async () => {
      setupMockRequest(200, {
        models: [{ name: 'qwen2.5-coder:7b' }]
      });

      const client = new OllamaClient({ model: 'qwen2.5-coder:7b' });
      const result = await client.healthCheck();

      expect(result.available).toBe(true);
      expect(result.models).toContain('qwen2.5-coder:7b');
      // hasModel checks if model name starts with base model name
      expect(result.hasModel).toBe(true);
    });

    test('should return available: false on connection error', async () => {
      setupMockRequest(200, {}, { error: 'Connection refused' });

      const client = new OllamaClient();
      const result = await client.healthCheck();

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('generate', () => {
    test('should send correct request', async () => {
      setupMockRequest(200, { response: 'Generated text' });

      const client = new OllamaClient();
      const result = await client.generate('Test prompt', { maxTokens: 100 });

      expect(result).toBe('Generated text');
      expect(mockRequest._writtenData).toContain('Test prompt');
    });

    test('should handle empty response', async () => {
      setupMockRequest(200, {});

      const client = new OllamaClient();
      const result = await client.generate('Test prompt');

      expect(result).toBe('');
    });
  });

  describe('generateJSON', () => {
    test('should parse JSON response', async () => {
      setupMockRequest(200, { response: '{"key": "value"}' });

      const client = new OllamaClient();
      const result = await client.generateJSON('Test prompt');

      expect(result).toEqual({ key: 'value' });
    });

    test('should extract JSON from text response', async () => {
      setupMockRequest(200, { response: 'Here is the result: {"data": 123}' });

      const client = new OllamaClient();
      const result = await client.generateJSON('Test prompt');

      expect(result).toEqual({ data: 123 });
    });

    test('should throw on invalid JSON', async () => {
      setupMockRequest(200, { response: 'No JSON here' });

      const client = new OllamaClient();

      await expect(client.generateJSON('Test prompt')).rejects.toThrow('No JSON found');
    });
  });

  describe('classify', () => {
    test('should return filtered topics', async () => {
      setupMockRequest(200, { response: '["api", "database", "invalid"]' });

      const client = new OllamaClient();
      const topics = ['api', 'database', 'testing'];
      const result = await client.classify('Some content', topics);

      expect(result).toContain('api');
      expect(result).toContain('database');
      expect(result).not.toContain('invalid');
    });

    test('should return empty array on error', async () => {
      setupMockRequest(200, { response: 'Not JSON' });

      const client = new OllamaClient();
      const result = await client.classify('Content', ['api']);

      expect(result).toEqual([]);
    });
  });

  describe('summarize', () => {
    test('should return summarized text', async () => {
      setupMockRequest(200, { response: 'Summary of content' });

      const client = new OllamaClient();
      const result = await client.summarize('Long content', 100);

      expect(result).toBe('Summary of content');
    });
  });

  describe('extractSection', () => {
    test('should extract section content', async () => {
      setupMockRequest(200, { response: 'Section content here' });

      const client = new OllamaClient();
      const result = await client.extractSection('## Header\nContent', 'Header');

      expect(result).toBe('Section content here');
    });

    test('should return empty string for NOT_FOUND', async () => {
      setupMockRequest(200, { response: 'NOT_FOUND' });

      const client = new OllamaClient();
      const result = await client.extractSection('Markdown', 'Missing');

      expect(result).toBe('');
    });
  });

  describe('analyzeDependencies', () => {
    test('should return dependency analysis', async () => {
      setupMockRequest(200, {
        response: '{"explicit": ["TASK1"], "implicit": [], "reasoning": "Direct ref"}'
      });

      const client = new OllamaClient();
      const result = await client.analyzeDependencies('Task content', ['TASK1', 'TASK2']);

      expect(result.explicit).toContain('TASK1');
      expect(result.reasoning).toBe('Direct ref');
    });

    test('should return default on error', async () => {
      setupMockRequest(200, { response: 'Invalid' });

      const client = new OllamaClient();
      const result = await client.analyzeDependencies('Content', []);

      expect(result.explicit).toEqual([]);
      expect(result.reasoning).toContain('Failed');
    });
  });

  describe('checkCompletion', () => {
    test('should return completion status', async () => {
      setupMockRequest(200, {
        response: '{"completed": true, "confidence": 0.9, "reason": "Done"}'
      });

      const client = new OllamaClient();
      const result = await client.checkCompletion('TODO content');

      expect(result.completed).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    test('should return default on error', async () => {
      setupMockRequest(200, { response: 'Not JSON' });

      const client = new OllamaClient();
      const result = await client.checkCompletion('Content');

      expect(result.completed).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });
});
