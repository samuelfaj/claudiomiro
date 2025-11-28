const fs = require('fs');
const path = require('path');
const IndexBuilder = require('./index-builder');
const QueryEngine = require('./query-engine');

/**
 * CodeIndex - Main service for code indexing and querying
 *
 * Token Optimization: Instead of sending entire files to LLM,
 * use this service to:
 * 1. Build an index of symbols (functions, classes, etc.)
 * 2. Query for relevant symbols
 * 3. Send only the relevant code snippets
 *
 * Estimated savings: 80-95% token reduction for code exploration tasks
 */
class CodeIndex {
  constructor(options = {}) {
    this.options = {
      cacheDir: '.claudiomiro/cache',
      cacheFile: 'code-index.json',
      ...options
    };

    this.builder = new IndexBuilder(options);
    this.query = null;
    this.indexData = null;
    this.rootPath = null;
  }

  /**
   * Build or load the code index
   * @param {string} rootPath - Root directory to index
   * @param {Object} options - Build options
   * @returns {Promise<CodeIndex>} This instance for chaining
   */
  async build(rootPath, options = {}) {
    const { forceRebuild = false, incremental = true } = options;

    this.rootPath = rootPath;
    const cachePath = this.getCachePath(rootPath);

    // Try to load cached index
    if (!forceRebuild && incremental && fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

        // Incremental update
        this.indexData = await this.builder.incrementalScan(rootPath, cached);
        this.query = new QueryEngine(this.indexData);
        this.saveCache(rootPath);

        return this;
      } catch (error) {
        // Cache invalid, rebuild
        console.warn('Code index cache invalid, rebuilding...');
      }
    }

    // Full rebuild
    this.indexData = await this.builder.scan(rootPath);
    this.query = new QueryEngine(this.indexData);
    this.saveCache(rootPath);

    return this;
  }

  /**
   * Get the cache file path
   */
  getCachePath(rootPath) {
    return path.join(rootPath, this.options.cacheDir, this.options.cacheFile);
  }

  /**
   * Save index to cache
   */
  saveCache(rootPath) {
    const cachePath = this.getCachePath(rootPath);
    const cacheDir = path.dirname(cachePath);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(cachePath, JSON.stringify(this.indexData, null, 2));
  }

  /**
   * Load index from cache
   * @param {string} rootPath - Root directory
   * @returns {boolean} True if cache loaded successfully
   */
  loadFromCache(rootPath) {
    const cachePath = this.getCachePath(rootPath);

    if (!fs.existsSync(cachePath)) {
      return false;
    }

    try {
      this.indexData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      this.query = new QueryEngine(this.indexData);
      this.rootPath = rootPath;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear the index cache
   * @param {string} rootPath - Root directory
   */
  clearCache(rootPath) {
    const cachePath = this.getCachePath(rootPath);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
    this.indexData = null;
    this.query = null;
  }

  /**
   * Get symbols relevant to a topic/task
   * @param {string} topic - Topic or task description
   * @param {Object} options - Search options
   * @returns {Object[]} Relevant symbols
   */
  findRelevantSymbols(topic, options = {}) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    const { maxResults = 20, kinds = null } = options;

    let results = this.query.findByTopic(topic);

    if (kinds && kinds.length > 0) {
      results = results.filter(s => kinds.includes(s.kind));
    }

    return results.slice(0, maxResults);
  }

  /**
   * Get context for a specific symbol
   * @param {string} symbolId - Symbol ID
   * @returns {Object|null} Symbol with full context
   */
  getSymbolContext(symbolId) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    const symbol = this.query.findById(symbolId);
    if (!symbol) return null;

    // Get file content
    const filePath = path.join(this.rootPath, symbol.file);
    let code = null;

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Extract symbol code with some context
      const startLine = Math.max(0, symbol.startLine - 2);
      const endLine = Math.min(lines.length, symbol.endLine + 1);

      code = lines.slice(startLine, endLine).join('\n');
    }

    // Get references
    const references = this.query.getSymbolReferences(symbolId);

    return {
      ...symbol,
      code,
      references,
      dependencies: this.query.getFileDependencies(symbol.file)
    };
  }

  /**
   * Get a file summary with all its symbols
   * @param {string} filePath - Relative file path
   * @returns {Object} File summary
   */
  getFileSummary(filePath) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    return this.query.getFileSummary(filePath);
  }

  /**
   * Get codebase overview
   * @returns {Object} Codebase summary
   */
  getOverview() {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    return this.query.getCodebaseSummary();
  }

  /**
   * Search for symbols
   * @param {Object} filters - Search filters
   * @returns {Object[]} Matching symbols
   */
  search(filters) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    return this.query.search(filters);
  }

  /**
   * Get dependency graph
   * @returns {Object} Dependency graph
   */
  getDependencyGraph() {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    return this.query.buildDependencyGraph();
  }

  /**
   * Format symbols as compact handles for LLM prompts
   * @param {Object[]} symbols - Symbols to format
   * @returns {string} Formatted string
   */
  formatForPrompt(symbols) {
    if (!this.query) {
      return '';
    }

    return this.query.formatForPrompt(symbols);
  }

  /**
   * Get handles for symbols (lightweight references)
   * @param {Object[]} symbols - Symbols
   * @returns {Object[]} Symbol handles
   */
  toHandles(symbols) {
    if (!this.query) {
      return [];
    }

    return this.query.toHandles(symbols);
  }

  // ============================================
  // Ollama-Enhanced Methods (with fallback)
  // ============================================

  /**
   * Semantic search using Ollama (with fallback)
   * @param {string} topic - Topic or task description
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Ranked symbols
   */
  async semanticSearch(topic, options = {}) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    return this.query.semanticSearch(topic, options);
  }

  /**
   * Get smart context for a task using Ollama (with fallback)
   * @param {string} taskDescription - Task description
   * @param {Object} options - Context options
   * @returns {Promise<Object>} Smart context with symbols and summaries
   */
  async getSmartContext(taskDescription, options = {}) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    const context = await this.query.getSmartContext(taskDescription, options);

    // Optionally add code snippets
    if (options.includeCode && context.symbols.length > 0) {
      for (const symbol of context.symbols) {
        const fullContext = this.getSymbolContext(symbol.id);
        if (fullContext?.code) {
          symbol.code = fullContext.code;
        }
      }
    }

    return context;
  }

  /**
   * Explain what a symbol does using Ollama (with fallback)
   * @param {string} symbolId - Symbol ID
   * @returns {Promise<Object>} Symbol explanation
   */
  async explainSymbol(symbolId) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    // Get code for the symbol
    const symbolContext = this.getSymbolContext(symbolId);
    const code = symbolContext?.code || null;

    return this.query.explainSymbol(symbolId, code);
  }

  /**
   * Rank symbols by relevance to a task (with fallback)
   * @param {Object[]} symbols - Symbols to rank
   * @param {string} taskDescription - Task description
   * @returns {Promise<Object[]>} Ranked symbols
   */
  async rankSymbols(symbols, taskDescription) {
    if (!this.query) {
      throw new Error('Index not built. Call build() first.');
    }

    return this.query.rankSymbols(symbols, taskDescription);
  }

  /**
   * Check if Ollama features are available
   * @returns {Promise<boolean>}
   */
  async isLLMAvailable() {
    if (!this.query) {
      return false;
    }

    return this.query.isLLMAvailable();
  }
}

// Export classes
module.exports = {
  CodeIndex,
  IndexBuilder,
  QueryEngine
};

// Export default singleton factory
module.exports.createIndex = (options = {}) => new CodeIndex(options);
