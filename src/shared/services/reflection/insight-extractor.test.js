const {
    extractInsights,
    categorizeInsight,
    deduplicateInsights,
} = require('./insight-extractor');

describe('insight-extractor', () => {
    describe('extractInsights', () => {
        it('parses bullet list with metadata tokens', () => {
            const markdown = `
- Use repository pattern to keep persistence layer consistent. [confidence: 0.8] [category: patterns]
- Avoid direct DB calls from controllers. (confidence:0.9) (actionable: yes)
- Improve logging for authentication flows. Evidence: increases traceability
`;

            const insights = extractInsights(markdown);

            expect(insights).toHaveLength(3);
            expect(insights[0]).toMatchObject({
                category: 'patterns',
            });
            expect(insights[1].actionable).toBe(true);
            expect(insights[2].evidence).toContain('traceability');
        });

        it('deduplicates insights with higher confidence retained', () => {
            const first = {
                insight: 'Cache frequently accessed endpoints.',
                confidence: 0.4,
                actionable: false,
            };
            const second = {
                insight: 'Cache frequently accessed endpoints.',
                confidence: 0.9,
                actionable: true,
            };

            const deduped = deduplicateInsights([first, second]);

            expect(deduped).toHaveLength(1);
            expect(deduped[0].confidence).toBe(0.9);
            expect(deduped[0].actionable).toBe(true);
        });
    });

    describe('categorizeInsight', () => {
        it('classifies anti-pattern language', () => {
            expect(categorizeInsight('Avoid tight coupling between layers')).toBe('antiPatterns');
        });

        it('defaults to projectSpecific when no keywords match', () => {
            expect(categorizeInsight('Remember to update README with new endpoints')).toBe('projectSpecific');
        });
    });
});
