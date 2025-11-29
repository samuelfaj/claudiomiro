const path = require('path');
const fs = require('fs');

class State {
    constructor() {
        this._folder = null;
        this._claudiomiroFolder = null;
        this._executorType = 'claude';
        this._multiRepoEnabled = false;
        this._repositories = new Map();
        this._gitMode = null;
        this._gitRoots = [];
    }

    setFolder(folderPath) {
        this._folder = path.resolve(folderPath);
        this._claudiomiroFolder = path.join(this._folder, '.claudiomiro');
    }

    get folder() {
        return this._folder;
    }

    get claudiomiroFolder() {
        return this._claudiomiroFolder;
    }

    /**
     * Gets the cache folder path
     * @returns {string} Path to cache folder
     */
    get cacheFolder() {
        return path.join(this._claudiomiroFolder, 'cache');
    }

    /**
     * Initializes the cache folder if it doesn't exist
     * Call this after setFolder() when starting a new session
     */
    initializeCache() {
        if (!this._claudiomiroFolder) {
            return;
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
     */
    setMultiRepo(backendPath, frontendPath, gitConfig) {
        this._multiRepoEnabled = true;
        this._repositories.set('backend', path.resolve(backendPath));
        this._repositories.set('frontend', path.resolve(frontendPath));
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
        return this._repositories.get(scope) || this._folder;
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
