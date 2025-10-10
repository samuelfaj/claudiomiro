"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = void 0;
const path = __importStar(require("path"));
class State {
    constructor() {
        this._folder = null;
        this._claudiomiroFolder = null;
        this._executorType = 'claude';
    }
    static getInstance() {
        if (!State._instance) {
            State._instance = new State();
        }
        return State._instance;
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
        const allowed = ['claude', 'codex', 'deep-seek', 'gemini'];
        if (!allowed.includes(type)) {
            throw new Error(`Invalid executor type: ${type}`);
        }
        this._executorType = type;
    }
    get executorType() {
        return this._executorType;
    }
}
exports.State = State;
State._instance = null;
exports.default = State.getInstance();
//# sourceMappingURL=state.js.map