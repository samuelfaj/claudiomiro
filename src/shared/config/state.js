const path = require('path');
const fs = require('fs');

class State {
    constructor() {
        this._folder = null;
        this._claudiomiroFolder = null;
        this._executorType = 'claude';
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
