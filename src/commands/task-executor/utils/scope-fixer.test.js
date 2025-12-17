const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../shared/executors/claude-executor');
jest.mock('../../../shared/utils/logger');
jest.mock('../../../shared/config/state');

const {
    detectScopeWithHeuristics,
    addScopeToBlueprint,
    buildScopeDetectionPrompt,
    autoFixScope,
} = require('./scope-fixer');

const state = require('../../../shared/config/state');
const { executeClaude } = require('../../../shared/executors/claude-executor');
const logger = require('../../../shared/utils/logger');

describe('scope-fixer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        state.claudiomiroFolder = '/test/.claudiomiro/task-executor';

        // Default mock implementations
        logger.info = jest.fn();
        logger.success = jest.fn();
        logger.warning = jest.fn();
        logger.error = jest.fn();
        logger.debug = jest.fn();
    });

    describe('detectScopeWithHeuristics', () => {
        test('should detect backend scope from content with backend indicators', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Creating API endpoint for user authentication
- Setting up database model for users
- Implementing server-side validation
- Creating backend service layer
            `);

            const scope = detectScopeWithHeuristics('/test/BLUEPRINT.md');
            expect(scope).toBe('backend');
        });

        test('should detect frontend scope from content with frontend indicators', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Creating React UI component for login form
- Setting up frontend state management with Redux
- Implementing client-side form validation
- Creating page component with Tailwind CSS
            `);

            const scope = detectScopeWithHeuristics('/test/BLUEPRINT.md');
            expect(scope).toBe('frontend');
        });

        test('should detect integration scope when both backend and frontend indicators present', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Creating API endpoint for authentication
- Creating React UI component for login form
- Setting up E2E tests for the full flow
            `);

            const scope = detectScopeWithHeuristics('/test/BLUEPRINT.md');
            expect(scope).toBe('integration');
        });

        test('should detect integration scope from E2E test indicators', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Creating end-to-end tests for user authentication
- Setting up integration test suite
- Validating API contract between frontend and backend
            `);

            const scope = detectScopeWithHeuristics('/test/BLUEPRINT.md');
            expect(scope).toBe('integration');
        });

        test('should return null when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const scope = detectScopeWithHeuristics('/test/BLUEPRINT.md');
            expect(scope).toBeNull();
        });

        test('should return null when content is inconclusive', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Implementing a feature
- Writing some code
            `);

            const scope = detectScopeWithHeuristics('/test/BLUEPRINT.md');
            expect(scope).toBeNull();
        });
    });

    describe('addScopeToBlueprint', () => {
        test('should add scope after @dependencies line', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`<!-- BLUEPRINT: Read-only after creation -->
@dependencies [TASK0]
@difficulty medium

# BLUEPRINT: TASK1
`);
            fs.writeFileSync = jest.fn();

            const result = addScopeToBlueprint('/test/BLUEPRINT.md', 'backend');

            expect(result).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                '/test/BLUEPRINT.md',
                expect.stringContaining('@scope backend'),
                'utf-8',
            );
            // Verify @scope is after @dependencies
            const writtenContent = fs.writeFileSync.mock.calls[0][1];
            const depsIndex = writtenContent.indexOf('@dependencies');
            const scopeIndex = writtenContent.indexOf('@scope');
            expect(scopeIndex).toBeGreaterThan(depsIndex);
        });

        test('should not add scope if already exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`<!-- BLUEPRINT: Read-only after creation -->
@dependencies [TASK0]
@scope frontend
@difficulty medium

# BLUEPRINT: TASK1
`);
            fs.writeFileSync = jest.fn();

            const result = addScopeToBlueprint('/test/BLUEPRINT.md', 'backend');

            expect(result).toBe(true);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should add scope at beginning if no @dependencies', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`<!-- BLUEPRINT: Read-only after creation -->
# BLUEPRINT: TASK1

## 1. IDENTITY
`);
            fs.writeFileSync = jest.fn();

            const result = addScopeToBlueprint('/test/BLUEPRINT.md', 'integration');

            expect(result).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                '/test/BLUEPRINT.md',
                expect.stringContaining('@scope integration'),
                'utf-8',
            );
        });

        test('should return false if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = addScopeToBlueprint('/test/BLUEPRINT.md', 'backend');

            expect(result).toBe(false);
        });
    });

    describe('buildScopeDetectionPrompt', () => {
        test('should include blueprint content in prompt', () => {
            const blueprintContent = '# BLUEPRINT: TASK1\n## 1. IDENTITY';
            const taskName = 'TASK1';

            const prompt = buildScopeDetectionPrompt(blueprintContent, taskName);

            expect(prompt).toContain(blueprintContent);
            expect(prompt).toContain(taskName);
            expect(prompt).toContain('backend');
            expect(prompt).toContain('frontend');
            expect(prompt).toContain('integration');
        });

        test('should include decision rules', () => {
            const prompt = buildScopeDetectionPrompt('content', 'TASK1');

            expect(prompt).toContain('Decision Rules');
            expect(prompt).toContain('server-side code');
            expect(prompt).toContain('client-side code');
        });
    });

    describe('autoFixScope', () => {
        test('should use heuristics first before AI', async () => {
            const taskFolder = '/test/.claudiomiro/task-executor/TASK1';
            const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');

            fs.existsSync.mockImplementation((p) => {
                return p === blueprintPath;
            });
            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Creating API endpoint for users
- Setting up database model
- Implementing server-side validation
- Backend service layer implementation
            `);
            fs.writeFileSync = jest.fn();

            const scope = await autoFixScope('TASK1');

            expect(scope).toBe('backend');
            // Should not call Claude since heuristics worked
            expect(executeClaude).not.toHaveBeenCalled();
        });

        test('should return null when BLUEPRINT.md does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            const scope = await autoFixScope('TASK1');

            expect(scope).toBeNull();
        });

        test('should use AI when heuristics are inconclusive', async () => {
            const taskFolder = '/test/.claudiomiro/task-executor/TASK1';
            const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
            const outputFile = path.join(taskFolder, '.scope-detection-output.txt');

            let existsCalls = 0;
            fs.existsSync.mockImplementation((p) => {
                existsCalls++;
                if (p === blueprintPath) return true;
                if (p === outputFile) return existsCalls > 2; // Simulate file created after AI execution
                return false;
            });

            fs.readFileSync.mockImplementation((p) => {
                if (p === blueprintPath) {
                    return `
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Doing something generic
                    `;
                }
                if (p === outputFile) {
                    return 'frontend';
                }
                return '';
            });

            fs.writeFileSync = jest.fn();
            fs.unlinkSync = jest.fn();
            executeClaude.mockResolvedValue();

            const scope = await autoFixScope('TASK1');

            expect(scope).toBe('frontend');
            expect(executeClaude).toHaveBeenCalled();
        });

        test('should default to integration when AI fails', async () => {
            const taskFolder = '/test/.claudiomiro/task-executor/TASK1';
            const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');

            fs.existsSync.mockImplementation((p) => {
                if (p === blueprintPath) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue(`
# BLUEPRINT: TASK1
## 1. IDENTITY
### This Task IS:
- Generic task
            `);

            fs.writeFileSync = jest.fn();
            executeClaude.mockRejectedValue(new Error('AI failed'));

            const scope = await autoFixScope('TASK1');

            // Should default to integration after AI failure
            expect(scope).toBe('integration');
        });
    });
});
