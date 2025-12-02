describe('context-generator', () => {
    let mockState;

    beforeEach(() => {
        jest.resetModules();

        mockState = {
            hasLegacySystems: jest.fn(),
            getLegacySystem: jest.fn(),
        };

        jest.doMock('../../config/state', () => mockState);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('generateLegacySystemContext', () => {
        test('should return empty string when no legacy systems configured', () => {
            mockState.hasLegacySystems.mockReturnValue(false);

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toBe('');
            expect(mockState.hasLegacySystems).toHaveBeenCalled();
        });

        test('should return markdown with header when single legacy system configured', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockImplementation((type) => {
                if (type === 'system') return '/path/to/legacy-system';
                return null;
            });

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toContain('## Legacy Systems Reference');
            expect(result).toContain('### Legacy System');
            expect(result).toContain('Path: `/path/to/legacy-system`');
            expect(result).not.toContain('### Legacy Backend');
            expect(result).not.toContain('### Legacy Frontend');
        });

        test('should return markdown with all sections when all three types configured', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockImplementation((type) => {
                if (type === 'system') return '/path/to/legacy-system';
                if (type === 'backend') return '/path/to/legacy-backend';
                if (type === 'frontend') return '/path/to/legacy-frontend';
                return null;
            });

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toContain('## Legacy Systems Reference');
            expect(result).toContain('### Legacy System');
            expect(result).toContain('Path: `/path/to/legacy-system`');
            expect(result).toContain('### Legacy Backend');
            expect(result).toContain('Path: `/path/to/legacy-backend`');
            expect(result).toContain('### Legacy Frontend');
            expect(result).toContain('Path: `/path/to/legacy-frontend`');
        });

        test('should include only backend section when only backend configured', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockImplementation((type) => {
                if (type === 'backend') return '/path/to/legacy-backend';
                return null;
            });

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toContain('### Legacy Backend');
            expect(result).toContain('Path: `/path/to/legacy-backend`');
            expect(result).not.toContain('### Legacy System');
            expect(result).not.toContain('### Legacy Frontend');
        });

        test('should include only frontend section when only frontend configured', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockImplementation((type) => {
                if (type === 'frontend') return '/path/to/legacy-frontend';
                return null;
            });

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toContain('### Legacy Frontend');
            expect(result).toContain('Path: `/path/to/legacy-frontend`');
            expect(result).not.toContain('### Legacy System');
            expect(result).not.toContain('### Legacy Backend');
        });

        test('should include READ-ONLY warning', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockReturnValue('/some/path');

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toContain('READ-ONLY');
            expect(result).toContain('Do NOT modify legacy code');
        });

        test('should include How to Use Legacy Systems section', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockReturnValue('/some/path');

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toContain('### How to Use Legacy Systems');
            expect(result).toContain('1. Use legacy code as reference for business logic and patterns');
            expect(result).toContain('2. Do NOT copy legacy code directly - adapt and modernize');
            expect(result).toContain('3. Do NOT modify any files in legacy system paths');
            expect(result).toContain('4. Document any business rules discovered in legacy code');
        });

        test('should have paths displayed correctly with backticks', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockImplementation((type) => {
                if (type === 'system') return '/custom/legacy/path';
                return null;
            });

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            expect(result).toMatch(/Path: `\/custom\/legacy\/path`/);
        });

        test('should produce valid markdown without broken syntax', () => {
            mockState.hasLegacySystems.mockReturnValue(true);
            mockState.getLegacySystem.mockImplementation((type) => {
                if (type === 'system') return '/path/to/system';
                if (type === 'backend') return '/path/to/backend';
                return null;
            });

            const { generateLegacySystemContext } = require('./context-generator');
            const result = generateLegacySystemContext();

            // Check for proper markdown structure
            expect(result).toMatch(/^## Legacy Systems Reference/);
            expect(result).toContain('\n\n');
            // Check no unmatched backticks
            const backtickCount = (result.match(/`/g) || []).length;
            expect(backtickCount % 2).toBe(0);
        });
    });
});
