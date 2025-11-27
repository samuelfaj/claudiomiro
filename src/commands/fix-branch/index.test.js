const path = require('path');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../../shared/utils/logger');
jest.mock('../../shared/config/state');
jest.mock('../loop-fixes/executor');

const { run, getFixedPrompt, getLevelInstructions, getLevelName } = require('./index');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { loopFixes } = require('../loop-fixes/executor');

describe('fix-branch command', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('Mock fixed prompt content');
        loopFixes.mockResolvedValue();
        state.setFolder = jest.fn();
    });

    describe('getLevelInstructions', () => {
        test('should return blockers only instructions for level 1', () => {
            const instructions = getLevelInstructions(1);

            expect(instructions).toContain('CORRECTION LEVEL: 1');
            expect(instructions).toContain('BLOCKERS ONLY');
            expect(instructions).toContain('DO NOT fix WARNINGS');
            expect(instructions).toContain('DO NOT fix SUGGESTIONS');
        });

        test('should return blockers + warnings instructions for level 2', () => {
            const instructions = getLevelInstructions(2);

            expect(instructions).toContain('CORRECTION LEVEL: 2');
            expect(instructions).toContain('BLOCKERS + WARNINGS');
            expect(instructions).toContain('DO NOT fix SUGGESTIONS');
            expect(instructions).not.toContain('DO NOT fix WARNINGS');
        });

        test('should return all issues instructions for level 3', () => {
            const instructions = getLevelInstructions(3);

            expect(instructions).toContain('CORRECTION LEVEL: 3');
            expect(instructions).toContain('ALL ISSUES');
            expect(instructions).toContain('BLOCKERS, WARNINGS, and SUGGESTIONS');
            expect(instructions).not.toContain('DO NOT fix');
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

    describe('getFixedPrompt', () => {
        test('should read prompt from prompt.md file and append level 1 instructions by default', () => {
            const basePrompt = 'You are a Staff+ Engineer...';
            fs.readFileSync.mockReturnValue(basePrompt);

            const result = getFixedPrompt();

            expect(result).toContain(basePrompt);
            expect(result).toContain('CORRECTION LEVEL: 1');
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('prompt.md'),
                'utf-8'
            );
        });

        test('should append level 2 instructions when level 2 is specified', () => {
            const basePrompt = 'You are a Staff+ Engineer...';
            fs.readFileSync.mockReturnValue(basePrompt);

            const result = getFixedPrompt(2);

            expect(result).toContain(basePrompt);
            expect(result).toContain('CORRECTION LEVEL: 2');
        });

        test('should append level 3 instructions when level 3 is specified', () => {
            const basePrompt = 'You are a Staff+ Engineer...';
            fs.readFileSync.mockReturnValue(basePrompt);

            const result = getFixedPrompt(3);

            expect(result).toContain(basePrompt);
            expect(result).toContain('CORRECTION LEVEL: 3');
        });

        test('should throw error if prompt.md does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            expect(() => getFixedPrompt()).toThrow('fix-branch prompt.md not found');
        });
    });

    describe('run', () => {
        test('should run with default max iterations (20) and level 1', async () => {
            await run([]);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('CORRECTION LEVEL: 1'),
                20
            );
        });

        test('should use --limit argument when provided', async () => {
            await run(['--limit=5']);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('Mock fixed prompt content'),
                5
            );
        });

        test('should use Infinity when --no-limit is provided', async () => {
            await run(['--no-limit']);

            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('Mock fixed prompt content'),
                Infinity
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
                expect.stringContaining('Mock fixed prompt content'),
                Infinity
            );
        });

        test('should log start messages with level info', async () => {
            await run([]);

            expect(logger.info).toHaveBeenCalledWith(
                'Starting fix-branch (Staff+ Engineer Code Review)...'
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('level: 1 - blockers only')
            );
        });

        test('should handle folder with --limit option', async () => {
            await run(['--limit=3', '/my/project']);

            expect(state.setFolder).toHaveBeenCalledWith('/my/project');
            expect(loopFixes).toHaveBeenCalledWith(
                expect.stringContaining('Mock fixed prompt content'),
                3
            );
        });

        test('should propagate errors from loopFixes', async () => {
            const error = new Error('Loop failed');
            loopFixes.mockRejectedValue(error);

            await expect(run([])).rejects.toThrow('Loop failed');
        });

        test('should throw error if prompt.md is missing', async () => {
            fs.existsSync.mockReturnValue(false);

            await expect(run([])).rejects.toThrow('fix-branch prompt.md not found');
        });

        // Level argument tests
        describe('level argument', () => {
            test('should use level 1 by default', async () => {
                await run([]);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20
                );
            });

            test('should parse --level=1 correctly', async () => {
                await run(['--level=1']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20
                );
            });

            test('should parse --level=2 correctly', async () => {
                await run(['--level=2']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('level: 2 - blockers + warnings')
                );
            });

            test('should parse --level=3 correctly', async () => {
                await run(['--level=3']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 3'),
                    20
                );
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('level: 3 - all issues')
                );
            });

            test('should throw error for invalid level', async () => {
                await expect(run(['--level=4'])).rejects.toThrow(
                    'Invalid level. Use --level=1, --level=2, or --level=3'
                );
            });

            test('should throw error for invalid level 0', async () => {
                await expect(run(['--level=0'])).rejects.toThrow(
                    'Invalid level. Use --level=1, --level=2, or --level=3'
                );
            });

            test('should use --blockers-only shortcut', async () => {
                await run(['--blockers-only']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20
                );
            });

            test('should use --no-suggestions shortcut', async () => {
                await run(['--no-suggestions']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20
                );
            });

            test('should give --blockers-only precedence over --level', async () => {
                await run(['--blockers-only', '--level=3']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 1'),
                    20
                );
            });

            test('should give --no-suggestions precedence over --level', async () => {
                await run(['--no-suggestions', '--level=3']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20
                );
            });

            test('should combine level with --limit', async () => {
                await run(['--level=2', '--limit=5']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    5
                );
            });

            test('should combine level with --no-limit', async () => {
                await run(['--level=3', '--no-limit']);

                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 3'),
                    Infinity
                );
            });

            test('should combine level with folder argument', async () => {
                await run(['--level=2', '/my/project']);

                expect(state.setFolder).toHaveBeenCalledWith('/my/project');
                expect(loopFixes).toHaveBeenCalledWith(
                    expect.stringContaining('CORRECTION LEVEL: 2'),
                    20
                );
            });
        });
    });
});
