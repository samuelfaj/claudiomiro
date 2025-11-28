/**
 * Test Local LLM Command Tests
 * Self-contained tests following Claudiomiro conventions
 */

// Mock dependencies before requiring the module
jest.mock('../../shared/services/local-llm/ollama-client');
jest.mock('../../shared/config/local-llm', () => ({
    parseLocalLLMConfig: jest.fn(),
}));
jest.mock('readline');

const { run, printHeader, printStatus, generateResponse } = require('./index');
const OllamaClient = require('../../shared/services/local-llm/ollama-client');
const { parseLocalLLMConfig } = require('../../shared/config/local-llm');
const readline = require('readline');

describe('test-local-llm command', () => {
    let consoleLogSpy;
    let processExitSpy;
    let mockRl;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

        // Default readline mock - empty input
        mockRl = {
            question: jest.fn((_, callback) => callback('')),
            close: jest.fn(),
        };
        readline.createInterface.mockReturnValue(mockRl);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    describe('printHeader', () => {
        test('should display header with title', () => {
            printHeader();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Local LLM Test');
            expect(output).toContain('Ollama');
        });
    });

    describe('printStatus', () => {
        test('should display connected status when available', () => {
            const status = {
                available: true,
                selectedModel: 'qwen2.5-coder:7b',
                hasModel: true,
                models: ['qwen2.5-coder:7b', 'codellama:7b'],
            };

            printStatus(status);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Connected');
            expect(output).toContain('qwen2.5-coder:7b');
        });

        test('should display error when not available', () => {
            const status = {
                available: false,
                error: 'Connection refused',
            };

            printStatus(status);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Not available');
            expect(output).toContain('Connection refused');
            expect(output).toContain('ollama serve');
        });

        test('should truncate long model list', () => {
            const models = Array.from({ length: 15 }, (_, i) => `model${i}:latest`);
            const status = {
                available: true,
                selectedModel: 'model0:latest',
                hasModel: true,
                models,
            };

            printStatus(status);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('and 5 more');
        });
    });

    describe('generateResponse', () => {
        test('should generate and display response', async () => {
            const mockClient = {
                generate: jest.fn().mockResolvedValue('Test response from LLM'),
            };

            const result = await generateResponse(mockClient, 'Test prompt');

            expect(mockClient.generate).toHaveBeenCalledWith('Test prompt', {
                maxTokens: 512,
                temperature: 0.7,
            });
            expect(result).toBe('Test response from LLM');

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('RESPONSE');
            expect(output).toContain('Test response from LLM');
        });

        test('should display error on failure', async () => {
            const mockClient = {
                generate: jest.fn().mockRejectedValue(new Error('Generation failed')),
            };

            await expect(generateResponse(mockClient, 'Test prompt')).rejects.toThrow('Generation failed');

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('ERROR');
            expect(output).toContain('Generation failed');
        });
    });

    describe('run', () => {
        test('should show instructions when LLM not enabled', async () => {
            parseLocalLLMConfig.mockReturnValue({ enabled: false });

            await run([]);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('not enabled');
            expect(output).toContain('CLAUDIOMIRO_LOCAL_LLM');
        });

        test('should exit with error when Ollama not available', async () => {
            parseLocalLLMConfig.mockReturnValue({
                enabled: true,
                model: 'qwen2.5-coder:7b',
                host: 'localhost',
                port: 11434,
                timeout: 30000,
            });

            const mockHealthCheck = jest.fn().mockResolvedValue({
                available: false,
                error: 'Connection refused',
            });

            OllamaClient.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
            }));

            await run([]);

            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        test('should exit with error when model not installed', async () => {
            parseLocalLLMConfig.mockReturnValue({
                enabled: true,
                model: 'qwen2.5-coder:7b',
                host: 'localhost',
                port: 11434,
                timeout: 30000,
            });

            const mockHealthCheck = jest.fn().mockResolvedValue({
                available: true,
                hasModel: false,
                models: ['codellama:7b'],
            });

            OllamaClient.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
            }));

            await run([]);

            expect(processExitSpy).toHaveBeenCalledWith(1);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('not installed');
            expect(output).toContain('ollama pull');
        });

        test('should use prompt from args', async () => {
            parseLocalLLMConfig.mockReturnValue({
                enabled: true,
                model: 'qwen2.5-coder:7b',
                host: 'localhost',
                port: 11434,
                timeout: 30000,
            });

            const mockHealthCheck = jest.fn().mockResolvedValue({
                available: true,
                hasModel: true,
                selectedModel: 'qwen2.5-coder:7b',
                models: ['qwen2.5-coder:7b'],
            });

            const mockGenerate = jest.fn().mockResolvedValue('Generated response');

            OllamaClient.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
                generate: mockGenerate,
            }));

            await run(['--prompt=Hello world']);

            expect(mockGenerate).toHaveBeenCalledWith('Hello world', expect.any(Object));
        });

        test('should handle quoted prompt in args', async () => {
            parseLocalLLMConfig.mockReturnValue({
                enabled: true,
                model: 'qwen2.5-coder:7b',
                host: 'localhost',
                port: 11434,
                timeout: 30000,
            });

            const mockHealthCheck = jest.fn().mockResolvedValue({
                available: true,
                hasModel: true,
                selectedModel: 'qwen2.5-coder:7b',
                models: ['qwen2.5-coder:7b'],
            });

            const mockGenerate = jest.fn().mockResolvedValue('Generated response');

            OllamaClient.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
                generate: mockGenerate,
            }));

            await run(['--prompt="Test with quotes"']);

            expect(mockGenerate).toHaveBeenCalledWith('Test with quotes', expect.any(Object));
        });

        test('should ask for prompt interactively when not provided', async () => {
            parseLocalLLMConfig.mockReturnValue({
                enabled: true,
                model: 'qwen2.5-coder:7b',
                host: 'localhost',
                port: 11434,
                timeout: 30000,
            });

            const mockHealthCheck = jest.fn().mockResolvedValue({
                available: true,
                hasModel: true,
                selectedModel: 'qwen2.5-coder:7b',
                models: ['qwen2.5-coder:7b'],
            });

            const mockGenerate = jest.fn().mockResolvedValue('Generated response');

            OllamaClient.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
                generate: mockGenerate,
            }));

            // Override readline mock for this test
            mockRl.question.mockImplementation((_, callback) => callback('Interactive prompt'));

            await run([]);

            expect(mockGenerate).toHaveBeenCalledWith('Interactive prompt', expect.any(Object));
        });

        test('should handle empty prompt gracefully', async () => {
            parseLocalLLMConfig.mockReturnValue({
                enabled: true,
                model: 'qwen2.5-coder:7b',
                host: 'localhost',
                port: 11434,
                timeout: 30000,
            });

            const mockHealthCheck = jest.fn().mockResolvedValue({
                available: true,
                hasModel: true,
                selectedModel: 'qwen2.5-coder:7b',
                models: ['qwen2.5-coder:7b'],
            });

            const mockGenerate = jest.fn().mockResolvedValue('Generated response');

            OllamaClient.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
                generate: mockGenerate,
            }));

            // Use default empty input from beforeEach
            await run([]);

            expect(mockGenerate).not.toHaveBeenCalled();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('No prompt provided');
        });
    });
});
