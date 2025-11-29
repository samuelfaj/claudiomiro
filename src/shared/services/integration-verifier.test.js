const { executeClaude } = require('../executors/claude-executor');
const {
    verifyIntegration,
    buildVerificationPrompt,
    parseVerificationResult,
} = require('./integration-verifier');

// Mock modules
jest.mock('../executors/claude-executor');

describe('integration-verifier', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('buildVerificationPrompt', () => {
        test('should include both backend and frontend paths in prompt', () => {
            const backendPath = '/path/to/backend';
            const frontendPath = '/path/to/frontend';

            const prompt = buildVerificationPrompt(backendPath, frontendPath);

            expect(prompt).toContain(backendPath);
            expect(prompt).toContain(frontendPath);
        });

        test('should request JSON format response', () => {
            const prompt = buildVerificationPrompt('/backend', '/frontend');

            expect(prompt).toContain('JSON');
            expect(prompt).toContain('"success"');
            expect(prompt).toContain('"mismatches"');
        });

        test('should include mismatch type definitions', () => {
            const prompt = buildVerificationPrompt('/backend', '/frontend');

            expect(prompt).toContain('endpoint_mismatch');
            expect(prompt).toContain('payload_mismatch');
            expect(prompt).toContain('response_mismatch');
            expect(prompt).toContain('missing_endpoint');
        });
    });

    describe('parseVerificationResult', () => {
        test('should parse clean JSON correctly', () => {
            const claudeOutput = JSON.stringify({
                success: true,
                mismatches: [],
                summary: 'No issues found',
            });

            const result = parseVerificationResult(claudeOutput);

            expect(result.success).toBe(true);
            expect(result.mismatches).toEqual([]);
            expect(result.summary).toBe('No issues found');
        });

        test('should parse JSON with mismatches', () => {
            const claudeOutput = JSON.stringify({
                success: false,
                mismatches: [{
                    type: 'endpoint_mismatch',
                    description: 'API endpoint /users not found',
                    backendFile: 'routes/users.js',
                    frontendFile: 'api/users.ts',
                }],
                summary: 'Found 1 issue',
            });

            const result = parseVerificationResult(claudeOutput);

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('endpoint_mismatch');
        });

        test('should extract JSON from wrapped text', () => {
            const claudeOutput = `Here is my analysis:

            {"success": true, "mismatches": [], "summary": "All good"}

            This concludes the verification.`;

            const result = parseVerificationResult(claudeOutput);

            expect(result.success).toBe(true);
            expect(result.mismatches).toEqual([]);
        });

        test('should return parse_error for malformed JSON', () => {
            const claudeOutput = '{ invalid json }';

            const result = parseVerificationResult(claudeOutput);

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('parse_error');
            expect(result.mismatches[0].description).toContain('Failed to parse JSON');
        });

        test('should return parse_error for empty input', () => {
            const result = parseVerificationResult('');

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('parse_error');
            expect(result.mismatches[0].description).toContain('Empty or invalid');
        });

        test('should return parse_error for null input', () => {
            const result = parseVerificationResult(null);

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('parse_error');
        });

        test('should return parse_error when no JSON object found', () => {
            const claudeOutput = 'This is just text without any JSON object';

            const result = parseVerificationResult(claudeOutput);

            expect(result.success).toBe(false);
            expect(result.mismatches[0].type).toBe('parse_error');
            expect(result.mismatches[0].description).toContain('No JSON object found');
        });

        test('should return parse_error for invalid JSON structure', () => {
            const claudeOutput = '{"foo": "bar"}'; // Missing required fields

            const result = parseVerificationResult(claudeOutput);

            expect(result.success).toBe(false);
            expect(result.mismatches[0].type).toBe('parse_error');
            expect(result.mismatches[0].description).toContain('missing required fields');
        });
    });

    describe('verifyIntegration', () => {
        test('should return success result when Claude finds no issues', async () => {
            executeClaude.mockResolvedValue(JSON.stringify({
                success: true,
                mismatches: [],
                summary: 'No integration issues found',
            }));

            const result = await verifyIntegration({
                backendPath: '/path/to/backend',
                frontendPath: '/path/to/frontend',
            });

            expect(result.success).toBe(true);
            expect(result.mismatches).toEqual([]);
        });

        test('should return mismatches when Claude finds issues', async () => {
            executeClaude.mockResolvedValue(JSON.stringify({
                success: false,
                mismatches: [{
                    type: 'payload_mismatch',
                    description: 'User creation payload differs',
                    backendFile: 'controllers/user.py',
                    frontendFile: 'services/userService.js',
                }],
                summary: 'Found integration issues',
            }));

            const result = await verifyIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('payload_mismatch');
        });

        test('should call executeClaude with correct arguments including cwd option', async () => {
            executeClaude.mockResolvedValue('{"success": true, "mismatches": []}');

            await verifyIntegration({
                backendPath: '/my/backend',
                frontendPath: '/my/frontend',
            });

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('/my/backend'),
                'integration-verify',
                { cwd: '/my/backend' },
            );
        });

        test('should return execution_error when executeClaude throws', async () => {
            executeClaude.mockRejectedValue(new Error('Claude process failed'));

            const result = await verifyIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('execution_error');
            expect(result.mismatches[0].description).toContain('Claude execution failed');
        });

        test('should handle parse errors from malformed Claude response', async () => {
            executeClaude.mockResolvedValue('not valid json at all');

            const result = await verifyIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(false);
            expect(result.mismatches[0].type).toBe('parse_error');
        });
    });
});
