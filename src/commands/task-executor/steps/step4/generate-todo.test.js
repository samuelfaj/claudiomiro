const fs = require('fs');
const _path = require('path');

jest.mock('fs');
jest.mock('../../../../shared/executors/claude-executor');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn().mockReturnValue(false),
    getRepository: jest.fn().mockReturnValue('/test/project'),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    startSpinner: jest.fn(),
    stopSpinner: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
}));

// Mock context-cache service (token optimization)
jest.mock('../../../../shared/services/context-cache', () => ({
    buildConsolidatedContextAsync: jest.fn().mockResolvedValue('## Environment Summary\nMocked context'),
    buildOptimizedContextAsync: jest.fn().mockResolvedValue({
        context: '## Environment Summary\nMocked context',
        tokenSavings: 0,
        method: 'consolidated',
        filesIncluded: 0,
    }),
    getContextFilePaths: jest.fn().mockReturnValue([]),
}));
jest.mock('../../../../shared/services/insights', () => ({
    getCuratedInsightsForTask: jest.fn().mockReturnValue([]),
    incrementInsightUsage: jest.fn(),
}));

// Import after mocks
const { generateTodo } = require('./generate-todo');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { buildOptimizedContextAsync, getContextFilePaths } = require('../../../../shared/services/context-cache');
const state = require('../../../../shared/config/state');
const insightsService = require('../../../../shared/services/insights');

describe('generate-todo', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
        insightsService.getCuratedInsightsForTask.mockReturnValue([]);
    });

    describe('generateTodo', () => {
        test('should load TODO.md template and call executeClaude with processed prompt', async () => {
            // Mock template files
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) {
                    return 'TODO template content';
                }
                if (filePath.includes('prompt-generate-todo.md')) {
                    return 'Generate TODO for {{taskMdPath}} with context {{contextSection}} using template {{todoTemplate}}';
                }
                return '';
            });

            // Mock directory structure
            fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.existsSync.mockReturnValue(false); // No existing files to check

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('templates/todo.md'),
                'utf-8',
            );
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('prompt-generate-todo.md'),
                'utf-8',
            );
            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Generate TODO for'),
                mockTask,
                undefined, // cwd is undefined when projectFolder equals state.folder
            );
        });

        test('should include AI_PROMPT.md in reference files section', async () => {
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('AI_PROMPT.md');
            });

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            const executeCall = executeClaude.mock.calls[0][0];
            // Now uses consolidated context structure
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/AI_PROMPT.md');
            expect(executeCall).toContain('CONTEXT SUMMARY');
            expect(executeCall).toContain('REFERENCE FILES');
        });

        test('should use context-cache service to get completed task files', async () => {
            // Mock context-cache to return files from completed tasks only
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK1/TODO.md',  // Only completed task files
            ]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            // Verify context-cache service was called with correct options
            expect(getContextFilePaths).toHaveBeenCalledWith('/test/.claudiomiro/task-executor', mockTask, {
                includeContext: true,
                includeResearch: true,
                includeTodo: true,
                onlyCompleted: true,
            });

            const executeCall = executeClaude.mock.calls[0][0];
            // Files returned by service should be in reference section
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK1/TODO.md');
        });

        test('should include files returned by context-cache service', async () => {
            // Mock context-cache to return CONTEXT.md, RESEARCH.md files (filtering is done internally)
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK1/CONTEXT.md',
                '/test/.claudiomiro/task-executor/TASK1/RESEARCH.md',
            ]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            const executeCall = executeClaude.mock.calls[0][0];
            // Files returned by context-cache should be in reference section
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK1/CONTEXT.md');
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK1/RESEARCH.md');
        });

        test('should use context-cache service (which excludes standard files internally)', async () => {
            // Mock context-cache to return filtered files (this is now handled by context-cache)
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK1/custom.md',  // Only valid custom files returned
            ]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            // Verify context-cache service was called (file filtering now happens there)
            expect(buildOptimizedContextAsync).toHaveBeenCalled();
            expect(getContextFilePaths).toHaveBeenCalledWith('/test/.claudiomiro/task-executor', mockTask, {
                includeContext: true,
                includeResearch: true,
                includeTodo: true,
                onlyCompleted: true,
            });

            const executeCall = executeClaude.mock.calls[0][0];
            // Custom files returned by context-cache should be in reference section
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK1/custom.md');
        });

        test('should inject curated insights when available', async () => {
            insightsService.getCuratedInsightsForTask.mockReturnValue([
                { id: 'insight-1', insight: 'Prefer using service layer for business rules.', confidence: 0.9, category: 'patterns', scope: 'project' },
            ]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                if (filePath.includes('TASK.md')) return 'Task description content';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);
            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            const executeCall = executeClaude.mock.calls[0][0];
            expect(executeCall).toContain('## CURATED INSIGHTS TO CONSIDER');
            expect(executeCall).toContain('Prefer using service layer for business rules.');
            expect(insightsService.incrementInsightUsage).toHaveBeenCalledWith('insight-1', 'project');
        });

        test('should replace all placeholders in prompt template', async () => {
            const todoTemplate = 'TODO TEMPLATE CONTENT';
            const promptTemplate = 'Task: {{taskMdPath}} Prompt: {{promptMdPath}} TODO: {{todoMdPath}} AI: {{aiPromptPath}} Template: {{todoTemplate}} Context: {{contextSection}}';

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return todoTemplate;
                if (filePath.includes('prompt-generate-todo.md')) return promptTemplate;
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            const executeCall = executeClaude.mock.calls[0][0];

            expect(executeCall).toContain('Task: /test/.claudiomiro/task-executor/TASK1/TASK.md');
            expect(executeCall).toContain('Prompt: /test/.claudiomiro/task-executor/TASK1/PROMPT.md');
            expect(executeCall).toContain('TODO: /test/.claudiomiro/task-executor/TASK1/TODO.md');
            expect(executeCall).toContain('AI: /test/.claudiomiro/task-executor/AI_PROMPT.md');
            expect(executeCall).toContain('Template: TODO TEMPLATE CONTENT');
        });

        test('should handle empty context when no previous TASK folders exist', async () => {
            // Mock context-cache to return empty array (no previous completed tasks)
            getContextFilePaths.mockReturnValue([]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            const executeCall = executeClaude.mock.calls[0][0];
            // Should still include AI_PROMPT.md in reference section
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/AI_PROMPT.md');
            // Context files from other tasks should not be present when none are returned
            expect(getContextFilePaths).toHaveBeenCalled();
        });

        test('should only include files from completed tasks (via context-cache)', async () => {
            // Mock context-cache to return only completed task files
            // The filtering of completed vs incomplete is now done by context-cache
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK2/TODO.md',  // Only completed task
                '/test/.claudiomiro/task-executor/TASK4/TODO.md',   // Only completed task
                // TASK3 (incomplete) would not be returned by context-cache
            ]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            // Verify getContextFilePaths was called with onlyCompleted: true
            expect(getContextFilePaths).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor',
                mockTask,
                expect.objectContaining({ onlyCompleted: true }),
            );

            const executeCall = executeClaude.mock.calls[0][0];
            // Should only include files returned by context-cache (completed tasks)
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK2/TODO.md');
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK4/TODO.md');
        });

        test('should handle error when TODO.md template is missing', async () => {
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) {
                    throw new Error('ENOENT: no such file or directory');
                }
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            await expect(generateTodo(mockTask)).rejects.toThrow('ENOENT: no such file or directory');
        });

        test('should handle error when prompt template is missing', async () => {
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) {
                    throw new Error('ENOENT: no such file or directory');
                }
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            await expect(generateTodo(mockTask)).rejects.toThrow('ENOENT: no such file or directory');
        });

        test('should pass task identifier correctly to executeClaude', async () => {
            const customTask = 'TASK2.1';

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt template';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(customTask);

            expect(executeClaude).toHaveBeenCalledWith(expect.any(String), customTask, undefined);
        });

        test('should include custom files returned by context-cache (excluding standard files)', async () => {
            // Context-cache service now handles file exclusion internally
            // It filters out standard files (PROMPT.md, TASK.md, etc.) and returns only valid context files
            getContextFilePaths.mockReturnValue([
                '/test/.claudiomiro/task-executor/TASK2/ARCHITECTURE.md',  // Custom file (included)
                '/test/.claudiomiro/task-executor/TASK2/API_DESIGN.md',     // Custom file (included)
                // PROMPT.md is excluded by context-cache internally
            ]);

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('templates/todo.md')) return 'TODO template';
                if (filePath.includes('prompt-generate-todo.md')) return 'Prompt {{contextSection}}';
                return '';
            });

            fs.readdirSync.mockReturnValue([]);
            fs.existsSync.mockReturnValue(false);

            executeClaude.mockResolvedValue({ success: true });

            await generateTodo(mockTask);

            const executeCall = executeClaude.mock.calls[0][0];
            // Custom files returned by context-cache should be included
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK2/ARCHITECTURE.md');
            expect(executeCall).toContain('/test/.claudiomiro/task-executor/TASK2/API_DESIGN.md');
            // Standard files like PROMPT.md are excluded by context-cache, not by generate-todo
        });

        describe('multi-repo mode', () => {
            test('should throw error when scope is missing in multi-repo mode', async () => {
                // Enable multi-repo mode
                state.isMultiRepo.mockReturnValue(true);

                fs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('templates/todo.md')) return 'TODO template';
                    if (filePath.includes('prompt-generate-todo.md')) return 'Prompt template';
                    if (filePath.includes('TASK.md')) return '# Task without scope\nSome task content';
                    return '';
                });

                fs.existsSync.mockReturnValue(true);

                await expect(generateTodo(mockTask)).rejects.toThrow('@scope tag is required');
            });

            test('should use correct repository path when scope is backend', async () => {
                state.isMultiRepo.mockReturnValue(true);
                state.getRepository.mockReturnValue('/test/backend');

                fs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('templates/todo.md')) return 'TODO template';
                    if (filePath.includes('prompt-generate-todo.md')) return 'Prompt template';
                    if (filePath.includes('TASK.md')) return '@scope backend\n# Backend task';
                    return '';
                });

                fs.existsSync.mockReturnValue(true);
                executeClaude.mockResolvedValue({ success: true });

                await generateTodo(mockTask);

                expect(state.getRepository).toHaveBeenCalledWith('backend');
                expect(executeClaude).toHaveBeenCalledWith(
                    expect.any(String),
                    mockTask,
                    { cwd: '/test/backend' },
                );
            });

            test('should use correct repository path when scope is frontend', async () => {
                state.isMultiRepo.mockReturnValue(true);
                state.getRepository.mockReturnValue('/test/frontend');

                fs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('templates/todo.md')) return 'TODO template';
                    if (filePath.includes('prompt-generate-todo.md')) return 'Prompt template';
                    if (filePath.includes('TASK.md')) return '@scope frontend\n# Frontend task';
                    return '';
                });

                fs.existsSync.mockReturnValue(true);
                executeClaude.mockResolvedValue({ success: true });

                await generateTodo(mockTask);

                expect(state.getRepository).toHaveBeenCalledWith('frontend');
                expect(executeClaude).toHaveBeenCalledWith(
                    expect.any(String),
                    mockTask,
                    { cwd: '/test/frontend' },
                );
            });
        });
    });
});
