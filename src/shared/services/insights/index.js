const insightStore = require('./insight-store');

module.exports = {
    loadAllInsights: insightStore.loadAllInsights,
    loadGlobalInsights: insightStore.loadGlobalInsights,
    loadProjectInsights: insightStore.loadProjectInsights,
    addCuratedInsight: insightStore.addCuratedInsight,
    addGlobalInsight: insightStore.addGlobalInsight,
    addProjectInsight: insightStore.addProjectInsight,
    getCuratedInsightsForTask: insightStore.getCuratedInsightsForTask,
    incrementInsightUsage: insightStore.incrementInsightUsage,
    addReflection: insightStore.addReflection,
    getTaskReflection: insightStore.getTaskReflection,
    categorizeInsightScope: insightStore.categorizeInsightScope,
};
