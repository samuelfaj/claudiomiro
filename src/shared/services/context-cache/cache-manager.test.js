const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mock fs module
jest.mock('fs');

const {
    loadCache,
    saveCache,
    createEmptyCache,
    computeFileHash,
    getCachePath,
    hasAiPromptChanged,
    updateAiPromptCache,
    getCachedAiPromptSummary,
    addCompletedTask,
    getNewCompletedTasks,
    getLastProcessedTask,
    clearCache,
    getAllCompletedTasks,
    storeCodebasePatterns,
    getCodebasePatterns,
    CACHE_VERSION,
} = require('./cache-manager');

describe('cache-manager', () => {
    const mockClaudiomiroFolder = '/test/.claudiomiro';
    const mockCachePath = '/test/.claudiomiro/cache/context-cache.json';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-18T10:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('createEmptyCache', () => {
        test('should create empty cache with correct structure', () => {
            const cache = createEmptyCache();

            expect(cache.version).toBe(CACHE_VERSION);
            expect(cache.created).toBe('2025-01-18T10:00:00.000Z');
            expect(cache.aiPrompt).toEqual({
                hash: null,
                summary: null,
                lastProcessed: null,
            });
            expect(cache.completedTasks).toEqual({});
            expect(cache.researchIndex).toEqual({});
            expect(cache.lastProcessedTask).toBeNull();
        });
    });

    describe('computeFileHash', () => {
        test('should return null if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const hash = computeFileHash('/test/file.md');

            expect(hash).toBeNull();
        });

        test('should compute MD5 hash of file content', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('test content');

            const hash = computeFileHash('/test/file.md');
            const expectedHash = crypto.createHash('md5').update('test content').digest('hex');

            expect(hash).toBe(expectedHash);
        });
    });

    describe('getCachePath', () => {
        test('should create cache directory if not exists', () => {
            fs.existsSync.mockReturnValue(false);

            getCachePath(mockClaudiomiroFolder);

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                path.join(mockClaudiomiroFolder, 'cache'),
                { recursive: true },
            );
        });

        test('should return correct cache file path', () => {
            fs.existsSync.mockReturnValue(true);

            const result = getCachePath(mockClaudiomiroFolder);

            expect(result).toBe(mockCachePath);
        });
    });

    describe('loadCache', () => {
        test('should return empty cache if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const cache = loadCache(mockClaudiomiroFolder);

            expect(cache.version).toBe(CACHE_VERSION);
            expect(cache.completedTasks).toEqual({});
        });

        test('should load cache from file', () => {
            const existingCache = {
                version: CACHE_VERSION,
                created: '2025-01-17T10:00:00Z',
                completedTasks: { TASK1: { summary: 'test' } },
            };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(existingCache));

            const cache = loadCache(mockClaudiomiroFolder);

            expect(cache.completedTasks).toEqual({ TASK1: { summary: 'test' } });
        });

        test('should return empty cache if version mismatch', () => {
            const oldCache = {
                version: '0.0.1',
                completedTasks: { TASK1: { summary: 'old' } },
            };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(oldCache));

            const cache = loadCache(mockClaudiomiroFolder);

            expect(cache.version).toBe(CACHE_VERSION);
            expect(cache.completedTasks).toEqual({});
        });

        test('should return empty cache on parse error', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            const cache = loadCache(mockClaudiomiroFolder);

            expect(cache.version).toBe(CACHE_VERSION);
        });
    });

    describe('saveCache', () => {
        test('should write cache to file with updated timestamp', () => {
            fs.existsSync.mockReturnValue(true);

            const cache = createEmptyCache();
            saveCache(mockClaudiomiroFolder, cache);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockCachePath,
                expect.stringContaining('"lastUpdated"'),
                'utf8',
            );
        });
    });

    describe('hasAiPromptChanged', () => {
        test('should return true if hash is different', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync
                .mockReturnValueOnce(JSON.stringify({
                    version: CACHE_VERSION,
                    aiPrompt: { hash: 'old-hash' },
                }))
                .mockReturnValueOnce('new content');

            const cache = loadCache(mockClaudiomiroFolder);
            const changed = hasAiPromptChanged(mockClaudiomiroFolder, cache);

            expect(changed).toBe(true);
        });

        test('should return false if hash is same', () => {
            const content = 'same content';
            const hash = crypto.createHash('md5').update(content).digest('hex');

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync
                .mockReturnValueOnce(JSON.stringify({
                    version: CACHE_VERSION,
                    aiPrompt: { hash },
                }))
                .mockReturnValueOnce(content);

            const cache = loadCache(mockClaudiomiroFolder);
            const changed = hasAiPromptChanged(mockClaudiomiroFolder, cache);

            expect(changed).toBe(false);
        });
    });

    describe('updateAiPromptCache', () => {
        test('should update AI prompt cache with hash and summary', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('AI prompt content');

            const cache = createEmptyCache();
            updateAiPromptCache(mockClaudiomiroFolder, cache, 'Test summary');

            expect(cache.aiPrompt.summary).toBe('Test summary');
            expect(cache.aiPrompt.hash).not.toBeNull();
            expect(cache.aiPrompt.lastProcessed).toBe('2025-01-18T10:00:00.000Z');
        });
    });

    describe('getCachedAiPromptSummary', () => {
        test('should return null if no summary cached', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                aiPrompt: { summary: null, hash: null },
            }));

            const summary = getCachedAiPromptSummary(mockClaudiomiroFolder);

            expect(summary).toBeNull();
        });

        test('should return null if AI_PROMPT changed', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync
                .mockReturnValueOnce(JSON.stringify({
                    version: CACHE_VERSION,
                    aiPrompt: { summary: 'old summary', hash: 'old-hash' },
                }))
                .mockReturnValueOnce('new content');

            const summary = getCachedAiPromptSummary(mockClaudiomiroFolder);

            expect(summary).toBeNull();
        });

        test('should return cached summary if valid', () => {
            const content = 'unchanged content';
            const hash = crypto.createHash('md5').update(content).digest('hex');

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync
                .mockReturnValueOnce(JSON.stringify({
                    version: CACHE_VERSION,
                    aiPrompt: { summary: 'cached summary', hash },
                }))
                .mockReturnValueOnce(content);

            const summary = getCachedAiPromptSummary(mockClaudiomiroFolder);

            expect(summary).toBe('cached summary');
        });
    });

    describe('addCompletedTask', () => {
        test('should add task to completed tasks', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                completedTasks: {},
                lastProcessedTask: null,
            }));

            addCompletedTask(mockClaudiomiroFolder, 'TASK1', { files: ['test.js'] });

            const writeCall = fs.writeFileSync.mock.calls[0];
            const savedCache = JSON.parse(writeCall[1]);

            expect(savedCache.completedTasks.TASK1).toBeDefined();
            expect(savedCache.completedTasks.TASK1.files).toEqual(['test.js']);
            expect(savedCache.lastProcessedTask).toBe('TASK1');
        });
    });

    describe('getNewCompletedTasks', () => {
        test('should return all tasks if afterTask is null', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                completedTasks: {
                    TASK1: { addedAt: '2025-01-17T10:00:00Z' },
                    TASK2: { addedAt: '2025-01-18T10:00:00Z' },
                },
            }));

            const tasks = getNewCompletedTasks(mockClaudiomiroFolder, null);

            expect(Object.keys(tasks)).toEqual(['TASK1', 'TASK2']);
        });

        test('should return only tasks after specified task', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                completedTasks: {
                    TASK1: { addedAt: '2025-01-17T10:00:00Z' },
                    TASK2: { addedAt: '2025-01-18T10:00:00Z' },
                    TASK3: { addedAt: '2025-01-18T11:00:00Z' },
                },
            }));

            const tasks = getNewCompletedTasks(mockClaudiomiroFolder, 'TASK1');

            expect(Object.keys(tasks)).toEqual(['TASK2', 'TASK3']);
        });
    });

    describe('getLastProcessedTask', () => {
        test('should return last processed task from cache', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                lastProcessedTask: 'TASK3',
            }));

            const lastTask = getLastProcessedTask(mockClaudiomiroFolder);

            expect(lastTask).toBe('TASK3');
        });
    });

    describe('clearCache', () => {
        test('should delete cache file if exists', () => {
            fs.existsSync.mockReturnValue(true);

            clearCache(mockClaudiomiroFolder);

            expect(fs.unlinkSync).toHaveBeenCalledWith(mockCachePath);
        });

        test('should do nothing if cache does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            clearCache(mockClaudiomiroFolder);

            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });
    });

    describe('getAllCompletedTasks', () => {
        test('should return all completed tasks', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                completedTasks: {
                    TASK1: { summary: 'task 1' },
                    TASK2: { summary: 'task 2' },
                },
            }));

            const tasks = getAllCompletedTasks(mockClaudiomiroFolder);

            expect(tasks).toEqual({
                TASK1: { summary: 'task 1' },
                TASK2: { summary: 'task 2' },
            });
        });
    });

    describe('storeCodebasePatterns', () => {
        test('should merge patterns into cache', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                codebasePatterns: { testFramework: 'jest' },
            }));

            storeCodebasePatterns(mockClaudiomiroFolder, { importStyle: 'commonjs' });

            const writeCall = fs.writeFileSync.mock.calls[0];
            const savedCache = JSON.parse(writeCall[1]);

            expect(savedCache.codebasePatterns.testFramework).toBe('jest');
            expect(savedCache.codebasePatterns.importStyle).toBe('commonjs');
        });
    });

    describe('getCodebasePatterns', () => {
        test('should return stored codebase patterns', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: CACHE_VERSION,
                codebasePatterns: { testFramework: 'jest', importStyle: 'commonjs' },
            }));

            const patterns = getCodebasePatterns(mockClaudiomiroFolder);

            expect(patterns).toEqual({
                testFramework: 'jest',
                importStyle: 'commonjs',
            });
        });
    });
});
