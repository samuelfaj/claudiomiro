const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../../shared/executors/claude-executor', () => ({
    executeClaude: jest.fn(),
}));

jest.mock('../../../../shared/services/insights', () => ({
    addReflection: jest.fn(),
    getTaskReflection: jest.fn().mockReturnValue(null),
}));

const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const insightsStore = require('../../../../shared/services/insights');
const {
    shouldReflect,
    createReflection,
    storeReflection,
    buildReflectionTrajectory,
} = require('./reflection-hook');

describe('reflection-hook', () => {
    let baseDir;
    let projectDir;
    let claudiomiroDir;
    let taskFolder;

    beforeEach(() => {
        jest.clearAllMocks();
        baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflection-hook-'));
        projectDir = path.join(baseDir, 'project');
        fs.mkdirSync(projectDir);
        state.setFolder(projectDir);

        claudiomiroDir = state.claudiomiroFolder;
        fs.mkdirSync(claudiomiroDir, { recursive: true });

        taskFolder = path.join(claudiomiroDir, 'TASK1');
        fs.mkdirSync(taskFolder, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(baseDir)) {
            fs.rmSync(baseDir, { recursive: true, force: true });
        }
    });

    it('determines when reflection should run based on attempts', () => {
        expect(shouldReflect('TASK1', { attempts: 1 })).toEqual({ should: false });
        expect(shouldReflect('TASK1', { attempts: 2 }).should).toBe(true);
        expect(shouldReflect('TASK1', { hasErrors: true, attempts: 2 }).trigger).toBe('error-pattern');
        expect(shouldReflect('TASK1', { codeChangeSize: 600 }).trigger).toBe('quality-threshold');
    });

    it('builds trajectory content from task artifacts', () => {
        fs.writeFileSync(path.join(taskFolder, 'TODO.md'), '# Plan\n- Step 1');
        fs.writeFileSync(path.join(taskFolder, 'CONTEXT.md'), 'Summary of changes');

        const trajectory = buildReflectionTrajectory('TASK1', 'Additional context');

        expect(trajectory).toContain('Implementation Plan');
        expect(trajectory).toContain('Additional context');
    });

    it('creates reflection and parses insights', async () => {
        const reflectionPath = path.join(taskFolder, 'REFLECTION.md');
        executeClaude.mockImplementation(async () => {
            fs.writeFileSync(reflectionPath, '- We should add integration tests. [confidence: 0.9]');
        });

        const result = await createReflection('TASK1', {
            trajectory: 'Implementation went smoothly.',
            cwd: projectDir,
        });

        expect(executeClaude).toHaveBeenCalled();
        expect(result.insights).toHaveLength(1);
        expect(result.insights[0].insight).toContain('integration tests');
    });

    it('stores reflection iterations via insights service', async () => {
        const summary = {
            insights: [{ insight: 'Cache responses', confidence: 0.8, actionable: true }],
            converged: true,
            iterations: 1,
            history: [],
        };

        await storeReflection('TASK1', summary, { trigger: 'quality-threshold' });

        expect(insightsStore.addReflection).toHaveBeenCalledWith('TASK1', expect.objectContaining({
            triggeredBy: 'quality-threshold',
            insights: summary.insights,
        }));
    });
});
