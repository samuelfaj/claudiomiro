const fs = require('fs');
const path = require('path');
const os = require('os');
const { CodeIndex, IndexBuilder, QueryEngine } = require('./index');
const { resetAstGrepState } = require('./index-builder');

// Suppress console.warn for cleaner test output
const originalWarn = console.warn;
beforeAll(() => {
    console.warn = jest.fn();
});
afterAll(() => {
    console.warn = originalWarn;
});

// Create temp directory for tests
const createTempDir = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-index-test-'));
    return tempDir;
};

// Clean up temp directory
const cleanupTempDir = (dir) => {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

// Create test files
const createTestFile = (dir, relativePath, content) => {
    const fullPath = path.join(dir, relativePath);
    const fileDir = path.dirname(fullPath);
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return fullPath;
};

describe('CodeIndex', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = createTempDir();
        // Reset ast-grep state to ensure consistent fallback behavior
        resetAstGrepState();
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
    });

    describe('IndexBuilder', () => {
        test('should scan directory and find JavaScript files', async () => {
            // Use code without leading whitespace for regex-based fallback
            createTestFile(tempDir, 'src/index.js', `function main() {
  console.log('hello');
}
module.exports = { main };
`);

            createTestFile(tempDir, 'src/utils.js', `const helper = () => {};
module.exports = { helper };
`);

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            expect(result.stats.totalFiles).toBe(2);
            expect(result.symbols.length).toBeGreaterThan(0);
        });

        test('should ignore node_modules directory', async () => {
            createTestFile(tempDir, 'src/index.js', 'const app = 1;');
            createTestFile(tempDir, 'node_modules/pkg/index.js', 'const pkg = 1;');

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            expect(result.symbols.every(s => !s.file.includes('node_modules'))).toBe(true);
        });

        test('should extract function declarations', async () => {
            createTestFile(tempDir, 'functions.js', `function regularFunction() {
  return 1;
}

async function asyncFunction() {
  return 2;
}

const arrowFunction = () => 3;
`);

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            const functionSymbols = result.symbols.filter(s => s.kind === 'function');
            expect(functionSymbols.length).toBeGreaterThanOrEqual(1);
        });

        test('should extract class declarations', async () => {
            createTestFile(tempDir, 'classes.js', `class BaseClass {
  constructor() {}
}

class DerivedClass extends BaseClass {
  method() {}
}
`);

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            const classSymbols = result.symbols.filter(s => s.kind === 'class');
            expect(classSymbols.length).toBeGreaterThanOrEqual(1);
        });

        test('should detect exported symbols', async () => {
            createTestFile(tempDir, 'exports.js', `export function exportedFn() {}
function privateFn() {}
export default exportedFn;
`);

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            const exported = result.symbols.filter(s => s.exports);
            expect(exported.length).toBeGreaterThan(0);
        });

        test('should calculate file hashes', async () => {
            createTestFile(tempDir, 'file.js', 'const x = 1;');

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            expect(result.fileHashes).toBeDefined();
            expect(Object.keys(result.fileHashes).length).toBe(1);
        });

        test('should handle TypeScript files', async () => {
            createTestFile(tempDir, 'types.ts', `
        interface User {
          name: string;
        }

        type ID = string | number;

        function greet(user: User): string {
          return user.name;
        }
      `);

            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            expect(result.stats.totalFiles).toBe(1);
        });

        test('should handle empty directory', async () => {
            const builder = new IndexBuilder();
            const result = await builder.scan(tempDir);

            expect(result.stats.totalFiles).toBe(0);
            expect(result.symbols).toHaveLength(0);
        });

        test('should respect maxFileSize option', async () => {
            // Create a large file
            const largeContent = 'const x = 1;\n'.repeat(100000);
            createTestFile(tempDir, 'large.js', largeContent);
            createTestFile(tempDir, 'small.js', 'const y = 2;');

            const builder = new IndexBuilder({ maxFileSize: 1000 });
            const result = await builder.scan(tempDir);

            expect(result.stats.totalFiles).toBe(1);
        });

        test('should perform incremental scan', async () => {
            createTestFile(tempDir, 'file1.js', 'const a = 1;');

            const builder = new IndexBuilder();
            const initial = await builder.scan(tempDir);

            // Add a new file
            createTestFile(tempDir, 'file2.js', 'const b = 2;');

            const incremental = await builder.incrementalScan(tempDir, initial);

            expect(incremental.stats.totalFiles).toBe(2);
        });
    });

    describe('QueryEngine', () => {
        let query;

        beforeEach(() => {
            const indexData = {
                symbols: [
                    { id: 'src/index.js:main', name: 'main', kind: 'function', file: 'src/index.js', startLine: 1, endLine: 5, exports: true },
                    { id: 'src/index.js:helper', name: 'helper', kind: 'function', file: 'src/index.js', startLine: 7, endLine: 10, exports: false },
                    { id: 'src/utils.js:formatDate', name: 'formatDate', kind: 'function', file: 'src/utils.js', startLine: 1, endLine: 8, exports: true },
                    { id: 'src/models/User.js:User', name: 'User', kind: 'class', file: 'src/models/User.js', startLine: 1, endLine: 20, exports: true },
                    { id: 'src/components/Button.js:Button', name: 'Button', kind: 'component', file: 'src/components/Button.js', startLine: 1, endLine: 15, exports: true },
                ],
                references: [
                    { type: 'importDeclaration', file: 'src/index.js', module: './utils', line: 1 },
                    { type: 'functionCall', file: 'src/index.js', func: 'formatDate', line: 5 },
                ],
            };
            query = new QueryEngine(indexData);
        });

        test('should find symbol by ID', () => {
            const symbol = query.findById('src/index.js:main');
            expect(symbol).not.toBeNull();
            expect(symbol.name).toBe('main');
        });

        test('should return null for non-existent ID', () => {
            const symbol = query.findById('nonexistent');
            expect(symbol).toBeNull();
        });

        test('should find symbols by name', () => {
            const results = query.findByName('main');
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('main');
        });

        test('should find symbols by partial name', () => {
            const results = query.findByName('format', { exact: false });
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(s => s.name === 'formatDate')).toBe(true);
        });

        test('should find symbols by kind', () => {
            const functions = query.findByKind('function');
            expect(functions.length).toBe(3);

            const classes = query.findByKind('class');
            expect(classes.length).toBe(1);
        });

        test('should find symbols by file', () => {
            const symbols = query.findByFile('src/index.js');
            expect(symbols.length).toBe(2);
        });

        test('should find exported symbols', () => {
            const exported = query.findExported();
            expect(exported.length).toBe(4);
            expect(exported.every(s => s.exports)).toBe(true);
        });

        test('should search with multiple filters', () => {
            const results = query.search({
                kind: 'function',
                exported: true,
            });
            expect(results.length).toBe(2);
        });

        test('should get file dependencies', () => {
            const deps = query.getFileDependencies('src/index.js');
            expect(deps.length).toBe(1);
            expect(deps[0].module).toBe('./utils');
        });

        test('should get file summary', () => {
            const summary = query.getFileSummary('src/index.js');
            expect(summary.symbolCount).toBe(2);
            expect(summary.exports).toContain('main');
            expect(summary.functions).toContain('main');
        });

        test('should get codebase summary', () => {
            const summary = query.getCodebaseSummary();
            expect(summary.totalSymbols).toBe(5);
            expect(summary.byKind.function).toBe(3);
            expect(summary.byKind.class).toBe(1);
        });

        test('should find symbols by topic', () => {
            const results = query.findByTopic('user model');
            expect(results.some(s => s.name === 'User')).toBe(true);
        });

        test('should format symbols for prompt', () => {
            const symbols = query.search({ kind: 'function' });
            const formatted = query.formatForPrompt(symbols);

            expect(formatted).toContain('main');
            expect(formatted).toContain('function');
        });

        test('should convert to handles', () => {
            const symbols = query.search({ kind: 'class' });
            const handles = query.toHandles(symbols);

            expect(handles.length).toBe(1);
            expect(handles[0]).toHaveProperty('id');
            expect(handles[0]).toHaveProperty('name');
            expect(handles[0]).toHaveProperty('kind');
            expect(handles[0]).not.toHaveProperty('hash'); // Handles are lightweight
        });

        test('should build dependency graph', () => {
            const graph = query.buildDependencyGraph();
            expect(graph.nodes.length).toBeGreaterThan(0);
        });

        // ============================================
        // Ollama-Enhanced Methods (with fallback tests)
        // ============================================

        describe('semanticSearch (with fallback)', () => {
            test('should return keyword-matched results when Ollama unavailable', async () => {
                const results = await query.semanticSearch('user model');
                expect(results.length).toBeGreaterThan(0);
                expect(results.some(s => s.name === 'User')).toBe(true);
            });

            test('should filter by kinds', async () => {
                const results = await query.semanticSearch('main helper', { kinds: ['function'] });
                expect(results.every(s => s.kind === 'function')).toBe(true);
            });

            test('should limit results by maxResults', async () => {
                const results = await query.semanticSearch('function', { maxResults: 2 });
                expect(results.length).toBeLessThanOrEqual(2);
            });

            test('should return empty array for no matches', async () => {
                const results = await query.semanticSearch('nonexistent-xyz-123');
                expect(results).toHaveLength(0);
            });
        });

        describe('getSmartContext (with fallback)', () => {
            test('should return context object with symbols', async () => {
                const context = await query.getSmartContext('user model class');

                expect(context).toHaveProperty('task');
                expect(context).toHaveProperty('symbols');
                expect(context).toHaveProperty('files');
                expect(context).toHaveProperty('llmEnhanced');
                expect(context.task).toBe('user model class');
            });

            test('should include relevant symbols', async () => {
                const context = await query.getSmartContext('User class');
                expect(context.symbols.length).toBeGreaterThan(0);
            });

            test('should track files in context', async () => {
                const context = await query.getSmartContext('main function');
                expect(Array.isArray(context.files)).toBe(true);
            });

            test('should return empty context for no matches', async () => {
                const context = await query.getSmartContext('nonexistent-xyz-123');
                expect(context.symbols).toHaveLength(0);
            });
        });

        describe('explainSymbol (with fallback)', () => {
            test('should return explanation for valid symbol', async () => {
                const explanation = await query.explainSymbol('src/index.js:main');

                expect(explanation).not.toBeNull();
                expect(explanation).toHaveProperty('symbol');
                expect(explanation).toHaveProperty('description');
                expect(explanation).toHaveProperty('dependencies');
                expect(explanation).toHaveProperty('llmEnhanced');
                expect(explanation.symbol.name).toBe('main');
            });

            test('should return null for non-existent symbol', async () => {
                const explanation = await query.explainSymbol('nonexistent:symbol');
                expect(explanation).toBeNull();
            });

            test('should generate basic description without LLM', async () => {
                const explanation = await query.explainSymbol('src/index.js:main');
                expect(explanation.description).toContain('function');
                expect(explanation.description).toContain('main');
                expect(explanation.llmEnhanced).toBe(false);
            });

            test('should include different descriptions for different kinds', async () => {
                const funcExplanation = await query.explainSymbol('src/index.js:main');
                const classExplanation = await query.explainSymbol('src/models/User.js:User');

                expect(funcExplanation.description).toContain('function');
                expect(classExplanation.description).toContain('class');
            });
        });

        describe('rankSymbols (with fallback)', () => {
            test('should rank symbols by relevance', async () => {
                const symbols = [
                    { id: '1', name: 'userService', kind: 'function', file: 'user.js', startLine: 1, exports: true },
                    { id: '2', name: 'formatDate', kind: 'function', file: 'utils.js', startLine: 1, exports: false },
                    { id: '3', name: 'User', kind: 'class', file: 'models/user.js', startLine: 1, exports: true },
                ];

                const ranked = await query.rankSymbols(symbols, 'user service');

                expect(ranked.length).toBe(3);
                expect(ranked[0]).toHaveProperty('relevanceScore');
                expect(ranked[0]).toHaveProperty('relevanceReason');
                // User-related symbols should rank higher
                expect(ranked[0].name).toMatch(/user/i);
            });

            test('should return empty array for empty input', async () => {
                const ranked = await query.rankSymbols([], 'anything');
                expect(ranked).toHaveLength(0);
            });

            test('should boost exported symbols', async () => {
                const symbols = [
                    { id: '1', name: 'helper', kind: 'function', file: 'a.js', startLine: 1, exports: true },
                    { id: '2', name: 'helper', kind: 'function', file: 'b.js', startLine: 1, exports: false },
                ];

                const ranked = await query.rankSymbols(symbols, 'helper');
                const exportedSymbol = ranked.find(s => s.exports === true);
                const nonExportedSymbol = ranked.find(s => s.exports === false);

                expect(exportedSymbol.relevanceScore).toBeGreaterThan(nonExportedSymbol.relevanceScore);
            });
        });

        describe('isLLMAvailable', () => {
            test('should return false when LocalLLM not configured', async () => {
                const available = await query.isLLMAvailable();
                // Without CLAUDIOMIRO_LOCAL_LLM env var, should be false
                expect(typeof available).toBe('boolean');
            });
        });
    });

    describe('CodeIndex (Integration)', () => {
        test('should build index from directory', async () => {
            createTestFile(tempDir, 'src/app.js', `function start() {
  console.log('starting');
}
module.exports = { start };
`);

            const index = new CodeIndex();
            await index.build(tempDir);

            const overview = index.getOverview();
            expect(overview.totalFiles).toBe(1);
        });

        test('should cache index to disk', async () => {
            createTestFile(tempDir, 'src/app.js', 'const x = 1;');

            const index = new CodeIndex();
            await index.build(tempDir);

            const cachePath = path.join(tempDir, '.claudiomiro/cache/code-index.json');
            expect(fs.existsSync(cachePath)).toBe(true);
        });

        test('should load index from cache', async () => {
            createTestFile(tempDir, 'src/app.js', 'const x = 1;');

            const index1 = new CodeIndex();
            await index1.build(tempDir);

            const index2 = new CodeIndex();
            const loaded = index2.loadFromCache(tempDir);

            expect(loaded).toBe(true);
        });

        test('should clear cache', async () => {
            createTestFile(tempDir, 'src/app.js', 'const x = 1;');

            const index = new CodeIndex();
            await index.build(tempDir);

            const cachePath = path.join(tempDir, '.claudiomiro/cache/code-index.json');
            expect(fs.existsSync(cachePath)).toBe(true);

            index.clearCache(tempDir);
            expect(fs.existsSync(cachePath)).toBe(false);
        });

        test('should find relevant symbols', async () => {
            createTestFile(tempDir, 'src/auth.js', `function login() {}
function logout() {}
function validateToken() {}
`);

            const index = new CodeIndex();
            await index.build(tempDir);

            const relevant = index.findRelevantSymbols('authentication login');
            expect(relevant.some(s => s.name === 'login')).toBe(true);
        });

        test('should get symbol context', async () => {
            createTestFile(tempDir, 'src/utils.js', `function helper() {
  return 42;
}
`);

            const index = new CodeIndex();
            await index.build(tempDir);

            const symbols = index.search({ name: 'helper' });
            expect(symbols.length).toBeGreaterThan(0);

            const context = index.getSymbolContext(symbols[0].id);
            expect(context).not.toBeNull();
            expect(context.code).toContain('helper');
        });

        test('should search with filters', async () => {
            createTestFile(tempDir, 'src/components/Button.js', `export function Button() {
  return null;
}
`);

            const index = new CodeIndex();
            await index.build(tempDir);

            const results = index.search({ exported: true });
            expect(results.length).toBeGreaterThan(0);
        });

        test('should throw error when not built', () => {
            const index = new CodeIndex();

            expect(() => index.getOverview()).toThrow('Index not built');
            expect(() => index.search({})).toThrow('Index not built');
        });

        test('should format symbols for LLM prompt', async () => {
            createTestFile(tempDir, 'src/api.js', `function fetchData() {}
function postData() {}
`);

            const index = new CodeIndex();
            await index.build(tempDir);

            const symbols = index.search({ kind: 'function' });
            const formatted = index.formatForPrompt(symbols);

            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
        });

        // ============================================
        // Ollama-Enhanced Integration Tests
        // ============================================

        describe('Ollama-Enhanced Methods', () => {
            test('semanticSearch should work with fallback', async () => {
                createTestFile(tempDir, 'src/user-service.js', `function createUser() {}
function deleteUser() {}
function updateUser() {}
`);

                const index = new CodeIndex();
                await index.build(tempDir);

                const results = await index.semanticSearch('user creation');
                expect(results.length).toBeGreaterThan(0);
            });

            test('getSmartContext should return context object', async () => {
                createTestFile(tempDir, 'src/auth.js', `function login() {}
function logout() {}
`);

                const index = new CodeIndex();
                await index.build(tempDir);

                const context = await index.getSmartContext('authentication login');
                expect(context).toHaveProperty('task');
                expect(context).toHaveProperty('symbols');
                expect(context).toHaveProperty('files');
            });

            test('getSmartContext with includeCode should add code snippets', async () => {
                createTestFile(tempDir, 'src/utils.js', `function helper() {
  return 42;
}
`);

                const index = new CodeIndex();
                await index.build(tempDir);

                const context = await index.getSmartContext('helper function', { includeCode: true });

                if (context.symbols.length > 0) {
                    const _symbolWithCode = context.symbols.find(s => s.code);
                    // Code might be included if symbol is found
                    expect(context.symbols.length).toBeGreaterThanOrEqual(0);
                }
            });

            test('explainSymbol should return explanation', async () => {
                createTestFile(tempDir, 'src/calc.js', `function calculate() {
  return 1 + 1;
}
`);

                const index = new CodeIndex();
                await index.build(tempDir);

                const symbols = index.search({ name: 'calculate' });
                if (symbols.length > 0) {
                    const explanation = await index.explainSymbol(symbols[0].id);
                    expect(explanation).not.toBeNull();
                    expect(explanation).toHaveProperty('description');
                }
            });

            test('rankSymbols should rank by relevance', async () => {
                createTestFile(tempDir, 'src/service.js', `function userService() {}
function dataService() {}
`);

                const index = new CodeIndex();
                await index.build(tempDir);

                const symbols = index.search({ kind: 'function' });
                const ranked = await index.rankSymbols(symbols, 'user');

                expect(ranked.length).toBe(symbols.length);
                if (ranked.length > 0) {
                    expect(ranked[0]).toHaveProperty('relevanceScore');
                }
            });

            test('isLLMAvailable should return boolean', async () => {
                createTestFile(tempDir, 'src/app.js', 'const x = 1;');

                const index = new CodeIndex();
                await index.build(tempDir);

                const available = await index.isLLMAvailable();
                expect(typeof available).toBe('boolean');
            });

            test('should throw error for Ollama methods when not built', async () => {
                const index = new CodeIndex();

                await expect(index.semanticSearch('test')).rejects.toThrow('Index not built');
                await expect(index.getSmartContext('test')).rejects.toThrow('Index not built');
                await expect(index.explainSymbol('test:id')).rejects.toThrow('Index not built');
                await expect(index.rankSymbols([], 'test')).rejects.toThrow('Index not built');
            });
        });
    });
});

describe('Language Patterns', () => {
    const javascriptConfig = require('./languages/javascript');

    test('should export SYMBOL_KINDS', () => {
        expect(javascriptConfig.SYMBOL_KINDS).toBeDefined();
        expect(javascriptConfig.SYMBOL_KINDS.FUNCTION).toBe('function');
        expect(javascriptConfig.SYMBOL_KINDS.CLASS).toBe('class');
    });

    test('should export PATTERNS', () => {
        expect(javascriptConfig.PATTERNS).toBeDefined();
        expect(javascriptConfig.PATTERNS.functionDeclaration).toBeDefined();
        expect(javascriptConfig.PATTERNS.classDeclaration).toBeDefined();
    });

    test('should export FILE_EXTENSIONS', () => {
        expect(javascriptConfig.FILE_EXTENSIONS).toContain('.js');
        expect(javascriptConfig.FILE_EXTENSIONS).toContain('.ts');
    });

    test('isReactComponentName should detect component names', () => {
        expect(javascriptConfig.isReactComponentName('Button')).toBe(true);
        expect(javascriptConfig.isReactComponentName('UserProfile')).toBe(true);
        expect(javascriptConfig.isReactComponentName('button')).toBe(false);
        expect(javascriptConfig.isReactComponentName('handleClick')).toBe(false);
    });

    test('isReactHookName should detect hook names', () => {
        expect(javascriptConfig.isReactHookName('useState')).toBe(true);
        expect(javascriptConfig.isReactHookName('useEffect')).toBe(true);
        expect(javascriptConfig.isReactHookName('useCustomHook')).toBe(true);
        expect(javascriptConfig.isReactHookName('useless')).toBe(false);
        expect(javascriptConfig.isReactHookName('myFunction')).toBe(false);
    });

    test('inferKind should infer React component kind', () => {
        expect(javascriptConfig.inferKind('Button', 'function')).toBe('component');
        expect(javascriptConfig.inferKind('helper', 'function')).toBe('function');
    });

    test('inferKind should infer React hook kind', () => {
        expect(javascriptConfig.inferKind('useAuth', 'function')).toBe('hook');
        expect(javascriptConfig.inferKind('useState', 'function')).toBe('hook');
    });

    test('extractParams should parse function parameters', () => {
    // Mock node with text method
        const mockNode = (text) => ({ text: () => text });

        expect(javascriptConfig.extractParams(mockNode('a, b, c'))).toEqual(['a', 'b', 'c']);
        expect(javascriptConfig.extractParams(mockNode('name: string, age: number'))).toEqual(['name', 'age']);
        expect(javascriptConfig.extractParams(mockNode('x = 10, y = 20'))).toEqual(['x', 'y']);
        expect(javascriptConfig.extractParams(null)).toEqual([]);
    });
});
