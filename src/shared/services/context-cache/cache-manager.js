const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Cache Manager for persistent context caching
 * Reduces token consumption by caching AI_PROMPT summaries and task context
 */

const CACHE_VERSION = '1.0.0';
const CACHE_FILE_NAME = 'context-cache.json';

/**
 * Computes MD5 hash of file content for change detection
 * @param {string} filePath - Path to file
 * @returns {string|null} Hash string or null if file doesn't exist
 */
const computeFileHash = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('md5').update(content).digest('hex');
};

/**
 * Gets the cache file path for the current project
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {string} Path to cache file
 */
const getCachePath = (claudiomiroFolder) => {
  const cacheDir = path.join(claudiomiroFolder, 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return path.join(cacheDir, CACHE_FILE_NAME);
};

/**
 * Loads cache from disk
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {object} Cache object or empty cache structure
 */
const loadCache = (claudiomiroFolder) => {
  const cachePath = getCachePath(claudiomiroFolder);

  if (!fs.existsSync(cachePath)) {
    return createEmptyCache();
  }

  try {
    const cacheContent = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(cacheContent);

    // Validate cache version
    if (cache.version !== CACHE_VERSION) {
      return createEmptyCache();
    }

    return cache;
  } catch (error) {
    return createEmptyCache();
  }
};

/**
 * Saves cache to disk
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {object} cache - Cache object to save
 */
const saveCache = (claudiomiroFolder, cache) => {
  const cachePath = getCachePath(claudiomiroFolder);
  cache.lastUpdated = new Date().toISOString();
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
};

/**
 * Creates an empty cache structure
 * @returns {object} Empty cache
 */
const createEmptyCache = () => ({
  version: CACHE_VERSION,
  created: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  aiPrompt: {
    hash: null,
    summary: null,
    lastProcessed: null
  },
  completedTasks: {},
  researchIndex: {},
  lastProcessedTask: null,
  codebasePatterns: {}
});

/**
 * Checks if AI_PROMPT.md has changed since last cache
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {object} cache - Current cache
 * @returns {boolean} True if changed or not cached
 */
const hasAiPromptChanged = (claudiomiroFolder, cache) => {
  const aiPromptPath = path.join(claudiomiroFolder, 'AI_PROMPT.md');
  const currentHash = computeFileHash(aiPromptPath);
  return currentHash !== cache.aiPrompt.hash;
};

/**
 * Updates AI_PROMPT cache with summary
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {object} cache - Cache object
 * @param {string} summary - Condensed summary of AI_PROMPT.md
 */
const updateAiPromptCache = (claudiomiroFolder, cache, summary) => {
  const aiPromptPath = path.join(claudiomiroFolder, 'AI_PROMPT.md');
  cache.aiPrompt = {
    hash: computeFileHash(aiPromptPath),
    summary: summary,
    lastProcessed: new Date().toISOString()
  };
  saveCache(claudiomiroFolder, cache);
};

/**
 * Gets cached AI_PROMPT summary or null if stale
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {string|null} Cached summary or null
 */
const getCachedAiPromptSummary = (claudiomiroFolder) => {
  const cache = loadCache(claudiomiroFolder);

  if (!cache.aiPrompt.summary) {
    return null;
  }

  if (hasAiPromptChanged(claudiomiroFolder, cache)) {
    return null;
  }

  return cache.aiPrompt.summary;
};

/**
 * Adds a completed task to the cache
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} taskId - Task identifier (e.g., 'TASK1')
 * @param {object} taskSummary - Summary of completed task
 */
const addCompletedTask = (claudiomiroFolder, taskId, taskSummary) => {
  const cache = loadCache(claudiomiroFolder);
  cache.completedTasks[taskId] = {
    ...taskSummary,
    addedAt: new Date().toISOString()
  };
  cache.lastProcessedTask = taskId;
  saveCache(claudiomiroFolder, cache);
};

/**
 * Gets completed tasks added after a specific task
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string|null} afterTask - Task ID to start from (exclusive), null for all
 * @returns {object} Object with new completed tasks
 */
const getNewCompletedTasks = (claudiomiroFolder, afterTask = null) => {
  const cache = loadCache(claudiomiroFolder);

  if (!afterTask) {
    return cache.completedTasks;
  }

  const tasks = cache.completedTasks;
  const afterTaskEntry = tasks[afterTask];

  if (!afterTaskEntry) {
    return tasks;
  }

  const afterTime = new Date(afterTaskEntry.addedAt).getTime();
  const newTasks = {};

  for (const [taskId, taskData] of Object.entries(tasks)) {
    const taskTime = new Date(taskData.addedAt).getTime();
    if (taskTime > afterTime) {
      newTasks[taskId] = taskData;
    }
  }

  return newTasks;
};

/**
 * Gets the last processed task ID
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {string|null} Last processed task ID
 */
const getLastProcessedTask = (claudiomiroFolder) => {
  const cache = loadCache(claudiomiroFolder);
  return cache.lastProcessedTask;
};

/**
 * Clears the cache
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 */
const clearCache = (claudiomiroFolder) => {
  const cachePath = getCachePath(claudiomiroFolder);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
};

/**
 * Gets all completed task summaries
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {object} All completed tasks
 */
const getAllCompletedTasks = (claudiomiroFolder) => {
  const cache = loadCache(claudiomiroFolder);
  return cache.completedTasks;
};

/**
 * Stores codebase patterns detected during analysis
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {object} patterns - Detected patterns
 */
const storeCodebasePatterns = (claudiomiroFolder, patterns) => {
  const cache = loadCache(claudiomiroFolder);
  cache.codebasePatterns = {
    ...cache.codebasePatterns,
    ...patterns,
    lastUpdated: new Date().toISOString()
  };
  saveCache(claudiomiroFolder, cache);
};

/**
 * Gets stored codebase patterns
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {object} Codebase patterns
 */
const getCodebasePatterns = (claudiomiroFolder) => {
  const cache = loadCache(claudiomiroFolder);
  return cache.codebasePatterns;
};

module.exports = {
  loadCache,
  saveCache,
  createEmptyCache,
  computeFileHash,
  getCachePath,
  hasAiPromptChanged,
  updateAiPromptCache,
  getCachedAiPromptSummary,
  addCompletedTask,
  getNewCompletedTasks,
  getLastProcessedTask,
  clearCache,
  getAllCompletedTasks,
  storeCodebasePatterns,
  getCodebasePatterns,
  CACHE_VERSION
};
