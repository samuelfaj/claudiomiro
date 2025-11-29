const path = require('path');
const fs = require('fs');
const { findGitRoot } = require('../services/git-detector');

class State {
    constructor() {
        this._folder = null;
        this._claudiomiroRoot = null;
        this._taskExecutorFolder = null;
        this._executorType = 'claude';
        this._multiRepoEnabled = false;
        this._repositories = new Map();
        this._gitMode = null;
        this._gitRoots = [];
    }

    setFolder(folderPath) {
        this._folder = path.resolve(folderPath);
        this._claudiomiroRoot = path.join(this._folder, '.claudiomiro');
        this._taskExecutorFolder = path.join(this._claudiomiroRoot, 'task-executor');
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

        if (!fs.existsSync(this._claudiomiroRoot)) {
            fs.mkdirSync(this._claudiomiroRoot, { recursive: true });
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
}

module.exports = new State();
