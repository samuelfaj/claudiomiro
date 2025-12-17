const fs = require('fs');
const {
    validateArtifactsExist,
    markArtifactsForRecreation,
    checkReviewChecklistBlocked,
} = require('./artifacts-exist');

jest.mock('fs');
jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('artifacts-exist', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateArtifactsExist', () => {
        test('should return valid when no artifacts exist', () => {
            const execution = { artifacts: [] };
            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
            expect(result.totalCount).toBe(0);
        });

        test('should return valid when all created artifacts exist on filesystem', () => {
            fs.existsSync.mockReturnValue(true);

            const execution = {
                artifacts: [
                    { path: 'src/file1.js', type: 'created' },
                    { path: 'src/file2.js', type: 'modified' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
            expect(result.existingCount).toBe(2);
            expect(result.totalCount).toBe(2);
        });

        test('should return invalid when created artifact does not exist (hallucination)', () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('file1.js')) return true;
                if (filePath.includes('file2.js')) return false;
                return false;
            });

            const execution = {
                artifacts: [
                    { path: 'src/file1.js', type: 'created' },
                    { path: 'src/file2.js', type: 'created' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0].path).toBe('src/file2.js');
            expect(result.missingCount).toBe(1);
            expect(result.existingCount).toBe(1);
        });

        test('should skip deleted artifacts', () => {
            fs.existsSync.mockReturnValue(true);

            const execution = {
                artifacts: [
                    { path: 'src/file1.js', type: 'created' },
                    { path: 'src/deleted.js', type: 'deleted' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(true);
            expect(result.totalCount).toBe(1);
        });

        test('should handle action field as well as type field', () => {
            fs.existsSync.mockReturnValue(true);

            const execution = {
                artifacts: [
                    { path: 'src/file1.js', action: 'created' },
                    { path: 'src/file2.js', action: 'modified' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(true);
            expect(result.totalCount).toBe(2);
        });

        test('should handle absolute paths', () => {
            fs.existsSync.mockReturnValue(true);

            const execution = {
                artifacts: [
                    { path: '/absolute/path/file.js', type: 'created' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith('/absolute/path/file.js');
        });

        test('should resolve relative paths with cwd', () => {
            fs.existsSync.mockReturnValue(true);

            const execution = {
                artifacts: [
                    { path: 'src/relative/file.js', type: 'created' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith('/project/src/relative/file.js');
        });

        test('should detect multiple missing files', () => {
            fs.existsSync.mockReturnValue(false);

            const execution = {
                artifacts: [
                    { path: 'src/file1.js', type: 'created' },
                    { path: 'src/file2.js', type: 'created' },
                    { path: 'src/file3.js', type: 'modified' },
                ],
            };

            const result = validateArtifactsExist(execution, { cwd: '/project', claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(3);
            expect(result.missingCount).toBe(3);
        });
    });

    describe('markArtifactsForRecreation', () => {
        test('should return early if no missing artifacts', () => {
            const execution = { artifacts: [], phases: [] };
            const result = markArtifactsForRecreation(execution, []);

            expect(result.actionsTaken).toBe(0);
            expect(result.resetPhases).toEqual([]);
        });

        test('should mark artifacts as needing creation', () => {
            const execution = {
                artifacts: [
                    { path: 'src/file1.js', verified: true },
                    { path: 'src/file2.js', verified: true },
                ],
                phases: [],
            };

            const missingArtifacts = [
                { path: 'src/file1.js' },
            ];

            markArtifactsForRecreation(execution, missingArtifacts);

            expect(execution.artifacts[0].verified).toBe(false);
            expect(execution.artifacts[0].needsCreation).toBe(true);
            expect(execution.artifacts[0].hallucinationDetected).toBe(true);
            expect(execution.artifacts[1].verified).toBe(true);
        });

        test('should reset phases that mention missing files', () => {
            const execution = {
                artifacts: [
                    { path: 'src/Component.tsx', verified: true },
                ],
                phases: [
                    {
                        id: 1,
                        name: 'Implementation',
                        status: 'completed',
                        items: [
                            { description: 'Create Component.tsx', completed: true, evidence: 'Created at src/Component.tsx' },
                            { description: 'Add tests', completed: true, evidence: 'Test file created' },
                        ],
                    },
                ],
            };

            const missingArtifacts = [
                { path: 'src/Component.tsx' },
            ];

            const result = markArtifactsForRecreation(execution, missingArtifacts);

            expect(result.resetPhases).toContain(1);
            expect(execution.phases[0].status).toBe('in_progress');
            expect(execution.phases[0].items[0].completed).toBe(false);
            expect(execution.phases[0].items[0].hallucinationDetected).toBe(true);
            expect(execution.phases[0].items[1].completed).toBe(true);
        });

        test('should add error to errorHistory', () => {
            const execution = {
                artifacts: [{ path: 'src/file.js', verified: true }],
                phases: [],
            };

            const missingArtifacts = [{ path: 'src/file.js' }];

            markArtifactsForRecreation(execution, missingArtifacts);

            expect(execution.errorHistory).toHaveLength(1);
            expect(execution.errorHistory[0].severity).toBe('CRITICAL');
            expect(execution.errorHistory[0].message).toContain('Hallucination detected');
        });

        test('should update completion status', () => {
            const execution = {
                artifacts: [{ path: 'src/file.js', verified: true }],
                phases: [],
                completion: { status: 'completed' },
            };

            const missingArtifacts = [{ path: 'src/file.js' }];

            markArtifactsForRecreation(execution, missingArtifacts);

            expect(execution.completion.status).toBe('pending_recovery');
            expect(execution.completion.hallucinationDetected).toBe(true);
            expect(execution.completion.missingArtifacts).toContain('src/file.js');
            expect(execution.status).toBe('in_progress');
        });
    });

    describe('checkReviewChecklistBlocked', () => {
        test('should return not blocked if checklist does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = checkReviewChecklistBlocked('TASK1', { claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.blocked).toBe(false);
        });

        test('should detect blocked status in checklist', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'blocked',
                summary: {
                    critical_issue: 'Files are missing from filesystem',
                },
            }));

            const result = checkReviewChecklistBlocked('TASK1', { claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('Files are missing');
        });

        test('should detect FILE NOT FOUND failure reasons', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'pending',
                items: [
                    { id: 'RC1', file: 'src/file1.js', failureReason: 'FILE NOT FOUND: Component does not exist' },
                    { id: 'RC2', file: 'src/file2.js', reviewed: true },
                ],
            }));

            const result = checkReviewChecklistBlocked('TASK1', { claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('1 review items failed');
            expect(result.missingFiles).toContain('src/file1.js');
        });

        test('should return not blocked for valid checklist', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'completed',
                items: [
                    { id: 'RC1', file: 'src/file1.js', reviewed: true },
                ],
            }));

            const result = checkReviewChecklistBlocked('TASK1', { claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.blocked).toBe(false);
        });

        test('should handle JSON parse errors gracefully', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('not valid json');

            const result = checkReviewChecklistBlocked('TASK1', { claudiomiroFolder: '/project/.claudiomiro' });

            expect(result.blocked).toBe(false);
            expect(result.reason).toContain('Could not parse');
        });
    });
});
