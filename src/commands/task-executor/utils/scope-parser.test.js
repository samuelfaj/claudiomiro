const { parseTaskScope, validateScope } = require('./scope-parser');

describe('scope-parser', () => {
    describe('parseTaskScope', () => {
        test('extracts backend scope', () => {
            const content = '@dependencies []\n@scope backend\n# Task';
            expect(parseTaskScope(content)).toBe('backend');
        });

        test('extracts frontend scope', () => {
            const content = '@scope frontend';
            expect(parseTaskScope(content)).toBe('frontend');
        });

        test('extracts integration scope', () => {
            const content = '@scope integration';
            expect(parseTaskScope(content)).toBe('integration');
        });

        test('returns null when no scope', () => {
            const content = '@dependencies []\n# Task';
            expect(parseTaskScope(content)).toBeNull();
        });

        test('is case insensitive', () => {
            const content = '@scope BACKEND';
            expect(parseTaskScope(content)).toBe('backend');
        });

        test('handles mixed case', () => {
            const content = '@scope Frontend';
            expect(parseTaskScope(content)).toBe('frontend');
        });

        test('handles scope in middle of content', () => {
            const content = '# My Task\n\nSome description.\n\n@scope integration\n\nMore content.';
            expect(parseTaskScope(content)).toBe('integration');
        });

        test('handles whitespace variations', () => {
            const content = '@scope   backend  ';
            expect(parseTaskScope(content)).toBe('backend');
        });

        test('returns null for invalid scope value', () => {
            const content = '@scope invalid';
            expect(parseTaskScope(content)).toBeNull();
        });

        test('returns null for empty content', () => {
            expect(parseTaskScope('')).toBeNull();
        });
    });

    describe('validateScope', () => {
        test('returns true in single-repo mode without scope', () => {
            expect(validateScope(null, false)).toBe(true);
        });

        test('returns true in multi-repo mode with scope', () => {
            expect(validateScope('backend', true)).toBe(true);
        });

        test('returns true for frontend scope in multi-repo mode', () => {
            expect(validateScope('frontend', true)).toBe(true);
        });

        test('returns true for integration scope in multi-repo mode', () => {
            expect(validateScope('integration', true)).toBe(true);
        });

        test('throws in multi-repo mode without scope', () => {
            expect(() => validateScope(null, true)).toThrow('@scope tag is required');
        });

        test('error message contains fix instructions', () => {
            expect(() => validateScope(null, true)).toThrow(
                'Add "@scope backend", "@scope frontend", or "@scope integration" to TASK.md',
            );
        });

        test('returns true in single-repo mode with scope', () => {
            expect(validateScope('backend', false)).toBe(true);
        });
    });
});
