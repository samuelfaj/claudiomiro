const { categorizeInsight, deduplicateInsights } = require('../insight-extractor');

const keywordMatchers = [
    { pattern: /\bshould\b|\brecommended\b|\bpattern\b/i, confidence: 0.75 },
    { pattern: /\bavoid\b|\banti-pattern\b|\bbug\b/i, confidence: 0.7 },
    { pattern: /\btest\b|\bassert\b|\bcoverage\b/i, confidence: 0.65 },
    { pattern: /\bperformance\b|\boptimi[sz]e\b|\blatency\b/i, confidence: 0.6 },
];

const extractFromSentences = (content) => {
    if (!content) {
        return [];
    }

    const sentences = content
        .split(/[\n\r]+/)
        .map((line) => line.trim())
        .filter(Boolean);

    const matches = [];

    for (const sentence of sentences) {
        for (const matcher of keywordMatchers) {
            if (matcher.pattern.test(sentence)) {
                matches.push({
                    insight: sentence,
                    description: sentence,
                    confidence: matcher.confidence,
                    actionable: sentence.toLowerCase().includes('should') || sentence.toLowerCase().includes('need to'),
                    category: categorizeInsight(sentence),
                    source: 'pattern-fallback',
                });
                break;
            }
        }
    }

    return deduplicateInsights(matches);
};

module.exports = { extractFromSentences };
