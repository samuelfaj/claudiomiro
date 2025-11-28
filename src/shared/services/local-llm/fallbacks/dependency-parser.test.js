/**
 * Dependency Parser Fallback Tests
 * Self-contained tests following Claudiomiro conventions
 */

const {
    parseDependencies,
    parseDependsOn,
    extractTaskReferences,
    getAllDependencies,
    validateDependencyGraph,
    getTopologicalOrder,
} = require('./dependency-parser');

describe('dependency-parser', () => {
    describe('parseDependencies', () => {
        test('should parse @dependencies with brackets', () => {
            const content = '@dependencies [TASK1, TASK2, TASK3]';

            const deps = parseDependencies(content);

            expect(deps).toContain('TASK1');
            expect(deps).toContain('TASK2');
            expect(deps).toContain('TASK3');
        });

        test('should parse @dependencies without brackets', () => {
            const content = '@dependencies TASK1, TASK2';

            const deps = parseDependencies(content);

            expect(deps).toContain('TASK1');
            expect(deps).toContain('TASK2');
        });

        test('should be case-insensitive', () => {
            const content = '@DEPENDENCIES [task1, TASK2]';

            const deps = parseDependencies(content);

            expect(deps.length).toBeGreaterThan(0);
        });

        test('should handle "none" value', () => {
            const content = '@dependencies none';

            const deps = parseDependencies(content);

            expect(deps).toEqual([]);
        });

        test('should handle empty brackets', () => {
            const content = '@dependencies []';

            const deps = parseDependencies(content);

            expect(deps).toEqual([]);
        });

        test('should filter invalid task names', () => {
            const content = '@dependencies [TASK1, invalid, TASK2]';

            const deps = parseDependencies(content);

            expect(deps).toContain('TASK1');
            expect(deps).toContain('TASK2');
            expect(deps).not.toContain('invalid');
        });

        test('should handle subtask format', () => {
            const content = '@dependencies [TASK1.1, TASK2.3]';

            const deps = parseDependencies(content);

            expect(deps).toContain('TASK1.1');
            expect(deps).toContain('TASK2.3');
        });

        test('should return empty array for no dependencies', () => {
            const content = 'No dependencies declared here';

            expect(parseDependencies(content)).toEqual([]);
        });

        test('should handle empty content', () => {
            expect(parseDependencies('')).toEqual([]);
            expect(parseDependencies(null)).toEqual([]);
        });
    });

    describe('parseDependsOn', () => {
        test('should parse "Depends on:" format', () => {
            const content = 'Depends on: TASK1, TASK2';

            const deps = parseDependsOn(content);

            expect(deps).toContain('TASK1');
            expect(deps).toContain('TASK2');
        });

        test('should parse "Dependencies:" format', () => {
            const content = 'Dependencies: TASK3';

            const deps = parseDependsOn(content);

            expect(deps).toContain('TASK3');
        });

        test('should parse "Requires:" format', () => {
            const content = 'Requires: TASK1';

            const deps = parseDependsOn(content);

            expect(deps).toContain('TASK1');
        });

        test('should parse "Blocked by:" format', () => {
            const content = 'Blocked by: TASK2';

            const deps = parseDependsOn(content);

            expect(deps).toContain('TASK2');
        });

        test('should deduplicate results', () => {
            const content = `Depends on: TASK1
Dependencies: TASK1`;

            const deps = parseDependsOn(content);

            expect(deps.filter(d => d === 'TASK1').length).toBe(1);
        });
    });

    describe('extractTaskReferences', () => {
        test('should find all TASK references', () => {
            const content = 'See TASK1 and TASK2 for details. Also check TASK3.';

            const refs = extractTaskReferences(content);

            expect(refs).toContain('TASK1');
            expect(refs).toContain('TASK2');
            expect(refs).toContain('TASK3');
        });

        test('should deduplicate references', () => {
            const content = 'TASK1 TASK1 TASK1';

            const refs = extractTaskReferences(content);

            expect(refs).toHaveLength(1);
            expect(refs[0]).toBe('TASK1');
        });

        test('should handle subtask format', () => {
            const content = 'TASK1.1 and TASK1.2';

            const refs = extractTaskReferences(content);

            expect(refs).toContain('TASK1.1');
            expect(refs).toContain('TASK1.2');
        });
    });

    describe('getAllDependencies', () => {
        test('should combine explicit dependencies', () => {
            const content = `@dependencies [TASK1]
Depends on: TASK2`;

            const result = getAllDependencies(content);

            expect(result.explicit).toContain('TASK1');
            expect(result.explicit).toContain('TASK2');
            expect(result.all).toContain('TASK1');
            expect(result.all).toContain('TASK2');
        });

        test('should separate explicit and inferred', () => {
            const content = '@dependencies [TASK1]';

            const result = getAllDependencies(content);

            expect(result.explicit).toContain('TASK1');
            expect(result.inferred).toEqual([]);
        });
    });

    describe('validateDependencyGraph', () => {
        test('should validate acyclic graph', () => {
            const graph = {
                TASK1: [],
                TASK2: ['TASK1'],
                TASK3: ['TASK1', 'TASK2'],
            };

            const result = validateDependencyGraph(graph);

            expect(result.valid).toBe(true);
            expect(result.cycles).toEqual([]);
        });

        test('should detect simple cycle', () => {
            const graph = {
                TASK1: ['TASK2'],
                TASK2: ['TASK1'],
            };

            const result = validateDependencyGraph(graph);

            expect(result.valid).toBe(false);
            expect(result.cycles.length).toBeGreaterThan(0);
        });

        test('should detect complex cycle', () => {
            const graph = {
                TASK1: ['TASK2'],
                TASK2: ['TASK3'],
                TASK3: ['TASK1'],
            };

            const result = validateDependencyGraph(graph);

            expect(result.valid).toBe(false);
        });

        test('should handle empty graph', () => {
            const result = validateDependencyGraph({});

            expect(result.valid).toBe(true);
            expect(result.cycles).toEqual([]);
        });

        test('should handle self-dependency', () => {
            const graph = {
                TASK1: ['TASK1'],
            };

            const result = validateDependencyGraph(graph);

            expect(result.valid).toBe(false);
        });
    });

    describe('getTopologicalOrder', () => {
        test('should return correct order for linear dependencies', () => {
            const graph = {
                TASK1: [],
                TASK2: ['TASK1'],
                TASK3: ['TASK2'],
            };

            const order = getTopologicalOrder(graph);

            expect(order).not.toBeNull();
            expect(order.indexOf('TASK1')).toBeLessThan(order.indexOf('TASK2'));
            expect(order.indexOf('TASK2')).toBeLessThan(order.indexOf('TASK3'));
        });

        test('should return correct order for diamond dependencies', () => {
            const graph = {
                TASK1: [],
                TASK2: ['TASK1'],
                TASK3: ['TASK1'],
                TASK4: ['TASK2', 'TASK3'],
            };

            const order = getTopologicalOrder(graph);

            expect(order).not.toBeNull();
            expect(order.indexOf('TASK1')).toBeLessThan(order.indexOf('TASK2'));
            expect(order.indexOf('TASK1')).toBeLessThan(order.indexOf('TASK3'));
            expect(order.indexOf('TASK2')).toBeLessThan(order.indexOf('TASK4'));
            expect(order.indexOf('TASK3')).toBeLessThan(order.indexOf('TASK4'));
        });

        test('should return null for cyclic graph', () => {
            const graph = {
                TASK1: ['TASK2'],
                TASK2: ['TASK1'],
            };

            const order = getTopologicalOrder(graph);

            expect(order).toBeNull();
        });

        test('should handle independent tasks', () => {
            const graph = {
                TASK1: [],
                TASK2: [],
                TASK3: [],
            };

            const order = getTopologicalOrder(graph);

            expect(order).not.toBeNull();
            expect(order).toHaveLength(3);
        });
    });
});
