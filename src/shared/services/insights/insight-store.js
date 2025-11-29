const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const state = require('../../config/state');
const logger = require('../../utils/logger');

const INSIGHTS_VERSION = '1.0.0';
const INSIGHTS_DIR_NAME = 'insights';

const getGlobalInsightsPath = () => path.join(
    os.homedir(),
    '.claudiomiro',
    INSIGHTS_DIR_NAME,
    'global-insights.json',
);

const getProjectInsightsPath = () => {
    if (!state.claudiomiroFolder) {
        return null;
    }
    return path.join(state.claudiomiroFolder, INSIGHTS_DIR_NAME, 'project-insights.json');
};

const getReflectionsDir = () => {
    if (!state.claudiomiroFolder) {
        return null;
    }
    return path.join(state.claudiomiroFolder, INSIGHTS_DIR_NAME, 'reflections');
};

const ensureDirectory = (dirPath) => {
    if (!dirPath) {
        return;
    }
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const createEmptyInsights = () => ({
    version: INSIGHTS_VERSION,
    lastUpdated: null,
    curatedInsights: {
        patterns: [],
        antiPatterns: [],
        projectSpecific: [],
    },
});

const normalizeStructure = (data = {}) => {
    const base = createEmptyInsights();

    const curated = typeof data.curatedInsights === 'object' && data.curatedInsights
        ? data.curatedInsights
        : {};

    const categories = new Set([
        ...Object.keys(base.curatedInsights),
        ...Object.keys(curated),
    ]);

    const curatedInsights = {};
    for (const category of categories) {
        const list = Array.isArray(curated[category]) ? curated[category] : [];
        curatedInsights[category] = list.map((item) => ({ ...item }));
    }

    return {
        version: INSIGHTS_VERSION,
        lastUpdated: data.lastUpdated || null,
        curatedInsights,
    };
};

const readInsightsFile = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return createEmptyInsights();
    }

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw.trim()) {
            return createEmptyInsights();
        }
        return normalizeStructure(JSON.parse(raw));
    } catch (error) {
        logger.warning(`[insights] Failed to read ${filePath}: ${error.message}`);
        return createEmptyInsights();
    }
};

const writeInsightsFile = (filePath, insights) => {
    if (!filePath) {
        throw new Error('Insights path is not configured');
    }
    ensureDirectory(path.dirname(filePath));

    const payload = normalizeStructure(insights);
    payload.version = INSIGHTS_VERSION;
    payload.lastUpdated = new Date().toISOString();

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
};

const categorizeInsightScope = (insight) => {
    if (!insight || typeof insight !== 'object') {
        return 'project';
    }

    if (insight.scope === 'global' || insight.scope === 'project') {
        return insight.scope;
    }

    const description = (insight.description || insight.insight || '').toLowerCase();

    const globalKeywords = [
        'always',
        'never',
        'best practice',
        'anti-pattern',
        'testing',
        'error handling',
        'security',
        'performance',
        'accessibility',
        'documentation',
    ];

    const projectKeywords = [
        'this project',
        'this codebase',
        'here we',
        'specific',
        'our implementation',
        'custom',
        'in this repo',
        'service-specific',
    ];

    const isGlobal = globalKeywords.some((keyword) => description.includes(keyword));
    const isProject = projectKeywords.some((keyword) => description.includes(keyword));

    if (isGlobal && !isProject) {
        return 'global';
    }
    return 'project';
};

const prepareInsightEntry = (insight, scope) => {
    if (!insight || typeof insight !== 'object') {
        throw new Error('Insight payload must be an object');
    }

    const now = new Date().toISOString();
    const text = insight.insight || insight.description || '';

    return {
        id: insight.id || crypto.randomUUID(),
        insight: text,
        description: insight.description || text,
        learnedFrom: insight.learnedFrom || 'unknown',
        addedAt: insight.addedAt || now,
        usageCount: typeof insight.usageCount === 'number' ? insight.usageCount : 0,
        confidence: typeof insight.confidence === 'number' ? insight.confidence : 0.5,
        category: insight.category || 'projectSpecific',
        actionable: insight.actionable !== undefined ? insight.actionable : true,
        evidence: insight.evidence || null,
        tags: insight.tags || [],
        scope,
        lastUsedAt: insight.lastUsedAt || null,
    };
};

const upsertInsight = (insightsData, entry) => {
    const category = entry.category || 'projectSpecific';
    if (!Array.isArray(insightsData.curatedInsights[category])) {
        insightsData.curatedInsights[category] = [];
    }

    const existingIndex = insightsData.curatedInsights[category]
        .findIndex((item) => item.id === entry.id);

    if (existingIndex >= 0) {
        insightsData.curatedInsights[category][existingIndex] = {
            ...insightsData.curatedInsights[category][existingIndex],
            ...entry,
        };
    } else {
        insightsData.curatedInsights[category].push(entry);
    }
};

const loadGlobalInsights = () => readInsightsFile(getGlobalInsightsPath());

const loadProjectInsights = () => readInsightsFile(getProjectInsightsPath());

const loadAllInsights = () => {
    const globalInsights = loadGlobalInsights();
    const projectInsights = loadProjectInsights();

    const categories = new Set([
        ...Object.keys(globalInsights.curatedInsights),
        ...Object.keys(projectInsights.curatedInsights),
    ]);

    const merged = createEmptyInsights();
    merged.curatedInsights = {};

    for (const category of categories) {
        merged.curatedInsights[category] = [
            ...(globalInsights.curatedInsights[category] || []).map((item) => ({
                ...item,
                scope: item.scope || 'global',
            })),
            ...(projectInsights.curatedInsights[category] || []).map((item) => ({
                ...item,
                scope: item.scope || 'project',
            })),
        ];
    }

    merged.lastUpdated = projectInsights.lastUpdated || globalInsights.lastUpdated || null;
    return merged;
};

const addGlobalInsight = (insight) => {
    const prepared = prepareInsightEntry(insight, 'global');
    const insightsData = loadGlobalInsights();
    upsertInsight(insightsData, prepared);
    writeInsightsFile(getGlobalInsightsPath(), insightsData);
    return prepared;
};

const addProjectInsight = (insight) => {
    const prepared = prepareInsightEntry(insight, 'project');
    const insightsData = loadProjectInsights();
    upsertInsight(insightsData, prepared);
    writeInsightsFile(getProjectInsightsPath(), insightsData);
    return prepared;
};

const addCuratedInsight = (insight) => {
    const scope = categorizeInsightScope(insight);
    return scope === 'global'
        ? addGlobalInsight(insight)
        : addProjectInsight(insight);
};

const flattenInsights = (insightsData) => {
    const flattened = [];
    const curated = insightsData.curatedInsights || {};

    for (const [category, items] of Object.entries(curated)) {
        if (!Array.isArray(items)) {
            continue;
        }
        for (const item of items) {
            flattened.push({
                ...item,
                category,
                scope: item.scope || 'project',
            });
        }
    }

    return flattened;
};

const computeRelevanceScore = (insight, taskDescription) => {
    let score = 0;
    const description = (taskDescription || '').toLowerCase();
    const insightText = (insight.insight || '').toLowerCase();

    if (insight.confidence) {
        score += insight.confidence * 2;
    }
    if (insight.usageCount) {
        score += Math.min(insight.usageCount, 5) * 0.3;
    }
    if (insight.scope === 'project') {
        score += 0.5;
    }
    if (insight.category === 'projectSpecific') {
        score += 0.5;
    }

    if (description && insightText) {
        const words = new Set(insightText.split(/\W+/).filter((word) => word.length > 3));
        for (const word of words) {
            if (description.includes(word)) {
                score += 1.2;
            }
        }
    }

    return score;
};

const getCuratedInsightsForTask = (taskDescription, options = {}) => {
    const {
        maxInsights = 5,
        minConfidence = 0,
    } = options;

    const allInsights = flattenInsights(loadAllInsights());

    const relevant = allInsights
        .filter((insight) => (insight.confidence || 0) >= minConfidence)
        .map((insight) => ({
            ...insight,
            score: computeRelevanceScore(insight, taskDescription),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxInsights);

    return relevant;
};

const updateUsageInData = (insightsData, insightId) => {
    const curated = insightsData.curatedInsights || {};
    for (const items of Object.values(curated)) {
        if (!Array.isArray(items)) {
            continue;
        }
        const match = items.find((item) => item.id === insightId);
        if (match) {
            match.usageCount = (match.usageCount || 0) + 1;
            match.lastUsedAt = new Date().toISOString();
            return match;
        }
    }
    return null;
};

const incrementInsightUsage = (insightId, scope) => {
    const targets = [];

    if (scope === 'global') {
        targets.push(getGlobalInsightsPath());
    } else if (scope === 'project') {
        targets.push(getProjectInsightsPath());
    } else {
        targets.push(getGlobalInsightsPath(), getProjectInsightsPath());
    }

    let updatedInsight = null;

    for (const filePath of targets) {
        if (!filePath) {
            continue;
        }
        const insightsData = readInsightsFile(filePath);
        const match = updateUsageInData(insightsData, insightId);
        if (match) {
            writeInsightsFile(filePath, insightsData);
            updatedInsight = updatedInsight || match;
        }
    }

    return updatedInsight;
};

const sanitizeTaskId = (task) => task.replace(/[^\w.-]/g, '_');

const addReflection = (task, reflection) => {
    if (!task) {
        throw new Error('Task identifier is required');
    }

    const reflectionsDir = getReflectionsDir();
    if (!reflectionsDir) {
        throw new Error('claudiomiro folder is not initialized');
    }

    ensureDirectory(reflectionsDir);

    const filePath = path.join(reflectionsDir, `${sanitizeTaskId(task)}.json`);
    let payload = {
        task,
        iterations: [],
        lastReflection: null,
    };

    if (fs.existsSync(filePath)) {
        try {
            payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!Array.isArray(payload.iterations)) {
                payload.iterations = [];
            }
        } catch (error) {
            logger.warning(`[insights] Failed to parse reflection for ${task}: ${error.message}`);
            payload = {
                task,
                iterations: [],
                lastReflection: null,
            };
        }
    }

    const timestamp = (reflection && reflection.timestamp) || new Date().toISOString();
    payload.iterations.push({
        ...(reflection || {}),
        timestamp,
    });
    payload.task = task;
    payload.lastReflection = timestamp;

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
};

const getTaskReflection = (task) => {
    if (!task) {
        return null;
    }
    const reflectionsDir = getReflectionsDir();
    if (!reflectionsDir) {
        return null;
    }
    const filePath = path.join(reflectionsDir, `${sanitizeTaskId(task)}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        logger.warning(`[insights] Failed to load reflection ${filePath}: ${error.message}`);
        return null;
    }
};

module.exports = {
    loadAllInsights,
    loadGlobalInsights,
    loadProjectInsights,
    addCuratedInsight,
    addGlobalInsight,
    addProjectInsight,
    getCuratedInsightsForTask,
    incrementInsightUsage,
    addReflection,
    getTaskReflection,
    categorizeInsightScope,
};
