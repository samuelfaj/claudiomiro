const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../../shared/utils/logger');
jest.mock('../../shared/config/state');
jest.mock('../loop-fixes/executor');

const { run, getLevelPrompt, getLevelName } = require('./index');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { loopFixes } = require('../loop-fixes/executor');

describe('fix-branch command', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('level1.md')) {
                return 'CORRECTION LEVEL: 1 (BLOCKERS ONLY)\nYou MUST ONLY report [BLOCKER] issues';
            }
            if (filePath.includes('level2.md')) {
                return 'CORRECTION LEVEL: 2 (BLOCKERS + WARNINGS)\nReport [BLOCKER] and [WARNING] issues ONLY';
            }
            if (filePath.includes('level3.md')) {
                return 'CORRECTION LEVEL: 3 (COMPREHENSIVE REVIEW)\nReport [BLOCKER], [WARNING], and [SUGGESTION] issues';
            }
            return 'Mock content';
        });
        loopFixes.mockResolvedValue();
        state.setFolder = jest.fn();
        state.isMultiRepo = jest.fn().mockReturnValue(false);
        state.getRepository = jest.fn();
    });

    describe('getLevelPrompt', () => {
        test('should return blockers only prompt for level 1', () => {
            const prompt = getLevelPrompt(1);

            expect(prompt).toContain('CORRECTION LEVEL: 1');
            expect(prompt).toContain('BLOCKERS ONLY');
            expect(prompt).toContain('[BLOCKER]');
        });

        test('should return blockers + warnings prompt for level 2', () => {
            const prompt = getLevelPrompt(2);

            expect(prompt).toContain('CORRECTION LEVEL: 2');
            expect(prompt).toContain('BLOCKERS + WARNINGS');
            expect(prompt).toContain('[BLOCKER]');
            expect(prompt).toContain('[WARNING]');
        });

        test('should return comprehensive review prompt for level 3', () => {
            const prompt = getLevelPrompt(3);

            expect(prompt).toContain('CORRECTION LEVEL: 3');
            expect(prompt).toContain('COMPREHENSIVE REVIEW');
            expect(prompt).toContain('[BLOCKER]');
            expect(prompt).toContain('[WARNING]');
            expect(prompt).toContain('[SUGGESTION]');
        });

        test('should throw error if level file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            expect(() => getLevelPrompt(1)).toThrow('fix-branch level1.md not found');
        });

        test('should read from correct level file path', () => {
            getLevelPrompt(2);

            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('level2.md'),
                'utf-8',
            );
        });
    });

    describe('getLevelName', () => {
        test('should return "blockers only" for level 1', () => {
            expect(getLevelName(1)).toBe('blockers only');
        });

        test('should return "blockers + warnings" for level 2', () => {
            expect(getLevelName(2)).toBe('blockers + warnings');
        });

        test('should return "all issues" for level 3', () => {
            expect(getLevelName(3)).toBe('all issues');
        });
    });

    describe('run', () => {
        test('should run with default max iterations (20) and level 1', async () => {
            await run([]);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('CORRECTION LEVEL: 1'),
                20,
                { clearFolder: true },
            );
        });

        test('should use --limit argument when provided', async () => {
            await run(['--limit=5']);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('CORRECTION LEVEL: 1'),
                5,
                { clearFolder: true },
            );
        });

        test('should use Infinity when --no-limit is provided', async () => {
            await run(['--no-limit']);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('CORRECTION LEVEL: 1'),
                Infinity,
                { clearFolder: true },
            );
        });

        test('should set folder from positional argument', async () => {
            await run(['/custom/path']);

            expect(state.setFolder).toHaveBeenCalledWith('/custom/path');
        });

        test('should use process.cwd() when no folder provided', async () => {
            const originalCwd = process.cwd();

            await run([]);

            expect(state.setFolder).toHaveBeenCalledWith(originalCwd);
        });

        test('should ignore --limit when --no-limit is also provided', async () => {
            await run(['--no-limit', '--limit=5']);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('CORRECTION LEVEL: 1'),
                Infinity,
                { clearFolder: true },
            );
        });

        test('should log start messages with level info', async () => {
            await run([]);

            expect(logger.info).toHaveBeenCalledWith(
                'Starting fix-branch (Staff+ Engineer Code Review)...',
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('level: 1 - blockers only'),
            );
        });

        test('should handle folder with --limit option', async () => {
            await run(['--limit=3', '/my/project']);

            expect(state.setFolder).toHaveBeenCalledWith('/my/project');
            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('CORRECTION LEVEL: 1'),
                3,
                { clearFolder: true },
            );
        });

        test('should propagate errors from loopFixes', async () => {
            const error = new Error('Loop failed');
            loopFixes.mockRejectedValue(error);

            await expect(run([])).rejects.toThrow('Loop failed');
        });

        test('should throw error if level file is missing', async () => {
            fs.existsSync.mockReturnValue(false);

            await expect(run([])).rejects.toThrow('fix-branch level1.md not found');
        });

        // Level argument tests
        describe('level argument', () => {
            test('should use level 1 by default', async () => {
                await run([]);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should parse --level=1 correctly', async () => {
                await run(['--level=1']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should parse --level=2 correctly', async () => {
                await run(['--level=2']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20,
                    { clearFolder: true },
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('level: 2 - blockers + warnings'),
                );
            });

            test('should parse --level=3 correctly', async () => {
                await run(['--level=3']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 3'),
                    20,
                    { clearFolder: true },
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('level: 3 - all issues'),
                );
            });

            test('should throw error for invalid level', async () => {
                await expect(run(['--level=4'])).rejects.toThrow(
                    'Invalid level. Use --level=1, --level=2, or --level=3',
                );
            });

            test('should throw error for invalid level 0', async () => {
                await expect(run(['--level=0'])).rejects.toThrow(
                    'Invalid level. Use --level=1, --level=2, or --level=3',
                );
            });

            test('should use --blockers-only shortcut', async () => {
                await run(['--blockers-only']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should use --no-suggestions shortcut', async () => {
                await run(['--no-suggestions']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should give --blockers-only precedence over --level', async () => {
                await run(['--blockers-only', '--level=3']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should give --no-suggestions precedence over --level', async () => {
                await run(['--no-suggestions', '--level=3']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should combine level with --limit', async () => {
                await run(['--level=2', '--limit=5']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    5,
                    { clearFolder: true },
                );
            });

            test('should combine level with --no-limit', async () => {
                await run(['--level=3', '--no-limit']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 3'),
                    Infinity,
                    { clearFolder: true },
                );
            });

            test('should combine level with folder argument', async () => {
                await run(['--level=2', '/my/project']);

                expect(state.setFolder).toHaveBeenCalledWith('/my/project');
                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20,
                    { clearFolder: true },
                );
            });

            test('should use --no-clear flag to set clearFolder to false', async () => {
                await run(['--no-clear']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: false },
                );
            });

            test('should combine --no-clear with other options', async () => {
                await run(['--level=2', '--limit=5', '--no-clear', '/my/project']);

                expect(state.setFolder).toHaveBeenCalledWith('/my/project');
                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    5,
                    { clearFolder: false },
                );
            });
        });

        describe('multi-repo mode', () => {
            beforeEach(() => {
                state.isMultiRepo.mockReturnValue(true);
                state.getRepository.mockImplementation((scope) => {
                    if (scope === 'backend') return '/path/to/backend';
                    if (scope === 'frontend') return '/path/to/frontend';
                    return null;
                });
            });

            test('should run loopFixes for both repositories in multi-repo mode', async () => {
                await run([]);

                expect(state.isMultiRepo).toHaveBeenCalled();
                expect(state.getRepository).toHaveBeenCalledWith('backend');
                expect(state.getRepository).toHaveBeenCalledWith('frontend');
                expect(loopFixes).toHaveBeenCalledTimes(2);
            });

            test('should set folder for each repository before running loopFixes', async () => {
                await run([]);

                expect(state.setFolder).toHaveBeenCalledWith('/path/to/backend');
                expect(state.setFolder).toHaveBeenCalledWith('/path/to/frontend');
            });

            test('should run backend first, then frontend', async () => {
                const callOrder = [];
                state.setFolder.mockImplementation((path) => {
                    callOrder.push(`setFolder:${path}`);
                });
                loopFixes.mockImplementation(() => {
                    callOrder.push('loopFixes');
                    return Promise.resolve();
                });

                await run([]);

                expect(callOrder).toEqual([
                    'setFolder:' + process.cwd(), // Initial setFolder call
                    'setFolder:/path/to/backend',
                    'loopFixes',
                    'setFolder:/path/to/frontend',
                    'loopFixes',
                ]);
            });

            test('should pass correct options to loopFixes for each repository', async () => {
                await run(['--level=2', '--limit=5']);

                expect(loopFixes).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    5,
                    { clearFolder: true },
                );
                expect(loopFixes).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    5,
                    { clearFolder: true },
                );
            });

            test('should respect --no-clear flag in multi-repo mode', async () => {
                await run(['--no-clear']);

                expect(loopFixes).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: false },
                );
                expect(loopFixes).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20,
                    { clearFolder: false },
                );
            });

            test('should log multi-repo mode message', async () => {
                await run([]);

                expect(logger.info).toHaveBeenCalledWith(
                    '🔀 Multi-repo mode detected - reviewing both repositories',
                );
            });

            test('should log completion message for each repository', async () => {
                await run([]);

                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('Processing Backend repository'),
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('Backend repository review completed'),
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('Processing Frontend repository'),
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('Frontend repository review completed'),
                );
            });

            test('should log final success message', async () => {
                await run([]);

                expect(logger.info).toHaveBeenCalledWith(
                    '\n✅ All repositories reviewed successfully',
                );
            });

            test('should propagate errors from backend loopFixes', async () => {
                const error = new Error('Backend loop failed');
                loopFixes.mockRejectedValueOnce(error);

                await expect(run([])).rejects.toThrow('Backend loop failed');
            });

            test('should propagate errors from frontend loopFixes', async () => {
                loopFixes
                    .mockResolvedValueOnce() // Backend succeeds
                    .mockRejectedValueOnce(new Error('Frontend loop failed')); // Frontend fails

                await expect(run([])).rejects.toThrow('Frontend loop failed');
            });

            test('should not run frontend if backend fails', async () => {
                loopFixes.mockRejectedValueOnce(new Error('Backend failed'));

                await expect(run([])).rejects.toThrow('Backend failed');
                expect(loopFixes).toHaveBeenCalledTimes(1);
            });
        });
    });
});
