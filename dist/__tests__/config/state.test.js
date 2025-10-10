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
const path = __importStar(require("path"));
// Import the State class for testing
const state_1 = require("../../config/state");
describe('State', () => {
    beforeEach(() => {
        // Reset the singleton instance for each test
        // @ts-ignore - accessing private property for testing
        state_1.State._instance = null;
    });
    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = state_1.State.getInstance();
            const instance2 = state_1.State.getInstance();
            expect(instance1).toBe(instance2);
        });
        it('should create new instance when previous is reset', () => {
            const instance1 = state_1.State.getInstance();
            // @ts-ignore - accessing private property for testing
            state_1.State._instance = null;
            const instance2 = state_1.State.getInstance();
            expect(instance1).not.toBe(instance2);
        });
    });
    describe('Folder Management', () => {
        it('should set and get folder correctly', () => {
            const state = state_1.State.getInstance();
            const testFolder = '/test/folder';
            state.setFolder(testFolder);
            expect(state.folder).toBe(path.resolve(testFolder));
            expect(state.claudiomiroFolder).toBe(path.join(path.resolve(testFolder), '.claudiomiro'));
        });
        it('should handle null folder initially', () => {
            const state = state_1.State.getInstance();
            expect(state.folder).toBeNull();
            expect(state.claudiomiroFolder).toBeNull();
        });
    });
    describe('Executor Type Management', () => {
        it('should set and get executor type correctly', () => {
            const state = state_1.State.getInstance();
            state.setExecutorType('codex');
            expect(state.executorType).toBe('codex');
            state.setExecutorType('gemini');
            expect(state.executorType).toBe('gemini');
        });
        it('should default to claude executor type', () => {
            const state = state_1.State.getInstance();
            expect(state.executorType).toBe('claude');
        });
        it('should throw error for invalid executor type', () => {
            const state = state_1.State.getInstance();
            expect(() => {
                state.setExecutorType('invalid');
            }).toThrow('Invalid executor type: invalid');
        });
        it('should accept all valid executor types', () => {
            const state = state_1.State.getInstance();
            const validTypes = ['claude', 'codex', 'deep-seek', 'gemini'];
            validTypes.forEach(type => {
                expect(() => {
                    state.setExecutorType(type);
                }).not.toThrow();
                expect(state.executorType).toBe(type);
            });
        });
    });
    describe('Type Safety', () => {
        it('should have correct TypeScript types', () => {
            const state = state_1.State.getInstance();
            // Test folder properties (initially null)
            expect(state.folder).toBeNull();
            expect(state.claudiomiroFolder).toBeNull();
            // Test executor type
            expect(typeof state.executorType).toBe('string');
            // Test methods exist
            expect(typeof state.setFolder).toBe('function');
            expect(typeof state.setExecutorType).toBe('function');
        });
        it('should maintain type safety with path resolution', () => {
            const state = state_1.State.getInstance();
            const relativePath = './test';
            state.setFolder(relativePath);
            expect(state.folder).toBe(path.resolve(relativePath));
            expect(state.claudiomiroFolder).toBe(path.join(path.resolve(relativePath), '.claudiomiro'));
        });
    });
});
//# sourceMappingURL=state.test.js.map