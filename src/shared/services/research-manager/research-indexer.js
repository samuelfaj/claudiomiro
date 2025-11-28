const fs = require('fs');
const path = require('path');

// Local LLM service for enhanced topic classification
let localLLMService = null;
const getLocalLLM = () => {
    if (!localLLMService) {
        try {
            const { getLocalLLMService } = require('../local-llm');
            localLLMService = getLocalLLMService();
        } catch (error) {
            localLLMService = null;
        }
    }
    return localLLMService;
};

/**
 * Research Indexer - Indexes and matches research files for reuse
 * Reduces token consumption by reusing similar research across tasks
 */

const RESEARCH_INDEX_FILE = 'research-index.json';

/**
 * Gets path to research index file
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {string} Path to index file
 */
const getIndexPath = (claudiomiroFolder) => {
    const cacheDir = path.join(claudiomiroFolder, 'cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    return path.join(cacheDir, RESEARCH_INDEX_FILE);
};

/**
 * Loads research index from disk
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {object} Research index
 */
const loadResearchIndex = (claudiomiroFolder) => {
    const indexPath = getIndexPath(claudiomiroFolder);

    if (!fs.existsSync(indexPath)) {
        return createEmptyIndex();
    }

    try {
        const content = fs.readFileSync(indexPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        return createEmptyIndex();
    }
};

/**
 * Saves research index to disk
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {object} index - Index to save
 */
const saveResearchIndex = (claudiomiroFolder, index) => {
    const indexPath = getIndexPath(claudiomiroFolder);
    index.lastUpdated = new Date().toISOString();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
};

/**
 * Creates empty research index
 * @returns {object} Empty index
 */
const createEmptyIndex = () => ({
    version: '1.0.0',
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    patterns: {},
    taskResearch: {},
});

/**
 * Extracts topics/patterns from task content using Local LLM or fallback heuristics
 * @param {string} taskContent - Content of TASK.md or TODO.md
 * @returns {Promise<string[]>} Array of detected topics
 */
const extractTopicsAsync = async (taskContent) => {
    const llm = getLocalLLM();

    if (llm) {
        try {
            await llm.initialize();
            if (llm.isAvailable()) {
                const topics = await llm.classifyTopics(taskContent);
                if (topics && topics.length > 0) {
                    return topics;
                }
            }
        } catch (error) {
            // Fall through to heuristic
        }
    }

    // Fallback to heuristic extraction
    return extractTopicsHeuristic(taskContent);
};

/**
 * Extracts topics/patterns from task content (sync version - heuristic only)
 * @param {string} taskContent - Content of TASK.md or TODO.md
 * @returns {string[]} Array of detected topics
 */
const extractTopics = (taskContent) => {
    return extractTopicsHeuristic(taskContent);
};

/**
 * Heuristic topic extraction (keyword-based)
 * @param {string} taskContent - Content of TASK.md or TODO.md
 * @returns {string[]} Array of detected topics
 */
const extractTopicsHeuristic = (taskContent) => {
    const content = taskContent.toLowerCase();
    const topics = [];

    // Common development topics
    const topicKeywords = {
        'authentication': ['authentication', 'auth', 'login', 'logout', 'session', 'jwt', 'token', 'password'],
        'api': ['api', 'endpoint', 'route', 'rest', 'graphql', 'request', 'response'],
        'database': ['database', 'db', 'sql', 'query', 'model', 'schema', 'migration', 'orm'],
        'testing': ['test', 'testing', 'spec', 'unit test', 'integration', 'mock', 'jest', 'mocha'],
        'config': ['config', 'configuration', 'env', 'environment', 'settings', 'options'],
        'middleware': ['middleware', 'interceptor', 'filter', 'guard'],
        'service': ['service', 'business logic', 'domain'],
        'controller': ['controller', 'handler', 'action'],
        'component': ['component', 'ui', 'frontend', 'view', 'template'],
        'validation': ['validation', 'validate', 'validator', 'schema'],
        'error': ['error', 'exception', 'handling', 'catch'],
        'logging': ['log', 'logging', 'logger', 'debug', 'trace'],
        'cache': ['cache', 'caching', 'redis', 'memcached'],
        'queue': ['queue', 'job', 'worker', 'background'],
        'file': ['file', 'upload', 'download', 'storage', 'fs'],
        'security': ['security', 'xss', 'csrf', 'injection', 'sanitize'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        for (const keyword of keywords) {
            if (content.includes(keyword)) {
                topics.push(topic);
                break;
            }
        }
    }

    return [...new Set(topics)]; // Remove duplicates
};

/**
 * Calculates similarity score between two topic arrays
 * @param {string[]} topics1 - First topic array
 * @param {string[]} topics2 - Second topic array
 * @returns {number} Similarity score (0-1)
 */
const calculateSimilarity = (topics1, topics2) => {
    if (topics1.length === 0 || topics2.length === 0) {
        return 0;
    }

    const set1 = new Set(topics1);
    const set2 = new Set(topics2);

    const intersection = [...set1].filter(t => set2.has(t));
    const union = new Set([...set1, ...set2]);

    return intersection.length / union.size;
};

/**
 * Indexes a task's research for future reuse
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} taskId - Task identifier
 * @param {string} taskContent - Content of TASK.md
 * @param {string} researchContent - Content of RESEARCH.md
 */
const indexResearch = (claudiomiroFolder, taskId, taskContent, researchContent) => {
    const index = loadResearchIndex(claudiomiroFolder);
    const topics = extractTopics(taskContent + ' ' + researchContent);

    // Add to task research
    index.taskResearch[taskId] = {
        topics,
        researchPath: path.join(claudiomiroFolder, taskId, 'RESEARCH.md'),
        indexedAt: new Date().toISOString(),
    };

    // Update pattern index
    for (const topic of topics) {
        if (!index.patterns[topic]) {
            index.patterns[topic] = [];
        }
        if (!index.patterns[topic].includes(taskId)) {
            index.patterns[topic].push(taskId);
        }
    }

    saveResearchIndex(claudiomiroFolder, index);
};

/**
 * Finds similar research for a new task
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} taskContent - Content of new task's TASK.md
 * @param {number} minSimilarity - Minimum similarity threshold (0-1), default 0.5
 * @returns {object|null} Similar research info or null
 */
const findSimilarResearch = (claudiomiroFolder, taskContent, minSimilarity = 0.5) => {
    const index = loadResearchIndex(claudiomiroFolder);
    const newTopics = extractTopics(taskContent);

    if (newTopics.length === 0) {
        return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [taskId, taskData] of Object.entries(index.taskResearch)) {
        const similarity = calculateSimilarity(newTopics, taskData.topics);

        if (similarity > bestScore && similarity >= minSimilarity) {
            // Verify research file still exists
            if (fs.existsSync(taskData.researchPath)) {
                bestScore = similarity;
                bestMatch = {
                    taskId,
                    researchPath: taskData.researchPath,
                    similarity,
                    topics: taskData.topics,
                    matchingTopics: newTopics.filter(t => taskData.topics.includes(t)),
                };
            }
        }
    }

    return bestMatch;
};

/**
 * Gets research content for reuse, with adaptation note
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} taskContent - Content of new task
 * @returns {object|null} Object with research content and metadata
 */
const getReusableResearch = (claudiomiroFolder, taskContent) => {
    const similar = findSimilarResearch(claudiomiroFolder, taskContent);

    if (!similar) {
        return null;
    }

    // Only reuse if similar (70%+) - lowered from 80% for better token savings
    if (similar.similarity < 0.7) {
        return null;
    }

    const researchContent = fs.readFileSync(similar.researchPath, 'utf8');

    return {
        content: researchContent,
        sourceTask: similar.taskId,
        similarity: similar.similarity,
        matchingTopics: similar.matchingTopics,
        adaptationNote: `This research was adapted from ${similar.taskId} (${Math.round(similar.similarity * 100)}% similar). Matching topics: ${similar.matchingTopics.join(', ')}.`,
    };
};

/**
 * Clears the research index
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 */
const clearResearchIndex = (claudiomiroFolder) => {
    const indexPath = getIndexPath(claudiomiroFolder);
    if (fs.existsSync(indexPath)) {
        fs.unlinkSync(indexPath);
    }
};

module.exports = {
    loadResearchIndex,
    saveResearchIndex,
    createEmptyIndex,
    extractTopics,
    extractTopicsAsync,
    extractTopicsHeuristic,
    calculateSimilarity,
    indexResearch,
    findSimilarResearch,
    getReusableResearch,
    clearResearchIndex,
    getIndexPath,
};
