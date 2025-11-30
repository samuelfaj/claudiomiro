const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const insightsStore = require('../../../../shared/services/insights');
const {
    deduplicateInsights,
    categorizeInsight,
    extractInsights,
} = require('../../../../shared/services/reflection');

const readIfExists = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return '';
    }
    return fs.readFileSync(filePath, 'utf8');
};

const extractImplementationPatterns = (content = '') => {
    if (!content) {
        return [];
    }

    const keywords = ['pattern', 'best practice', 'avoid', 'ensure', 'always', 'never', 'test', 'mock', 'validate'];
    const lines = content.split(/\r?\n/);
    let currentSection = null;
    const results = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (/^##\s+/.test(trimmed)) {
            currentSection = trimmed.replace(/^#+\s*/, '');
            continue;
        }

        if (/^[-*]\s+/.test(trimmed)) {
            const body = trimmed.replace(/^[-*]\s+/, '').trim();
            const lower = body.toLowerCase();
            if (keywords.some((keyword) => lower.includes(keyword))) {
                results.push({
                    insight: body,
                    description: body,
                    confidence: lower.includes('must') || lower.includes('always') ? 0.85 : 0.7,
                    actionable: lower.includes('should') || lower.includes('ensure') || lower.includes('must') || lower.includes('avoid'),
                    evidence: currentSection || 'Implementation plan',
                });
            }
        }
    }

    return results;
};

const categorizeInsights = (insights = []) => {
    return insights.reduce((accumulator, insight) => {
        const category = insight.category || categorizeInsight(insight);
        const entry = { ...insight, category };
        if (!accumulator[category]) {
            accumulator[category] = [];
        }
        accumulator[category].push(entry);
        return accumulator;
    }, {});
};

const resolvePaths = (task, overrides = {}) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    return {
        todoPath: overrides.todoPath || folder('TODO.md'),
        contextPath: overrides.contextPath || folder('CONTEXT.md'),
        codeReviewPath: overrides.codeReviewPath || folder('CODE_REVIEW.md'),
        reflectionPath: overrides.reflectionPath || folder('REFLECTION.md'),
    };
};

const curateInsights = async (task, options = {}) => {
    const paths = resolvePaths(task, options);
    const candidates = [];

    // Load reflection insights if available (JSON cache)
    const reflectionData = insightsStore.getTaskReflection(task);
    if (reflectionData && Array.isArray(reflectionData.iterations) && reflectionData.iterations.length > 0) {
        const latestIteration = reflectionData.iterations[reflectionData.iterations.length - 1];
        if (latestIteration && Array.isArray(latestIteration.insights)) {
            candidates.push(...latestIteration.insights);
        }
    }

    // Parse raw reflection markdown for additional insights
    const reflectionContent = readIfExists(paths.reflectionPath);
    if (reflectionContent) {
        candidates.push(...extractInsights(reflectionContent));
    }

    // Extract implementation patterns from TODO/context documents
    const todoContent = readIfExists(paths.todoPath);
    candidates.push(...extractImplementationPatterns(todoContent));

    const contextContent = readIfExists(paths.contextPath);
    candidates.push(...extractImplementationPatterns(contextContent));

    const codeReviewContent = readIfExists(paths.codeReviewPath);
    candidates.push(...extractImplementationPatterns(codeReviewContent));

    const deduped = deduplicateInsights(candidates.filter(Boolean));
    const categorized = categorizeInsights(deduped);

    Object.values(categorized).forEach((group) => {
        group.forEach((insight) => {
            insightsStore.addCuratedInsight({
                ...insight,
                learnedFrom: task,
            });
        });
    });

    return categorized;
};

module.exports = {
    curateInsights,
    extractImplementationPatterns,
    categorizeInsights,
};
