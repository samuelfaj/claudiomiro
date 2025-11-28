// Mock cli module BEFORE requiring index
jest.mock('./cli', () => ({
    init: jest.fn().mockResolvedValue(undefined),
}));

const { run } = require('./index');
const { init } = require('./cli');

describe('src/commands/task-executor/index.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('run()', () => {
        test('should call init with provided args', async () => {
            const args = ['.', '--fresh'];

            await run(args);

            expect(init).toHaveBeenCalledWith(args);
            expect(init).toHaveBeenCalledTimes(1);
        });

        test('should call init with empty array when no args provided', async () => {
            await run([]);

            expect(init).toHaveBeenCalledWith([]);
        });

        test('should pass through all args to init', async () => {
            const args = ['.', '--fresh', '--push=false', '--steps=0,1,2'];

            await run(args);

            expect(init).toHaveBeenCalledWith(args);
        });

        test('should return promise that resolves when init completes', async () => {
            const args = ['.'];

            const result = run(args);

            expect(result).toBeInstanceOf(Promise);
            await expect(result).resolves.toBeUndefined();
        });

        test('should propagate errors from init', async () => {
            const error = new Error('Init failed');
            init.mockRejectedValueOnce(error);

            await expect(run(['.'])).rejects.toThrow('Init failed');
        });
    });

    describe('exports', () => {
        test('should export run function', () => {
            expect(run).toBeDefined();
            expect(typeof run).toBe('function');
        });
    });
});
