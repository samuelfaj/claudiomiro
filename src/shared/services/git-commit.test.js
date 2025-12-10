const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('../executors/claude-executor');
const { commitOrFix, collectRichContext, generateCommitMessageLocally: _generateCommitMessageLocally, smartCommit } = require('./git-commit');
const { getLocalLLMService } = require('./local-llm');

// Mock modules
jest.mock('fs');
jest.mock('child_process');
jest.mock('../utils/logger', () => ({
    stopSpinner: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
    newline: jest.fn(),
    separator: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('../config/state');
jest.mock('../executors/claude-executor');
jest.mock('./local-llm');

const fs = require('fs');
const { execSync } = require('child_process');

describe('git-commit', () => {
    beforeEach(() => {
    // Reset all mocks
        jest.clearAllMocks();

        // Setup default mocks
        executeClaude.mockResolvedValue();
        state.claudiomiroFolder = '/test/.claudiomiro/task-executor';
        state.folder = '/test';
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue('Task description content');
        getLocalLLMService.mockReturnValue(null); // Default: no local LLM
    });

    describe('commitOrFix', () => {
        test('should execute Claude with enhanced prompt containing hard rules', async () => {
            const prompt = 'Commit these changes';
            const taskName = 'test-task';

            await commitOrFix(prompt, taskName);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining(prompt),
                taskName,
                expect.objectContaining({ cwd: '/test' }),
            );

            const calledPrompt = executeClaude.mock.calls[0][0];
            expect(calledPrompt).toContain('HARD RULES:');
            expect(calledPrompt).toContain('NEVER mention that you are an AI model');
            expect(calledPrompt).toContain('NEVER mention Authored or Co-Authored');
            expect(calledPrompt).toContain('NEVER mention any AI model');
            expect(calledPrompt).toContain('The Authorship must be the user and only the user');
            expect(calledPrompt).toContain('NOBODY can know that AI was used');
            expect(calledPrompt).toContain('git commit -m "message"');
            expect(calledPrompt).toContain('git push');
            expect(calledPrompt).toContain('create a PR, use the available git tools');
        });

        test('should work without taskName parameter', async () => {
            const prompt = 'Commit these changes';

            await commitOrFix(prompt);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining(prompt),
                null,
                expect.objectContaining({ cwd: '/test' }),
            );
        });

        test('should stop spinner and log appropriate messages', async () => {
            await commitOrFix('test prompt');

            expect(logger.stopSpinner).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Git committing via Claude...');
            expect(logger.newline).toHaveBeenCalledTimes(2);
            expect(logger.separator).toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith('Git commit/PR process completed');
        });

        test('should handle Claude execution success', async () => {
            executeClaude.mockResolvedValue();

            const result = await commitOrFix('test prompt');

            expect(result).toBe(true);
            expect(logger.success).toHaveBeenCalled();
        });

        test('should handle Claude execution failure gracefully', async () => {
            const error = new Error('Claude execution failed');
            executeClaude.mockRejectedValue(error);

            const result = await commitOrFix('test prompt');

            expect(result).toBe(true); // Should still return true even on failure
            expect(logger.warning).toHaveBeenCalledWith('⚠️  Git commit/PR process failed: Claude execution failed');
        });

        test('should handle empty prompt', async () => {
            await commitOrFix('');

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining(''),
                null,
                expect.objectContaining({ cwd: '/test' }),
            );
        });

        test('should handle prompt with special characters', async () => {
            const prompt = 'Commit "special" chars & symbols: @#$%^&*()';

            await commitOrFix(prompt);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining(prompt),
                null,
                expect.objectContaining({ cwd: '/test' }),
            );
        });

        test('should handle very long prompts', async () => {
            const longPrompt = 'x'.repeat(10000);

            await commitOrFix(longPrompt);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining(longPrompt),
                null,
                expect.objectContaining({ cwd: '/test' }),
            );
        });

        test('should preserve original prompt in enhanced message', async () => {
            const originalPrompt = 'Fix the bug in authentication module';

            await commitOrFix(originalPrompt);

            const calledPrompt = executeClaude.mock.calls[0][0];
            expect(calledPrompt).toContain(originalPrompt);
            expect(calledPrompt).toContain('HARD RULES:');
        });

        test('should format hard rules consistently', async () => {
            await commitOrFix('any prompt');

            const calledPrompt = executeClaude.mock.calls[0][0];

            // Check that all hard rules are present with exact formatting
            const expectedRules = [
                'HARD RULES:',
                ' - NEVER mention that you are an AI model',
                ' - NEVER mention Authored or Co-Authored',
                ' - NEVER mention any AI model (example: Claude, ChatGPT, GLM, Deepseek)',
                ' - The Authorship must be the user and only the user',
                ' - NOBODY can know that AI was used',
                ' - If you need to commit, use git commit -m "message"',
                ' - If you need to push, use git push',
                ' - If you need to create a PR, use the available git tools (GitHub, GitLab, etc.)',
            ];

            expectedRules.forEach(rule => {
                expect(calledPrompt).toContain(rule);
            });
        });

        test('should pass through taskName parameter correctly', async () => {
            const taskName = 'feature-authentication';

            await commitOrFix('test prompt', taskName);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.any(String),
                taskName,
                expect.objectContaining({ cwd: '/test' }),
            );
        });

        test('should handle different task names', async () => {
            const taskNames = ['task1', 'task-with-dashes', 'task_with_underscores', 'task123'];

            for (const taskName of taskNames) {
                await commitOrFix('test prompt', taskName);

                expect(executeClaude).toHaveBeenCalledWith(
                    expect.any(String),
                    taskName,
                    expect.objectContaining({ cwd: '/test' }),
                );

                // Reset mock for next iteration
                executeClaude.mockClear();
            }
        });

        test('should handle execution errors with different error types', async () => {
            const errorTypes = [
                new Error('Network error'),
                new Error('File not found'),
                new Error('Permission denied'),
                new Error('Command failed'),
            ];

            for (const error of errorTypes) {
                executeClaude.mockRejectedValue(error);

                const result = await commitOrFix('test prompt');

                expect(result).toBe(true);
                expect(logger.warning).toHaveBeenCalledWith(
                    `⚠️  Git commit/PR process failed: ${error.message}`,
                );

                // Reset mock for next iteration
                executeClaude.mockClear();
                logger.warning.mockClear();
            }
        });

        test('should call logger methods in correct order on success', async () => {
            const callOrder = [];

            logger.stopSpinner.mockImplementation(() => callOrder.push('stopSpinner'));
            logger.info.mockImplementation(() => callOrder.push('info'));
            logger.newline.mockImplementation(() => callOrder.push('newline'));
            logger.separator.mockImplementation(() => callOrder.push('separator'));
            logger.success.mockImplementation(() => callOrder.push('success'));

            executeClaude.mockImplementation(async () => {
                // Simulate async execution
                await Promise.resolve();
            });

            await commitOrFix('test prompt');

            expect(callOrder).toEqual([
                'stopSpinner',
                'info',
                'newline',
                'newline',
                'separator',
                'success',
            ]);
        });

        test('should call logger methods in correct order on failure', async () => {
            const callOrder = [];

            logger.stopSpinner.mockImplementation(() => callOrder.push('stopSpinner'));
            logger.info.mockImplementation(() => callOrder.push('info'));
            logger.warning.mockImplementation(() => callOrder.push('warning'));

            executeClaude.mockRejectedValue(new Error('Test error'));

            await commitOrFix('test prompt');

            expect(callOrder).toEqual([
                'stopSpinner',
                'info',
                'warning',
            ]);
        });

        test('should handle multiline prompts', async () => {
            const multilinePrompt = 'Line 1\nLine 2\nLine 3';

            await commitOrFix(multilinePrompt);

            const calledPrompt = executeClaude.mock.calls[0][0];
            expect(calledPrompt).toContain(multilinePrompt);
        });

        test('should handle prompts with git commands', async () => {
            const promptWithGit = 'Run git status and then git add .';

            await commitOrFix(promptWithGit);

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining(promptWithGit),
                null,
                expect.objectContaining({ cwd: '/test' }),
            );
        });

        test('should maintain consistency across multiple calls', async () => {
            const prompts = ['prompt1', 'prompt2', 'prompt3'];

            for (const prompt of prompts) {
                await commitOrFix(prompt);

                const calledPrompt = executeClaude.mock.calls[0][0];
                expect(calledPrompt).toContain(prompt);
                expect(calledPrompt).toContain('HARD RULES:');

                // Reset for next iteration
                executeClaude.mockClear();
            }
        });
    });

    describe('smartCommit', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            state.folder = '/test';
            state.claudiomiroFolder = '/test/.claudiomiro/task-executor';
        });

        describe('when no changes to commit', () => {
            test('should return success with no changes message', async () => {
                execSync.mockReturnValue('');

                const result = await smartCommit();

                expect(result).toEqual({
                    success: true,
                    method: 'shell',
                    message: 'No changes to commit',
                });
                expect(logger.info).toHaveBeenCalledWith('📝 No changes to commit');
            });
        });

        describe('when git status fails', () => {
            test('should fall back to Claude', async () => {
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') {
                        throw new Error('Git not installed');
                    }
                    return '';
                });
                executeClaude.mockResolvedValue();

                const result = await smartCommit({ taskName: 'TASK1', shouldPush: true });

                expect(result).toEqual({
                    success: true,
                    method: 'claude',
                });
                expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Using Claude for git operations'));
            });
        });

        describe('when local LLM is not available', () => {
            test('should fall back to Claude', async () => {
                execSync.mockReturnValue('M file.js\n');
                getLocalLLMService.mockReturnValue(null);
                executeClaude.mockResolvedValue();

                const result = await smartCommit();

                expect(result).toEqual({
                    success: true,
                    method: 'claude',
                });
                expect(logger.debug).toHaveBeenCalledWith('[Git] Local LLM not available, falling back to Claude');
            });
        });

        describe('when local LLM is available', () => {
            let mockLLM;

            beforeEach(() => {
                mockLLM = {
                    initialize: jest.fn().mockResolvedValue(),
                    isAvailable: jest.fn().mockReturnValue(true),
                    generateCommitMessage: jest.fn().mockResolvedValue({
                        title: 'feat: add new feature',
                        body: 'This adds a new feature to the system',
                    }),
                };
                getLocalLLMService.mockReturnValue(mockLLM);
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    return '';
                });
            });

            test('should commit via shell with Ollama message', async () => {
                const result = await smartCommit({ taskName: 'TASK1' });

                expect(result).toEqual({
                    success: true,
                    method: 'shell',
                });
                expect(logger.success).toHaveBeenCalledWith('✅ Commit successful via shell');
            });

            test('should stage all changes before commit', async () => {
                await smartCommit();

                expect(execSync).toHaveBeenCalledWith('git add .', expect.objectContaining({
                    cwd: '/test',
                }));
            });

            test('should include commit body when present', async () => {
                mockLLM.generateCommitMessage.mockResolvedValue({
                    title: 'feat: new feature',
                    body: 'Detailed description here',
                });

                await smartCommit();

                expect(execSync).toHaveBeenCalledWith(
                    expect.stringContaining('git commit -m'),
                    expect.any(Object),
                );
            });

            test('should push when shouldPush is true', async () => {
                await smartCommit({ shouldPush: true });

                expect(execSync).toHaveBeenCalledWith('git push', expect.objectContaining({
                    cwd: '/test',
                    timeout: 60000,
                }));
                expect(logger.success).toHaveBeenCalledWith('✅ Push successful');
            });

            test('should not push when shouldPush is false', async () => {
                await smartCommit({ shouldPush: false });

                const pushCalls = execSync.mock.calls.filter(call => call[0] === 'git push');
                expect(pushCalls).toHaveLength(0);
            });

            test('should fall back to Claude when push fails and createPR is true', async () => {
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    if (cmd === 'git push') throw new Error('Push rejected');
                    return '';
                });
                executeClaude.mockResolvedValue();

                const result = await smartCommit({ shouldPush: true, createPR: true });

                expect(result).toEqual({
                    success: true,
                    method: 'claude',
                });
                expect(logger.warning).toHaveBeenCalledWith('⚠️ Push failed: Push rejected');
            });

            test('should return success when push fails but createPR is false', async () => {
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    if (cmd === 'git push') throw new Error('Push rejected');
                    return '';
                });

                const result = await smartCommit({ shouldPush: true, createPR: false });

                expect(result).toEqual({
                    success: true,
                    method: 'shell',
                    message: 'Commit succeeded, push failed',
                });
            });

            test('should use Claude for PR creation', async () => {
                executeClaude.mockResolvedValue();

                const result = await smartCommit({ createPR: true });

                expect(result).toEqual({
                    success: true,
                    method: 'claude',
                });
                expect(logger.info).toHaveBeenCalledWith('🔗 Creating PR via Claude...');
            });

            test('should read TASK.md for task description', async () => {
                fs.existsSync.mockReturnValue(true);
                fs.readFileSync.mockReturnValue('Task description from file');

                await smartCommit({ taskName: 'TASK1' });

                expect(fs.existsSync).toHaveBeenCalledWith('/test/.claudiomiro/task-executor/TASK1/TASK.md');
                expect(fs.readFileSync).toHaveBeenCalledWith('/test/.claudiomiro/task-executor/TASK1/TASK.md', 'utf-8');
            });
        });

        describe('when shell commit fails', () => {
            test('should fall back to Claude', async () => {
                const mockLLM = {
                    initialize: jest.fn().mockResolvedValue(),
                    isAvailable: jest.fn().mockReturnValue(true),
                    generateCommitMessage: jest.fn().mockResolvedValue({
                        title: 'feat: new feature',
                        body: '',
                    }),
                };
                getLocalLLMService.mockReturnValue(mockLLM);
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    if (cmd.startsWith('git commit')) throw new Error('Commit failed');
                    return '';
                });
                executeClaude.mockResolvedValue();

                const result = await smartCommit();

                expect(result).toEqual({
                    success: true,
                    method: 'claude',
                });
                expect(logger.debug).toHaveBeenCalledWith('[Git] Shell commit failed: Commit failed');
            });
        });

        describe('default parameters', () => {
            test('should use defaults when no options provided', async () => {
                execSync.mockReturnValue('');

                await smartCommit();

                expect(logger.stopSpinner).toHaveBeenCalled();
            });

            test('should use taskName when provided', async () => {
                execSync.mockReturnValue('M file.js\n');
                getLocalLLMService.mockReturnValue(null);
                executeClaude.mockResolvedValue();

                await smartCommit({ taskName: 'TASK1' });

                expect(executeClaude).toHaveBeenCalledWith(
                    expect.stringContaining('git add'),
                    'TASK1',
                    expect.objectContaining({ cwd: '/test' }),
                );
                // Verify new detailed prompt format
                const calledPrompt = executeClaude.mock.calls[0][0];
                expect(calledPrompt).toContain('DETAILED commit message');
            });
        });

        describe('cwd parameter', () => {
            test('should use state.folder when cwd not provided', async () => {
                execSync.mockReturnValue('');
                state.folder = '/default/folder';

                await smartCommit();

                expect(execSync).toHaveBeenCalledWith('git status --porcelain', expect.objectContaining({
                    cwd: '/default/folder',
                }));
            });

            test('should use custom cwd for git status when provided', async () => {
                execSync.mockReturnValue('');

                await smartCommit({ cwd: '/custom/repo' });

                expect(execSync).toHaveBeenCalledWith('git status --porcelain', expect.objectContaining({
                    cwd: '/custom/repo',
                }));
            });

            test('should use custom cwd for git add when provided', async () => {
                const mockLLM = {
                    initialize: jest.fn().mockResolvedValue(),
                    isAvailable: jest.fn().mockReturnValue(true),
                    generateCommitMessage: jest.fn().mockResolvedValue({
                        title: 'feat: new feature',
                        body: '',
                    }),
                };
                getLocalLLMService.mockReturnValue(mockLLM);
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    return '';
                });

                await smartCommit({ cwd: '/custom/repo' });

                expect(execSync).toHaveBeenCalledWith('git add .', expect.objectContaining({
                    cwd: '/custom/repo',
                }));
            });

            test('should use custom cwd for git commit when provided', async () => {
                const mockLLM = {
                    initialize: jest.fn().mockResolvedValue(),
                    isAvailable: jest.fn().mockReturnValue(true),
                    generateCommitMessage: jest.fn().mockResolvedValue({
                        title: 'feat: new feature',
                        body: '',
                    }),
                };
                getLocalLLMService.mockReturnValue(mockLLM);
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    return '';
                });

                await smartCommit({ cwd: '/custom/repo' });

                expect(execSync).toHaveBeenCalledWith(
                    expect.stringContaining('git commit -m'),
                    expect.objectContaining({ cwd: '/custom/repo' }),
                );
            });

            test('should use custom cwd for git push when provided', async () => {
                const mockLLM = {
                    initialize: jest.fn().mockResolvedValue(),
                    isAvailable: jest.fn().mockReturnValue(true),
                    generateCommitMessage: jest.fn().mockResolvedValue({
                        title: 'feat: new feature',
                        body: '',
                    }),
                };
                getLocalLLMService.mockReturnValue(mockLLM);
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    return '';
                });

                await smartCommit({ cwd: '/custom/repo', shouldPush: true });

                expect(execSync).toHaveBeenCalledWith('git push', expect.objectContaining({
                    cwd: '/custom/repo',
                }));
            });

            test('should pass custom cwd to Claude on fallback', async () => {
                execSync.mockReturnValue('M file.js\n');
                getLocalLLMService.mockReturnValue(null);
                executeClaude.mockResolvedValue();

                await smartCommit({ cwd: '/custom/repo' });

                expect(executeClaude).toHaveBeenCalledWith(
                    expect.stringContaining('git add'),
                    null,
                    expect.objectContaining({ cwd: '/custom/repo' }),
                );
                // Verify new detailed prompt format
                const calledPrompt = executeClaude.mock.calls[0][0];
                expect(calledPrompt).toContain('DETAILED commit message');
            });

            test('should pass custom cwd through all git operations', async () => {
                const mockLLM = {
                    initialize: jest.fn().mockResolvedValue(),
                    isAvailable: jest.fn().mockReturnValue(true),
                    generateCommitMessage: jest.fn().mockResolvedValue({
                        title: 'feat: new feature',
                        body: 'Description',
                    }),
                };
                getLocalLLMService.mockReturnValue(mockLLM);
                execSync.mockImplementation((cmd) => {
                    if (cmd === 'git status --porcelain') return 'M file.js\n';
                    if (cmd === 'git diff --staged --stat') return 'file.js | 5 +++++\n';
                    return '';
                });

                await smartCommit({ cwd: '/custom/repo', shouldPush: true });

                // Verify all git commands received the custom cwd
                const calls = execSync.mock.calls;
                const cwdValues = calls.map(call => call[1]?.cwd);
                expect(cwdValues.every(cwd => cwd === '/custom/repo')).toBe(true);
            });
        });
    });

    describe('commitOrFix', () => {
        describe('cwd parameter', () => {
            test('should pass cwd to executeClaude', async () => {
                executeClaude.mockResolvedValue();

                await commitOrFix('test prompt', 'TASK1', '/custom/repo');

                expect(executeClaude).toHaveBeenCalledWith(
                    expect.any(String),
                    'TASK1',
                    expect.objectContaining({ cwd: '/custom/repo' }),
                );
            });

            test('should use state.folder when cwd not provided', async () => {
                state.folder = '/default/folder';
                executeClaude.mockResolvedValue();

                await commitOrFix('test prompt', 'TASK1');

                expect(executeClaude).toHaveBeenCalledWith(
                    expect.any(String),
                    'TASK1',
                    expect.objectContaining({ cwd: '/default/folder' }),
                );
            });

            test('should use null cwd as state.folder', async () => {
                state.folder = '/state/folder';
                executeClaude.mockResolvedValue();

                await commitOrFix('test prompt', 'TASK1', null);

                expect(executeClaude).toHaveBeenCalledWith(
                    expect.any(String),
                    'TASK1',
                    expect.objectContaining({ cwd: '/state/folder' }),
                );
            });
        });
    });

    describe('collectRichContext', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            state.folder = '/test';
            state.claudiomiroFolder = '/test/.claudiomiro/task-executor';
        });

        test('should collect changed files from git', () => {
            execSync.mockImplementation((cmd) => {
                if (cmd.includes('git diff --name-only')) {
                    return 'src/file1.js\nsrc/file2.js\n';
                }
                if (cmd.includes('git diff --stat')) {
                    return ' src/file1.js | 10 ++++\n src/file2.js | 5 ++\n';
                }
                return '';
            });
            fs.existsSync.mockReturnValue(false);

            const context = collectRichContext();

            expect(context.changedFiles).toContain('src/file1.js');
            expect(context.changedFiles).toContain('src/file2.js');
            expect(context.diffSummary).toContain('10 ++++');
        });

        test('should collect CODE_REVIEW.md content from tasks', () => {
            execSync.mockReturnValue('');
            fs.existsSync.mockImplementation((path) => {
                if (path === '/test/.claudiomiro/task-executor') return true;
                if (path.includes('CODE_REVIEW.md')) return true;
                if (path.includes('TASK.md')) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('CODE_REVIEW.md')) {
                    return 'Code review passed. All tests pass.';
                }
                if (path.includes('TASK.md')) {
                    return 'Implement feature X with validation';
                }
                return '';
            });

            const context = collectRichContext();

            expect(context.codeReviews).toContain('TASK1');
            expect(context.codeReviews).toContain('Code review passed');
            expect(context.taskDescriptions).toContain('Implement feature X');
        });

        test('should collect INITIAL_PROMPT.md content', () => {
            execSync.mockReturnValue('');
            fs.existsSync.mockImplementation((path) => {
                if (path === '/test/.claudiomiro/task-executor') return true;
                if (path.includes('INITIAL_PROMPT.md')) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue([]);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('INITIAL_PROMPT.md')) {
                    return 'Build a user authentication system with JWT';
                }
                return '';
            });

            const context = collectRichContext();

            expect(context.initialPrompt).toContain('user authentication');
        });

        test('should handle missing claudiomiroFolder gracefully', () => {
            execSync.mockReturnValue('');
            fs.existsSync.mockReturnValue(false);

            const context = collectRichContext();

            expect(context.changedFiles).toBe('');
            expect(context.codeReviews).toBe('');
            expect(context.taskDescriptions).toBe('');
            expect(context.initialPrompt).toBe('');
        });

        test('should handle git errors gracefully', () => {
            execSync.mockImplementation(() => {
                throw new Error('Git not available');
            });
            fs.existsSync.mockReturnValue(false);

            const context = collectRichContext();

            expect(context.changedFiles).toBe('');
            expect(context.diffSummary).toBe('');
        });

        test('should use custom cwd when provided', () => {
            execSync.mockReturnValue('custom/file.js\n');
            fs.existsSync.mockReturnValue(false);

            collectRichContext('/custom/repo');

            expect(execSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ cwd: '/custom/repo' }),
            );
        });

        test('should truncate long content', () => {
            const longContent = 'x'.repeat(2000);
            execSync.mockReturnValue('');
            fs.existsSync.mockImplementation((path) => {
                if (path === '/test/.claudiomiro/task-executor') return true;
                if (path.includes('CODE_REVIEW.md')) return true;
                return false;
            });
            fs.readdirSync.mockReturnValue(['TASK1']);
            fs.readFileSync.mockReturnValue(longContent);

            const context = collectRichContext();

            // CODE_REVIEW.md content should be limited to 1000 chars per task
            expect(context.codeReviews.length).toBeLessThan(longContent.length);
        });
    });
});
