const fs = require('fs');
const path = require('path');
const { executeClaude } = require('../executors/claude-executor');
const {
    verifyIntegration,
    verifyAndFixIntegration,
    fixIntegrationMismatches,
    buildVerificationPrompt,
    buildFixPrompt,
    parseVerificationResult,
    extractBalancedJson,
} = require('./integration-verifier');

// Mock modules
jest.mock('../executors/claude-executor');

describe('integration-verifier', () => {
    const writeResultToPromptPath = (prompt, payload) => {
        const match = prompt.match(/OUTPUT_FILE:\s*(.+)/);
        expect(match).toBeTruthy();
        const outputPath = match[1].trim();
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, payload, 'utf-8');
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extractBalancedJson', () => {
        test('should extract simple JSON object', () => {
            const input = '{"success": true, "mismatches": []}';
            expect(extractBalancedJson(input)).toBe(input);
        });

        test('should extract JSON from wrapped text', () => {
            const input = 'Here is my analysis:\n{"success": true}\nEnd of analysis';
            expect(extractBalancedJson(input)).toBe('{"success": true}');
        });

        test('should handle nested objects', () => {
            const input = '{"outer": {"inner": {"deep": true}}}';
            expect(extractBalancedJson(input)).toBe(input);
        });

        test('should handle arrays with objects', () => {
            const input = '{"mismatches": [{"type": "error"}, {"type": "warning"}]}';
            expect(extractBalancedJson(input)).toBe(input);
        });

        test('should handle strings with braces inside', () => {
            const input = '{"description": "Use { and } for objects"}';
            expect(extractBalancedJson(input)).toBe(input);
        });

        test('should handle escaped quotes in strings', () => {
            const input = '{"text": "He said \\"hello\\""}';
            expect(extractBalancedJson(input)).toBe(input);
        });

        test('should return null for no JSON', () => {
            expect(extractBalancedJson('No JSON here')).toBeNull();
        });

        test('should return null for empty string', () => {
            expect(extractBalancedJson('')).toBeNull();
        });

        test('should extract first JSON when multiple objects present', () => {
            const input = 'First: {"a": 1} Second: {"b": 2}';
            expect(extractBalancedJson(input)).toBe('{"a": 1}');
        });

        test('should handle unbalanced braces (return null)', () => {
            const input = '{"unclosed": true';
            expect(extractBalancedJson(input)).toBeNull();
        });
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

        test('should embed output instructions when outputPath provided', () => {
            const prompt = buildVerificationPrompt('/backend', '/frontend', '/tmp/result.json');

            expect(prompt).toContain('OUTPUT_FILE: /tmp/result.json');
            expect(prompt).toContain('Write ONLY the JSON object');
            expect(prompt).toContain('OUTPUT_FILE_QUOTED: "/tmp/result.json"');
            expect(prompt).toContain('mkdir -p "$(dirname "/tmp/result.json")"');
            expect(prompt).toContain('cat <<\'EOF\' > "/tmp/result.json"');
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
            executeClaude.mockImplementation(async (prompt) => {
                writeResultToPromptPath(prompt, JSON.stringify({
                    success: true,
                    mismatches: [],
                    summary: 'No integration issues found',
                }));
            });

            const result = await verifyIntegration({
                backendPath: '/path/to/backend',
                frontendPath: '/path/to/frontend',
            });

            expect(result.success).toBe(true);
            expect(result.mismatches).toEqual([]);
        });

        test('should return mismatches when Claude finds issues', async () => {
            executeClaude.mockImplementation(async (prompt) => {
                writeResultToPromptPath(prompt, JSON.stringify({
                    success: false,
                    mismatches: [{
                        type: 'payload_mismatch',
                        description: 'User creation payload differs',
                        backendFile: 'controllers/user.py',
                        frontendFile: 'services/userService.js',
                    }],
                    summary: 'Found integration issues',
                }));
            });

            const result = await verifyIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(false);
            expect(result.mismatches).toHaveLength(1);
            expect(result.mismatches[0].type).toBe('payload_mismatch');
        });

        test('should call executeClaude with correct arguments including cwd option', async () => {
            executeClaude.mockImplementation(async (prompt) => {
                writeResultToPromptPath(prompt, '{"success": true, "mismatches": []}');
            });

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
            executeClaude.mockImplementation(async (prompt) => {
                writeResultToPromptPath(prompt, 'not valid json at all');
            });

            const result = await verifyIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(false);
            expect(result.mismatches[0].type).toBe('parse_error');
        });
    });

    describe('buildFixPrompt', () => {
        test('should include backend and frontend paths', () => {
            const prompt = buildFixPrompt('/path/to/backend', '/path/to/frontend', []);
            expect(prompt).toContain('/path/to/backend');
            expect(prompt).toContain('/path/to/frontend');
        });

        test('should include all mismatches in numbered list', () => {
            const mismatches = [
                { type: 'endpoint_mismatch', description: 'Missing GET endpoint', backendFile: 'api.js', frontendFile: 'hooks.ts' },
                { type: 'payload_mismatch', description: 'Wrong HTTP method', backendFile: null, frontendFile: 'service.ts' },
            ];

            const prompt = buildFixPrompt('/backend', '/frontend', mismatches);

            expect(prompt).toContain('1. **endpoint_mismatch**: Missing GET endpoint');
            expect(prompt).toContain('2. **payload_mismatch**: Wrong HTTP method');
            expect(prompt).toContain('Backend file: api.js');
            expect(prompt).toContain('Frontend file: hooks.ts');
            expect(prompt).toContain('Backend file: N/A');
        });

        test('should include decision rules for fixing', () => {
            const prompt = buildFixPrompt('/backend', '/frontend', []);

            expect(prompt).toContain('endpoint_mismatch (missing GET endpoints)');
            expect(prompt).toContain('payload_mismatch (wrong HTTP method)');
            expect(prompt).toContain('endpoint_mismatch (path prefix issues)');
            expect(prompt).toContain('response_mismatch');
        });

        test('should include critical rules', () => {
            const prompt = buildFixPrompt('/backend', '/frontend', []);

            expect(prompt).toContain('**MUST** fix ALL mismatches');
            expect(prompt).toContain('**MUST** read files before modifying');
            expect(prompt).toContain('**PREFER** fixing frontend over backend');
        });
    });

    describe('fixIntegrationMismatches', () => {
        test('should return success when Claude executes without error', async () => {
            executeClaude.mockResolvedValue(undefined);

            const result = await fixIntegrationMismatches({
                backendPath: '/backend',
                frontendPath: '/frontend',
                mismatches: [
                    { type: 'endpoint_mismatch', description: 'Missing endpoint' },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.fixedCount).toBe(1);
        });

        test('should call executeClaude with integration-fix context', async () => {
            executeClaude.mockResolvedValue(undefined);

            await fixIntegrationMismatches({
                backendPath: '/my/backend',
                frontendPath: '/my/frontend',
                mismatches: [{ type: 'payload_mismatch', description: 'Wrong method' }],
            });

            expect(executeClaude).toHaveBeenCalledWith(
                expect.stringContaining('Wrong method'),
                'integration-fix',
                { cwd: '/my/backend' },
            );
        });

        test('should filter out parse_error mismatches', async () => {
            executeClaude.mockResolvedValue(undefined);

            const result = await fixIntegrationMismatches({
                backendPath: '/backend',
                frontendPath: '/frontend',
                mismatches: [
                    { type: 'parse_error', description: 'Failed to parse' },
                    { type: 'endpoint_mismatch', description: 'Missing endpoint' },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.fixedCount).toBe(1);
        });

        test('should return failure when only parse errors exist', async () => {
            const result = await fixIntegrationMismatches({
                backendPath: '/backend',
                frontendPath: '/frontend',
                mismatches: [
                    { type: 'parse_error', description: 'Failed to parse' },
                    { type: 'execution_error', description: 'Claude failed' },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('No fixable mismatches');
            expect(executeClaude).not.toHaveBeenCalled();
        });

        test('should return failure when executeClaude throws', async () => {
            executeClaude.mockRejectedValue(new Error('Claude crashed'));

            const result = await fixIntegrationMismatches({
                backendPath: '/backend',
                frontendPath: '/frontend',
                mismatches: [{ type: 'endpoint_mismatch', description: 'Missing endpoint' }],
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Fix attempt failed');
        });
    });

    describe('verifyAndFixIntegration', () => {
        test('should return success on first check if no mismatches', async () => {
            executeClaude.mockImplementation(async (prompt) => {
                if (prompt.includes('Analyze the integration')) {
                    writeResultToPromptPath(prompt, JSON.stringify({
                        success: true,
                        mismatches: [],
                    }));
                }
            });

            const result = await verifyAndFixIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(true);
            expect(result.iterations).toBe(1);
            expect(result.message).toContain('passed on first check');
        });

        test('should attempt fix and re-verify on failure', async () => {
            let callCount = 0;

            executeClaude.mockImplementation(async (prompt) => {
                if (prompt.includes('Analyze the integration')) {
                    callCount++;
                    if (callCount === 1) {
                        // First verify fails
                        writeResultToPromptPath(prompt, JSON.stringify({
                            success: false,
                            mismatches: [{ type: 'endpoint_mismatch', description: 'Missing endpoint' }],
                        }));
                    } else {
                        // Second verify succeeds (after fix)
                        writeResultToPromptPath(prompt, JSON.stringify({
                            success: true,
                            mismatches: [],
                        }));
                    }
                }
                // Fix prompt succeeds silently
            });

            const result = await verifyAndFixIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
                maxIterations: 3,
            });

            expect(result.success).toBe(true);
            expect(result.iterations).toBe(2);
            expect(result.message).toContain('after 1 fix attempt');
        });

        test('should fail after max iterations exhausted', async () => {
            executeClaude.mockImplementation(async (prompt) => {
                if (prompt.includes('Analyze the integration')) {
                    writeResultToPromptPath(prompt, JSON.stringify({
                        success: false,
                        mismatches: [{ type: 'endpoint_mismatch', description: 'Persistent issue' }],
                    }));
                }
            });

            const result = await verifyAndFixIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
                maxIterations: 2,
            });

            expect(result.success).toBe(false);
            expect(result.iterations).toBe(2);
            expect(result.mismatches).toHaveLength(1);
            expect(result.message).toContain('failed after 2 fix attempts');
        });

        test('should stop immediately if fix returns failure', async () => {
            let verifyCount = 0;

            executeClaude.mockImplementation(async (prompt) => {
                if (prompt.includes('Analyze the integration')) {
                    verifyCount++;
                    writeResultToPromptPath(prompt, JSON.stringify({
                        success: false,
                        mismatches: [{ type: 'parse_error', description: 'Only parse error' }],
                    }));
                }
            });

            const result = await verifyAndFixIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
                maxIterations: 5,
            });

            expect(result.success).toBe(false);
            expect(verifyCount).toBe(1); // Only one verify, no retries
            expect(result.message).toContain('No fixable mismatches');
        });

        test('should default to 3 max iterations', async () => {
            let iterations = 0;

            executeClaude.mockImplementation(async (prompt) => {
                if (prompt.includes('Analyze the integration')) {
                    iterations++;
                    writeResultToPromptPath(prompt, JSON.stringify({
                        success: false,
                        mismatches: [{ type: 'endpoint_mismatch', description: 'Issue' }],
                    }));
                }
            });

            const result = await verifyAndFixIntegration({
                backendPath: '/backend',
                frontendPath: '/frontend',
            });

            expect(result.success).toBe(false);
            expect(iterations).toBe(3); // Default maxIterations
        });
    });
});
