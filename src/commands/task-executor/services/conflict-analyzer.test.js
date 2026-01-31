const {
    ConflictType,
    ConflictSeverity,
    analyzeRequirementConflicts,
    detectImpossibleCombinations,
    detectScopeConflicts,
    detectDependencyConflicts,
    validateRequirementFeasibility,
    createConflictReport,
    generateSuggestions,
    analyzeScopeComplexity,
    detectAmbiguousRequirements,
    findCycle,
} = require('./conflict-analyzer');

describe('conflict-analyzer', () => {
    describe('ConflictType', () => {
        test('should have all required conflict types', () => {
            expect(ConflictType.MUTUALLY_EXCLUSIVE).toBe('mutually-exclusive');
            expect(ConflictType.CIRCULAR_DEPENDENCY).toBe('circular-dependency');
            expect(ConflictType.IMPOSSIBLE_SCOPE).toBe('impossible-scope');
            expect(ConflictType.MISSING_PREREQUISITE).toBe('missing-prerequisite');
            expect(ConflictType.VERSION_CONFLICT).toBe('version-conflict');
            expect(ConflictType.AMBIGUOUS_REQUIREMENT).toBe('ambiguous-requirement');
        });
    });

    describe('ConflictSeverity', () => {
        test('should have all required severity levels', () => {
            expect(ConflictSeverity.BLOCKING).toBe('blocking');
            expect(ConflictSeverity.WARNING).toBe('warning');
            expect(ConflictSeverity.INFO).toBe('info');
        });
    });

    describe('analyzeRequirementConflicts', () => {
        test('should return no conflicts for null content', () => {
            const result = analyzeRequirementConflicts(null);
            expect(result.hasConflicts).toBe(false);
            expect(result.conflicts).toHaveLength(0);
        });

        test('should return no conflicts for empty string', () => {
            const result = analyzeRequirementConflicts('');
            expect(result.hasConflicts).toBe(false);
        });

        test('should detect mutually exclusive patterns - module system', () => {
            const content = `
                # Requirements
                - Use CommonJS modules
                - Convert to ES Modules
            `;
            const result = analyzeRequirementConflicts(content);
            expect(result.hasConflicts).toBe(true);
            expect(result.hasBlockingConflicts).toBe(true);
            const moduleConflict = result.conflicts.find(c =>
                c.details?.conflictType === 'module-system',
            );
            expect(moduleConflict).toBeDefined();
        });

        test('should detect mutually exclusive patterns - package manager', () => {
            const content = `
                # Setup
                npm install express
                yarn add lodash
            `;
            const result = analyzeRequirementConflicts(content);
            expect(result.hasConflicts).toBe(true);
        });

        test('should detect scope complexity issues', () => {
            const content = `
                # Task
                Refactor the entire codebase to use TypeScript
            `;
            const result = analyzeRequirementConflicts(content);
            expect(result.hasConflicts).toBe(true);
            const scopeConflict = result.conflicts.find(c =>
                c.type === ConflictType.IMPOSSIBLE_SCOPE,
            );
            expect(scopeConflict).toBeDefined();
        });

        test('should detect ambiguous requirements', () => {
            const content = `
                # Requirements
                - Make it better
                - Fix all the bugs
            `;
            const result = analyzeRequirementConflicts(content);
            expect(result.hasConflicts).toBe(true);
            const ambiguousConflicts = result.conflicts.filter(c =>
                c.type === ConflictType.AMBIGUOUS_REQUIREMENT,
            );
            expect(ambiguousConflicts.length).toBeGreaterThan(0);
        });

        test('should return suggestions for detected conflicts', () => {
            const content = 'Rewrite the entire application from scratch';
            const result = analyzeRequirementConflicts(content);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('analyzeScopeComplexity', () => {
        test('should detect high complexity indicators', () => {
            const content = 'Complete overhaul of the authentication system';
            const result = analyzeScopeComplexity(content);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe(ConflictType.IMPOSSIBLE_SCOPE);
        });

        test('should detect multiple systems', () => {
            const content = `
                Update frontend and backend simultaneously.
                Changes affect client and server code.
            `;
            const result = analyzeScopeComplexity(content);
            const multiSystem = result.find(c => c.details?.category === 'multiple-systems');
            expect(multiSystem).toBeDefined();
            expect(multiSystem.severity).toBe(ConflictSeverity.BLOCKING);
        });

        test('should detect large scope indicators', () => {
            const content = 'Update all files in the project';
            const result = analyzeScopeComplexity(content);
            const largeScope = result.find(c => c.details?.category === 'large-scope');
            expect(largeScope).toBeDefined();
        });

        test('should return empty array for reasonable scope', () => {
            const content = 'Add a new endpoint for user authentication';
            const result = analyzeScopeComplexity(content);
            expect(result).toHaveLength(0);
        });
    });

    describe('detectAmbiguousRequirements', () => {
        test('should detect vague improvement requests', () => {
            const content = 'Make it better and faster';
            const result = detectAmbiguousRequirements(content);
            expect(result.length).toBeGreaterThan(0);
        });

        test('should detect incomplete lists', () => {
            const content = 'Support PNG, JPG, GIF, etc.';
            const result = detectAmbiguousRequirements(content);
            const etcConflict = result.find(c => c.details?.issue.includes('Incomplete'));
            expect(etcConflict).toBeDefined();
        });

        test('should detect undefined decision criteria', () => {
            const content = 'Add validation as needed';
            const result = detectAmbiguousRequirements(content);
            expect(result.length).toBeGreaterThan(0);
        });

        test('should return empty array for clear requirements', () => {
            const content = 'Add input validation for email field using regex pattern';
            const result = detectAmbiguousRequirements(content);
            expect(result).toHaveLength(0);
        });
    });

    describe('detectImpossibleCombinations', () => {
        test('should return empty array for null criteria', () => {
            expect(detectImpossibleCombinations(null)).toEqual([]);
        });

        test('should return empty array for empty criteria', () => {
            expect(detectImpossibleCombinations([])).toEqual([]);
        });

        test('should detect test coverage contradiction', () => {
            const criteria = [
                { criterion: '100% test coverage required' },
                { criterion: 'No tests required for this task' },
            ];
            const result = detectImpossibleCombinations(criteria);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].severity).toBe(ConflictSeverity.BLOCKING);
        });

        test('should detect backwards compatibility contradiction', () => {
            const criteria = [
                { criterion: 'Must be backwards compatible' },
                { criterion: 'Introduce breaking change to API' },
            ];
            const result = detectImpossibleCombinations(criteria);
            expect(result.length).toBeGreaterThan(0);
        });

        test('should return empty for compatible criteria', () => {
            const criteria = [
                { criterion: 'Add unit tests' },
                { criterion: 'Update documentation' },
            ];
            const result = detectImpossibleCombinations(criteria);
            expect(result).toHaveLength(0);
        });
    });

    describe('detectScopeConflicts', () => {
        test('should return empty array for null tasks', () => {
            expect(detectScopeConflicts(null)).toEqual([]);
        });

        test('should return empty array for single task', () => {
            expect(detectScopeConflicts([{ name: 'TASK1' }])).toEqual([]);
        });

        test('should detect overlapping files', () => {
            const tasks = [
                { name: 'TASK1', files: ['src/auth.js', 'src/utils.js'] },
                { name: 'TASK2', files: ['src/auth.js', 'src/api.js'] },
            ];
            const result = detectScopeConflicts(tasks);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].details.overlappingFiles).toContain('src/auth.js');
        });

        test('should not detect conflicts for non-overlapping files', () => {
            const tasks = [
                { name: 'TASK1', files: ['src/auth.js'] },
                { name: 'TASK2', files: ['src/api.js'] },
            ];
            const result = detectScopeConflicts(tasks);
            expect(result).toHaveLength(0);
        });
    });

    describe('detectDependencyConflicts', () => {
        test('should return empty array for null tasks', () => {
            expect(detectDependencyConflicts(null)).toEqual([]);
        });

        test('should detect circular dependencies', () => {
            const tasks = [
                { name: 'TASK1', dependencies: ['TASK2'] },
                { name: 'TASK2', dependencies: ['TASK1'] },
            ];
            const result = detectDependencyConflicts(tasks);
            const circular = result.find(c => c.type === ConflictType.CIRCULAR_DEPENDENCY);
            expect(circular).toBeDefined();
            expect(circular.severity).toBe(ConflictSeverity.BLOCKING);
        });

        test('should detect missing dependencies', () => {
            const tasks = [
                { name: 'TASK1', dependencies: ['TASK_NOT_EXISTS'] },
            ];
            const result = detectDependencyConflicts(tasks);
            const missing = result.find(c => c.type === ConflictType.MISSING_PREREQUISITE);
            expect(missing).toBeDefined();
            expect(missing.details.missingDep).toBe('TASK_NOT_EXISTS');
        });

        test('should not detect conflicts for valid dependencies', () => {
            const tasks = [
                { name: 'TASK1', dependencies: [] },
                { name: 'TASK2', dependencies: ['TASK1'] },
            ];
            const result = detectDependencyConflicts(tasks);
            expect(result).toHaveLength(0);
        });
    });

    describe('findCycle', () => {
        test('should find simple cycle', () => {
            const taskMap = new Map([
                ['A', { dependencies: ['B'] }],
                ['B', { dependencies: ['A'] }],
            ]);
            const result = findCycle('A', ['B'], taskMap, new Set(), []);
            expect(result).toBeTruthy();
            expect(result).toContain('A');
            expect(result).toContain('B');
        });

        test('should return null for no cycle', () => {
            const taskMap = new Map([
                ['A', { dependencies: [] }],
                ['B', { dependencies: ['A'] }],
            ]);
            const result = findCycle('B', ['A'], taskMap, new Set(), []);
            expect(result).toBeNull();
        });
    });

    describe('validateRequirementFeasibility', () => {
        test('should detect infeasible requirements', () => {
            const requirement = {
                description: 'Implement new feature without changing any code',
            };
            const result = validateRequirementFeasibility(requirement, '/tmp');
            expect(result.feasible).toBe(false);
            expect(result.reason).toBeTruthy();
        });

        test('should accept feasible requirements', () => {
            const requirement = {
                description: 'Add validation to user input',
            };
            const result = validateRequirementFeasibility(requirement, '/tmp');
            expect(result.feasible).toBe(true);
        });
    });

    describe('generateSuggestions', () => {
        test('should return empty array for null conflicts', () => {
            expect(generateSuggestions(null)).toEqual([]);
        });

        test('should return empty array for empty conflicts', () => {
            expect(generateSuggestions([])).toEqual([]);
        });

        test('should generate unique suggestions', () => {
            const conflicts = [
                {
                    type: ConflictType.IMPOSSIBLE_SCOPE,
                    suggestion: 'Break into smaller tasks',
                },
                {
                    type: ConflictType.IMPOSSIBLE_SCOPE,
                    suggestion: 'Break into smaller tasks',
                },
            ];
            const result = generateSuggestions(conflicts);
            const uniqueSuggestions = new Set(result);
            expect(result.length).toBe(uniqueSuggestions.size);
        });

        test('should add type-specific suggestions', () => {
            const conflicts = [
                { type: ConflictType.CIRCULAR_DEPENDENCY, suggestion: 'Fix cycle' },
            ];
            const result = generateSuggestions(conflicts);
            expect(result.some(s => s.includes('dependencies') || s.includes('execution order'))).toBe(true);
        });
    });

    describe('createConflictReport', () => {
        test('should return no conflicts message', () => {
            const analysis = { hasConflicts: false, conflicts: [], suggestions: [] };
            const report = createConflictReport(analysis);
            expect(report).toContain('No conflicts detected');
        });

        test('should include blocking issues section', () => {
            const analysis = {
                hasConflicts: true,
                conflicts: [
                    {
                        type: ConflictType.CIRCULAR_DEPENDENCY,
                        severity: ConflictSeverity.BLOCKING,
                        description: 'Circular dependency found',
                        suggestion: 'Break the cycle',
                    },
                ],
                suggestions: ['Break the cycle'],
            };
            const report = createConflictReport(analysis);
            expect(report).toContain('Blocking Issues');
            expect(report).toContain('Circular dependency found');
        });

        test('should include warnings section', () => {
            const analysis = {
                hasConflicts: true,
                conflicts: [
                    {
                        type: ConflictType.IMPOSSIBLE_SCOPE,
                        severity: ConflictSeverity.WARNING,
                        description: 'Large scope',
                        suggestion: 'Consider splitting',
                    },
                ],
                suggestions: ['Consider splitting'],
            };
            const report = createConflictReport(analysis);
            expect(report).toContain('Warnings');
        });

        test('should include recommendations section', () => {
            const analysis = {
                hasConflicts: true,
                conflicts: [],
                suggestions: ['Recommendation 1', 'Recommendation 2'],
            };
            const report = createConflictReport(analysis);
            expect(report).toContain('Recommendations');
            expect(report).toContain('Recommendation 1');
        });
    });

    describe('integration', () => {
        test('should handle complex document with multiple issues', () => {
            const content = `
                # Project Requirements

                ## Setup
                npm install express
                yarn add lodash

                ## Task
                Refactor the entire codebase
                Update frontend and backend
                Migrate all databases

                ## Criteria
                - Make it better
                - Fix all bugs
                - Improve performance
            `;

            const result = analyzeRequirementConflicts(content);

            expect(result.hasConflicts).toBe(true);
            expect(result.conflicts.length).toBeGreaterThan(2);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
    });
});
