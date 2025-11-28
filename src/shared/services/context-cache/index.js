/**
 * Context Cache Service
 *
 * Provides token-efficient context management by:
 * - Caching AI_PROMPT.md summaries
 * - Tracking completed tasks incrementally
 * - Building consolidated context instead of reading all files
 * - Code index integration for smart symbol discovery
 *
 * Usage:
 *   const { buildConsolidatedContext, buildConsolidatedContextAsync, markTaskCompleted } = require('./context-cache');
 *
 *   // Get consolidated context for a task (sync)
 *   const context = buildConsolidatedContext(claudiomiroFolder, 'TASK1');
 *
 *   // Get consolidated context with code symbols (async)
 *   const contextWithSymbols = await buildConsolidatedContextAsync(
 *     claudiomiroFolder, 'TASK1', projectFolder, 'authentication login'
 *   );
 *
 *   // Mark task as completed after execution
 *   markTaskCompleted(claudiomiroFolder, 'TASK1');
 */

const {
    loadCache,
    saveCache,
    clearCache,
    getCachedAiPromptSummary,
    updateAiPromptCache,
    addCompletedTask,
    getNewCompletedTasks,
    getLastProcessedTask,
    getAllCompletedTasks,
    storeCodebasePatterns,
    getCodebasePatterns,
    hasAiPromptChanged,
    CACHE_VERSION,
} = require('./cache-manager');

const {
    getIncrementalContext,
    buildConsolidatedContext,
    buildConsolidatedContextAsync,
    buildOptimizedContextAsync,
    markTaskCompleted,
    getContextFilePaths,
    isTaskCompleted,
    getTaskFolders,
    createAiPromptSummary,
    extractCodebasePatterns,
    getRelevantSymbols,
    getFileSummary,
    // Async LLM-enhanced versions
    extractContextSummaryAsync,
    extractResearchPatternsAsync,
} = require('./context-collector');

module.exports = {
    // Cache management
    loadCache,
    saveCache,
    clearCache,
    CACHE_VERSION,

    // AI_PROMPT caching
    getCachedAiPromptSummary,
    updateAiPromptCache,
    hasAiPromptChanged,
    createAiPromptSummary,

    // Task tracking
    addCompletedTask,
    getNewCompletedTasks,
    getLastProcessedTask,
    getAllCompletedTasks,
    markTaskCompleted,
    isTaskCompleted,
    getTaskFolders,

    // Codebase patterns
    storeCodebasePatterns,
    getCodebasePatterns,

    // Context collection
    getIncrementalContext,
    buildConsolidatedContext,
    buildConsolidatedContextAsync,
    buildOptimizedContextAsync,
    getContextFilePaths,
    extractCodebasePatterns,

    // LLM-enhanced extraction (async, with fallback)
    extractContextSummaryAsync,
    extractResearchPatternsAsync,

    // Code index integration (uses semantic search with Ollama)
    getRelevantSymbols,
    getFileSummary,
};
