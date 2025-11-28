const fs = require('fs');

// Mock fs module
jest.mock('fs');

// Mock cache-manager
jest.mock('./cache-manager', () => ({
    loadCache: jest.fn(),
    saveCache: jest.fn(),
    addCompletedTask: jest.fn(),
    getLastProcessedTask: jest.fn(),
    getAllCompletedTasks: jest.fn(),
    getCachedAiPromptSummary: jest.fn(),
    updateAiPromptCache: jest.fn(),
    hasAiPromptChanged: jest.fn(),
    storeCodebasePatterns: jest.fn(),
    getCodebasePatterns: jest.fn(),
}));

const {
    getTaskOrder,
    getTaskFolders,
    isTaskCompleted,
    extractContextSummary,
    extractContextSummaryAsync,
    extractResearchPatterns,
    extractResearchPatternsAsync,
    extractCodebasePatterns,
    createAiPromptSummary,
    getIncrementalContext,
    buildConsolidatedContext,
    buildConsolidatedContextAsync,
    markTaskCompleted,
    getContextFilePaths,
    getRelevantSymbols,
    getFileSummary,
} = require('./context-collector');

const cacheManager = require('./cache-manager');

describe('context-collector', () => {
    const mockClaudiomiroFolder = '/test/.claudiomiro';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mocks
        cacheManager.loadCache.mockReturnValue({
            aiPrompt: { hash: null, summary: null },
            completedTasks: {},
            lastProcessedTask: null,
            codebasePatterns: {},
        });
        cacheManager.hasAiPromptChanged.mockReturnValue(false);
        cacheManager.getLastProcessedTask.mockReturnValue(null);
        cacheManager.getCodebasePatterns.mockReturnValue({});
    });

    describe('getTaskOrder', () => {
        test('should return numeric order for simple task', () => {
            expect(getTaskOrder('TASK1')).toBe(1);
            expect(getTaskOrder('TASK2')).toBe(2);
            expect(getTaskOrder('TASK10')).toBe(10);
        });

        test('should handle subtask notation', () => {
            expect(getTaskOrder('TASK1.1')).toBeCloseTo(1.01);
            expect(getTaskOrder('TASK2.5')).toBeCloseTo(2.05);
        });

        test('should return 0 for invalid format', () => {
            expect(getTaskOrder('INVALID')).toBe(0);
            expect(getTaskOrder('')).toBe(0);
        });
    });

    describe('getTaskFolders', () => {
        test('should return empty array if folder does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const folders = getTaskFolders(mockClaudiomiroFolder);

            expect(folders).toEqual([]);
        });

        test('should return sorted task folders', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['TASK2', 'TASK1', 'TASK10', 'cache', 'AI_PROMPT.md']);
            fs.statSync.mockImplementation((p) => ({
                isDirectory: () => p.includes('TASK') || p.includes('cache'),
            }));

            const folders = getTaskFolders(mockClaudiomiroFolder);

            expect(folders).toEqual(['TASK1', 'TASK2', 'TASK10']);
        });
    });

    describe('isTaskCompleted', () => {
        test('should return false if TODO.md does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(false);
        });

        test('should return true if TODO starts with "Fully implemented: YES"', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('Fully implemented: YES\n\nRest of content');

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(true);
        });

        test('should return false if TODO starts with "Fully implemented: NO"', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('Fully implemented: NO\n\nRest of content');

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(false);
        });
    });

    describe('extractContextSummary', () => {
        test('should return null if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const summary = extractContextSummary('/test/CONTEXT.md');

            expect(summary).toBeNull();
        });

        test('should extract files modified and decisions', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
## Files Modified
- src/auth/index.js
- src/auth/middleware.js

## Key Decisions
- Used JWT for authentication
- Added rate limiting

## Other Section
Content here
`);

            const summary = extractContextSummary('/test/CONTEXT.md');

            expect(summary.filesModified).toContain('src/auth/index.js');
            expect(summary.decisions).toContain('JWT');
            expect(summary.fullPath).toBe('/test/CONTEXT.md');
        });
    });

    describe('extractContextSummaryAsync (with fallback)', () => {
        test('should return null if file does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            const summary = await extractContextSummaryAsync('/test/CONTEXT.md');

            expect(summary).toBeNull();
        });

        test('should fallback to heuristic extraction when Ollama unavailable', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
## Files Modified
- src/auth/index.js

## Key Decisions
- Used JWT
`);

            const summary = await extractContextSummaryAsync('/test/CONTEXT.md');

            // Should use fallback (heuristic extraction)
            expect(summary.filesModified).toContain('src/auth/index.js');
            expect(summary.decisions).toContain('JWT');
            expect(summary.fullPath).toBe('/test/CONTEXT.md');
            expect(summary.llmEnhanced).toBeUndefined(); // No LLM enhancement
        });

        test('should include fullPath in result', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('## Files Modified\n- test.js');

            const summary = await extractContextSummaryAsync('/test/path/CONTEXT.md');

            expect(summary.fullPath).toBe('/test/path/CONTEXT.md');
        });
    });

    describe('extractResearchPatterns', () => {
        test('should return null if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const patterns = extractResearchPatterns('/test/RESEARCH.md');

            expect(patterns).toBeNull();
        });

        test('should extract strategy, patterns, and topics', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
## Execution Strategy
1. Create auth middleware
2. Add JWT validation

## Code Patterns
- Error handling: throw custom errors
- Middleware pattern: express middleware

## Other Content
This has auth and api related code
`);

            const research = extractResearchPatterns('/test/RESEARCH.md');

            expect(research.strategy).toContain('auth middleware');
            expect(research.patterns).toContain('Error handling');
            expect(research.topics).toContain('auth');
            expect(research.topics).toContain('api');
            expect(research.topics).toContain('middleware');
        });
    });

    describe('extractResearchPatternsAsync (with fallback)', () => {
        test('should return null if file does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            const patterns = await extractResearchPatternsAsync('/test/RESEARCH.md');

            expect(patterns).toBeNull();
        });

        test('should fallback to heuristic extraction when Ollama unavailable', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
## Execution Strategy
1. Create auth middleware

## Code Patterns
- Error handling

## Other Content
This has auth and database related code
`);

            const research = await extractResearchPatternsAsync('/test/RESEARCH.md');

            // Should use fallback (heuristic extraction)
            expect(research.strategy).toContain('auth middleware');
            expect(research.patterns).toContain('Error handling');
            expect(research.topics).toContain('auth');
            expect(research.topics).toContain('database');
            expect(research.llmEnhanced).toBeUndefined(); // No LLM enhancement
        });

        test('should detect extended keyword list', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
Content about validation and error handling.
Also includes cache and security concerns.
Performance optimization and logging.
`);

            const research = await extractResearchPatternsAsync('/test/RESEARCH.md');

            // Should detect extended keywords
            expect(research.topics).toContain('validation');
            expect(research.topics).toContain('error');
            expect(research.topics).toContain('cache');
            expect(research.topics).toContain('security');
            expect(research.topics).toContain('performance');
            expect(research.topics).toContain('logging');
        });

        test('should include fullPath in result', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('Some content');

            const research = await extractResearchPatternsAsync('/test/path/RESEARCH.md');

            expect(research.fullPath).toBe('/test/path/RESEARCH.md');
        });
    });

    describe('createAiPromptSummary', () => {
        test('should return empty string if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const summary = createAiPromptSummary('/test/AI_PROMPT.md');

            expect(summary).toBe('');
        });

        test('should extract tech stack, architecture, and conventions', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# Project Overview

## Tech Stack
- Node.js v18
- Express 4.x
- Jest for testing

## Architecture
- MVC pattern
- REST API

## Conventions
- Use async/await
- ESLint rules

## Other Section
More content
`);

            const summary = createAiPromptSummary('/test/AI_PROMPT.md');

            expect(summary).toContain('**Tech Stack:**');
            expect(summary).toContain('Node.js');
            expect(summary).toContain('**Architecture:**');
            expect(summary).toContain('MVC');
            expect(summary).toContain('**Conventions:**');
            expect(summary).toContain('async/await');
        });

        test('should return first 1500 chars if no sections found', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('A'.repeat(2000));

            const summary = createAiPromptSummary('/test/AI_PROMPT.md');

            expect(summary.length).toBe(1500);
        });
    });

    describe('extractCodebasePatterns', () => {
        test('should detect Jest testing framework', () => {
            const content = 'We use jest for testing. Run npm test to execute tests.';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.testingFramework).toBe('jest');
        });

        test('should detect Python pytest framework', () => {
            const content = 'Tests are run using pytest. See tests/*.py files.';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.testingFramework).toBe('pytest');
        });

        test('should detect CommonJS import style', () => {
            const content = 'Use require("module") for imports.';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.importStyle).toBe('commonjs');
        });

        test('should detect ESM import style', () => {
            const content = 'import express from "express"';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.importStyle).toBe('esm');
        });

        test('should detect test file naming convention', () => {
            const content = 'Tests are in file.test.js next to source files.';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.testFileNaming).toBe('file.test.ext');
        });

        test('should detect primary language from file extensions', () => {
            const content = 'Source files are in .ts and .tsx formats.';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.primaryLanguage).toBe('typescript');
        });

        test('should detect key directories', () => {
            const content = 'Code is in src/services/auth and src/utils/helpers.';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.keyDirectories).toContain('src/services/auth');
            expect(patterns.keyDirectories).toContain('src/utils/helpers');
        });

        test('should detect functional code style', () => {
            const content = 'const myFunction = (arg) => { return arg; }';
            const patterns = extractCodebasePatterns(content);
            expect(patterns.codeStyle).toBe('functional');
        });

        test('should return empty object for empty content', () => {
            const patterns = extractCodebasePatterns('');
            expect(Object.keys(patterns).length).toBe(0);
        });
    });

    describe('getIncrementalContext', () => {
        test('should return AI prompt summary from cache if valid', () => {
            cacheManager.hasAiPromptChanged.mockReturnValue(false);
            cacheManager.getCachedAiPromptSummary.mockReturnValue('Cached summary');
            cacheManager.getCodebasePatterns.mockReturnValue({ testingFramework: 'jest' });
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue([]);

            const context = getIncrementalContext(mockClaudiomiroFolder, 'TASK1');

            expect(context.aiPromptSummary).toBe('Cached summary');
            expect(context.codebasePatterns).toEqual({ testingFramework: 'jest' });
        });

        test('should generate new summary if AI prompt changed', () => {
            cacheManager.hasAiPromptChanged.mockReturnValue(true);
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('## Tech Stack\n- Node.js\nWe use jest for testing.');
            fs.readdirSync.mockReturnValue([]);

            const context = getIncrementalContext(mockClaudiomiroFolder, 'TASK1');

            expect(cacheManager.updateAiPromptCache).toHaveBeenCalled();
            expect(cacheManager.storeCodebasePatterns).toHaveBeenCalled();
            expect(context.aiPromptSummary).toContain('Node.js');
            expect(context.codebasePatterns).toHaveProperty('testingFramework', 'jest');
        });

        test('should exclude current task from context', () => {
            cacheManager.hasAiPromptChanged.mockReturnValue(false);
            cacheManager.getCachedAiPromptSummary.mockReturnValue('Summary');
            cacheManager.getCodebasePatterns.mockReturnValue({});

            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockReturnValue('Fully implemented: YES');

            const context = getIncrementalContext(mockClaudiomiroFolder, 'TASK1');

            // TASK1 should not be in context (it's the current task)
            expect(context.contextFiles).not.toContain(
                expect.stringContaining('TASK1'),
            );
        });
    });

    describe('buildConsolidatedContext', () => {
        test('should build context string with all sections', () => {
            cacheManager.hasAiPromptChanged.mockReturnValue(false);
            cacheManager.getCachedAiPromptSummary.mockReturnValue('Tech stack summary');
            cacheManager.getLastProcessedTask.mockReturnValue(null);
            cacheManager.getCodebasePatterns.mockReturnValue({
                testingFramework: 'jest',
                importStyle: 'commonjs',
                primaryLanguage: 'javascript',
            });

            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['TASK1']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockImplementation((p) => {
                if (p.includes('TODO.md')) return 'Fully implemented: YES';
                if (p.includes('CONTEXT.md')) return '## Files Modified\n- test.js';
                if (p.includes('RESEARCH.md')) return '## Patterns\n- error handling';
                return '';
            });

            const context = buildConsolidatedContext(mockClaudiomiroFolder, 'TASK2');

            expect(context).toContain('Environment Summary');
            expect(context).toContain('Tech stack summary');
            expect(context).toContain('Detected Codebase Patterns');
            expect(context).toContain('jest');
            expect(context).toContain('commonjs');
        });
    });

    describe('markTaskCompleted', () => {
        test('should add task to cache with summary', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((p) => {
                if (p.includes('CONTEXT.md')) return '## Files Modified\n- test.js';
                if (p.includes('RESEARCH.md')) return '## Patterns\n- testing';
                return '';
            });

            markTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(cacheManager.addCompletedTask).toHaveBeenCalledWith(
                mockClaudiomiroFolder,
                'TASK1',
                expect.objectContaining({
                    completedAt: expect.any(String),
                }),
            );
        });
    });

    describe('getContextFilePaths', () => {
        test('should return context file paths for completed tasks', () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('CONTEXT.md')) return true;
                if (p.includes('RESEARCH.md')) return true;
                if (p.includes('TODO.md')) return true;
                if (p === mockClaudiomiroFolder) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockReturnValue('Fully implemented: YES');

            const paths = getContextFilePaths(mockClaudiomiroFolder, 'TASK3', {
                includeContext: true,
                includeResearch: true,
                includeTodo: false,
            });

            expect(paths.some(p => p.includes('CONTEXT.md'))).toBe(true);
            expect(paths.some(p => p.includes('RESEARCH.md'))).toBe(true);
            expect(paths.some(p => p.includes('TODO.md'))).toBe(false);
        });

        test('should exclude incomplete tasks when onlyCompleted is true', () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('TODO.md')) return true;
                if (p.includes('CONTEXT.md')) return true;
                if (p === mockClaudiomiroFolder) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockReturnValue('Fully implemented: NO');

            const paths = getContextFilePaths(mockClaudiomiroFolder, 'TASK2', {
                onlyCompleted: true,
            });

            expect(paths).toEqual([]);
        });
    });

    describe('getRelevantSymbols (with semantic search)', () => {
        test('should return null when code index is not available', async () => {
            // Code index module is not mocked, so require will fail gracefully
            const result = await getRelevantSymbols('/nonexistent', 'authentication');

            // Should return null since code-index module is mocked/not available
            expect(result).toBeNull();
        });

        test('should accept options for maxSymbols and kinds', async () => {
            const result = await getRelevantSymbols('/test', 'test task', {
                maxSymbols: 10,
                kinds: ['function', 'class'],
            });

            // Should return null since code-index is not available in test
            expect(result).toBeNull();
        });

        test('should accept useSemantic option', async () => {
            const result = await getRelevantSymbols('/test', 'test task', {
                useSemantic: true,
            });

            // Should return null since code-index is not available in test
            expect(result).toBeNull();
        });

        test('should fallback to keyword search when useSemantic is false', async () => {
            const result = await getRelevantSymbols('/test', 'test task', {
                useSemantic: false,
            });

            // Should return null since code-index is not available in test
            expect(result).toBeNull();
        });
    });

    describe('getFileSummary', () => {
        test('should return null when code index is not available', async () => {
            const result = await getFileSummary('/test', 'src/index.js');

            // Should return null since code-index module is not available
            expect(result).toBeNull();
        });
    });

    describe('buildConsolidatedContextAsync', () => {
        test('should return base context when no project folder provided', async () => {
            cacheManager.hasAiPromptChanged.mockReturnValue(false);
            cacheManager.getCachedAiPromptSummary.mockReturnValue('Test summary');
            cacheManager.getCodebasePatterns.mockReturnValue({});
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue([]);

            const result = await buildConsolidatedContextAsync(mockClaudiomiroFolder, 'TASK1');

            expect(result).toContain('Test summary');
        });

        test('should include base context even when symbols not available', async () => {
            cacheManager.hasAiPromptChanged.mockReturnValue(false);
            cacheManager.getCachedAiPromptSummary.mockReturnValue('Environment info');
            cacheManager.getCodebasePatterns.mockReturnValue({ testingFramework: 'jest' });
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue([]);

            const result = await buildConsolidatedContextAsync(
                mockClaudiomiroFolder,
                'TASK1',
                '/test/project',
                'authentication',
            );

            // Should still have base context
            expect(result).toContain('Environment info');
            expect(result).toContain('jest');
        });
    });
});
