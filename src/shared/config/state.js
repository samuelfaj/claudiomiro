const path = require('path');
const fs = require('fs');
const { findGitRoot } = require('../services/git-detector');

class State {
    constructor() {
        this._folder = null;
        this._claudiomiroRoot = null;
        this._taskExecutorFolder = null;
        this._workspaceRoot = null;
        this._workspaceClaudiomiroRoot = null;
        this._workspaceTaskExecutorFolder = null;
        this._executorType = 'claude';
        this._multiRepoEnabled = false;
        this._repositories = new Map();
        this._gitMode = null;
        this._gitRoots = [];
        this._legacySystems = new Map();
    }

    setFolder(folderPath) {
        const resolvedFolder = path.resolve(folderPath);
        this._folder = resolvedFolder;

        this._claudiomiroRoot = path.join(resolvedFolder, '.claudiomiro');

        if (!this._workspaceRoot) {
            this._workspaceRoot = resolvedFolder;
            this._workspaceClaudiomiroRoot = this._claudiomiroRoot;
        }

        this._taskExecutorFolder = this._resolveTaskExecutorFolder();

        if (!this._workspaceTaskExecutorFolder) {
            // First setFolder call defines the workspace-scoped folder
            this._workspaceTaskExecutorFolder = this._taskExecutorFolder;
        }
    }

    get folder() {
        return this._folder;
    }

    get claudiomiroFolder() {
        return this._taskExecutorFolder;
    }

    get claudiomiroRoot() {
        return this._claudiomiroRoot;
    }

    get workspaceRoot() {
        return this._workspaceRoot;
    }

    get workspaceClaudiomiroRoot() {
        return this._workspaceClaudiomiroRoot;
    }

    get workspaceClaudiomiroFolder() {
        return this._workspaceTaskExecutorFolder;
    }

    /**
     * Gets the cache folder path
     * @returns {string} Path to cache folder
     */
    get cacheFolder() {
        return path.join(this._taskExecutorFolder, 'cache');
    }

    /**
     * Initializes the cache folder if it doesn't exist
     * Call this after setFolder() when starting a new session
     */
    initializeCache() {
        if (!this._taskExecutorFolder) {
            return;
        }

        if (!fs.existsSync(this._taskExecutorFolder)) {
            fs.mkdirSync(this._taskExecutorFolder, { recursive: true });
        }

        const cacheDir = this.cacheFolder;
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    }

    /**
     * Checks if cache folder exists
     * @returns {boolean} True if cache folder exists
     */
    hasCacheFolder() {
        if (!this._taskExecutorFolder) {
            return false;
        }
        return fs.existsSync(this.cacheFolder);
    }

    /**
     * Configures multi-repository mode
     * @param {string} backendPath - Path to backend repository
     * @param {string} frontendPath - Path to frontend repository
     * @param {Object} gitConfig - Git configuration from git-detector
     * @param {string} gitConfig.mode - 'monorepo' or 'separate'
     * @param {string[]} gitConfig.gitRoots - Array of git root paths
     * @throws {Error} If paths don't exist or aren't git repositories
     */
    setMultiRepo(backendPath, frontendPath, gitConfig) {
        const resolvedBackend = path.resolve(backendPath);
        const resolvedFrontend = path.resolve(frontendPath);

        // Validate paths exist
        if (!fs.existsSync(resolvedBackend)) {
            throw new Error(`Backend path does not exist: ${resolvedBackend}`);
        }
        if (!fs.existsSync(resolvedFrontend)) {
            throw new Error(`Frontend path does not exist: ${resolvedFrontend}`);
        }

        // Validate are git repositories
        if (!findGitRoot(resolvedBackend)) {
            throw new Error(`Backend path is not a git repository: ${resolvedBackend}`);
        }
        if (!findGitRoot(resolvedFrontend)) {
            throw new Error(`Frontend path is not a git repository: ${resolvedFrontend}`);
        }

        this._multiRepoEnabled = true;
        this._repositories.set('backend', resolvedBackend);
        this._repositories.set('frontend', resolvedFrontend);
        this._gitMode = gitConfig.mode;
        this._gitRoots = gitConfig.gitRoots;
        this.setFolder(backendPath);
        this.initializeCache();
    }

    /**
     * Gets repository path for a given scope
     * @param {string} scope - 'backend', 'frontend', 'integration', or other
     * @returns {string} Absolute path to repository
     */
    getRepository(scope) {
        if (!this._multiRepoEnabled) {
            return this._folder;
        }
        if (scope === 'integration') {
            return this._folder;
        }
        const repo = this._repositories.get(scope);
        if (!repo && scope) {
            // Warn about unknown scope to help debug typos like "@scope backnd"
            const logger = require('../utils/logger');
            logger.warning(`Unknown scope "${scope}", using base folder. Valid scopes: backend, frontend, integration`);
        }
        return repo || this._folder;
    }

    /**
     * Checks if multi-repo mode is enabled
     * @returns {boolean} True if multi-repo mode is enabled
     */
    isMultiRepo() {
        return this._multiRepoEnabled;
    }

    /**
     * Gets the git mode
     * @returns {string|null} 'monorepo', 'separate', or null
     */
    getGitMode() {
        return this._gitMode;
    }

    /**
     * Gets the git root paths
     * @returns {string[]} Array of git root paths
     */
    getGitRoots() {
        return this._gitRoots;
    }

    /**
     * Configures legacy systems for reference
     * @param {Object} legacyPaths - { system?: string, backend?: string, frontend?: string }
     * @throws {Error} If any provided path does not exist
     */
    setLegacySystems(legacyPaths) {
        this._legacySystems.clear();

        for (const [type, legacyPath] of Object.entries(legacyPaths)) {
            if (!legacyPath) continue;

            const resolvedPath = path.resolve(legacyPath);
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`Legacy ${type} path does not exist: ${resolvedPath}`);
            }
            this._legacySystems.set(type, resolvedPath);
        }
    }

    /**
     * Checks if any legacy systems are configured
     * @returns {boolean}
     */
    hasLegacySystems() {
        return this._legacySystems.size > 0;
    }

    /**
     * Gets a specific legacy system path
     * @param {string} type - 'system' | 'backend' | 'frontend'
     * @returns {string|null}
     */
    getLegacySystem(type) {
        return this._legacySystems.get(type) || null;
    }

    /**
     * Gets all configured legacy systems
     * @returns {Map<string, string>} Copy of legacy systems Map
     */
    getAllLegacySystems() {
        return new Map(this._legacySystems);
    }

    setExecutorType(type) {
        const allowed = ['claude', 'codex', 'deep-seek', 'glm', 'gemini'];
        if (!allowed.includes(type)) {
            throw new Error(`Invalid executor type: ${type}`);
        }
        this._executorType = type;
    }

    get executorType() {
        return this._executorType;
    }

    _resolveTaskExecutorFolder() {
        const preferredFolder = path.join(this._claudiomiroRoot, 'task-executor');

        if (!fs.existsSync(this._claudiomiroRoot)) {
            return preferredFolder;
        }

        if (fs.existsSync(preferredFolder)) {
            return preferredFolder;
        }

        const legacyEntries = this._collectLegacyTaskExecutorEntries();
        if (legacyEntries.length === 0) {
            return preferredFolder;
        }

        try {
            fs.mkdirSync(preferredFolder, { recursive: true });
            this._migrateLegacyEntries(legacyEntries, preferredFolder);

            const logger = require('../utils/logger');
            logger.info?.('Migrated legacy .claudiomiro session into .claudiomiro/task-executor');
            return preferredFolder;
        } catch (error) {
            const logger = require('../utils/logger');
            logger.warning?.(`Failed to migrate legacy .claudiomiro layout: ${error.message}`);
            return this._claudiomiroRoot;
        }
    }

    _collectLegacyTaskExecutorEntries() {
        try {
            const entries = fs.readdirSync(this._claudiomiroRoot);
            const legacyFiles = new Set([
                'AI_PROMPT.md',
                'INITIAL_PROMPT.md',
                'CLARIFICATION_QUESTIONS.json',
                'CLARIFICATION_ANSWERS.json',
                'CRITICAL_REVIEW_PASSED.md',
                'CRITICAL_REVIEW_OVERVIEW.md',
                'BUGS.md',
                'BRANCH_REVIEW.md',
                'PENDING_CLARIFICATION.flag',
                'done.txt',
                'newbranch.txt',
                'log.txt',
                'multi-repo.json',
            ]);
            const legacyDirectories = new Set([
                'cache',
                'insights',
            ]);

            return entries.filter((entry) => {
                if (entry === 'task-executor') {
                    return false;
                }
                if (/^TASK\d+/.test(entry)) {
                    return true;
                }
                if (legacyFiles.has(entry) || legacyDirectories.has(entry)) {
                    return true;
                }
                return false;
            });
        } catch {
            return [];
        }
    }

    _migrateLegacyEntries(entries, destination) {
        for (const entry of entries) {
            const from = path.join(this._claudiomiroRoot, entry);
            const to = path.join(destination, entry);

            if (!fs.existsSync(from) || fs.existsSync(to)) {
                continue;
            }

            try {
                fs.renameSync(from, to);
                continue;
            } catch (_) {
                // Fall through to copy/remove path-based migration
            }

            try {
                const stats = fs.statSync(from);
                if (stats.isDirectory()) {
                    fs.cpSync(from, to, { recursive: true });
                    fs.rmSync(from, { recursive: true, force: true });
                } else {
                    fs.copyFileSync(from, to);
                    fs.unlinkSync(from);
                }
            } catch {
                // Best effort migration; leave the legacy file in place if copy/remove fails
            }
        }
    }
}

module.exports = new State();
