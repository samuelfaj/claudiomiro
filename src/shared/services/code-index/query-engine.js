const path = require('path');

// Lazy load to avoid circular dependencies
let localLLMService = null;
const getLocalLLM = () => {
    if (!localLLMService) {
        try {
            const { getLocalLLMService } = require('../local-llm');
            localLLMService = getLocalLLMService();
        } catch {
            localLLMService = null;
        }
    }
    return localLLMService;
};

/**
 * QueryEngine - Search and query the code index
 *
 * Provides methods to find symbols, get dependencies,
 * and search for code patterns in the indexed codebase.
 *
 * Enhanced with optional Ollama integration for semantic search.
 * Falls back to keyword matching when Ollama is unavailable.
 */
class QueryEngine {
    constructor(indexData = null) {
        this.symbols = new Map();
        this.symbolsByFile = new Map();
        this.symbolsByKind = new Map();
        this.symbolsByName = new Map();
        this.references = [];

        if (indexData) {
            this.loadIndex(indexData);
        }
    }

    /**
   * Load index data into the query engine
   * @param {Object} indexData - Index data from IndexBuilder
   */
    loadIndex(indexData) {
        this.symbols.clear();
        this.symbolsByFile.clear();
        this.symbolsByKind.clear();
        this.symbolsByName.clear();
        this.references = indexData.references || [];

        for (const symbol of indexData.symbols || []) {
            this.symbols.set(symbol.id, symbol);

            // Index by file
            if (!this.symbolsByFile.has(symbol.file)) {
                this.symbolsByFile.set(symbol.file, []);
            }
            this.symbolsByFile.get(symbol.file).push(symbol);

            // Index by kind
            if (!this.symbolsByKind.has(symbol.kind)) {
                this.symbolsByKind.set(symbol.kind, []);
            }
            this.symbolsByKind.get(symbol.kind).push(symbol);

            // Index by name
            if (!this.symbolsByName.has(symbol.name)) {
                this.symbolsByName.set(symbol.name, []);
            }
            this.symbolsByName.get(symbol.name).push(symbol);
        }
    }

    /**
   * Find a symbol by its ID
   * @param {string} symbolId - Symbol ID (file:name)
   * @returns {Object|null} Symbol or null
   */
    findById(symbolId) {
        return this.symbols.get(symbolId) || null;
    }

    /**
   * Find symbols by name
   * @param {string} name - Symbol name (exact or pattern)
   * @param {Object} options - Search options
   * @returns {Object[]} Matching symbols
   */
    findByName(name, options = {}) {
        const { exact = false, caseSensitive = true } = options;

        if (exact) {
            return this.symbolsByName.get(name) || [];
        }

        const results = [];
        const searchName = caseSensitive ? name : name.toLowerCase();

        for (const [symbolName, symbols] of this.symbolsByName) {
            const compareName = caseSensitive ? symbolName : symbolName.toLowerCase();
            if (compareName.includes(searchName)) {
                results.push(...symbols);
            }
        }

        return results;
    }

    /**
   * Find symbols by kind
   * @param {string} kind - Symbol kind (function, class, etc.)
   * @returns {Object[]} Matching symbols
   */
    findByKind(kind) {
        return this.symbolsByKind.get(kind) || [];
    }

    /**
   * Find symbols in a specific file
   * @param {string} filePath - Relative file path
   * @returns {Object[]} Symbols in the file
   */
    findByFile(filePath) {
    // Normalize path separators
        const normalizedPath = filePath.replace(/\\/g, '/');
        return this.symbolsByFile.get(normalizedPath) || [];
    }

    /**
   * Find all exported symbols
   * @returns {Object[]} Exported symbols
   */
    findExported() {
        const results = [];
        for (const symbol of this.symbols.values()) {
            if (symbol.exports) {
                results.push(symbol);
            }
        }
        return results;
    }

    /**
   * Search symbols with multiple filters
   * @param {Object} filters - Search filters
   * @returns {Object[]} Matching symbols
   */
    search(filters = {}) {
        const { name, kind, file, exported, pattern } = filters;
        let results = Array.from(this.symbols.values());

        if (name) {
            const searchName = name.toLowerCase();
            results = results.filter(s =>
                s.name.toLowerCase().includes(searchName),
            );
        }

        if (kind) {
            results = results.filter(s => s.kind === kind);
        }

        if (file) {
            results = results.filter(s => s.file.includes(file));
        }

        if (exported !== undefined) {
            results = results.filter(s => s.exports === exported);
        }

        if (pattern) {
            const regex = new RegExp(pattern, 'i');
            results = results.filter(s =>
                regex.test(s.name) || regex.test(s.file),
            );
        }

        return results;
    }

    /**
   * Get dependencies for a file (what it imports)
   * @param {string} filePath - File path
   * @returns {Object[]} Dependencies
   */
    getFileDependencies(filePath) {
        return this.references.filter(ref =>
            ref.file === filePath &&
      (ref.type === 'require' || ref.type === 'importDeclaration' || ref.type === 'dynamicImport'),
        );
    }

    /**
   * Get dependents of a file (what imports it)
   * @param {string} filePath - File path
   * @returns {Object[]} Files that depend on this file
   */
    getFileDependents(filePath) {
        const filename = path.basename(filePath, path.extname(filePath));
        const _dirname = path.dirname(filePath);

        return this.references.filter(ref => {
            if (ref.type !== 'require' && ref.type !== 'importDeclaration') {
                return false;
            }

            const module = ref.module || '';

            // Check if the module reference matches this file
            // Handle relative paths like './file', '../dir/file'
            if (module.startsWith('.')) {
                const refDir = path.dirname(ref.file);
                const resolvedPath = path.normalize(path.join(refDir, module));
                return resolvedPath === filePath.replace(/\.[^.]+$/, '');
            }

            // Check if it's a direct filename match
            return module === filename || module.endsWith('/' + filename);
        });
    }

    /**
   * Get all symbols that reference a given symbol
   * @param {string} symbolId - Symbol ID
   * @returns {Object[]} Referencing symbols with context
   */
    getSymbolReferences(symbolId) {
        const symbol = this.findById(symbolId);
        if (!symbol) return [];

        const symbolName = symbol.name;
        const results = [];

        // Find function calls that match this symbol's name
        for (const ref of this.references) {
            if (ref.type === 'functionCall' && ref.func === symbolName) {
                results.push({
                    ...ref,
                    symbolId,
                    context: `Called in ${ref.file}:${ref.line}`,
                });
            }
        }

        return results;
    }

    /**
   * Build a dependency graph for the codebase
   * @returns {Object} Dependency graph { nodes, edges }
   */
    buildDependencyGraph() {
        const nodes = new Set();
        const edges = [];

        // Add all files as nodes
        for (const file of this.symbolsByFile.keys()) {
            nodes.add(file);
        }

        // Add edges from imports
        for (const ref of this.references) {
            if (ref.type !== 'require' && ref.type !== 'importDeclaration') {
                continue;
            }

            const sourceFile = ref.file;
            const module = ref.module || '';

            // Try to resolve the target file
            let targetFile = null;

            if (module.startsWith('.')) {
                // Relative import
                const sourceDir = path.dirname(sourceFile);
                const resolved = path.normalize(path.join(sourceDir, module));

                // Find matching file in index
                for (const file of nodes) {
                    const fileWithoutExt = file.replace(/\.[^.]+$/, '');
                    if (fileWithoutExt === resolved || file === resolved) {
                        targetFile = file;
                        break;
                    }
                }
            }

            if (targetFile) {
                edges.push({
                    source: sourceFile,
                    target: targetFile,
                    type: ref.type,
                });
            }
        }

        return {
            nodes: Array.from(nodes),
            edges,
        };
    }

    /**
   * Get a summary of a file's symbols
   * @param {string} filePath - File path
   * @returns {Object} File summary
   */
    getFileSummary(filePath) {
        const symbols = this.findByFile(filePath);
        const dependencies = this.getFileDependencies(filePath);

        const summary = {
            file: filePath,
            symbolCount: symbols.length,
            exports: symbols.filter(s => s.exports).map(s => s.name),
            functions: symbols.filter(s => s.kind === 'function').map(s => s.name),
            classes: symbols.filter(s => s.kind === 'class').map(s => s.name),
            components: symbols.filter(s => s.kind === 'component').map(s => s.name),
            hooks: symbols.filter(s => s.kind === 'hook').map(s => s.name),
            dependencies: dependencies.map(d => d.module).filter(Boolean),
            types: symbols.filter(s => s.kind === 'type' || s.kind === 'interface').map(s => s.name),
        };

        return summary;
    }

    /**
   * Get a summary of the entire codebase
   * @returns {Object} Codebase summary
   */
    getCodebaseSummary() {
        const files = Array.from(this.symbolsByFile.keys());
        const totalSymbols = this.symbols.size;

        const byKind = {};
        for (const [kind, symbols] of this.symbolsByKind) {
            byKind[kind] = symbols.length;
        }

        const exportedCount = Array.from(this.symbols.values())
            .filter(s => s.exports).length;

        return {
            totalFiles: files.length,
            totalSymbols,
            totalReferences: this.references.length,
            exportedSymbols: exportedCount,
            byKind,
            files: files.slice(0, 20), // First 20 files
        };
    }

    /**
   * Find symbols related to a topic/feature
   * @param {string} topic - Topic to search for
   * @returns {Object[]} Related symbols
   */
    findByTopic(topic) {
        const keywords = topic.toLowerCase().split(/\s+/);
        const results = [];
        const scores = new Map();

        for (const symbol of this.symbols.values()) {
            let score = 0;
            const searchText = `${symbol.name} ${symbol.file} ${symbol.kind}`.toLowerCase();

            for (const keyword of keywords) {
                if (searchText.includes(keyword)) {
                    score++;
                }
            }

            if (score > 0) {
                scores.set(symbol.id, score);
                results.push(symbol);
            }
        }

        // Sort by relevance score
        results.sort((a, b) =>
            (scores.get(b.id) || 0) - (scores.get(a.id) || 0),
        );

        return results;
    }

    /**
   * Get compact symbol handles for LLM context
   * @param {Object[]} symbols - Array of symbols
   * @returns {Object[]} Compact handles
   */
    toHandles(symbols) {
        return symbols.map(s => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            file: s.file,
            line: s.startLine,
            exported: s.exports || false,
        }));
    }

    /**
   * Format symbols as a concise string for LLM prompts
   * @param {Object[]} symbols - Symbols to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted string
   */
    formatForPrompt(symbols, options = {}) {
        const { includeFile = true, maxLength = 100 } = options;

        const lines = symbols.slice(0, maxLength).map(s => {
            const location = includeFile ? ` (${s.file}:${s.startLine})` : '';
            const exported = s.exports ? ' [exported]' : '';
            return `- ${s.name}: ${s.kind}${location}${exported}`;
        });

        if (symbols.length > maxLength) {
            lines.push(`... and ${symbols.length - maxLength} more`);
        }

        return lines.join('\n');
    }

    // ============================================
    // Ollama-Enhanced Methods (with fallback)
    // ============================================

    /**
   * Semantic search for symbols using Ollama
   * Falls back to keyword search if Ollama unavailable
   * @param {string} topic - Topic or task description
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Ranked symbols
   */
    async semanticSearch(topic, options = {}) {
        const { maxResults = 20, kinds = null } = options;

        // Get initial candidates using keyword search
        let candidates = this.findByTopic(topic);

        if (kinds && kinds.length > 0) {
            candidates = candidates.filter(s => kinds.includes(s.kind));
        }

        // Limit candidates for LLM processing
        candidates = candidates.slice(0, 50);

        if (candidates.length === 0) {
            return [];
        }

        // Try LLM-based ranking
        const llm = getLocalLLM();
        if (llm) {
            try {
                await llm.initialize();

                if (llm.isAvailable()) {
                    const symbolDescriptions = candidates.map(s =>
                        `${s.kind}:${s.name} in ${s.file}:${s.startLine}`,
                    );

                    const ranked = await llm.rankFileRelevance(symbolDescriptions, topic);

                    if (ranked && ranked.length > 0) {
                        // Map back to symbols with LLM scores
                        const rankedSymbols = [];
                        for (const item of ranked) {
                            const match = candidates.find(s =>
                                item.path.includes(s.name) && item.path.includes(s.file),
                            );
                            if (match) {
                                rankedSymbols.push({
                                    ...match,
                                    relevanceScore: item.relevance,
                                    relevanceReason: item.reason,
                                });
                            }
                        }

                        return rankedSymbols.slice(0, maxResults);
                    }
                }
            } catch {
                // Fallback to keyword search on error
            }
        }

        // Fallback: return keyword-matched results
        return candidates.slice(0, maxResults);
    }

    /**
   * Get smart context for a task using Ollama
   * Summarizes and ranks relevant symbols
   * Falls back to simple selection if Ollama unavailable
   * @param {string} taskDescription - Task description
   * @param {Object} options - Context options
   * @returns {Promise<Object>} Smart context
   */
    async getSmartContext(taskDescription, options = {}) {
        const { maxSymbols = 15, includeCode: _includeCode = false } = options;

        // Find relevant symbols
        const symbols = await this.semanticSearch(taskDescription, {
            maxResults: maxSymbols * 2,
        });

        const context = {
            task: taskDescription,
            symbols: [],
            files: new Set(),
            summary: null,
            llmEnhanced: false,
        };

        if (symbols.length === 0) {
            return context;
        }

        // Try LLM summarization
        const llm = getLocalLLM();
        if (llm) {
            try {
                await llm.initialize();

                if (llm.isAvailable()) {
                    // Prepare symbol info for summarization
                    const symbolInfo = symbols.slice(0, maxSymbols).map(s => ({
                        path: `${s.file}:${s.startLine}`,
                        content: `${s.kind} ${s.name}${s.signature ? s.signature : ''}`,
                    }));

                    const summarized = await llm.summarizeContext(symbolInfo, taskDescription);

                    if (summarized && summarized.length > 0) {
                        context.llmEnhanced = true;

                        // Merge LLM insights with symbols
                        for (const item of summarized) {
                            const symbol = symbols.find(s =>
                                item.path.includes(s.file) && item.path.includes(String(s.startLine)),
                            );
                            if (symbol) {
                                context.symbols.push({
                                    ...symbol,
                                    summary: item.summary,
                                    relevance: item.relevance,
                                });
                                context.files.add(symbol.file);
                            }
                        }

                        // Sort by relevance
                        context.symbols.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
                        context.symbols = context.symbols.slice(0, maxSymbols);
                    }
                }
            } catch {
                // Fallback on error
            }
        }

        // Fallback: use symbols without LLM enhancement
        if (context.symbols.length === 0) {
            context.symbols = symbols.slice(0, maxSymbols).map(s => {
                context.files.add(s.file);
                return {
                    ...s,
                    relevance: s.relevanceScore || 0.5,
                };
            });
        }

        context.files = Array.from(context.files);

        return context;
    }

    /**
   * Explain what a symbol does using Ollama
   * Falls back to basic info if Ollama unavailable
   * @param {string} symbolId - Symbol ID
   * @param {string} code - Optional code content
   * @returns {Promise<Object>} Symbol explanation
   */
    async explainSymbol(symbolId, code = null) {
        const symbol = this.findById(symbolId);
        if (!symbol) {
            return null;
        }

        const explanation = {
            symbol,
            description: null,
            purpose: null,
            dependencies: this.getSymbolReferences(symbolId),
            llmEnhanced: false,
        };

        // Try LLM explanation
        const llm = getLocalLLM();
        if (llm && code) {
            try {
                await llm.initialize();

                if (llm.isAvailable()) {
                    const prompt = `Explain this ${symbol.kind} briefly:
Name: ${symbol.name}
File: ${symbol.file}

Code:
${code.slice(0, 1500)}

Provide: 1) What it does, 2) Its purpose in the codebase`;

                    const result = await llm.generate(prompt, { maxTokens: 200 });

                    if (result) {
                        explanation.description = result;
                        explanation.llmEnhanced = true;
                    }
                }
            } catch {
                // Fallback on error
            }
        }

        // Fallback: generate basic description
        if (!explanation.description) {
            explanation.description = this._generateBasicDescription(symbol);
        }

        return explanation;
    }

    /**
   * Rank symbols by relevance to a task
   * Uses Ollama if available, otherwise keyword scoring
   * @param {Object[]} symbols - Symbols to rank
   * @param {string} taskDescription - Task description
   * @returns {Promise<Object[]>} Ranked symbols with scores
   */
    async rankSymbols(symbols, taskDescription) {
        if (!symbols || symbols.length === 0) {
            return [];
        }

        // Try LLM ranking
        const llm = getLocalLLM();
        if (llm) {
            try {
                await llm.initialize();

                if (llm.isAvailable()) {
                    const symbolPaths = symbols.map(s =>
                        `${s.kind}:${s.name} (${s.file}:${s.startLine})`,
                    );

                    const ranked = await llm.rankFileRelevance(symbolPaths, taskDescription);

                    if (ranked && ranked.length > 0) {
                        return symbols.map(s => {
                            const match = ranked.find(r =>
                                r.path.includes(s.name) && r.path.includes(s.file),
                            );
                            return {
                                ...s,
                                relevanceScore: match?.relevance || 0.3,
                                relevanceReason: match?.reason || 'No match',
                            };
                        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
                    }
                }
            } catch {
                // Fallback on error
            }
        }

        // Fallback: keyword-based scoring
        return this._keywordRank(symbols, taskDescription);
    }

    /**
   * Check if Ollama features are available
   * @returns {Promise<boolean>}
   */
    async isLLMAvailable() {
        const llm = getLocalLLM();
        if (!llm) return false;

        try {
            await llm.initialize();
            return llm.isAvailable();
        } catch {
            return false;
        }
    }

    // ============================================
    // Private Helpers
    // ============================================

    /**
   * Generate basic description without LLM
   * @private
   */
    _generateBasicDescription(symbol) {
        const kindDescriptions = {
            function: 'A function',
            class: 'A class',
            method: 'A method',
            component: 'A React component',
            hook: 'A React hook',
            variable: 'A variable',
            constant: 'A constant',
            type: 'A type definition',
            interface: 'An interface',
        };

        const base = kindDescriptions[symbol.kind] || `A ${symbol.kind}`;
        const exported = symbol.exports ? ' (exported)' : '';
        const location = `in ${symbol.file}`;

        return `${base} named "${symbol.name}"${exported} ${location}`;
    }

    /**
   * Keyword-based ranking fallback
   * @private
   */
    _keywordRank(symbols, taskDescription) {
        const keywords = taskDescription.toLowerCase().split(/\s+/);

        return symbols.map(s => {
            const searchText = `${s.name} ${s.file} ${s.kind}`.toLowerCase();
            let score = 0;

            for (const keyword of keywords) {
                if (keyword.length > 2 && searchText.includes(keyword)) {
                    score += 0.2;
                }
            }

            // Boost exported symbols
            if (s.exports) score += 0.1;

            return {
                ...s,
                relevanceScore: Math.min(1, 0.3 + score),
                relevanceReason: 'Keyword matching',
            };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
}

module.exports = QueryEngine;
