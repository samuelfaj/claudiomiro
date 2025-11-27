const path = require('path');

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
