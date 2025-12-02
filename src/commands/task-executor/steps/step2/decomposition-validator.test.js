const fs = require('fs');
const {
    validateDecomposition,
    runValidation,
    extractConfidenceScore,
    hasPhase,
    hasPhaseContent,
    getMissingPreBlueprintAnalysis,
    hasUnresolvedDivergence,
    getTaskNames,
} = require('./decomposition-validator');

jest.mock('fs');
jest.mock('../../../../shared/utils/logger');

describe('decomposition-validator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extractConfidenceScore', () => {
        test('should extract score from "Overall Confidence: 4.2 / 5"', () => {
            const content = 'Some text\n**Overall Confidence:** 4.2 / 5\nMore text';
            expect(extractConfidenceScore(content)).toBe(4.2);
        });

        test('should extract score from "Overall Confidence: 3.5"', () => {
            const content = 'Overall Confidence: 3.5';
            expect(extractConfidenceScore(content)).toBe(3.5);
        });

        test('should extract score from "Confidence Score: 4.7 / 5"', () => {
            const content = '**Confidence Score:** 4.7 / 5';
            expect(extractConfidenceScore(content)).toBe(4.7);
        });

        test('should return null if no score found', () => {
            const content = 'No confidence score here';
            expect(extractConfidenceScore(content)).toBeNull();
        });

        test('should handle integer scores', () => {
            const content = 'Overall Confidence: 5 / 5';
            expect(extractConfidenceScore(content)).toBe(5);
        });
    });

    describe('hasPhase', () => {
        test('should return true if phase exists', () => {
            const content = '## Phase A: Requirements Extraction\n\nContent here';
            expect(hasPhase(content, 'Phase A')).toBe(true);
        });

        test('should return false if phase does not exist', () => {
            const content = '## Phase B: Complexity\n\nContent';
            expect(hasPhase(content, 'Phase A')).toBe(false);
        });

        test('should be case insensitive', () => {
            const content = '## PHASE A: Requirements\n\nContent';
            expect(hasPhase(content, 'Phase A')).toBe(true);
        });
    });

    describe('hasPhaseContent', () => {
        test('should return true if phase has content', () => {
            const content = `## Phase A: Requirements

| Req ID | Quote |
|--------|-------|
| R1 | "text" |

Some more content here.`;
            expect(hasPhaseContent(content, 'Phase A')).toBe(true);
        });

        test('should return false if phase has no content', () => {
            const content = '## Phase A\n\n## Phase B';
            expect(hasPhaseContent(content, 'Phase A')).toBe(false);
        });

        test('should return false if phase does not exist', () => {
            const content = '## Phase B\n\nContent';
            expect(hasPhaseContent(content, 'Phase A')).toBe(false);
        });
    });

    describe('getMissingPreBlueprintAnalysis', () => {
        test('should return empty array if all tasks have analysis', () => {
            const content = `
## Pre-BLUEPRINT Analysis: TASK0
Content for TASK0

## Pre-BLUEPRINT Analysis: TASK1
Content for TASK1
`;
            const result = getMissingPreBlueprintAnalysis(content, ['TASK0', 'TASK1']);
            expect(result).toEqual([]);
        });

        test('should return missing tasks', () => {
            const content = `
## Pre-BLUEPRINT Analysis: TASK0
Content for TASK0
`;
            const result = getMissingPreBlueprintAnalysis(content, ['TASK0', 'TASK1', 'TASK2']);
            expect(result).toEqual(['TASK1', 'TASK2']);
        });

        test('should handle case variations', () => {
            const content = 'Pre-BLUEPRINT Analysis: task0';
            const result = getMissingPreBlueprintAnalysis(content, ['TASK0']);
            expect(result).toEqual([]);
        });
    });

    describe('hasUnresolvedDivergence', () => {
        test('should return true if divergence detected without resolution', () => {
            const content = 'Divergence detected! Path 1 differs from Path 2.';
            expect(hasUnresolvedDivergence(content)).toBe(true);
        });

        test('should return false if divergence is resolved', () => {
            const content = `
Divergence detected! Path 1 differs from Path 2.
Resolution: Paths 2 and 3 agree.
`;
            expect(hasUnresolvedDivergence(content)).toBe(false);
        });

        test('should return false if no divergence', () => {
            const content = 'All paths converge on the same decomposition.';
            expect(hasUnresolvedDivergence(content)).toBe(false);
        });
    });

    describe('getTaskNames', () => {
        test('should return task directories sorted', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['TASK0', 'TASK2', 'TASK1', 'other-file.md']);
            fs.statSync.mockImplementation((p) => ({
                isDirectory: () => p.includes('TASK'),
            }));

            const result = getTaskNames('/some/folder');
            expect(result).toEqual(['TASK0', 'TASK1', 'TASK2']);
        });

        test('should return empty array if folder does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = getTaskNames('/nonexistent');
            expect(result).toEqual([]);
        });
    });

    describe('validateDecomposition', () => {
        test('should return blocking error if DECOMPOSITION_ANALYSIS.md does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = validateDecomposition('/some/folder');

            expect(result.valid).toBe(false);
            expect(result.blocking).toContain(
                'DECOMPOSITION_ANALYSIS.md does not exist - decomposition reasoning is required',
            );
        });

        test('should return blocking errors for missing phases', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('DECOMPOSITION_ANALYSIS.md'));
            fs.readFileSync.mockReturnValue(`
## Phase A: Requirements

Content here
Tables and data

## Phase C: Dependencies

More content
Multiple lines
`);
            fs.readdirSync.mockReturnValue([]);

            const result = validateDecomposition('/some/folder');

            expect(result.valid).toBe(false);
            expect(result.blocking.some(e => e.includes('Phase B'))).toBe(true);
            expect(result.blocking.some(e => e.includes('Phase D'))).toBe(true);
            expect(result.blocking.some(e => e.includes('Phase E'))).toBe(true);
        });

        test('should return blocking error for low confidence score', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('DECOMPOSITION_ANALYSIS.md'));
            fs.readFileSync.mockReturnValue(`
## Phase A: Requirements
Content and tables

## Phase B: Complexity
More content

## Phase C: Dependencies
Dependency info

## Phase D: Strategy
Strategy info

## Phase E: Self-Critique
Critique content

**Overall Confidence:** 2.5 / 5
`);
            fs.readdirSync.mockReturnValue([]);

            const result = validateDecomposition('/some/folder');

            expect(result.valid).toBe(false);
            expect(result.blocking.some(e => e.includes('2.5'))).toBe(true);
        });

        test('should return warning for confidence between 3.0 and 4.0', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('DECOMPOSITION_ANALYSIS.md'));
            fs.readFileSync.mockReturnValue(`
## Phase A: Requirements
Content line 1
Content line 2

## Phase B: Complexity
Content line 1
Content line 2

## Phase C: Dependencies
Content line 1
Content line 2

## Phase D: Strategy
Content line 1
Content line 2

## Phase E: Self-Critique
Content line 1
Content line 2

**Overall Confidence:** 3.5 / 5
`);
            fs.readdirSync.mockReturnValue([]);

            const result = validateDecomposition('/some/folder');

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('3.5'))).toBe(true);
        });

        test('should return warning if Phase F is missing', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('DECOMPOSITION_ANALYSIS.md'));
            fs.readFileSync.mockReturnValue(`
## Phase A: Requirements
Content 1
Content 2

## Phase B: Complexity
Content 1
Content 2

## Phase C: Dependencies
Content 1
Content 2

## Phase D: Strategy
Content 1
Content 2

## Phase E: Self-Critique
Content 1
Content 2

**Overall Confidence:** 4.5 / 5
`);
            fs.readdirSync.mockReturnValue([]);

            const result = validateDecomposition('/some/folder');

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('Phase F'))).toBe(true);
        });

        test('should pass validation for complete document', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('DECOMPOSITION_ANALYSIS.md'));
            fs.readFileSync.mockReturnValue(`
## Phase A: Requirements
| Req | Quote |
| R1 | "text" |

## Phase B: Complexity
| Req | Level |
| R1 | MEDIUM |

## Phase C: Dependencies
| Req | Deps |
| R1 | None |

## Phase D: Strategy
**Evidence:** AI_PROMPT.md:L45
Keep atomic? YES

## Phase E: Self-Critique
All checks pass
Quality gates met

## Phase F: Tree of Thought
Alternatives explored
Self-consistency checked

**Overall Confidence:** 4.5 / 5
`);
            fs.readdirSync.mockReturnValue([]);

            const result = validateDecomposition('/some/folder');

            expect(result.valid).toBe(true);
            expect(result.blocking).toHaveLength(0);
        });
    });

    describe('runValidation', () => {
        const logger = require('../../../../shared/utils/logger');

        test('should throw error if blocking issues exist', () => {
            fs.existsSync.mockReturnValue(false);

            expect(() => runValidation('/some/folder')).toThrow('Decomposition validation failed');
        });

        test('should log warnings but not throw', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('DECOMPOSITION_ANALYSIS.md'));
            fs.readFileSync.mockReturnValue(`
## Phase A: Requirements
Content 1
Content 2

## Phase B: Complexity
Content 1
Content 2

## Phase C: Dependencies
Content 1
Content 2

## Phase D: Strategy
Content 1
Content 2

## Phase E: Self-Critique
Content 1
Content 2

**Overall Confidence:** 3.5 / 5
`);
            fs.readdirSync.mockReturnValue([]);

            expect(() => runValidation('/some/folder')).not.toThrow();
            expect(logger.warning).toHaveBeenCalled();
        });
    });
});
