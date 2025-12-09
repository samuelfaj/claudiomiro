const {
    createCheckpoint,
    getLastCheckpoint,
    getAllCheckpoints,
    getNextPhase,
    hasCheckpoint,
} = require('./git-checkpoint');

// Mock dependencies
jest.mock('child_process');
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
}));

const { execSync } = require('child_process');

describe('git-checkpoint', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createCheckpoint', () => {
        test('should create checkpoint commit successfully', async () => {
            execSync
                .mockReturnValueOnce('M  src/file.js\n') // git status
                .mockReturnValueOnce('') // git add
                .mockReturnValueOnce('') // git commit
                .mockReturnValueOnce('abc123def456\n'); // git rev-parse

            const result = await createCheckpoint('TASK1', 2, 'Core Implementation', { cwd: '/test' });

            expect(result.success).toBe(true);
            expect(result.commitHash).toBe('abc123def456');
            expect(result.message).toBe('[TASK1] Phase 2: Core Implementation complete');
            expect(execSync).toHaveBeenCalledWith('git status --porcelain', expect.any(Object));
            expect(execSync).toHaveBeenCalledWith('git add -A', expect.any(Object));
            expect(execSync).toHaveBeenCalledWith(
                'git commit -m "[TASK1] Phase 2: Core Implementation complete"',
                expect.any(Object),
            );
        });

        test('should return success with no hash when no changes to commit', async () => {
            execSync.mockReturnValueOnce(''); // git status (no changes)

            const result = await createCheckpoint('TASK1', 1, 'Preparation', { cwd: '/test' });

            expect(result.success).toBe(true);
            expect(result.commitHash).toBeNull();
            expect(result.message).toBe('No changes to commit');
            expect(execSync).toHaveBeenCalledTimes(1);
        });

        test('should handle git errors gracefully', async () => {
            execSync.mockImplementation(() => {
                throw new Error('fatal: not a git repository');
            });

            const result = await createCheckpoint('TASK1', 1, 'Preparation', { cwd: '/test' });

            expect(result.success).toBe(false);
            expect(result.commitHash).toBeNull();
            expect(result.message).toBe('fatal: not a git repository');
        });

        test('should use process.cwd() when no cwd option provided', async () => {
            execSync.mockReturnValueOnce(''); // git status (no changes)

            await createCheckpoint('TASK1', 1, 'Preparation');

            expect(execSync).toHaveBeenCalledWith('git status --porcelain', {
                cwd: process.cwd(),
                encoding: 'utf-8',
            });
        });
    });

    describe('getLastCheckpoint', () => {
        test('should parse last checkpoint from git log', () => {
            execSync.mockReturnValueOnce('abc1234 [TASK1] Phase 2: Core Implementation complete\n');

            const result = getLastCheckpoint('TASK1', { cwd: '/test' });

            expect(result).toEqual({
                commitHash: 'abc1234',
                taskId: 'TASK1',
                phaseNumber: 2,
                phaseName: 'Core Implementation',
            });
        });

        test('should return null when no checkpoints found', () => {
            execSync.mockReturnValueOnce('');

            const result = getLastCheckpoint('TASK1', { cwd: '/test' });

            expect(result).toBeNull();
        });

        test('should return null on git error', () => {
            execSync.mockImplementation(() => {
                throw new Error('git error');
            });

            const result = getLastCheckpoint('TASK1', { cwd: '/test' });

            expect(result).toBeNull();
        });

        test('should return null for non-matching commit format', () => {
            execSync.mockReturnValueOnce('abc1234 Some other commit message\n');

            const result = getLastCheckpoint('TASK1', { cwd: '/test' });

            expect(result).toBeNull();
        });
    });

    describe('getAllCheckpoints', () => {
        test('should parse multiple checkpoints from git log', () => {
            execSync.mockReturnValueOnce(
                'abc1234 [TASK1] Phase 3: Testing complete\n' +
                'def5678 [TASK1] Phase 2: Core Implementation complete\n' +
                'aaa9012 [TASK1] Phase 1: Preparation complete\n',
            );

            const result = getAllCheckpoints('TASK1', { cwd: '/test' });

            expect(result).toHaveLength(3);
            expect(result[0].phaseNumber).toBe(3);
            expect(result[1].phaseNumber).toBe(2);
            expect(result[2].phaseNumber).toBe(1);
        });

        test('should return empty array when no checkpoints found', () => {
            execSync.mockReturnValueOnce('');

            const result = getAllCheckpoints('TASK1', { cwd: '/test' });

            expect(result).toEqual([]);
        });

        test('should return empty array on git error', () => {
            execSync.mockImplementation(() => {
                throw new Error('git error');
            });

            const result = getAllCheckpoints('TASK1', { cwd: '/test' });

            expect(result).toEqual([]);
        });

        test('should respect limit option', () => {
            execSync.mockReturnValueOnce('abc1234 [TASK1] Phase 1: Preparation complete\n');

            getAllCheckpoints('TASK1', { cwd: '/test', limit: 5 });

            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('-5'),
                expect.any(Object),
            );
        });

        test('should use default limit of 10', () => {
            execSync.mockReturnValueOnce('');

            getAllCheckpoints('TASK1', { cwd: '/test' });

            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('-10'),
                expect.any(Object),
            );
        });
    });

    describe('getNextPhase', () => {
        test('should return 1 when no checkpoints exist', () => {
            execSync.mockReturnValueOnce(''); // getLastCheckpoint returns null

            const result = getNextPhase('TASK1', 5, { cwd: '/test' });

            expect(result).toBe(1);
        });

        test('should return next phase after last checkpoint', () => {
            execSync.mockReturnValueOnce('abc1234 [TASK1] Phase 2: Core Implementation complete\n');

            const result = getNextPhase('TASK1', 5, { cwd: '/test' });

            expect(result).toBe(3);
        });

        test('should return last phase when task is complete', () => {
            execSync.mockReturnValueOnce('abc1234 [TASK1] Phase 5: Validation complete\n');

            const result = getNextPhase('TASK1', 5, { cwd: '/test' });

            expect(result).toBe(5);
        });
    });

    describe('hasCheckpoint', () => {
        test('should return true when checkpoint exists for phase', () => {
            execSync.mockReturnValueOnce(
                'abc1234 [TASK1] Phase 2: Core Implementation complete\n' +
                'def5678 [TASK1] Phase 1: Preparation complete\n',
            );

            const result = hasCheckpoint('TASK1', 2, { cwd: '/test' });

            expect(result).toBe(true);
        });

        test('should return false when checkpoint does not exist for phase', () => {
            execSync.mockReturnValueOnce(
                'def5678 [TASK1] Phase 1: Preparation complete\n',
            );

            const result = hasCheckpoint('TASK1', 2, { cwd: '/test' });

            expect(result).toBe(false);
        });

        test('should return false when no checkpoints exist', () => {
            execSync.mockReturnValueOnce('');

            const result = hasCheckpoint('TASK1', 1, { cwd: '/test' });

            expect(result).toBe(false);
        });
    });
});
