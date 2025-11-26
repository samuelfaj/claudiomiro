const { executeClaude } = require('./claude-executor');
const { executeCodex } = require('./codex-executor');
const { executeGemini } = require('./gemini-executor');
const { executeDeepSeek } = require('./deep-seek-executor');
const { executeGlm } = require('./glm-executor');

const getExecutor = (type) => {
    const executors = {
        'claude': executeClaude,
        'codex': executeCodex,
        'gemini': executeGemini,
        'deep-seek': executeDeepSeek,
        'glm': executeGlm
    };

    const executor = executors[type];
    if (!executor) {
        throw new Error(`Unknown executor type: ${type}`);
    }
    return executor;
};

module.exports = {
    getExecutor,
    executeClaude,
    executeCodex,
    executeGemini,
    executeDeepSeek,
    executeGlm
};
