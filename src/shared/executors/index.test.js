// Mock all executor modules BEFORE requiring the module
const mockExecuteClaude = jest.fn();
const mockExecuteCodex = jest.fn();
const mockExecuteGemini = jest.fn();
const mockExecuteDeepSeek = jest.fn();
const mockExecuteGlm = jest.fn();

jest.mock('./claude-executor', () => ({
    executeClaude: mockExecuteClaude,
}));

jest.mock('./codex-executor', () => ({
    executeCodex: mockExecuteCodex,
}));

jest.mock('./gemini-executor', () => ({
    executeGemini: mockExecuteGemini,
}));

jest.mock('./deep-seek-executor', () => ({
    executeDeepSeek: mockExecuteDeepSeek,
}));

jest.mock('./glm-executor', () => ({
    executeGlm: mockExecuteGlm,
}));

const {
    getExecutor,
    executeClaude,
    executeCodex,
    executeGemini,
    executeDeepSeek,
    executeGlm,
} = require('./index');

describe('src/shared/executors/index.js', () => {
    describe('getExecutor()', () => {
        test('should return executeClaude for type "claude"', () => {
            const executor = getExecutor('claude');
            expect(executor).toBe(mockExecuteClaude);
        });

        test('should return executeCodex for type "codex"', () => {
            const executor = getExecutor('codex');
            expect(executor).toBe(mockExecuteCodex);
        });

        test('should return executeGemini for type "gemini"', () => {
            const executor = getExecutor('gemini');
            expect(executor).toBe(mockExecuteGemini);
        });

        test('should return executeDeepSeek for type "deep-seek"', () => {
            const executor = getExecutor('deep-seek');
            expect(executor).toBe(mockExecuteDeepSeek);
        });

        test('should return executeGlm for type "glm"', () => {
            const executor = getExecutor('glm');
            expect(executor).toBe(mockExecuteGlm);
        });

        test('should throw error for unknown executor type', () => {
            expect(() => getExecutor('unknown')).toThrow('Unknown executor type: unknown');
        });

        test('should throw error with specific type name', () => {
            expect(() => getExecutor('invalid-type')).toThrow('Unknown executor type: invalid-type');
        });

        test('should throw error for empty string', () => {
            expect(() => getExecutor('')).toThrow('Unknown executor type: ');
        });

        test('should throw error for undefined', () => {
            expect(() => getExecutor(undefined)).toThrow('Unknown executor type: undefined');
        });

        test('should throw error for null', () => {
            expect(() => getExecutor(null)).toThrow('Unknown executor type: null');
        });
    });

    describe('direct exports', () => {
        test('should export executeClaude directly', () => {
            expect(executeClaude).toBe(mockExecuteClaude);
        });

        test('should export executeCodex directly', () => {
            expect(executeCodex).toBe(mockExecuteCodex);
        });

        test('should export executeGemini directly', () => {
            expect(executeGemini).toBe(mockExecuteGemini);
        });

        test('should export executeDeepSeek directly', () => {
            expect(executeDeepSeek).toBe(mockExecuteDeepSeek);
        });

        test('should export executeGlm directly', () => {
            expect(executeGlm).toBe(mockExecuteGlm);
        });
    });

    describe('exports', () => {
        test('should export getExecutor function', () => {
            expect(getExecutor).toBeDefined();
            expect(typeof getExecutor).toBe('function');
        });

        test('should export all executor functions', () => {
            const exports = require('./index');
            expect(exports).toHaveProperty('getExecutor');
            expect(exports).toHaveProperty('executeClaude');
            expect(exports).toHaveProperty('executeCodex');
            expect(exports).toHaveProperty('executeGemini');
            expect(exports).toHaveProperty('executeDeepSeek');
            expect(exports).toHaveProperty('executeGlm');
        });
    });
});
