/**
 * Completion Detector Fallback Tests
 * Self-contained tests following Claudiomiro conventions
 */

const {
    isFullyImplemented,
    hasApprovedCodeReview,
    getCheckboxCompletion,
    hasPendingTodos,
    analyzeCompletion,
} = require('./completion-detector');

describe('completion-detector', () => {
    describe('isFullyImplemented', () => {
        test('should return true for "Fully implemented: YES"', () => {
            const content = `# Task
Fully implemented: YES

Some content here`;

            expect(isFullyImplemented(content)).toBe(true);
        });

        test('should return true for "Fully implemented: yes" (lowercase)', () => {
            const content = 'Fully implemented: yes\nContent';

            expect(isFullyImplemented(content)).toBe(true);
        });

        test('should return true for "Status: Complete"', () => {
            const content = 'Status: Complete\nAll done';

            expect(isFullyImplemented(content)).toBe(true);
        });

        test('should return true for "Status: Done"', () => {
            const content = 'Status: Done';

            expect(isFullyImplemented(content)).toBe(true);
        });

        test('should return true for "[x] Fully implemented" checkbox', () => {
            const content = `Tasks:
[x] Fully implemented
[x] Tests pass`;

            expect(isFullyImplemented(content)).toBe(true);
        });

        test('should return false for "Fully implemented: NO"', () => {
            const content = 'Fully implemented: NO\nStill working';

            expect(isFullyImplemented(content)).toBe(false);
        });

        test('should return false for "Status: Pending"', () => {
            const content = 'Status: Pending\nIn progress';

            expect(isFullyImplemented(content)).toBe(false);
        });

        test('should return false for "Status: In Progress"', () => {
            const content = 'Status: In Progress';

            expect(isFullyImplemented(content)).toBe(false);
        });

        test('should return false for empty content', () => {
            expect(isFullyImplemented('')).toBe(false);
            expect(isFullyImplemented(null)).toBe(false);
            expect(isFullyImplemented(undefined)).toBe(false);
        });

        test('should check only first 20 lines for status', () => {
            const lines = Array(25).fill('Some content');
            lines[22] = 'Fully implemented: YES'; // After line 20
            const content = lines.join('\n');

            expect(isFullyImplemented(content)).toBe(false);
        });
    });

    describe('hasApprovedCodeReview', () => {
        test('should return true for approved status section', () => {
            const content = `# Code Review

## Status

Approved - all checks passed

## Comments

Looks good`;

            expect(hasApprovedCodeReview(content)).toBe(true);
        });

        test('should return true for LGTM in status', () => {
            const content = '## Status\nLGTM';

            expect(hasApprovedCodeReview(content)).toBe(true);
        });

        test('should return true for "Verdict: Approved"', () => {
            const content = 'Verdict: Approved';

            expect(hasApprovedCodeReview(content)).toBe(true);
        });

        test('should return false for rejected status', () => {
            const content = `## Status

Rejected - needs changes`;

            expect(hasApprovedCodeReview(content)).toBe(false);
        });

        test('should return false for failed status', () => {
            const content = '## Status\nFailed';

            expect(hasApprovedCodeReview(content)).toBe(false);
        });

        test('should return false for empty content', () => {
            expect(hasApprovedCodeReview('')).toBe(false);
            expect(hasApprovedCodeReview(null)).toBe(false);
        });
    });

    describe('getCheckboxCompletion', () => {
        test('should count checked and unchecked boxes', () => {
            const content = `- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4`;

            const result = getCheckboxCompletion(content);

            expect(result.completed).toBe(2);
            expect(result.total).toBe(4);
            expect(result.percentage).toBe(50);
        });

        test('should return 100% for all checked', () => {
            const content = `- [x] Task 1
- [x] Task 2`;

            const result = getCheckboxCompletion(content);

            expect(result.percentage).toBe(100);
        });

        test('should return 0% for none checked', () => {
            const content = `- [ ] Task 1
- [ ] Task 2`;

            const result = getCheckboxCompletion(content);

            expect(result.percentage).toBe(0);
        });

        test('should handle no checkboxes', () => {
            const content = 'No checkboxes here';

            const result = getCheckboxCompletion(content);

            expect(result.total).toBe(0);
            expect(result.percentage).toBe(0);
        });

        test('should handle empty content', () => {
            const result = getCheckboxCompletion('');

            expect(result).toEqual({ completed: 0, total: 0, percentage: 0 });
        });
    });

    describe('hasPendingTodos', () => {
        test('should detect TODO markers', () => {
            const content = 'Some code\n// TODO: fix this\nMore code';

            expect(hasPendingTodos(content)).toBe(true);
        });

        test('should detect FIXME markers', () => {
            const content = '// FIXME: this is broken';

            expect(hasPendingTodos(content)).toBe(true);
        });

        test('should detect unchecked checkboxes', () => {
            const content = '- [ ] Pending task';

            expect(hasPendingTodos(content)).toBe(true);
        });

        test('should detect "pending" keyword', () => {
            const content = 'This feature is pending review';

            expect(hasPendingTodos(content)).toBe(true);
        });

        test('should detect "not implemented" phrase', () => {
            const content = 'This function is not implemented yet';

            expect(hasPendingTodos(content)).toBe(true);
        });

        test('should return false for completed content', () => {
            const content = `All tasks completed:
- [x] Task 1
- [x] Task 2
Everything is done.`;

            expect(hasPendingTodos(content)).toBe(false);
        });

        test('should handle empty content', () => {
            expect(hasPendingTodos('')).toBe(false);
            expect(hasPendingTodos(null)).toBe(false);
        });
    });

    describe('analyzeCompletion', () => {
        test('should return high confidence for completed task', () => {
            const content = `Fully implemented: YES

- [x] Task 1
- [x] Task 2

All done!`;

            const result = analyzeCompletion(content);

            expect(result.completed).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.8);
            expect(result.checkboxes.percentage).toBe(100);
            expect(result.hasPendingTodos).toBe(false);
        });

        test('should return low confidence for incomplete task', () => {
            const content = `Status: Pending

- [ ] Task 1
- [ ] Task 2

TODO: finish this`;

            const result = analyzeCompletion(content);

            expect(result.completed).toBe(false);
            expect(result.hasPendingTodos).toBe(true);
        });

        test('should include reason', () => {
            const result = analyzeCompletion('Fully implemented: YES');

            expect(result.reason).toContain('marker');
        });
    });
});
