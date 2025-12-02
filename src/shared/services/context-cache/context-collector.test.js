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

// Mock local-llm to avoid Ollama connection attempts
jest.mock('../local-llm', () => ({
    getLocalLLMService: jest.fn(() => null),
}));

const {
    getTaskOrder,
    getTaskFolders,
    isTaskCompleted,
    hasValidTaskStructure,
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
        test('should return false if execution.json does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(false);
        });

        test('should return true if execution.json status is completed', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ status: 'completed' }));

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(true);
        });

        test('should return true if execution.json completion.status is completed', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ completion: { status: 'completed' } }));

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(true);
        });

        test('should return false if execution.json status is not completed', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ status: 'in_progress' }));

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(false);
        });

        test('should return false if execution.json is malformed', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{ invalid json }');

            const completed = isTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(completed).toBe(false);
        });
    });

    describe('hasValidTaskStructure', () => {
        test('should return true when both BLUEPRINT.md and execution.json exist', () => {
            fs.existsSync.mockImplementation((p) =>
                p.includes('BLUEPRINT.md') || p.includes('execution.json'),
            );

            const valid = hasValidTaskStructure('/test/.claudiomiro/TASK1');

            expect(valid).toBe(true);
        });

        test('should return false when BLUEPRINT.md does not exist', () => {
            fs.existsSync.mockImplementation((p) => p.includes('execution.json'));

            const valid = hasValidTaskStructure('/test/.claudiomiro/TASK1');

            expect(valid).toBe(false);
        });

        test('should return false when execution.json does not exist', () => {
            fs.existsSync.mockImplementation((p) => p.includes('BLUEPRINT.md'));

            const valid = hasValidTaskStructure('/test/.claudiomiro/TASK1');

            expect(valid).toBe(false);
        });

        test('should return false for empty folder', () => {
            fs.existsSync.mockReturnValue(false);

            const valid = hasValidTaskStructure('/test/.claudiomiro/TASK_EMPTY');

            expect(valid).toBe(false);
        });
    });

    describe('extractContextSummary', () => {
        test('should return null if execution.json does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const summary = extractContextSummary('/test/.claudiomiro/TASK1');

            expect(summary).toBeNull();
        });

        test('should read from execution.json', () => {
            fs.existsSync.mockImplementation((p) => {
                return p.includes('BLUEPRINT.md') || p.includes('execution.json');
            });
            fs.readFileSync.mockReturnValue(JSON.stringify({
                completion: {
                    summary: ['Added authentication module', 'Configured JWT tokens'],
                    deviations: [],
                    forFutureTasks: [],
                },
            }));

            const summary = extractContextSummary('/test/.claudiomiro/TASK1');

            expect(summary.summary).toBe('Added authentication module\nConfigured JWT tokens');
            expect(summary.fullPath).toContain('execution.json');
        });

        test('should return empty summary when execution.json has empty summary array', () => {
            fs.existsSync.mockImplementation((p) => {
                return p.includes('BLUEPRINT.md') || p.includes('execution.json');
            });
            fs.readFileSync.mockReturnValue(JSON.stringify({
                completion: {
                    summary: [],
                    deviations: [],
                    forFutureTasks: [],
                },
            }));

            const summary = extractContextSummary('/test/.claudiomiro/TASK1');

            expect(summary.summary).toBe('');
            expect(summary.fullPath).toContain('execution.json');
        });

        test('should return null when execution.json is malformed', () => {
            fs.existsSync.mockImplementation((p) => {
                return p.includes('BLUEPRINT.md') || p.includes('execution.json');
            });
            fs.readFileSync.mockReturnValue('{ invalid json }');

            const summary = extractContextSummary('/test/.claudiomiro/TASK1');

            expect(summary).toBeNull();
        });

        test('should return null when execution.json missing but BLUEPRINT.md exists', () => {
            fs.existsSync.mockImplementation((p) => {
                // BLUEPRINT.md exists but execution.json doesn't
                return p.includes('BLUEPRINT.md');
            });

            const summary = extractContextSummary('/test/.claudiomiro/TASK1');

            expect(summary).toBeNull();
        });
    });

    describe('extractContextSummaryAsync (with fallback)', () => {
        test('should return null if execution.json does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            const summary = await extractContextSummaryAsync('/test/.claudiomiro/TASK1');

            expect(summary).toBeNull();
        });

        test('should read from execution.json (skip LLM)', async () => {
            fs.existsSync.mockImplementation((p) => {
                return p.includes('BLUEPRINT.md') || p.includes('execution.json');
            });
            fs.readFileSync.mockReturnValue(JSON.stringify({
                completion: {
                    summary: ['Implemented new feature', 'Added tests'],
                    deviations: [],
                    forFutureTasks: [],
                },
            }));

            const summary = await extractContextSummaryAsync('/test/.claudiomiro/TASK1');

            // Should skip LLM and return execution.json data directly
            expect(summary.summary).toBe('Implemented new feature\nAdded tests');
            expect(summary.fullPath).toContain('execution.json');
            expect(summary.llmEnhanced).toBeUndefined(); // No LLM for new format
        });
    });

    describe('extractResearchPatterns (deprecated)', () => {
        test('should return null (deprecated function)', () => {
            const patterns = extractResearchPatterns('/test/RESEARCH.md');

            expect(patterns).toBeNull();
        });
    });

    describe('extractResearchPatternsAsync (deprecated)', () => {
        test('should return null (deprecated function)', async () => {
            const patterns = await extractResearchPatternsAsync('/test/RESEARCH.md');

            expect(patterns).toBeNull();
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
        test('should add task to cache with summary (old format)', () => {
            fs.existsSync.mockImplementation((p) => {
                // Old format: no BLUEPRINT.md, but CONTEXT.md and RESEARCH.md exist
                return p.includes('CONTEXT.md') || p.includes('RESEARCH.md');
            });
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

        test('should extract summary from execution.json for new format', () => {
            fs.existsSync.mockImplementation((p) => {
                // New format: BLUEPRINT.md and execution.json exist
                return p.includes('BLUEPRINT.md') ||
                       p.includes('execution.json') ||
                       p.includes('RESEARCH.md');
            });
            fs.readFileSync.mockImplementation((p) => {
                if (p.includes('execution.json')) {
                    return JSON.stringify({
                        completion: {
                            summary: ['Implemented feature X', 'Added tests'],
                            deviations: [],
                            forFutureTasks: [],
                        },
                    });
                }
                if (p.includes('RESEARCH.md')) return '## Patterns\n- testing';
                return '';
            });

            markTaskCompleted(mockClaudiomiroFolder, 'TASK1');

            expect(cacheManager.addCompletedTask).toHaveBeenCalledWith(
                mockClaudiomiroFolder,
                'TASK1',
                expect.objectContaining({
                    completedAt: expect.any(String),
                    context: expect.objectContaining({
                        summary: 'Implemented feature X\nAdded tests',
                    }),
                }),
            );
        });
    });

    describe('getContextFilePaths', () => {
        test('should return BLUEPRINT.md + execution.json for completed tasks', () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('BLUEPRINT.md')) return true;
                if (p.includes('execution.json')) return true;
                if (p === mockClaudiomiroFolder) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockReturnValue(JSON.stringify({ status: 'completed' }));

            const paths = getContextFilePaths(mockClaudiomiroFolder, 'TASK3');

            expect(paths.some(p => p.includes('BLUEPRINT.md'))).toBe(true);
            expect(paths.some(p => p.includes('execution.json'))).toBe(true);
        });

        test('should exclude incomplete tasks when onlyCompleted is true', () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('execution.json')) return true;
                if (p.includes('BLUEPRINT.md')) return true;
                if (p === mockClaudiomiroFolder) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockReturnValue(JSON.stringify({ status: 'in_progress' }));

            const paths = getContextFilePaths(mockClaudiomiroFolder, 'TASK2', {
                onlyCompleted: true,
            });

            expect(paths).toEqual([]);
        });

        test('should filter out non-existent files', () => {
            fs.existsSync.mockImplementation((p) => {
                // BLUEPRINT.md exists but execution.json doesn't
                if (p.includes('BLUEPRINT.md')) return true;
                if (p === mockClaudiomiroFolder) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });

            const paths = getContextFilePaths(mockClaudiomiroFolder, 'TASK2', {
                onlyCompleted: false,
            });

            expect(paths.some(p => p.includes('BLUEPRINT.md'))).toBe(true);
            expect(paths.some(p => p.includes('execution.json'))).toBe(false);
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
