const fs = require('fs');
const path = require('path');

const {
    generateLimitationsContent,
    generateLimitations,
    shouldGenerateLimitations,
    getBlockedSummary,
    escapeMarkdown,
} = require('./limitations-generator');

// Mock fs module
jest.mock('fs');

describe('limitations-generator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(false);
        fs.writeFileSync.mockImplementation(() => {});
        fs.readFileSync.mockReturnValue('');
    });

    describe('escapeMarkdown', () => {
        test('should escape pipe characters', () => {
            expect(escapeMarkdown('test|value')).toBe('test\\|value');
        });

        test('should replace newlines with spaces', () => {
            expect(escapeMarkdown('line1\nline2')).toBe('line1 line2');
        });

        test('should handle empty strings', () => {
            expect(escapeMarkdown('')).toBe('');
            expect(escapeMarkdown(null)).toBe('');
            expect(escapeMarkdown(undefined)).toBe('');
        });

        test('should convert numbers to strings', () => {
            expect(escapeMarkdown(123)).toBe('123');
        });
    });

    describe('generateLimitationsContent', () => {
        test('should return null when no blocked criteria', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'Test 1', passed: true },
                ],
            };

            const content = generateLimitationsContent(execution);
            expect(content).toBeNull();
        });

        test('should generate content for blocked criteria', () => {
            const execution = {
                taskId: 'TASK1',
                successCriteria: [
                    {
                        criterion: 'Tests pass',
                        status: 'blocked',
                        blockReason: 'Service unavailable',
                        workaround: 'Manual testing',
                        attemptCount: 10,
                    },
                ],
            };

            const content = generateLimitationsContent(execution, { includeTimestamp: false });

            expect(content).toContain('# Limitations');
            expect(content).toContain('Task: TASK1');
            expect(content).toContain('Tests pass');
            expect(content).toContain('Service unavailable');
            expect(content).toContain('Manual testing');
            expect(content).toContain('10');
        });

        test('should include recommendations section', () => {
            const execution = {
                successCriteria: [
                    {
                        criterion: 'Build succeeds',
                        status: 'blocked',
                        blockReason: 'Missing dependency',
                        workaround: 'Install manually',
                        forFuture: 'Add dependency to package.json',
                    },
                ],
            };

            const content = generateLimitationsContent(execution, { includeTimestamp: false });

            expect(content).toContain('## Recommendations for Future');
            expect(content).toContain('Add dependency to package.json');
        });

        test('should include auto-adjust information when enabled', () => {
            const execution = {
                successCriteria: [
                    {
                        criterion: 'Test',
                        status: 'blocked',
                        blockReason: 'Reason',
                        workaround: 'Work',
                    },
                ],
                autoAdjustMode: true,
                autoAdjustReason: 'Enabled after 6 failed attempts',
            };

            const content = generateLimitationsContent(execution, { includeTimestamp: false });

            expect(content).toContain('Auto-adjust mode was enabled');
            expect(content).toContain('6 failed attempts');
        });

        test('should handle multiple blocked criteria', () => {
            const execution = {
                successCriteria: [
                    {
                        criterion: 'Test 1',
                        status: 'blocked',
                        blockReason: 'Reason 1',
                        workaround: 'Work 1',
                    },
                    {
                        criterion: 'Test 2',
                        status: 'blocked',
                        blockReason: 'Reason 2',
                        workaround: 'Work 2',
                    },
                    { criterion: 'Test 3', passed: true },
                ],
            };

            const content = generateLimitationsContent(execution, { includeTimestamp: false });

            expect(content).toContain('**2 blocked criteria**');
            expect(content).toContain('Test 1');
            expect(content).toContain('Test 2');
            expect(content).not.toContain('Test 3');
        });
    });

    describe('generateLimitations', () => {
        test('should not generate file when no blocked criteria', () => {
            const execution = {
                successCriteria: [{ criterion: 'Test', passed: true }],
            };

            const result = generateLimitations(execution, '/task/folder');

            expect(result.generated).toBe(false);
            expect(result.path).toBeNull();
            expect(result.blockedCount).toBe(0);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should generate file when blocked criteria exist', () => {
            const execution = {
                successCriteria: [
                    {
                        criterion: 'Test',
                        status: 'blocked',
                        blockReason: 'Reason',
                        workaround: 'Work',
                    },
                ],
            };

            const result = generateLimitations(execution, '/task/folder');

            expect(result.generated).toBe(true);
            expect(result.path).toBe(path.join('/task/folder', 'LIMITATIONS.md'));
            expect(result.blockedCount).toBe(1);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/task/folder', 'LIMITATIONS.md'),
                expect.any(String),
                'utf-8',
            );
        });

        test('should append to existing file when append option is true', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Previous content');

            const execution = {
                successCriteria: [
                    {
                        criterion: 'Test',
                        status: 'blocked',
                        blockReason: 'Reason',
                        workaround: 'Work',
                    },
                ],
            };

            generateLimitations(execution, '/task/folder', { append: true });

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenContent = fs.writeFileSync.mock.calls[0][1];
            expect(writtenContent).toContain('Previous Limitations');
            expect(writtenContent).toContain('# Previous content');
        });
    });

    describe('shouldGenerateLimitations', () => {
        test('should return false when no blocked criteria', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'Test', passed: true },
                ],
            };

            expect(shouldGenerateLimitations(execution)).toBe(false);
        });

        test('should return true when blocked criteria exist', () => {
            const execution = {
                successCriteria: [
                    {
                        criterion: 'Test',
                        status: 'blocked',
                        blockReason: 'Reason',
                        workaround: 'Work',
                    },
                ],
            };

            expect(shouldGenerateLimitations(execution)).toBe(true);
        });

        test('should return false for empty criteria', () => {
            expect(shouldGenerateLimitations({})).toBe(false);
            expect(shouldGenerateLimitations({ successCriteria: [] })).toBe(false);
        });
    });

    describe('getBlockedSummary', () => {
        test('should return correct counts', () => {
            const execution = {
                successCriteria: [
                    { criterion: 'Test 1', passed: true },
                    { criterion: 'Test 2', passed: true },
                    {
                        criterion: 'Test 3',
                        status: 'blocked',
                        blockReason: 'Reason',
                    },
                    { criterion: 'Test 4', passed: false, status: 'failed' },
                ],
            };

            const summary = getBlockedSummary(execution);

            expect(summary.total).toBe(4);
            expect(summary.passed).toBe(2);
            expect(summary.blocked).toBe(1);
            expect(summary.failed).toBe(1);
        });

        test('should include blocked criteria details', () => {
            const execution = {
                successCriteria: [
                    {
                        criterion: 'Database test',
                        status: 'blocked',
                        blockReason: 'DB not available',
                    },
                ],
            };

            const summary = getBlockedSummary(execution);

            expect(summary.blockedCriteria).toHaveLength(1);
            expect(summary.blockedCriteria[0].criterion).toBe('Database test');
            expect(summary.blockedCriteria[0].reason).toBe('DB not available');
        });

        test('should handle empty execution', () => {
            const summary = getBlockedSummary({});

            expect(summary.total).toBe(0);
            expect(summary.passed).toBe(0);
            expect(summary.blocked).toBe(0);
            expect(summary.failed).toBe(0);
            expect(summary.blockedCriteria).toHaveLength(0);
        });
    });
});
