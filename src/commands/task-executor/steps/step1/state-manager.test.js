const {
    STATE_FILES,
    getStatePaths,
    countPendingItems,
    countCompletedItems,
    isVerificationPhase,
    isVerificationPassed,
    deleteOverview,
    createPassedFile,
    clearStateFiles,
} = require('./state-manager');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../../shared/config/state');
jest.mock('../../../../shared/utils/logger');

const fs = require('fs');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

describe('state-manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        state.claudiomiroFolder = '/test/.claudiomiro/task-executor';
        logger.warning = jest.fn();
        logger.debug = jest.fn();
    });

    describe('STATE_FILES', () => {
        test('should have correct file names', () => {
            expect(STATE_FILES.TODO).toBe('PROMPT_REFINEMENT_TODO.md');
            expect(STATE_FILES.OVERVIEW).toBe('PROMPT_REFINEMENT_OVERVIEW.md');
            expect(STATE_FILES.PASSED).toBe('PROMPT_REFINEMENT_PASSED.md');
        });
    });

    describe('getStatePaths', () => {
        test('should return correct paths based on claudiomiroFolder', () => {
            const paths = getStatePaths();

            expect(paths.todoPath).toBe('/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_TODO.md');
            expect(paths.overviewPath).toBe('/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_OVERVIEW.md');
            expect(paths.passedPath).toBe('/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_PASSED.md');
        });
    });

    describe('countPendingItems', () => {
        test('should return 0 when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const count = countPendingItems('/test/TODO.md');

            expect(count).toBe(0);
        });

        test('should count unchecked items correctly', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# Pending Items

- [ ] First item
- [ ] Second item
- [x] Completed item
- [ ] Third item
            `);

            const count = countPendingItems('/test/TODO.md');

            expect(count).toBe(3);
        });

        test('should return 0 when no pending items', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# All Complete

- [x] First item
- [x] Second item
            `);

            const count = countPendingItems('/test/TODO.md');

            expect(count).toBe(0);
        });

        test('should return 0 and log warning on read error', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const count = countPendingItems('/test/TODO.md');

            expect(count).toBe(0);
            expect(logger.warning).toHaveBeenCalledWith(
                expect.stringContaining('Could not read'),
            );
        });
    });

    describe('countCompletedItems', () => {
        test('should return 0 when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const count = countCompletedItems('/test/TODO.md');

            expect(count).toBe(0);
        });

        test('should count checked items correctly (case-insensitive)', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# Items

- [x] First item
- [X] Second item (uppercase)
- [ ] Pending item
- [x] Third item
            `);

            const count = countCompletedItems('/test/TODO.md');

            expect(count).toBe(3);
        });

        test('should return 0 when no completed items', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# All Pending

- [ ] First item
- [ ] Second item
            `);

            const count = countCompletedItems('/test/TODO.md');

            expect(count).toBe(0);
        });

        test('should return 0 and log warning on read error', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const count = countCompletedItems('/test/TODO.md');

            expect(count).toBe(0);
            expect(logger.warning).toHaveBeenCalledWith(
                expect.stringContaining('Could not read'),
            );
        });
    });

    describe('isVerificationPhase', () => {
        test('should return true when OVERVIEW file exists', () => {
            fs.existsSync.mockReturnValue(true);

            const result = isVerificationPhase();

            expect(result).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_OVERVIEW.md',
            );
        });

        test('should return false when OVERVIEW file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = isVerificationPhase();

            expect(result).toBe(false);
        });
    });

    describe('isVerificationPassed', () => {
        test('should return true when PASSED file exists', () => {
            fs.existsSync.mockReturnValue(true);

            const result = isVerificationPassed();

            expect(result).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_PASSED.md',
            );
        });

        test('should return false when PASSED file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = isVerificationPassed();

            expect(result).toBe(false);
        });
    });

    describe('deleteOverview', () => {
        test('should delete OVERVIEW file when it exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {});

            deleteOverview();

            expect(fs.unlinkSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_OVERVIEW.md',
            );
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Deleted OVERVIEW file'),
            );
        });

        test('should do nothing when OVERVIEW file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            deleteOverview();

            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        test('should log warning on delete error', () => {
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {
                throw new Error('Delete error');
            });

            deleteOverview();

            expect(logger.warning).toHaveBeenCalledWith(
                expect.stringContaining('Could not delete'),
            );
        });
    });

    describe('createPassedFile', () => {
        test('should create PASSED file with correct content', () => {
            fs.writeFileSync.mockImplementation(() => {});

            createPassedFile(5, 3);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_PASSED.md',
                expect.stringContaining('AI_PROMPT.md Refinement Passed'),
                'utf-8',
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Total refinement items processed: 5'),
                'utf-8',
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Completed in 3 iteration(s)'),
                'utf-8',
            );
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Created PASSED file'),
            );
        });
    });

    describe('clearStateFiles', () => {
        test('should delete all existing state files', () => {
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {});

            clearStateFiles();

            expect(fs.unlinkSync).toHaveBeenCalledTimes(3);
            expect(fs.unlinkSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_TODO.md',
            );
            expect(fs.unlinkSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_OVERVIEW.md',
            );
            expect(fs.unlinkSync).toHaveBeenCalledWith(
                '/test/.claudiomiro/task-executor/PROMPT_REFINEMENT_PASSED.md',
            );
        });

        test('should handle non-existent files gracefully', () => {
            fs.existsSync.mockReturnValue(false);

            clearStateFiles();

            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        test('should log warning on delete error but continue', () => {
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {
                throw new Error('Delete error');
            });

            clearStateFiles();

            expect(logger.warning).toHaveBeenCalledTimes(3);
        });
    });
});
