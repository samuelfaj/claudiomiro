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

    it('curates insights from TODO content when reflection absent', async () => {
        insightsStore.getTaskReflection.mockReturnValue(null);

        const todoPath = path.join(claudiomiroDir, task, 'TODO.md');
        fs.writeFileSync(todoPath, `
## Implementation Plan
- Ensure cache invalidation happens after user role updates.
- Add monitoring for background job failures.
        `);

        await curateInsights(task, { todoPath });

        expect(insightsStore.addCuratedInsight).toHaveBeenCalledWith(expect.objectContaining({
            insight: expect.stringContaining('Ensure cache invalidation'),
            learnedFrom: task,
        }));
    });
});
