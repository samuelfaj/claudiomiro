const { parseTaskScope, validateScope, validateScopeWithAutoFix } = require('./scope-parser');

// Mock scope-fixer for validateScopeWithAutoFix tests
jest.mock('./scope-fixer', () => ({
    autoFixScope: jest.fn(),
}));

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

    describe('validateScopeWithAutoFix', () => {
        const { autoFixScope } = require('./scope-fixer');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('returns valid without auto-fix in single-repo mode', async () => {
            const result = await validateScopeWithAutoFix(null, false, 'TASK1');
            expect(result).toEqual({ valid: true, scope: null, autoFixed: false });
            expect(autoFixScope).not.toHaveBeenCalled();
        });

        test('returns valid with existing scope in multi-repo mode', async () => {
            const result = await validateScopeWithAutoFix('backend', true, 'TASK1');
            expect(result).toEqual({ valid: true, scope: 'backend', autoFixed: false });
            expect(autoFixScope).not.toHaveBeenCalled();
        });

        test('attempts auto-fix when scope missing in multi-repo mode', async () => {
            autoFixScope.mockResolvedValue('frontend');

            const result = await validateScopeWithAutoFix(null, true, 'TASK1');

            expect(result).toEqual({ valid: true, scope: 'frontend', autoFixed: true });
            expect(autoFixScope).toHaveBeenCalledWith('TASK1');
        });

        test('returns invalid when auto-fix fails in multi-repo mode', async () => {
            autoFixScope.mockResolvedValue(null);

            const result = await validateScopeWithAutoFix(null, true, 'TASK1');

            expect(result).toEqual({ valid: false, scope: null, autoFixed: false });
            expect(autoFixScope).toHaveBeenCalledWith('TASK1');
        });

        test('returns auto-fixed scope when detection succeeds', async () => {
            autoFixScope.mockResolvedValue('integration');

            const result = await validateScopeWithAutoFix(null, true, 'TASK2.1');

            expect(result.valid).toBe(true);
            expect(result.scope).toBe('integration');
            expect(result.autoFixed).toBe(true);
        });
    });
});
