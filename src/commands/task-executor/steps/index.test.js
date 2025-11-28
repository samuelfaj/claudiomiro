const steps = require('./index');

describe('steps/index', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('module exports', () => {
        test('should export all step functions', () => {
            // Verify module exports an object
            expect(steps).toBeDefined();
            expect(typeof steps).toBe('object');

            // Verify all expected step exports exist
            expect(steps.step0).toBeDefined();
            expect(steps.step1).toBeDefined();
            expect(steps.step2).toBeDefined();
            expect(steps.step3).toBeDefined();
            expect(steps.step4).toBeDefined();
            expect(steps.step5).toBeDefined();
            expect(steps.step6).toBeDefined();
            expect(steps.step7).toBeDefined();
            expect(steps.step8).toBeDefined();
        });

        test('should export exactly 9 step functions', () => {
            const exportedKeys = Object.keys(steps);
            expect(exportedKeys).toHaveLength(9);

            // Verify no extra exports
            const expectedKeys = ['step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8'];
            expectedKeys.forEach(key => {
                expect(exportedKeys).toContain(key);
            });

            // Verify no unexpected exports
            expect(exportedKeys.sort()).toEqual(expectedKeys.sort());
        });

        test('should export functions with correct types', () => {
            expect(typeof steps.step0).toBe('function');
            expect(typeof steps.step1).toBe('function');
            expect(typeof steps.step2).toBe('function');
            expect(typeof steps.step3).toBe('function');
            expect(typeof steps.step4).toBe('function');
            expect(typeof steps.step5).toBe('function');
            expect(typeof steps.step6).toBe('function');
            expect(typeof steps.step7).toBe('function');
            expect(typeof steps.step8).toBe('function');
        });

        test('should have all step functions in sequential order', () => {
            // Test that step functions follow expected naming pattern
            const stepNumbers = [];
            for (let i = 0; i <= 8; i++) {
                stepNumbers.push(`step${i}`);
            }

            const exportedKeys = Object.keys(steps);
            expect(exportedKeys.sort()).toEqual(stepNumbers.sort());
        });

        test('should export non-null step functions', () => {
            // Ensure all exported functions are not null or undefined
            Object.values(steps).forEach(stepFunction => {
                expect(stepFunction).not.toBeNull();
                expect(stepFunction).not.toBeUndefined();
                expect(stepFunction).not.toBeFalsy();
            });
        });
    });
});
