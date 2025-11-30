const fs = require('fs');
const os = require('os');
const path = require('path');
const { executeClaude } = require('../executors/claude-executor');
const state = require('../config/state');

const escapeForDoubleQuotes = (value) => value.replace(/(["\\$`])/g, '\\$1');

/**
 * Builds a prompt for Claude to analyze backend and frontend codebases
 * for integration issues
 * @param {string} backendPath - Path to the backend codebase
 * @param {string} frontendPath - Path to the frontend codebase
 * @param {string} [outputPath] - Optional file path where Claude must write the JSON result
 * @returns {string} The prompt for Claude
 */
const buildVerificationPrompt = (backendPath, frontendPath, outputPath) => {
    const basePrompt = `Analyze the integration between these two codebases and identify any mismatches:

BACKEND CODEBASE: ${backendPath}
FRONTEND CODEBASE: ${frontendPath}

Your task:
1. Analyze the backend codebase to identify all API endpoints, their request/response formats, and data contracts
2. Analyze the frontend codebase to identify all API calls, expected payloads, and response handling
3. Compare them to find any mismatches or integration issues

Look for:
- Endpoint URL mismatches (frontend calling endpoints that don't exist in backend)
- Request payload mismatches (frontend sending different data structure than backend expects)
- Response format mismatches (frontend expecting different response structure than backend provides)
- Missing endpoints (endpoints defined in backend but not used, or frontend calling undefined endpoints)
- HTTP method mismatches (frontend using GET where backend expects POST, etc.)
- Authentication/authorization requirements not handled in frontend

IMPORTANT: Respond with ONLY a JSON object in this exact format:
{
  "success": boolean,
  "mismatches": [
    {
      "type": "endpoint_mismatch" | "payload_mismatch" | "response_mismatch" | "missing_endpoint",
      "description": "Detailed description of the issue",
      "backendFile": "path/to/backend/file.ext" | null,
      "frontendFile": "path/to/frontend/file.ext" | null
    }
  ],
  "summary": "Brief summary of the analysis"
}

If no issues are found, return:
{
  "success": true,
  "mismatches": [],
  "summary": "No integration issues found"
}

Do not include any explanation or text outside the JSON object.`;

    if (!outputPath) {
        return basePrompt;
    }

    const quotedPath = `"${escapeForDoubleQuotes(outputPath)}"`;

    return `${basePrompt}

After generating the JSON response, follow these mandatory steps:

OUTPUT_FILE: ${outputPath}
OUTPUT_FILE_QUOTED: ${quotedPath}

1. Run: mkdir -p "$(dirname ${quotedPath})"
2. Write ONLY the JSON object to the output file using:
   cat <<'EOF' > ${quotedPath}
   {paste the JSON object here}
   EOF
3. Do not add commentary before or after the JSON content.
4. Overwrite any previous contents of the file.
5. Confirm completion only after the file has been written successfully.`;
};

/**
 * Extracts the first balanced JSON object from a string
 * This handles cases where Claude wraps JSON in explanation text
 * @param {string} text - Text containing JSON
 * @returns {string|null} The extracted JSON string or null
 */
const extractBalancedJson = (text) => {
    const startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\' && inString) {
            escape = true;
            continue;
        }

        if (char === '"' && !escape) {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') depth++;
            if (char === '}') {
                depth--;
                if (depth === 0) {
                    return text.substring(startIndex, i + 1);
                }
            }
        }
    }

    return null;
};

/**
 * Parses Claude's response to extract the verification result
 * @param {string} claudeOutput - Raw output from Claude
 * @returns {Object} Parsed verification result
 */
const parseVerificationResult = (claudeOutput) => {
    // Handle empty or null input
    if (!claudeOutput || typeof claudeOutput !== 'string' || claudeOutput.trim() === '') {
        return {
            success: false,
            mismatches: [{
                type: 'parse_error',
                description: 'Empty or invalid response received from Claude',
                backendFile: null,
                frontendFile: null,
            }],
        };
    }

    try {
        // Extract the first balanced JSON object from the response
        const jsonString = extractBalancedJson(claudeOutput);
        if (!jsonString) {
            return {
                success: false,
                mismatches: [{
                    type: 'parse_error',
                    description: 'No JSON object found in Claude response',
                    backendFile: null,
                    frontendFile: null,
                }],
            };
        }

        const parsed = JSON.parse(jsonString);

        // Validate required fields
        if (typeof parsed.success !== 'boolean' || !Array.isArray(parsed.mismatches)) {
            return {
                success: false,
                mismatches: [{
                    type: 'parse_error',
                    description: 'Invalid JSON structure: missing required fields (success, mismatches)',
                    backendFile: null,
                    frontendFile: null,
                }],
            };
        }

        return {
            success: parsed.success,
            mismatches: parsed.mismatches,
            summary: parsed.summary || undefined,
        };
    } catch (error) {
        return {
            success: false,
            mismatches: [{
                type: 'parse_error',
                description: `Failed to parse JSON: ${error.message}`,
                backendFile: null,
                frontendFile: null,
            }],
        };
    }
};

/**
 * Verifies integration between backend and frontend codebases using Claude
 * @param {Object} options - Verification options
 * @param {string} options.backendPath - Path to the backend codebase
 * @param {string} options.frontendPath - Path to the frontend codebase
 * @returns {Promise<Object>} Verification result with success flag and any mismatches
 */
const verifyIntegration = async ({ backendPath, frontendPath }) => {
    try {
        const baseDir = state.workspaceClaudiomiroFolder
            || state.claudiomiroFolder
            || path.join(os.tmpdir(), 'claudiomiro', 'integration');
        const outputDir = path.join(baseDir, 'integration-verification');
        fs.mkdirSync(outputDir, { recursive: true });
        const outputPath = path.join(outputDir, `result-${Date.now()}.json`);

        const prompt = buildVerificationPrompt(backendPath, frontendPath, outputPath);

        await executeClaude(prompt, 'integration-verify', { cwd: backendPath });

        let fileContent;
        try {
            fileContent = fs.readFileSync(outputPath, 'utf-8');
        } catch (readError) {
            return {
                success: false,
                mismatches: [{
                    type: 'parse_error',
                    description: `Integration result file not found or unreadable: ${readError.message}`,
                    backendFile: null,
                    frontendFile: null,
                }],
            };
        } finally {
            try {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } catch {
                // Ignore cleanup errors
            }
        }

        return parseVerificationResult(fileContent);
    } catch (error) {
        return {
            success: false,
            mismatches: [{
                type: 'execution_error',
                description: `Claude execution failed: ${error.message}`,
                backendFile: null,
                frontendFile: null,
            }],
        };
    }
};

module.exports = {
    verifyIntegration,
    buildVerificationPrompt,
    parseVerificationResult,
    extractBalancedJson,
};
