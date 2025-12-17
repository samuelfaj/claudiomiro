const fs = require('fs');

jest.mock('fs');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
    folder: '/test/project',
    isMultiRepo: jest.fn().mockReturnValue(false),
    getRepository: jest.fn().mockReturnValue('/test/project'),
}));
jest.mock('../../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
}));
jest.mock('../../utils/schema-validator');
jest.mock('../../utils/scope-parser');

// Import after mocks
const { generateExecution } = require('./generate-execution');
const { validateExecutionJson } = require('../../utils/schema-validator');
const { parseTaskScope, validateScopeWithAutoFix } = require('../../utils/scope-parser');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');

describe('generate-execution', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        parseTaskScope.mockReturnValue(null);
        validateScopeWithAutoFix.mockResolvedValue({ valid: true, scope: null, autoFixed: false });
        validateExecutionJson.mockReturnValue({ valid: true, errors: [] });

        // Default fs mocks - BLUEPRINT.md must exist
        fs.existsSync.mockImplementation((path) => path.includes('BLUEPRINT.md'));
        fs.readFileSync.mockReturnValue('# Sample Task\nTask content here');
        fs.writeFileSync.mockImplementation(() => {});
    });

    describe('requires BLUEPRINT.md', () => {
        test('should throw error when BLUEPRINT.md does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            await expect(generateExecution(mockTask)).rejects.toThrow(
                'BLUEPRINT.md not found for task TASK1. Step 3 must generate BLUEPRINT.md before step 4.',
            );
        });
    });

    describe('generateExecution', () => {
        test('should generate valid execution.json with all required fields', async () => {
            await generateExecution(mockTask);

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
            const writtenPath = fs.writeFileSync.mock.calls[0][0];
            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);

            expect(writtenPath).toContain('execution.json');
            expect(writtenContent.$schema).toBe('execution-schema-v1');
            expect(writtenContent.version).toBe('1.0');
            expect(writtenContent.task).toBe('TASK1');
            expect(writtenContent.status).toBe('pending');
            expect(writtenContent.attempts).toBe(0);
        });

        test('should call schema validation before writing file', async () => {
            await generateExecution(mockTask);

            expect(validateExecutionJson).toHaveBeenCalledTimes(1);
            expect(validateExecutionJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    $schema: 'execution-schema-v1',
                    status: 'pending',
                }),
            );
            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        });

        test('should throw error when validation fails', async () => {
            validateExecutionJson.mockReturnValue({
                valid: false,
                errors: ['Missing required field "task"', 'Invalid status enum'],
            });

            await expect(generateExecution(mockTask)).rejects.toThrow('execution.json validation failed');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should set initial status as pending', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.status).toBe('pending');
        });

        test('should initialize all phases with pending status', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.phases).toBeInstanceOf(Array);
            expect(writtenContent.phases.length).toBeGreaterThan(0);
            writtenContent.phases.forEach((phase) => {
                expect(phase.status).toBe('pending');
            });
        });

        test('should use default phases when BLUEPRINT.md has no phases section', async () => {
            fs.readFileSync.mockReturnValue('# Simple Task\nNo phases defined');

            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.phases).toEqual([
                { id: 1, name: 'Preparation', status: 'pending' },
                { id: 2, name: 'Core Implementation', status: 'pending' },
                { id: 3, name: 'Testing', status: 'pending' },
                { id: 4, name: 'Verification', status: 'pending' },
            ]);
        });

        test('should read BLUEPRINT.md when it exists', async () => {
            fs.readFileSync.mockReturnValue('# Blueprint Title\n## 4. IMPLEMENTATION STRATEGY\n### Phase 1: Setup\n### Phase 2: Build');

            await generateExecution(mockTask);

            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('BLUEPRINT.md'),
                'utf-8',
            );
        });

        test('should extract phases from BLUEPRINT.md content', async () => {
            const blueprintContent = `# My Task
## 4. IMPLEMENTATION STRATEGY
### Phase 1: Database Setup
### Phase 2: API Development
### Phase 3: Frontend Integration
`;
            fs.readFileSync.mockReturnValue(blueprintContent);

            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.phases).toEqual([
                { id: 1, name: 'Database Setup', status: 'pending' },
                { id: 2, name: 'API Development', status: 'pending' },
                { id: 3, name: 'Frontend Integration', status: 'pending' },
            ]);
        });

        test('should extract task title from content heading', async () => {
            fs.readFileSync.mockReturnValue('# Implement User Authentication');

            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.title).toBe('Implement User Authentication');
        });

        test('should use first non-empty line when no heading found', async () => {
            fs.readFileSync.mockReturnValue('Some content without heading');

            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.title).toBe('Some content without heading');
        });

        test('should use Untitled Task when content is empty', async () => {
            fs.readFileSync.mockReturnValue('');

            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.title).toBe('Untitled Task');
        });

        test('should write JSON with 2-space indentation', async () => {
            await generateExecution(mockTask);

            const writtenJson = fs.writeFileSync.mock.calls[0][1];
            // Check that it has proper indentation (2 spaces)
            expect(writtenJson).toContain('\n  "');
        });

        test('should include ISO timestamp in started field', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.started).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        test('should initialize beyondTheBasics with correct structure', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.beyondTheBasics).toEqual({
                extras: [],
                edgeCases: [],
                downstreamImpact: {},
                cleanup: {
                    debugLogsRemoved: false,
                    formattingConsistent: false,
                    deadCodeRemoved: false,
                },
            });
        });

        test('should initialize completion with pending_validation status', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.completion).toEqual({
                status: 'pending_validation',
                summary: [],
                deviations: [],
                forFutureTasks: [],
            });
        });

        test('should initialize empty arrays for uncertainties and artifacts', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.uncertainties).toEqual([]);
            expect(writtenContent.artifacts).toEqual([]);
        });

        test('should set currentPhase to first phase', async () => {
            await generateExecution(mockTask);

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.currentPhase).toEqual({
                id: 1,
                name: 'Preparation',
                lastAction: 'Initialized',
            });
        });

        test('should handle subtask format (TASK2.1 -> TASK2)', async () => {
            await generateExecution('TASK2.1');

            const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenContent.task).toBe('TASK2');
        });

        test('should log debug message after generation', async () => {
            await generateExecution(mockTask);

            expect(logger.debug).toHaveBeenCalledWith('[Step4] Generated execution.json for TASK1');
        });

        describe('multi-repo mode', () => {
            test('should throw error when scope is missing and auto-fix fails in multi-repo mode', async () => {
                state.isMultiRepo.mockReturnValue(true);
                parseTaskScope.mockReturnValue(null);
                validateScopeWithAutoFix.mockResolvedValue({ valid: false, scope: null, autoFixed: false });

                fs.readFileSync.mockReturnValue('# Task without scope');

                await expect(generateExecution(mockTask)).rejects.toThrow(
                    '@scope tag is required in multi-repo mode',
                );
            });

            test('should parse scope from content and skip auto-fix when scope exists', async () => {
                state.isMultiRepo.mockReturnValue(true);
                parseTaskScope.mockReturnValue('backend');

                fs.readFileSync.mockReturnValue('@scope backend\n# Backend task');

                await generateExecution(mockTask);

                expect(parseTaskScope).toHaveBeenCalled();
                // validateScopeWithAutoFix should not be called when scope already exists
                expect(validateScopeWithAutoFix).not.toHaveBeenCalled();
            });

            test('should auto-fix scope when missing in multi-repo mode', async () => {
                state.isMultiRepo.mockReturnValue(true);
                parseTaskScope.mockReturnValue(null);
                validateScopeWithAutoFix.mockResolvedValue({ valid: true, scope: 'frontend', autoFixed: true });

                fs.readFileSync.mockReturnValue('# Task without scope');

                await generateExecution(mockTask);

                expect(validateScopeWithAutoFix).toHaveBeenCalledWith(null, true, mockTask);
                expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('attempting auto-fix'));
                expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Auto-fixed @scope'));
            });
        });

        describe('validation error handling', () => {
            test('should include all validation errors in thrown error message', async () => {
                validateExecutionJson.mockReturnValue({
                    valid: false,
                    errors: [
                        'root: Missing required field "task"',
                        'status: Invalid value. Allowed values: pending, in_progress, completed, blocked',
                    ],
                });

                await expect(generateExecution(mockTask)).rejects.toThrow(
                    /Missing required field "task"/,
                );
            });
        });
    });
});
