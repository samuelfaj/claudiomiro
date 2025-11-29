const { Reflector } = require('./reflector');

describe('Reflector', () => {
    const template = `
Task: {{task}}
Iteration: {{iteration}}
Trajectory:
{{trajectory}}

Previous:
{{previousInsights}}
`.trim();

    it('aggregates insights until convergence', async () => {
        const responses = [
            '- Use repository pattern for new services. [confidence: 0.8]\n- Add integration tests to cover auth flow. [confidence: 0.75]',
            '- Use repository pattern for new services. [confidence: 0.8]\n- Add integration tests to cover auth flow. [confidence: 0.75]',
        ];

        let callCount = 0;
        const reflector = new Reflector({
            promptTemplate: template,
            executor: jest.fn().mockImplementation(async () => {
                const content = responses[callCount] || '';
                callCount += 1;
                return { content };
            }),
        });

        const result = await reflector.reflect('TASK-1', { trajectory: 'Implemented repository pattern.' });

        expect(result.insights).toHaveLength(2);
        expect(result.converged).toBe(true);
        expect(result.iterations).toBe(2);
    });

    it('falls back to pattern matcher when extractor yields nothing', async () => {
        const reflector = new Reflector({
            promptTemplate: template,
            executor: jest.fn().mockResolvedValue({
                content: 'We should avoid direct database calls inside controllers to prevent tight coupling.',
            }),
        });

        const result = await reflector.reflect('TASK-2', { trajectory: 'Controller logic adjusted.' });

        expect(result.insights.length).toBeGreaterThan(0);
        expect(result.insights[0].insight.toLowerCase()).toContain('avoid direct database calls');
    });

    it('stops early when quality threshold satisfied', async () => {
        const reflector = new Reflector({
            promptTemplate: template,
            executor: jest.fn().mockResolvedValue({
                content: '- We should cache heavy endpoints to reduce latency. [confidence: 0.9]\n- We should add regression tests for checkout flow. [confidence: 0.85]',
            }),
        });

        const result = await reflector.reflect('TASK-3', {
            trajectory: 'Performance tuning and regression tests.',
            maxIterations: 5,
        });

        expect(result.iterations).toBe(1);
        expect(result.converged).toBe(true);
    });
});
