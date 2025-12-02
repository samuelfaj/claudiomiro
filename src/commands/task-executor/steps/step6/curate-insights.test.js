const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../../shared/services/insights', () => ({
    addCuratedInsight: jest.fn(),
    getTaskReflection: jest.fn().mockReturnValue(null),
}));

const state = require('../../../../shared/config/state');
const insightsStore = require('../../../../shared/services/insights');
const {
    curateInsights,
    extractImplementationPatterns,
    extractExecutionInsights,
    categorizeInsights,
} = require('./curate-insights');

describe('curate-insights', () => {
    let tempDir;
    let projectDir;
    let claudiomiroDir;
    const task = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curate-insights-'));
        projectDir = path.join(tempDir, 'project');
        fs.mkdirSync(projectDir);
        state.setFolder(projectDir);
        claudiomiroDir = state.claudiomiroFolder;
        fs.mkdirSync(claudiomiroDir, { recursive: true });
        fs.mkdirSync(path.join(claudiomiroDir, task), { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('categorizes insights by detected category', () => {
        const groups = categorizeInsights([
            { insight: 'Add integration tests for auth.', category: 'testing' },
            { insight: 'Avoid tight coupling in services.' },
        ]);

        expect(groups.testing).toHaveLength(1);
        expect(groups.antiPatterns).toHaveLength(1);
    });

    it('extracts implementation patterns from markdown content', () => {
        const markdown = `
## Implementation Notes
- Ensure API responses include pagination metadata.
- Document the new endpoints in the README.

## Testing
- Always add regression tests for checkout flow.
- Use mocks to avoid calling external APIs.
`;
        const patterns = extractImplementationPatterns(markdown);

        expect(patterns.length).toBeGreaterThanOrEqual(2);
        expect(patterns[0].insight).toContain('Ensure API responses');
        expect(patterns[0].actionable).toBe(true);
    });

    it('curates insights from reflection data', async () => {
        insightsStore.getTaskReflection.mockReturnValue({
            iterations: [{
                insights: [{
                    insight: 'Add unit tests for payment adapter errors.',
                    confidence: 0.8,
                    actionable: true,
                    category: 'testing',
                }],
            }],
        });

        await curateInsights(task, {});

        expect(insightsStore.addCuratedInsight).toHaveBeenCalledWith(expect.objectContaining({
            insight: 'Add unit tests for payment adapter errors.',
            learnedFrom: task,
        }));
    });

    it('curates insights from BLUEPRINT.md content when reflection absent', async () => {
        insightsStore.getTaskReflection.mockReturnValue(null);

        const blueprintPath = path.join(claudiomiroDir, task, 'BLUEPRINT.md');
        fs.writeFileSync(blueprintPath, `
# BLUEPRINT: TASK1

## Implementation Plan
- Ensure cache invalidation happens after user role updates.
- Add monitoring for background job failures.
        `);

        await curateInsights(task, { blueprintPath });

        expect(insightsStore.addCuratedInsight).toHaveBeenCalledWith(expect.objectContaining({
            insight: expect.stringContaining('Ensure cache invalidation'),
            learnedFrom: task,
        }));
    });

    it('curates insights from execution.json forFutureTasks', async () => {
        insightsStore.getTaskReflection.mockReturnValue(null);

        const executionPath = path.join(claudiomiroDir, task, 'execution.json');
        fs.writeFileSync(executionPath, JSON.stringify({
            status: 'completed',
            completion: {
                forFutureTasks: [
                    'Always validate input before database operations',
                    'Use transactions for multi-step operations',
                ],
            },
        }));

        await curateInsights(task, { executionPath });

        expect(insightsStore.addCuratedInsight).toHaveBeenCalledWith(expect.objectContaining({
            insight: 'Always validate input before database operations',
            learnedFrom: task,
        }));
    });

    it('extracts insights from execution.json resolved uncertainties', () => {
        const execution = {
            uncertainties: [
                {
                    id: 'U1',
                    topic: 'API versioning',
                    assumption: 'Use v2 API',
                    confidence: 0.6,
                    resolution: 'Confirmed v2 API is correct',
                },
                {
                    id: 'U2',
                    topic: 'Cache TTL',
                    assumption: '5 minutes',
                    confidence: 0.7,
                    // No resolution - should be skipped
                },
            ],
        };

        const insights = extractExecutionInsights(execution);

        expect(insights).toHaveLength(1);
        expect(insights[0].insight).toContain('API versioning');
        expect(insights[0].insight).toContain('Confirmed v2 API is correct');
    });

    it('returns empty array for null execution', () => {
        const insights = extractExecutionInsights(null);
        expect(insights).toEqual([]);
    });
});
