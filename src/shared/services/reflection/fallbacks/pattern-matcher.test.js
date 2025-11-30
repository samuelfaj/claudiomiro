const { extractFromSentences } = require('./pattern-matcher');

describe('pattern-matcher fallback', () => {
    it('extracts insights using keyword heuristics', () => {
        const text = `
Caching layer should avoid direct database hits.
This update improves performance under load.
Remember to update documentation.
`;

        const results = extractFromSentences(text);
        const summaries = results.map((item) => item.insight);

        expect(results.length).toBeGreaterThanOrEqual(2);
        expect(summaries.some((line) => line.includes('Caching layer'))).toBe(true);
        expect(results.every((item) => item.category)).toBe(true);
    });
});
