const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../../../shared/executors/claude-executor', () => ({
    executeClaude: jest.fn(),
}));
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
}));

const {
    inferFinishingTouches,
    applyFinishingTouches,
    updateBlueprintFinishingTouches,
    updateExecutionFinishingTouches,
    readModifiedFiles,
    parseInferenceResult,
    CATEGORIES,
    CONFIDENCE,
} = require('./finishing-touches');
const { executeClaude } = require('../../../../../shared/executors/claude-executor');
const logger = require('../../../../../shared/utils/logger');

describe('finishing-touches', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('CATEGORIES', () => {
        test('should define all expected categories', () => {
            expect(CATEGORIES.UI_STATE).toBe('ui_state');
            expect(CATEGORIES.NAVIGATION).toBe('navigation');
            expect(CATEGORIES.DATA_SYNC).toBe('data_sync');
            expect(CATEGORIES.VALIDATION).toBe('validation');
            expect(CATEGORIES.CLEANUP).toBe('cleanup');
            expect(CATEGORIES.ERROR_HANDLING).toBe('error_handling');
        });
    });

    describe('CONFIDENCE', () => {
        test('should define confidence thresholds', () => {
            expect(CONFIDENCE.HIGH).toBe(0.9);
            expect(CONFIDENCE.MEDIUM).toBe(0.7);
            expect(CONFIDENCE.LOW).toBe(0.5);
        });
    });

    describe('readModifiedFiles', () => {
        test('should read and combine file contents', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('const foo = 1;');

            const result = readModifiedFiles(['file1.js', 'file2.js'], '/test');

            expect(result).toContain('// File: file1.js');
            expect(result).toContain('// File: file2.js');
            expect(result).toContain('const foo = 1;');
        });

        test('should skip non-existent files', () => {
            fs.existsSync.mockReturnValue(false);

            const result = readModifiedFiles(['missing.js'], '/test');

            expect(result).toBe('');
        });

        test('should handle read errors gracefully', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const result = readModifiedFiles(['error.js'], '/test');

            expect(result).toBe('');
            expect(logger.warning).toHaveBeenCalled();
        });
    });

    describe('parseInferenceResult', () => {
        test('should parse object result directly', () => {
            const input = {
                finishingTouches: [
                    { action: 'create', inference: 'reload', confidence: 0.95, category: 'ui_state' },
                ],
            };

            const result = parseInferenceResult(input);

            expect(result.finishingTouches).toHaveLength(1);
            expect(result.finishingTouches[0].action).toBe('create');
        });

        test('should parse JSON string', () => {
            const input = JSON.stringify({
                finishingTouches: [
                    { action: 'delete', inference: 'redirect', confidence: 0.8, category: 'navigation' },
                ],
            });

            const result = parseInferenceResult(input);

            expect(result.finishingTouches).toHaveLength(1);
            expect(result.finishingTouches[0].action).toBe('delete');
        });

        test('should extract JSON from markdown code blocks', () => {
            const input = '```json\n{"finishingTouches": [{"action": "test", "confidence": 0.9}]}\n```';

            const result = parseInferenceResult(input);

            expect(result.finishingTouches).toHaveLength(1);
        });

        test('should filter out low confidence items', () => {
            const input = {
                finishingTouches: [
                    { action: 'high', confidence: 0.95 },
                    { action: 'low', confidence: 0.3 },
                ],
            };

            const result = parseInferenceResult(input);

            expect(result.finishingTouches).toHaveLength(1);
            expect(result.finishingTouches[0].action).toBe('high');
        });

        test('should handle invalid JSON gracefully', () => {
            const result = parseInferenceResult('not valid json');

            expect(result.finishingTouches).toHaveLength(0);
            expect(result.summary.parseError).toBe(true);
        });

        test('should normalize missing fields', () => {
            const input = {
                finishingTouches: [{ confidence: 0.9 }],
            };

            const result = parseInferenceResult(input);

            expect(result.finishingTouches[0].action).toBe('unknown');
            expect(result.finishingTouches[0].inference).toBe('');
            expect(result.finishingTouches[0].category).toBe('ui_state');
        });
    });

    describe('inferFinishingTouches', () => {
        test('should return empty when prompt template not found', async () => {
            fs.existsSync.mockReturnValue(false);

            const result = await inferFinishingTouches('task', ['file.js'], { cwd: '/test' });

            expect(result.finishingTouches).toHaveLength(0);
            expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Prompt template not found'));
        });

        test('should return empty when no code to analyze', async () => {
            fs.existsSync.mockImplementation((p) => p.includes('prompt'));
            fs.readFileSync.mockReturnValue('prompt template');

            const result = await inferFinishingTouches('task', [], { cwd: '/test' });

            expect(result.finishingTouches).toHaveLength(0);
        });

        test('should call executeClaude with prompt', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync
                .mockReturnValueOnce('{{TASK_DESCRIPTION}} {{GENERATED_CODE}} {{MODIFIED_FILES}}')
                .mockReturnValueOnce('const x = 1;');

            executeClaude.mockResolvedValue({
                finishingTouches: [
                    { action: 'create', inference: 'reload', confidence: 0.95 },
                ],
            });

            const result = await inferFinishingTouches('my task', ['src/file.js'], { cwd: '/test' });

            expect(executeClaude).toHaveBeenCalled();
            expect(result.finishingTouches).toHaveLength(1);
        });

        test('should handle executeClaude errors gracefully', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync
                .mockReturnValueOnce('prompt')
                .mockReturnValueOnce('code');

            executeClaude.mockRejectedValue(new Error('API error'));

            const result = await inferFinishingTouches('task', ['file.js'], { cwd: '/test' });

            expect(result.finishingTouches).toHaveLength(0);
            expect(result.summary.error).toBe('API error');
        });
    });

    describe('applyFinishingTouches', () => {
        test('should separate high and low confidence items', async () => {
            const touches = [
                { action: 'a', confidence: 0.95, suggestion: { file: 'x.js', code: 'y' } },
                { action: 'b', confidence: 0.7 },
            ];

            fs.existsSync.mockReturnValue(true);

            const result = await applyFinishingTouches(touches, { cwd: '/test' });

            // High confidence goes to pending because we don't auto-apply yet
            expect(result.pending).toHaveLength(2);
        });

        test('should respect dryRun option', async () => {
            const touches = [
                { action: 'a', confidence: 0.95, suggestion: { file: 'x.js', code: 'y' } },
            ];

            const result = await applyFinishingTouches(touches, { dryRun: true });

            expect(result.pending).toHaveLength(1);
        });

        test('should mark items without suggestion as pending', async () => {
            const touches = [
                { action: 'a', confidence: 0.95 }, // no suggestion
            ];

            const result = await applyFinishingTouches(touches, { cwd: '/test' });

            expect(result.pending).toHaveLength(1);
            expect(result.pending[0].status).toBe('no_suggestion');
        });

        test('should mark low confidence items correctly', async () => {
            const touches = [
                { action: 'a', confidence: 0.6, suggestion: { file: 'x.js', code: 'y' } },
            ];

            const result = await applyFinishingTouches(touches, { cwd: '/test' });

            expect(result.pending[0].status).toBe('low_confidence');
        });
    });

    describe('updateBlueprintFinishingTouches', () => {
        test('should return false when BLUEPRINT.md not found', () => {
            fs.existsSync.mockReturnValue(false);

            const result = updateBlueprintFinishingTouches('/test/BLUEPRINT.md', { applied: [], pending: [] });

            expect(result).toBe(false);
        });

        test('should append section when not exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# BLUEPRINT\n\n## 4. IMPLEMENTATION');

            updateBlueprintFinishingTouches('/test/BLUEPRINT.md', {
                applied: [{ action: 'create', inference: 'reload', category: 'ui_state', status: 'applied' }],
                pending: [],
            });

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenContent = fs.writeFileSync.mock.calls[0][1];
            expect(writtenContent).toContain('### 3.4 FINISHING TOUCHES');
            expect(writtenContent).toContain('create');
            expect(writtenContent).toContain('reload');
        });

        test('should replace existing section', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(
                '# BLUEPRINT\n\n### 3.4 FINISHING TOUCHES (Auto-inferred)\n\nOld content\n\n## 4. IMPLEMENTATION',
            );

            updateBlueprintFinishingTouches('/test/BLUEPRINT.md', {
                applied: [],
                pending: [{ action: 'delete', inference: 'redirect', category: 'navigation', status: 'low_confidence' }],
            });

            const writtenContent = fs.writeFileSync.mock.calls[0][1];
            expect(writtenContent).not.toContain('Old content');
            expect(writtenContent).toContain('delete');
        });

        test('should show pending message when items pending', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# BLUEPRINT');

            updateBlueprintFinishingTouches('/test/BLUEPRINT.md', {
                applied: [],
                pending: [{ action: 'a', inference: 'b', category: 'ui_state', status: 'pending' }],
            });

            const writtenContent = fs.writeFileSync.mock.calls[0][1];
            expect(writtenContent).toContain('Pending items require manual review');
        });
    });

    describe('updateExecutionFinishingTouches', () => {
        test('should return false when execution.json not found', () => {
            fs.existsSync.mockReturnValue(false);

            const result = updateExecutionFinishingTouches('/test/execution.json', { applied: [], pending: [] });

            expect(result).toBe(false);
        });

        test('should update execution.json with finishing touches', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"status": "in_progress"}');

            updateExecutionFinishingTouches('/test/execution.json', {
                applied: [{ action: 'create', inference: 'reload', category: 'ui_state', suggestion: { file: 'x.js' } }],
                pending: [{ action: 'delete', inference: 'redirect', category: 'navigation', status: 'low_confidence' }],
            });

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.finishingTouches.inferred).toBe(2);
            expect(writtenContent.finishingTouches.applied).toHaveLength(1);
            expect(writtenContent.finishingTouches.pending).toHaveLength(1);
        });

        test('should handle JSON parse errors', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('not json');

            const result = updateExecutionFinishingTouches('/test/execution.json', { applied: [], pending: [] });

            expect(result).toBe(false);
            expect(logger.warning).toHaveBeenCalled();
        });
    });
});
