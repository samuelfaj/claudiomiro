const { Reflector } = require('./reflector');
const {
    extractInsights,
    categorizeInsight,
    deduplicateInsights,
} = require('./insight-extractor');
const { extractFromSentences } = require('./fallbacks/pattern-matcher');

module.exports = {
    Reflector,
    extractInsights,
    categorizeInsight,
    deduplicateInsights,
    extractFromSentences,
};
