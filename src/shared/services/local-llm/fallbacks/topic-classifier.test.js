/**
 * Topic Classifier Fallback Tests
 * Self-contained tests following Claudiomiro conventions
 */

const { classifyTopics, getTopicSimilarity, TOPIC_KEYWORDS } = require('./topic-classifier');

describe('topic-classifier', () => {
    describe('classifyTopics', () => {
        test('should classify authentication-related content', () => {
            const content = 'Implement user authentication with JWT tokens and login flow';
            const topics = classifyTopics(content);

            expect(topics).toContain('authentication');
        });

        test('should classify API-related content', () => {
            const content = 'Create REST API endpoint for user CRUD operations';
            const topics = classifyTopics(content);

            expect(topics).toContain('api');
        });

        test('should classify database-related content', () => {
            const content = 'Add database migration for users table with SQL schema';
            const topics = classifyTopics(content);

            expect(topics).toContain('database');
        });

        test('should classify testing-related content', () => {
            const content = 'Write unit tests with Jest and mock dependencies';
            const topics = classifyTopics(content);

            expect(topics).toContain('testing');
        });

        test('should classify multiple topics', () => {
            const content = 'Create API endpoint with authentication and database query';
            const topics = classifyTopics(content);

            expect(topics.length).toBeGreaterThan(1);
            expect(topics).toContain('api');
            expect(topics).toContain('authentication');
            expect(topics).toContain('database');
        });

        test('should respect maxTopics limit', () => {
            const content = 'API authentication database testing config middleware';
            const topics = classifyTopics(content, 2);

            expect(topics.length).toBeLessThanOrEqual(2);
        });

        test('should return empty array for empty content', () => {
            expect(classifyTopics('')).toEqual([]);
            expect(classifyTopics(null)).toEqual([]);
            expect(classifyTopics(undefined)).toEqual([]);
        });

        test('should handle content with no matching topics', () => {
            const content = 'xyzabc random gibberish 12345';
            const topics = classifyTopics(content);

            expect(topics.length).toBe(0);
        });

        test('should be case-insensitive', () => {
            const content = 'AUTHENTICATION API DATABASE';
            const topics = classifyTopics(content);

            expect(topics.length).toBeGreaterThan(0);
        });

        test('should weight longer keywords higher', () => {
            const content = 'authentication authentication auth auth auth';
            const topics = classifyTopics(content);

            // Should still pick up authentication as primary
            expect(topics[0]).toBe('authentication');
        });
    });

    describe('getTopicSimilarity', () => {
        test('should return 1.0 for identical arrays', () => {
            const topics = ['api', 'database', 'testing'];
            const similarity = getTopicSimilarity(topics, topics);

            expect(similarity).toBe(1.0);
        });

        test('should return 0.0 for completely different arrays', () => {
            const topics1 = ['api', 'database'];
            const topics2 = ['ui', 'state'];
            const similarity = getTopicSimilarity(topics1, topics2);

            expect(similarity).toBe(0.0);
        });

        test('should return partial similarity for overlapping arrays', () => {
            const topics1 = ['api', 'database', 'testing'];
            const topics2 = ['api', 'database', 'ui'];
            const similarity = getTopicSimilarity(topics1, topics2);

            // 2 common (api, database) / 4 union (api, database, testing, ui) = 0.5
            expect(similarity).toBe(0.5);
        });

        test('should return 0.0 for empty arrays', () => {
            expect(getTopicSimilarity([], ['api'])).toBe(0);
            expect(getTopicSimilarity(['api'], [])).toBe(0);
            expect(getTopicSimilarity([], [])).toBe(0);
        });

        test('should handle single element arrays', () => {
            const similarity = getTopicSimilarity(['api'], ['api']);
            expect(similarity).toBe(1.0);
        });
    });

    describe('TOPIC_KEYWORDS', () => {
        test('should have all expected topic categories', () => {
            const expectedTopics = [
                'authentication', 'api', 'database', 'testing', 'config',
                'middleware', 'service', 'controller', 'component', 'validation',
                'error', 'logging', 'cache', 'queue', 'file', 'security', 'ui', 'state',
            ];

            for (const topic of expectedTopics) {
                expect(TOPIC_KEYWORDS).toHaveProperty(topic);
                expect(Array.isArray(TOPIC_KEYWORDS[topic])).toBe(true);
                expect(TOPIC_KEYWORDS[topic].length).toBeGreaterThan(0);
            }
        });

        test('should have keywords as strings', () => {
            for (const keywords of Object.values(TOPIC_KEYWORDS)) {
                for (const keyword of keywords) {
                    expect(typeof keyword).toBe('string');
                }
            }
        });
    });
});
