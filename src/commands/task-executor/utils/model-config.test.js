const {
    VALID_MODELS,
    STEP_MODEL_DEFAULTS,
    getStepModel,
    determineStep5Model,
    isEscalationStep,
    getDefaultModel,
    parseDifficultyTag,
} = require('./model-config');

describe('model-config', () => {
    // Store original env vars
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Clear all CLAUDIOMIRO env vars before each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('CLAUDIOMIRO_')) {
                delete process.env[key];
            }
        });
    });

    afterAll(() => {
        // Restore original env vars
        process.env = originalEnv;
    });

    describe('VALID_MODELS', () => {
        test('should contain fast, medium, hard', () => {
            expect(VALID_MODELS).toContain('fast');
            expect(VALID_MODELS).toContain('medium');
            expect(VALID_MODELS).toContain('hard');
            expect(VALID_MODELS).toHaveLength(3);
        });
    });

    describe('STEP_MODEL_DEFAULTS', () => {
        test('should have defaults for all steps 0-8', () => {
            expect(STEP_MODEL_DEFAULTS.step0).toBe('medium');
            expect(STEP_MODEL_DEFAULTS.step1).toBe('hard');
            expect(STEP_MODEL_DEFAULTS.step2).toBe('hard');
            expect(STEP_MODEL_DEFAULTS.step3).toBe('medium');
            expect(STEP_MODEL_DEFAULTS.step4).toBe('medium');
            expect(STEP_MODEL_DEFAULTS.step5).toBe('dynamic');
            expect(STEP_MODEL_DEFAULTS.step6).toBe('escalation');
            expect(STEP_MODEL_DEFAULTS.step7).toBe('escalation');
            expect(STEP_MODEL_DEFAULTS.step8).toBe('fast');
        });
    });

    describe('getStepModel', () => {
        test('should return default model when no env vars set', () => {
            expect(getStepModel(0)).toBe('medium');
            expect(getStepModel(1)).toBe('hard');
            expect(getStepModel(2)).toBe('hard');
            expect(getStepModel(3)).toBe('medium');
            expect(getStepModel(4)).toBe('medium');
            expect(getStepModel(5)).toBe('dynamic');
            expect(getStepModel(6)).toBe('escalation');
            expect(getStepModel(7)).toBe('escalation');
            expect(getStepModel(8)).toBe('fast');
        });

        test('should return global override when CLAUDIOMIRO_MODEL is set', () => {
            process.env.CLAUDIOMIRO_MODEL = 'fast';
            expect(getStepModel(0)).toBe('fast');
            expect(getStepModel(1)).toBe('fast');
            expect(getStepModel(5)).toBe('fast');
        });

        test('should return step-specific env var over default', () => {
            process.env.CLAUDIOMIRO_STEP0_MODEL = 'hard';
            expect(getStepModel(0)).toBe('hard');
        });

        test('should prioritize global over step-specific', () => {
            process.env.CLAUDIOMIRO_MODEL = 'fast';
            process.env.CLAUDIOMIRO_STEP0_MODEL = 'hard';
            expect(getStepModel(0)).toBe('fast');
        });

        test('should ignore invalid global model', () => {
            process.env.CLAUDIOMIRO_MODEL = 'invalid';
            expect(getStepModel(0)).toBe('medium');
        });

        test('should ignore invalid step-specific model', () => {
            process.env.CLAUDIOMIRO_STEP0_MODEL = 'invalid';
            expect(getStepModel(0)).toBe('medium');
        });

        test('should allow dynamic and escalation for step-specific env vars', () => {
            process.env.CLAUDIOMIRO_STEP0_MODEL = 'dynamic';
            expect(getStepModel(0)).toBe('dynamic');

            process.env.CLAUDIOMIRO_STEP1_MODEL = 'escalation';
            expect(getStepModel(1)).toBe('escalation');
        });

        test('should return medium for unknown step', () => {
            expect(getStepModel(99)).toBe('medium');
        });
    });

    describe('parseDifficultyTag', () => {
        test('should parse @difficulty fast', () => {
            const content = '@dependencies []\n@difficulty fast\n# BLUEPRINT';
            expect(parseDifficultyTag(content)).toBe('fast');
        });

        test('should parse @difficulty medium', () => {
            const content = '@dependencies []\n@difficulty medium\n# BLUEPRINT';
            expect(parseDifficultyTag(content)).toBe('medium');
        });

        test('should parse @difficulty hard', () => {
            const content = '@dependencies []\n@scope backend\n@difficulty hard\n# BLUEPRINT';
            expect(parseDifficultyTag(content)).toBe('hard');
        });

        test('should be case-insensitive', () => {
            expect(parseDifficultyTag('@difficulty FAST')).toBe('fast');
            expect(parseDifficultyTag('@difficulty Medium')).toBe('medium');
            expect(parseDifficultyTag('@Difficulty HARD')).toBe('hard');
        });

        test('should return null for missing @difficulty', () => {
            const content = '@dependencies []\n# BLUEPRINT';
            expect(parseDifficultyTag(content)).toBeNull();
        });

        test('should return null for invalid difficulty value', () => {
            const content = '@difficulty extreme';
            expect(parseDifficultyTag(content)).toBeNull();
        });

        test('should return null for empty content', () => {
            expect(parseDifficultyTag('')).toBeNull();
            expect(parseDifficultyTag(null)).toBeNull();
            expect(parseDifficultyTag(undefined)).toBeNull();
        });

        test('should handle @difficulty anywhere in content', () => {
            const content = `
# BLUEPRINT: TASK1
Some content here
@difficulty hard
More content
`;
            expect(parseDifficultyTag(content)).toBe('hard');
        });

        test('should handle extra whitespace', () => {
            expect(parseDifficultyTag('@difficulty   fast')).toBe('fast');
            expect(parseDifficultyTag('@difficulty\tmedium')).toBe('medium');
        });
    });

    describe('determineStep5Model', () => {
        describe('high attempt count override (>= 5)', () => {
            test('should return hard when attempts >= 5, overriding @difficulty tag', () => {
                const execution = { phases: [], artifacts: [], attempts: 5 };
                const blueprint = '@difficulty fast\n# Simple blueprint';
                expect(determineStep5Model(execution, blueprint)).toBe('hard');
            });

            test('should return hard when attempts >= 5, overriding env var', () => {
                process.env.CLAUDIOMIRO_STEP5_MODEL = 'fast';
                const execution = { phases: [], artifacts: [], attempts: 5 };
                const blueprint = 'Simple blueprint';
                expect(determineStep5Model(execution, blueprint)).toBe('hard');
            });

            test('should return hard when attempts > 5', () => {
                const execution = { phases: [], artifacts: [], attempts: 8 };
                const blueprint = '@difficulty fast\nSimple';
                expect(determineStep5Model(execution, blueprint)).toBe('hard');
            });

            test('should NOT force hard when attempts < 5', () => {
                const execution = { phases: [], artifacts: [], attempts: 4 };
                const blueprint = '@difficulty fast\nSimple';
                expect(determineStep5Model(execution, blueprint)).toBe('fast');
            });

            test('should return hard when attempts = 5 exactly', () => {
                const execution = { phases: [], artifacts: [], attempts: 5 };
                const blueprint = '@difficulty medium\nSimple';
                expect(determineStep5Model(execution, blueprint)).toBe('hard');
            });
        });

        test('should prioritize @difficulty tag over heuristics (when attempts < 5)', () => {
            // Complex execution that would normally be "hard" based on heuristics
            // but attempts < 5 so @difficulty tag should win
            const execution = { phases: [1, 2, 3, 4, 5], artifacts: [1, 2, 3, 4, 5, 6], attempts: 4 };
            const blueprint = '@difficulty fast\n' + '\n'.repeat(500);
            expect(determineStep5Model(execution, blueprint)).toBe('fast');
        });

        test('should use @difficulty medium from blueprint', () => {
            const execution = { phases: [], artifacts: [], attempts: 0 };
            const blueprint = '@dependencies []\n@difficulty medium\n# BLUEPRINT';
            expect(determineStep5Model(execution, blueprint)).toBe('medium');
        });

        test('should use @difficulty hard from blueprint', () => {
            const execution = { phases: [], artifacts: [], attempts: 0 };
            const blueprint = '@dependencies []\n@difficulty hard\n# BLUEPRINT';
            expect(determineStep5Model(execution, blueprint)).toBe('hard');
        });

        test('should fall back to heuristics when no @difficulty tag', () => {
            const execution = { phases: [], artifacts: [], attempts: 0 };
            const blueprint = 'Short blueprint\nOnly 2 lines';
            expect(determineStep5Model(execution, blueprint)).toBe('fast');
        });

        test('should return fast for simple tasks (heuristic fallback)', () => {
            const execution = { phases: [], artifacts: [], attempts: 0 };
            const blueprint = 'Short blueprint\nOnly 2 lines';
            expect(determineStep5Model(execution, blueprint)).toBe('fast');
        });

        test('should return medium for moderate tasks (heuristic fallback)', () => {
            const execution = { phases: [1, 2], artifacts: [1, 2, 3], attempts: 0 };
            const blueprint = 'A'.repeat(100) + '\n'.repeat(101);
            expect(determineStep5Model(execution, blueprint)).toBe('medium');
        });

        test('should return hard for complex tasks with many phases (heuristic fallback)', () => {
            const execution = { phases: [1, 2, 3, 4], artifacts: [], attempts: 0 };
            const blueprint = 'Simple';
            expect(determineStep5Model(execution, blueprint)).toBe('hard');
        });

        test('should return hard for tasks with many artifacts (heuristic fallback)', () => {
            const execution = { phases: [], artifacts: [1, 2, 3, 4, 5, 6], attempts: 0 };
            const blueprint = 'Simple';
            expect(determineStep5Model(execution, blueprint)).toBe('hard');
        });

        test('should return hard for tasks with uncertainties (heuristic fallback)', () => {
            const execution = { phases: [], artifacts: [], uncertainties: [{ id: 'U1' }], attempts: 0 };
            const blueprint = 'Simple';
            expect(determineStep5Model(execution, blueprint)).toBe('hard');
        });

        test('should return hard for tasks with many attempts (heuristic fallback)', () => {
            const execution = { phases: [], artifacts: [], attempts: 3 };
            const blueprint = 'Simple';
            expect(determineStep5Model(execution, blueprint)).toBe('hard');
        });

        test('should return hard for long blueprints (heuristic fallback)', () => {
            const execution = { phases: [], artifacts: [], attempts: 0 };
            const blueprint = '\n'.repeat(301);
            expect(determineStep5Model(execution, blueprint)).toBe('hard');
        });

        test('should respect env override over @difficulty tag', () => {
            process.env.CLAUDIOMIRO_STEP5_MODEL = 'fast';
            const execution = { phases: [1, 2, 3, 4, 5], artifacts: [1, 2, 3, 4, 5, 6] };
            const blueprint = '@difficulty hard\n' + '\n'.repeat(500);
            expect(determineStep5Model(execution, blueprint)).toBe('fast');
        });

        test('should handle null/undefined execution', () => {
            expect(determineStep5Model(null, 'blueprint')).toBe('fast');
            expect(determineStep5Model(undefined, 'blueprint')).toBe('fast');
        });

        test('should handle null/undefined blueprint', () => {
            const execution = { phases: [], artifacts: [], attempts: 0 };
            expect(determineStep5Model(execution, null)).toBe('fast');
            expect(determineStep5Model(execution, undefined)).toBe('fast');
        });
    });

    describe('isEscalationStep', () => {
        test('should return true for step 6 and 7 by default', () => {
            expect(isEscalationStep(6)).toBe(true);
            expect(isEscalationStep(7)).toBe(true);
        });

        test('should return false for non-escalation steps', () => {
            expect(isEscalationStep(0)).toBe(false);
            expect(isEscalationStep(1)).toBe(false);
            expect(isEscalationStep(5)).toBe(false);
            expect(isEscalationStep(8)).toBe(false);
        });

        test('should respect env override', () => {
            process.env.CLAUDIOMIRO_STEP6_MODEL = 'hard';
            expect(isEscalationStep(6)).toBe(false);
        });

        test('should return true when env sets escalation', () => {
            process.env.CLAUDIOMIRO_STEP0_MODEL = 'escalation';
            expect(isEscalationStep(0)).toBe(true);
        });
    });

    describe('getDefaultModel', () => {
        test('should return default model ignoring env vars', () => {
            process.env.CLAUDIOMIRO_MODEL = 'fast';
            process.env.CLAUDIOMIRO_STEP0_MODEL = 'hard';

            expect(getDefaultModel(0)).toBe('medium');
            expect(getDefaultModel(1)).toBe('hard');
            expect(getDefaultModel(5)).toBe('dynamic');
            expect(getDefaultModel(6)).toBe('escalation');
        });

        test('should return medium for unknown step', () => {
            expect(getDefaultModel(99)).toBe('medium');
        });
    });
});
