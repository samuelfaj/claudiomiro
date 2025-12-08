/**
 * Local LLM Service Tests
 * Self-contained tests following Claudiomiro conventions
 */

const { LocalLLMService, getLocalLLMService, resetLocalLLMService } = require('./index');

// Mock the OllamaClient
jest.mock('./ollama-client', () => {
    return jest.fn().mockImplementation((options) => {
        const shouldFail = options?.shouldFail || false;

        return {
            model: options?.model || 'qwen2.5-coder:7b',
            healthCheck: jest.fn().mockImplementation(async () => {
                if (shouldFail) {
                    return { available: false, error: 'Connection refused' };
                }
                return {
                    available: true,
                    models: ['qwen2.5-coder:7b'],
                    hasModel: true,
                };
            }),
            classify: jest.fn().mockResolvedValue(['api', 'database']),
            summarize: jest.fn().mockResolvedValue('Summarized content'),
            extractSection: jest.fn().mockResolvedValue('Section content'),
            checkCompletion: jest.fn().mockResolvedValue({
                completed: true,
                confidence: 0.95,
                reason: 'Explicit marker found',
            }),
            analyzeDependencies: jest.fn().mockResolvedValue({
                explicit: ['TASK1'],
                implicit: ['TASK2'],
                reasoning: 'File dependency detected',
            }),
            generate: jest.fn().mockResolvedValue('Generated text'),
        };
    });
});

// Mock the cache
jest.mock('./cache', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockReturnValue(null),
        set: jest.fn(),
        getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0 }),
    }));
});

describe('LocalLLMService', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.CLAUDIOMIRO_LOCAL_LLM;
        // Enable local LLM for most tests
        process.env.CLAUDIOMIRO_LOCAL_LLM = 'qwen2.5-coder:7b';
        resetLocalLLMService();
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env.CLAUDIOMIRO_LOCAL_LLM = originalEnv;
    });

    describe('initialization', () => {
        test('should initialize successfully when Ollama is available', async () => {
            const service = new LocalLLMService();
            const result = await service.initialize();

            expect(result.available).toBe(true);
            expect(result.fallbackMode).toBe(false);
            expect(service.isAvailable()).toBe(true);
        });

        test('should fallback when Ollama is unavailable', async () => {
            // Disable Claude fallback to test pure fallback mode
            const service = new LocalLLMService({ shouldFail: true, useClaudeFallback: false });
            const result = await service.initialize();

            expect(result.available).toBe(false);
            expect(result.fallbackMode).toBe(true);
            expect(service.isAvailable()).toBe(false);
        });

        test('should use Claude fast model when Ollama unavailable and useClaudeFallback enabled', async () => {
            const service = new LocalLLMService({ shouldFail: true, useClaudeFallback: true });
            const result = await service.initialize();

            expect(result.available).toBe(false);
            expect(result.fallbackMode).toBe(true);
            expect(service.useClaudeFallback).toBe(true);
            // isAvailable returns true because Claude fallback is available
            expect(service.isAvailable()).toBe(true);
        });

        test('should be disabled by default when CLAUDIOMIRO_LOCAL_LLM not set', async () => {
            delete process.env.CLAUDIOMIRO_LOCAL_LLM;

            const service = new LocalLLMService();
            const result = await service.initialize();

            expect(result.available).toBe(false);
            expect(result.fallbackMode).toBe(true);
            expect(result.reason).toContain('not enabled');
        });

        test('should be disabled when CLAUDIOMIRO_LOCAL_LLM is set to "true" (no default model)', async () => {
            process.env.CLAUDIOMIRO_LOCAL_LLM = 'true';

            const service = new LocalLLMService();
            const result = await service.initialize();

            expect(result.available).toBe(false);
            expect(result.fallbackMode).toBe(true);
            expect(result.reason).toContain('not enabled');
        });

        test('should be enabled when CLAUDIOMIRO_LOCAL_LLM is set to model name', async () => {
            process.env.CLAUDIOMIRO_LOCAL_LLM = 'qwen2.5-coder:7b';

            const service = new LocalLLMService();
            const result = await service.initialize();

            expect(result.available).toBe(true);
            expect(result.fallbackMode).toBe(false);
        });

        test('should only initialize once', async () => {
            const service = new LocalLLMService();
            await service.initialize();
            const status1 = service.getStatus();

            await service.initialize();
            const status2 = service.getStatus();

            expect(status1).toEqual(status2);
        });
    });

    describe('classifyTopics', () => {
        test('should use LLM when available', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const topics = await service.classifyTopics('API endpoint for user database');

            expect(topics).toEqual(['api', 'database']);
        });

        test('should fallback to heuristics when LLM unavailable', async () => {
            const service = new LocalLLMService({ shouldFail: true });
            await service.initialize();

            const topics = await service.classifyTopics('authentication login jwt token');

            expect(topics).toContain('authentication');
        });
    });

    describe('extractSection', () => {
        test('should use LLM when available', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const markdown = '## Test Section\nSome content';
            const section = await service.extractSection(markdown, 'Test Section');

            expect(section).toBe('Section content');
        });

        test('should fallback to regex when LLM unavailable', async () => {
            const service = new LocalLLMService({ shouldFail: true });
            await service.initialize();

            const markdown = '## Implementation Plan\nStep 1\nStep 2';
            const section = await service.extractSection(markdown, 'Implementation Plan');

            expect(section).toContain('Step 1');
        });
    });

    describe('summarize', () => {
        test('should use LLM when available', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const summary = await service.summarize('Long content here', 100);

            expect(summary).toBe('Summarized content');
        });

        test('should truncate when LLM unavailable', async () => {
            const service = new LocalLLMService({ shouldFail: true });
            await service.initialize();

            const longContent = 'A'.repeat(1000);
            const summary = await service.summarize(longContent, 50);

            expect(summary.length).toBe(200); // 50 tokens * 4 chars
        });
    });

    describe('checkCompletion', () => {
        test('should use LLM when available', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const result = await service.checkCompletion('Fully implemented: YES');

            expect(result.completed).toBe(true);
            expect(result.confidence).toBe(0.95);
        });

        test('should fallback to heuristics when LLM unavailable', async () => {
            const service = new LocalLLMService({ shouldFail: true });
            await service.initialize();

            const result = await service.checkCompletion('Fully implemented: YES\nAll done');

            expect(result.completed).toBe(true);
            expect(result.reason).toContain('Heuristic');
        });
    });

    describe('analyzeDependencies', () => {
        test('should use LLM when available', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const result = await service.analyzeDependencies(
                '@dependencies [TASK1]',
                ['TASK1', 'TASK2', 'TASK3'],
            );

            expect(result.explicit).toContain('TASK1');
            expect(result.implicit).toContain('TASK2');
        });

        test('should fallback to regex when LLM unavailable', async () => {
            const service = new LocalLLMService({ shouldFail: true });
            await service.initialize();

            const result = await service.analyzeDependencies(
                '@dependencies [TASK1, TASK3]',
                ['TASK1', 'TASK2', 'TASK3'],
            );

            expect(result.explicit).toContain('TASK1');
            expect(result.explicit).toContain('TASK3');
        });
    });

    describe('generate', () => {
        test('should return text when LLM available', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const result = await service.generate('Test prompt');

            expect(result).toBe('Generated text');
        });

        test('should return null when LLM unavailable', async () => {
            const service = new LocalLLMService({ shouldFail: true });
            await service.initialize();

            const result = await service.generate('Test prompt');

            expect(result).toBeNull();
        });
    });

    describe('getStatus', () => {
        test('should return complete status', async () => {
            const service = new LocalLLMService();
            await service.initialize();

            const status = service.getStatus();

            expect(status).toHaveProperty('initialized', true);
            expect(status).toHaveProperty('available', true);
            expect(status).toHaveProperty('fallbackMode', false);
            expect(status).toHaveProperty('model', 'qwen2.5-coder:7b');
        });
    });

    describe('singleton', () => {
        test('should return same instance', () => {
            const instance1 = getLocalLLMService();
            const instance2 = getLocalLLMService();

            expect(instance1).toBe(instance2);
        });

        test('should reset correctly', () => {
            const instance1 = getLocalLLMService();
            resetLocalLLMService();
            const instance2 = getLocalLLMService();

            expect(instance1).not.toBe(instance2);
        });
    });
});
