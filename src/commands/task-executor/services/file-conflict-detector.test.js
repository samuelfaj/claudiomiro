const {
    parseFilesTag,
    canRunInParallel,
    detectFileConflicts,
    autoResolveConflicts,
    suggestDependencyFixes,
    findTasksMissingFiles,
} = require('./file-conflict-detector');

describe('file-conflict-detector', () => {
    describe('parseFilesTag', () => {
        test('should parse @files tag with multiple files', () => {
            const content = `
@dependencies [TASK0]
@scope backend
@difficulty fast
@files [src/models/user.js, src/models/user.test.js]

# BLUEPRINT
`;
            expect(parseFilesTag(content)).toEqual([
                'src/models/user.js',
                'src/models/user.test.js',
            ]);
        });

        test('should parse @files tag with single file', () => {
            const content = '@files [src/handler.js]';
            expect(parseFilesTag(content)).toEqual(['src/handler.js']);
        });

        test('should return empty array if no @files tag', () => {
            const content = '@dependencies [TASK0]\n@scope backend';
            expect(parseFilesTag(content)).toEqual([]);
        });

        test('should return empty array for empty @files tag', () => {
            const content = '@files []';
            expect(parseFilesTag(content)).toEqual([]);
        });

        test('should return empty array for null/undefined content', () => {
            expect(parseFilesTag(null)).toEqual([]);
            expect(parseFilesTag(undefined)).toEqual([]);
            expect(parseFilesTag('')).toEqual([]);
        });

        test('should handle whitespace in file paths', () => {
            const content = '@files [  src/a.js  ,  src/b.js  ]';
            expect(parseFilesTag(content)).toEqual(['src/a.js', 'src/b.js']);
        });

        test('should be case-insensitive for @files tag', () => {
            const content = '@FILES [src/a.js]';
            expect(parseFilesTag(content)).toEqual(['src/a.js']);
        });
    });

    describe('canRunInParallel', () => {
        test('should return true for independent tasks', () => {
            const graph = {
                TASK1: { deps: [], files: [] },
                TASK2: { deps: [], files: [] },
            };
            expect(canRunInParallel(graph, 'TASK1', 'TASK2')).toBe(true);
        });

        test('should return false if task1 depends on task2', () => {
            const graph = {
                TASK1: { deps: ['TASK2'], files: [] },
                TASK2: { deps: [], files: [] },
            };
            expect(canRunInParallel(graph, 'TASK1', 'TASK2')).toBe(false);
        });

        test('should return false if task2 depends on task1', () => {
            const graph = {
                TASK1: { deps: [], files: [] },
                TASK2: { deps: ['TASK1'], files: [] },
            };
            expect(canRunInParallel(graph, 'TASK1', 'TASK2')).toBe(false);
        });

        test('should return false for transitive dependencies', () => {
            const graph = {
                TASK1: { deps: [], files: [] },
                TASK2: { deps: ['TASK1'], files: [] },
                TASK3: { deps: ['TASK2'], files: [] },
            };
            // TASK3 transitively depends on TASK1
            expect(canRunInParallel(graph, 'TASK1', 'TASK3')).toBe(false);
        });

        test('should return false if task does not exist', () => {
            const graph = {
                TASK1: { deps: [], files: [] },
            };
            expect(canRunInParallel(graph, 'TASK1', 'TASK2')).toBe(false);
        });
    });

    describe('detectFileConflicts', () => {
        test('should detect conflict between parallel tasks with same file', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/handler.js'] },
                TASK2: { deps: [], files: ['src/handler.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0]).toMatchObject({
                task1: 'TASK1',
                task2: 'TASK2',
                files: ['src/handler.js'],
            });
        });

        test('should NOT detect conflict if tasks have dependency', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/handler.js'] },
                TASK2: { deps: ['TASK1'], files: ['src/handler.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(0);
        });

        test('should NOT detect conflict if files are different', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/a.js'] },
                TASK2: { deps: [], files: ['src/b.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(0);
        });

        test('should detect multiple file conflicts', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/a.js', 'src/b.js'] },
                TASK2: { deps: [], files: ['src/a.js', 'src/b.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].files).toHaveLength(2);
        });

        test('should detect conflicts between multiple tasks', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/shared.js'] },
                TASK2: { deps: [], files: ['src/shared.js'] },
                TASK3: { deps: [], files: ['src/shared.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            // TASK1-TASK2, TASK1-TASK3, TASK2-TASK3 = 3 conflicts
            expect(conflicts).toHaveLength(3);
        });

        test('should handle empty files arrays', () => {
            const graph = {
                TASK1: { deps: [], files: [] },
                TASK2: { deps: [], files: [] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(0);
        });

        test('should handle missing files property', () => {
            const graph = {
                TASK1: { deps: [] },
                TASK2: { deps: [] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(0);
        });

        test('should handle case-insensitive file comparison', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/Handler.js'] },
                TASK2: { deps: [], files: ['src/handler.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(1);
        });
    });

    describe('autoResolveConflicts', () => {
        test('should add dependency to resolve conflict', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/a.js'] },
                TASK2: { deps: [], files: ['src/a.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            const resolutions = autoResolveConflicts(graph, conflicts);

            expect(resolutions).toHaveLength(1);
            expect(resolutions[0].resolution).toBe('TASK2 now depends on TASK1');
            expect(graph.TASK2.deps).toContain('TASK1');
        });

        test('should use alphabetical order for consistent resolution', () => {
            const graph = {
                TASK_B: { deps: [], files: ['src/a.js'] },
                TASK_A: { deps: [], files: ['src/a.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            autoResolveConflicts(graph, conflicts);

            // TASK_A comes before TASK_B alphabetically
            expect(graph.TASK_B.deps).toContain('TASK_A');
            expect(graph.TASK_A.deps).not.toContain('TASK_B');
        });

        test('should not add duplicate dependencies', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/a.js'] },
                TASK2: { deps: ['TASK1'], files: ['src/a.js'] },
            };
            // No conflicts because TASK2 already depends on TASK1
            const conflicts = detectFileConflicts(graph);
            expect(conflicts).toHaveLength(0);
        });

        test('should resolve multiple conflicts', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/shared.js'] },
                TASK2: { deps: [], files: ['src/shared.js'] },
                TASK3: { deps: [], files: ['src/shared.js'] },
            };
            const conflicts = detectFileConflicts(graph);
            const resolutions = autoResolveConflicts(graph, conflicts);

            expect(resolutions.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('suggestDependencyFixes', () => {
        test('should suggest dependency fix for conflict', () => {
            const conflicts = [
                { task1: 'TASK2', task2: 'TASK1', files: ['src/a.js'] },
            ];
            const suggestions = suggestDependencyFixes(conflicts);

            expect(suggestions).toHaveLength(1);
            // TASK1 < TASK2 alphabetically, so TASK2 should depend on TASK1
            expect(suggestions[0].suggestion).toBe(
                "Add @dependencies [TASK1] to TASK2's BLUEPRINT.md",
            );
        });

        test('should return empty array for no conflicts', () => {
            const suggestions = suggestDependencyFixes([]);
            expect(suggestions).toEqual([]);
        });
    });

    describe('findTasksMissingFiles', () => {
        test('should find tasks without @files declaration', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/a.js'] },
                TASK2: { deps: [] },
                TASK3: { deps: [], files: [] },
            };
            const missing = findTasksMissingFiles(graph);
            expect(missing).toContain('TASK2');
            expect(missing).toContain('TASK3');
            expect(missing).not.toContain('TASK1');
        });

        test('should return empty array if all tasks have files', () => {
            const graph = {
                TASK1: { deps: [], files: ['src/a.js'] },
                TASK2: { deps: [], files: ['src/b.js'] },
            };
            const missing = findTasksMissingFiles(graph);
            expect(missing).toEqual([]);
        });
    });
});
