const fs = require('fs');
const os = require('os');
const path = require('path');
const state = require('../../config/state');

const {
    loadGlobalInsights,
    loadProjectInsights,
    loadAllInsights,
    addProjectInsight,
    addGlobalInsight,
    addCuratedInsight,
    getCuratedInsightsForTask,
    incrementInsightUsage,
    addReflection,
    getTaskReflection,
} = require('./insight-store');

describe('insight-store', () => {
    let baseDir;
    let homeDir;
    let projectDir;
    let homedirSpy;

    beforeEach(() => {
        baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-store-'));
        homeDir = path.join(baseDir, 'home');
        projectDir = path.join(baseDir, 'project');
        fs.mkdirSync(homeDir);
        fs.mkdirSync(projectDir);

        if (homedirSpy) {
            homedirSpy.mockRestore();
        }
        homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(homeDir);

        state.setFolder(projectDir);
        if (!fs.existsSync(state.claudiomiroFolder)) {
            fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
        }
    });

    afterEach(() => {
        if (homedirSpy) {
            homedirSpy.mockRestore();
        }
        if (fs.existsSync(baseDir)) {
            fs.rmSync(baseDir, { recursive: true, force: true });
        }
    });

    it('returns default structure when global insights file is missing', () => {
        const globalInsights = loadGlobalInsights();

        expect(globalInsights).toHaveProperty('version', '1.0.0');
        expect(globalInsights.curatedInsights.patterns).toEqual([]);
        expect(globalInsights.curatedInsights.antiPatterns).toEqual([]);
        expect(globalInsights.curatedInsights.projectSpecific).toEqual([]);
    });

    it('persists project insight to project file', () => {
        const entry = addProjectInsight({
            insight: 'Repository pattern is preferred here',
            category: 'patterns',
            learnedFrom: 'TASK1',
            confidence: 0.8,
        });

        const projectPath = path.join(state.claudiomiroFolder, 'insights', 'project-insights.json');
        const stored = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

        expect(entry.scope).toBe('project');
        expect(stored.curatedInsights.patterns).toHaveLength(1);
        expect(stored.curatedInsights.patterns[0].insight).toContain('Repository pattern');
    });

    it('categorizes curated insight scope automatically', () => {
        const entry = addCuratedInsight({
            insight: 'Always mock external services in tests to keep them deterministic.',
            category: 'patterns',
            learnedFrom: 'TASK2',
            confidence: 0.9,
        });

        const globalPath = path.join(os.homedir(), '.claudiomiro', 'insights', 'global-insights.json');
        const stored = JSON.parse(fs.readFileSync(globalPath, 'utf8'));

        expect(entry.scope).toBe('global');
        expect(stored.curatedInsights.patterns).toHaveLength(1);
        expect(stored.curatedInsights.patterns[0].scope).toBe('global');
    });

    it('merges global and project insights when loading all data', () => {
        addGlobalInsight({
            insight: 'Always add error boundaries to React apps.',
            category: 'patterns',
            learnedFrom: 'TASK3',
            confidence: 0.9,
        });
        addProjectInsight({
            insight: 'This project stores auth tokens in Redis.',
            category: 'projectSpecific',
            learnedFrom: 'TASK4',
            confidence: 0.7,
        });

        const all = loadAllInsights();
        const categories = Object.keys(all.curatedInsights);

        expect(categories).toContain('patterns');
        expect(categories).toContain('projectSpecific');
        expect(all.curatedInsights.patterns.some((item) => item.scope === 'global')).toBe(true);
        expect(all.curatedInsights.projectSpecific.some((item) => item.scope === 'project')).toBe(true);
    });

    it('ranks curated insights by relevance for a task', () => {
        addProjectInsight({
            insight: 'Repository pattern is extensively used in this codebase.',
            category: 'projectSpecific',
            learnedFrom: 'TASK5',
            confidence: 0.85,
        });
        addGlobalInsight({
            insight: 'Always write integration tests for critical flows.',
            category: 'patterns',
            learnedFrom: 'TASK6',
            confidence: 0.95,
        });

        const results = getCuratedInsightsForTask(
            'Implement repository pattern for new persistence layer',
            { maxInsights: 2, minConfidence: 0.5 },
        );

        expect(results).toHaveLength(2);
        expect(results[0].insight.toLowerCase()).toContain('repository pattern');
    });

    it('increments usage count for project insight', () => {
        const entry = addProjectInsight({
            insight: 'This service expects snake_case payloads.',
            category: 'projectSpecific',
            learnedFrom: 'TASK7',
            confidence: 0.6,
        });

        const updated = incrementInsightUsage(entry.id, 'project');
        const reloaded = loadProjectInsights();
        const stored = reloaded.curatedInsights.projectSpecific.find((item) => item.id === entry.id);

        expect(updated.usageCount).toBe(1);
        expect(stored.usageCount).toBe(1);
        expect(stored.lastUsedAt).toBeDefined();
    });

    it('stores and retrieves reflections per task', () => {
        const reflection = addReflection('TASK8', {
            insights: [{
                type: 'pattern',
                description: 'Batch database writes to reduce load',
                confidence: 0.8,
            }],
            triggeredBy: 'quality-threshold',
        });

        const loaded = getTaskReflection('TASK8');

        expect(reflection.iterations).toHaveLength(1);
        expect(loaded.iterations[0].description).toBeUndefined();
        expect(loaded.iterations[0].insights[0].description).toContain('Batch database writes');
        expect(loaded.lastReflection).toBeDefined();
    });
});
