const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dynamic import for ast-grep (ES module)
let astGrep = null;
let astGrepLoadAttempted = false;
let astGrepAvailable = false;

/**
 * Load ast-grep dynamically
 * Returns null if ast-grep is not available (falls back to basic indexing)
 */
async function loadAstGrep() {
    if (astGrepLoadAttempted) {
        return astGrepAvailable ? astGrep : null;
    }

    astGrepLoadAttempted = true;

    try {
    // Try to load ast-grep
        astGrep = await import('@ast-grep/napi');
        astGrepAvailable = true;
        return astGrep;
    } catch (error) {
    // ast-grep not available, will use fallback
        console.warn('ast-grep not available, using basic regex indexing:', error.message);
        astGrepAvailable = false;
        return null;
    }
}

/**
 * Reset ast-grep load state (for testing)
 */
function resetAstGrepState() {
    astGrep = null;
    astGrepLoadAttempted = false;
    astGrepAvailable = false;
}

// Language configurations
const javascriptConfig = require('./languages/javascript');
const pythonConfig = require('./languages/python');
const goConfig = require('./languages/go');
const rustConfig = require('./languages/rust');
const javaConfig = require('./languages/java');
const cConfig = require('./languages/c');
const cppConfig = require('./languages/cpp');
const csharpConfig = require('./languages/csharp');
const rubyConfig = require('./languages/ruby');
const phpConfig = require('./languages/php');
const swiftConfig = require('./languages/swift');
const kotlinConfig = require('./languages/kotlin');
const scalaConfig = require('./languages/scala');
const luaConfig = require('./languages/lua');
const elixirConfig = require('./languages/elixir');
const bashConfig = require('./languages/bash');
const cssConfig = require('./languages/css');
const htmlConfig = require('./languages/html');
const dartConfig = require('./languages/dart');
const haskellConfig = require('./languages/haskell');
const sqlConfig = require('./languages/sql');

/**
 * Map of file extensions to language configs
 */
const LANGUAGE_CONFIGS = {
    // JavaScript/TypeScript
    '.js': javascriptConfig,
    '.jsx': javascriptConfig,
    '.ts': javascriptConfig,
    '.tsx': javascriptConfig,
    '.mjs': javascriptConfig,
    '.cjs': javascriptConfig,
    // Python
    '.py': pythonConfig,
    '.pyw': pythonConfig,
    '.pyi': pythonConfig,
    // Go
    '.go': goConfig,
    // Rust
    '.rs': rustConfig,
    // Java
    '.java': javaConfig,
    // C
    '.c': cConfig,
    '.h': cConfig,
    // C++
    '.cpp': cppConfig,
    '.cc': cppConfig,
    '.cxx': cppConfig,
    '.hpp': cppConfig,
    '.hh': cppConfig,
    '.hxx': cppConfig,
    // C#
    '.cs': csharpConfig,
    '.csx': csharpConfig,
    // Ruby
    '.rb': rubyConfig,
    '.rake': rubyConfig,
    '.gemspec': rubyConfig,
    '.ru': rubyConfig,
    // PHP
    '.php': phpConfig,
    '.phtml': phpConfig,
    '.php3': phpConfig,
    '.php4': phpConfig,
    '.php5': phpConfig,
    '.phps': phpConfig,
    // Swift
    '.swift': swiftConfig,
    // Kotlin
    '.kt': kotlinConfig,
    '.kts': kotlinConfig,
    // Scala
    '.scala': scalaConfig,
    '.sc': scalaConfig,
    // Lua
    '.lua': luaConfig,
    // Elixir
    '.ex': elixirConfig,
    '.exs': elixirConfig,
    // Bash/Shell
    '.sh': bashConfig,
    '.bash': bashConfig,
    '.zsh': bashConfig,
    '.ksh': bashConfig,
    // CSS/SCSS/LESS
    '.css': cssConfig,
    '.scss': cssConfig,
    '.sass': cssConfig,
    '.less': cssConfig,
    '.styl': cssConfig,
    // HTML
    '.html': htmlConfig,
    '.htm': htmlConfig,
    '.xhtml': htmlConfig,
    '.vue': htmlConfig,
    '.svelte': htmlConfig,
    // Dart
    '.dart': dartConfig,
    // Haskell
    '.hs': haskellConfig,
    '.lhs': haskellConfig,
    // SQL
    '.sql': sqlConfig,
    '.psql': sqlConfig,
    '.pgsql': sqlConfig,
    '.plsql': sqlConfig,
    '.mysql': sqlConfig,
};

/**
 * Map of extensions to ast-grep languages
 */
const AST_GREP_LANGUAGES = {
    // JavaScript/TypeScript
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'Tsx',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    // Python
    '.py': 'Python',
    '.pyw': 'Python',
    '.pyi': 'Python',
    // Go
    '.go': 'Go',
    // Rust
    '.rs': 'Rust',
    // Java
    '.java': 'Java',
    // C
    '.c': 'C',
    '.h': 'C',
    // C++
    '.cpp': 'Cpp',
    '.cc': 'Cpp',
    '.cxx': 'Cpp',
    '.hpp': 'Cpp',
    '.hh': 'Cpp',
    '.hxx': 'Cpp',
    // C#
    '.cs': 'CSharp',
    '.csx': 'CSharp',
    // Ruby
    '.rb': 'Ruby',
    '.rake': 'Ruby',
    '.gemspec': 'Ruby',
    '.ru': 'Ruby',
    // PHP
    '.php': 'Php',
    '.phtml': 'Php',
    '.php3': 'Php',
    '.php4': 'Php',
    '.php5': 'Php',
    '.phps': 'Php',
    // Swift
    '.swift': 'Swift',
    // Kotlin
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
    // Scala
    '.scala': 'Scala',
    '.sc': 'Scala',
    // Lua
    '.lua': 'Lua',
    // Elixir
    '.ex': 'Elixir',
    '.exs': 'Elixir',
    // Bash/Shell
    '.sh': 'Bash',
    '.bash': 'Bash',
    '.zsh': 'Bash',
    '.ksh': 'Bash',
    // CSS/SCSS/LESS
    '.css': 'Css',
    '.scss': 'Css',
    '.sass': 'Css',
    '.less': 'Css',
    '.styl': 'Css',
    // HTML
    '.html': 'Html',
    '.htm': 'Html',
    '.xhtml': 'Html',
    '.vue': 'Html',
    '.svelte': 'Html',
    // Dart
    '.dart': 'Dart',
    // Haskell
    '.hs': 'Haskell',
    '.lhs': 'Haskell',
    // SQL
    '.sql': 'Sql',
    '.psql': 'Sql',
    '.pgsql': 'Sql',
    '.plsql': 'Sql',
    '.mysql': 'Sql',
};

/**
 * IndexBuilder - Builds code index using ast-grep
 */
class IndexBuilder {
    constructor(options = {}) {
        this.options = {
            ignoreDirs: ['node_modules', '.git', 'dist', 'build', 'coverage', '.claudiomiro'],
            ignoreFiles: ['*.min.js', '*.bundle.js', '*.d.ts'],
            maxFileSize: 1024 * 1024, // 1MB
            ...options,
        };
        this.symbols = new Map();
        this.references = [];
        this.fileHashes = new Map();
    }

    /**
   * Scan a directory and build the code index
   * @param {string} rootPath - Root directory to scan
   * @returns {Promise<Object>} Index data with symbols and references
   */
    async scan(rootPath) {
    // Try to load ast-grep but continue with fallback if not available
        await loadAstGrep();

        this.symbols.clear();
        this.references = [];
        this.fileHashes.clear();

        const files = this.getSourceFiles(rootPath);

        for (const file of files) {
            await this.indexFile(file, rootPath);
        }

        return {
            symbols: Array.from(this.symbols.values()),
            references: this.references,
            fileHashes: Object.fromEntries(this.fileHashes),
            stats: {
                totalFiles: files.length,
                totalSymbols: this.symbols.size,
                totalReferences: this.references.length,
                usingAstGrep: astGrepAvailable,
            },
        };
    }

    /**
   * Get all source files in a directory
   * @param {string} rootPath - Root directory
   * @returns {string[]} Array of file paths
   */
    getSourceFiles(rootPath) {
        const files = [];
        this.walkDir(rootPath, files);
        return files;
    }

    /**
   * Recursively walk directory and collect files
   */
    walkDir(dir, files) {
        if (!fs.existsSync(dir)) return;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Skip ignored directories
                if (this.options.ignoreDirs.includes(entry.name)) continue;
                this.walkDir(fullPath, files);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);

                // Only process supported file types
                if (!LANGUAGE_CONFIGS[ext]) continue;

                // Skip ignored file patterns
                if (this.shouldIgnoreFile(entry.name)) continue;

                // Skip files that are too large
                const stats = fs.statSync(fullPath);
                if (stats.size > this.options.maxFileSize) continue;

                files.push(fullPath);
            }
        }
    }

    /**
   * Check if a file should be ignored
   */
    shouldIgnoreFile(filename) {
        for (const pattern of this.options.ignoreFiles) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(filename)) return true;
        }
        return false;
    }

    /**
   * Index a single file
   * @param {string} filePath - Path to the file
   * @param {string} rootPath - Root directory for relative paths
   */
    async indexFile(filePath, rootPath) {
        const ext = path.extname(filePath);
        const langConfig = LANGUAGE_CONFIGS[ext];
        const astLang = AST_GREP_LANGUAGES[ext];

        if (!langConfig) return;

        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(rootPath, filePath);

        // Store file hash for change detection
        const hash = this.hashContent(content);
        this.fileHashes.set(relativePath, hash);

        // If ast-grep is not available, use basic indexing
        if (!astGrepAvailable) {
            this.indexFileBasic(filePath, relativePath, content, langConfig);
            return;
        }

        try {
            const astGrepModule = await loadAstGrep();
            if (!astGrepModule) {
                this.indexFileBasic(filePath, relativePath, content, langConfig);
                return;
            }

            const { parse, Lang } = astGrepModule;

            // Get the language enum value
            const lang = Lang[astLang];
            if (!lang) {
                // Fallback to basic if specific language not available
                this.indexFileBasic(filePath, relativePath, content, langConfig);
                return;
            }

            // Parse the file
            const tree = parse(lang, content);
            const root = tree.root();

            // Extract symbols using patterns
            await this.extractSymbols(root, relativePath, langConfig, content);

            // Extract references
            await this.extractReferences(root, relativePath, langConfig);
        } catch (error) {
            // If ast-grep fails, fallback to basic indexing
            this.indexFileBasic(filePath, relativePath, content, langConfig);
        }
    }

    /**
   * Extract symbols from AST root using language patterns
   */
    async extractSymbols(root, relativePath, langConfig, content) {
        const _lines = content.split('\n');

        // Try each pattern
        for (const [patternName, patternConfig] of Object.entries(langConfig.PATTERNS)) {
            try {
                const matches = root.findAll(patternConfig.pattern);

                for (const match of matches) {
                    const range = match.range();
                    const startLine = range.start.line + 1; // 1-indexed
                    const endLine = range.end.line + 1;

                    // Extract info using pattern's extractor
                    let extracted = {};
                    if (patternConfig.extract) {
                        try {
                            extracted = patternConfig.extract(match);
                        } catch (e) {
                            // Extraction failed, use basic info
                            extracted = { name: match.text().substring(0, 50) };
                        }
                    }

                    const name = extracted.name || patternName;
                    if (!name || name.length === 0) continue;

                    // Infer the actual kind based on naming conventions
                    const kind = langConfig.inferKind
                        ? langConfig.inferKind(name, patternConfig.kind)
                        : patternConfig.kind;

                    const symbolId = `${relativePath}:${name}`;

                    // Check if symbol already exists (avoid duplicates from overlapping patterns)
                    if (this.symbols.has(symbolId)) continue;

                    this.symbols.set(symbolId, {
                        id: symbolId,
                        name,
                        kind,
                        file: relativePath,
                        startLine,
                        endLine,
                        exports: this.checkIfExported(name, content),
                        ...extracted,
                        hash: this.hashContent(match.text()),
                    });
                }
            } catch (_patternError) {
                // Pattern may not be valid for this version of ast-grep
                // Silently continue with other patterns
            }
        }
    }

    /**
   * Extract references (imports, function calls) from AST
   */
    async extractReferences(root, relativePath, langConfig) {
        for (const [patternName, patternConfig] of Object.entries(langConfig.REFERENCE_PATTERNS)) {
            try {
                const matches = root.findAll(patternConfig.pattern);

                for (const match of matches) {
                    const range = match.range();
                    let extracted = {};

                    if (patternConfig.extract) {
                        try {
                            extracted = patternConfig.extract(match);
                        } catch (e) {
                            continue;
                        }
                    }

                    this.references.push({
                        type: patternName,
                        file: relativePath,
                        line: range.start.line + 1,
                        ...extracted,
                    });
                }
            } catch (_patternError) {
                // Pattern may not be valid, continue
            }
        }
    }

    /**
   * Basic indexing fallback using regex (when ast-grep fails)
   */
    indexFileBasic(filePath, relativePath, content, langConfig) {
        const lines = content.split('\n');

        // Basic patterns for common constructs
        const basicPatterns = [
            { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m, kind: 'function' },
            { regex: /^(?:export\s+)?class\s+(\w+)/m, kind: 'class' },
            { regex: /^(?:export\s+)?const\s+(\w+)\s*=/m, kind: 'constant' },
            { regex: /^(?:export\s+)?interface\s+(\w+)/m, kind: 'interface' },
            { regex: /^(?:export\s+)?type\s+(\w+)\s*=/m, kind: 'type' },
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            for (const { regex, kind } of basicPatterns) {
                const match = line.match(regex);
                if (match) {
                    const name = match[1];
                    const symbolId = `${relativePath}:${name}`;

                    if (!this.symbols.has(symbolId)) {
                        this.symbols.set(symbolId, {
                            id: symbolId,
                            name,
                            kind: langConfig.inferKind ? langConfig.inferKind(name, kind) : kind,
                            file: relativePath,
                            startLine: i + 1,
                            endLine: i + 1, // Can't determine end without AST
                            exports: line.includes('export'),
                            hash: this.hashContent(line),
                        });
                    }
                }
            }
        }
    }

    /**
   * Index file using only patterns (fallback when Lang enum fails)
   */
    indexFileWithPatterns(filePath, relativePath, content, langConfig) {
        this.indexFileBasic(filePath, relativePath, content, langConfig);
    }

    /**
   * Check if a symbol is exported
   */
    checkIfExported(symbolName, content) {
    // Check for various export patterns
        const exportPatterns = [
            new RegExp(`export\\s+(const|let|var|function|class|async\\s+function)\\s+${symbolName}\\b`),
            new RegExp(`export\\s*{[^}]*\\b${symbolName}\\b[^}]*}`),
            new RegExp(`export\\s+default\\s+${symbolName}\\b`),
            new RegExp(`module\\.exports\\s*=\\s*{[^}]*\\b${symbolName}\\b`),
            new RegExp(`module\\.exports\\.${symbolName}\\s*=`),
            new RegExp(`exports\\.${symbolName}\\s*=`),
        ];

        return exportPatterns.some(pattern => pattern.test(content));
    }

    /**
   * Calculate MD5 hash of content
   */
    hashContent(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
   * Check if a file has changed since last index
   * @param {string} filePath - File path
   * @param {string} previousHash - Previous hash
   * @returns {boolean} True if file changed
   */
    hasFileChanged(filePath, previousHash) {
        if (!fs.existsSync(filePath)) return true;
        const content = fs.readFileSync(filePath, 'utf-8');
        const currentHash = this.hashContent(content);
        return currentHash !== previousHash;
    }

    /**
   * Incrementally update index for changed files only
   * @param {string} rootPath - Root directory
   * @param {Object} previousIndex - Previous index data
   * @returns {Promise<Object>} Updated index
   */
    async incrementalScan(rootPath, previousIndex) {
        await loadAstGrep();

        const files = this.getSourceFiles(rootPath);
        const previousHashes = previousIndex.fileHashes || {};

        // Keep symbols from unchanged files
        for (const symbol of previousIndex.symbols || []) {
            const fileHash = previousHashes[symbol.file];
            if (fileHash && !this.hasFileChanged(path.join(rootPath, symbol.file), fileHash)) {
                this.symbols.set(symbol.id, symbol);
                this.fileHashes.set(symbol.file, fileHash);
            }
        }

        // Re-index changed files
        for (const file of files) {
            const relativePath = path.relative(rootPath, file);
            const previousHash = previousHashes[relativePath];

            if (!previousHash || this.hasFileChanged(file, previousHash)) {
                // Remove old symbols from this file
                for (const [id, symbol] of this.symbols) {
                    if (symbol.file === relativePath) {
                        this.symbols.delete(id);
                    }
                }

                // Re-index the file
                await this.indexFile(file, rootPath);
            }
        }

        return {
            symbols: Array.from(this.symbols.values()),
            references: this.references,
            fileHashes: Object.fromEntries(this.fileHashes),
            stats: {
                totalFiles: files.length,
                totalSymbols: this.symbols.size,
                totalReferences: this.references.length,
            },
        };
    }
}

module.exports = IndexBuilder;
module.exports.LANGUAGE_CONFIGS = LANGUAGE_CONFIGS;
module.exports.AST_GREP_LANGUAGES = AST_GREP_LANGUAGES;
module.exports.resetAstGrepState = resetAstGrepState;
