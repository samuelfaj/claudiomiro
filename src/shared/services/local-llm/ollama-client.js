/**
 * Ollama HTTP Client
 * Handles communication with local Ollama server for LLM inference
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Lazy load state to avoid circular dependencies
let state = null;
const getState = () => {
    if (!state) {
        try {
            state = require('../../config/state');
        } catch {
            state = { claudiomiroFolder: null };
        }
    }
    return state;
};

class OllamaClient {
    constructor(options = {}) {
        this.host = options.host || process.env.OLLAMA_HOST || 'localhost';
        this.port = parseInt(options.port || process.env.OLLAMA_PORT) || 11434;
        this.model = options.model || null; // No default - must be specified
        this.timeout = parseInt(options.timeout || process.env.OLLAMA_TIMEOUT) || 300000; // 5 minutes default
    }

    /**
   * Log Ollama activity to log.txt
   * @param {string} action - Action being performed
   * @param {string} details - Details of the action
   * @param {string} [response] - Response received (optional)
   * @private
   */
    _logToFile(action, details, response = null) {
        try {
            const currentState = getState();
            if (!currentState.claudiomiroFolder) return;

            const logFilePath = path.join(currentState.claudiomiroFolder, 'log.txt');
            const timestamp = new Date().toISOString();

            let logEntry = `\n[${timestamp}] [Ollama] ${action}\n`;
            logEntry += '-'.repeat(60) + '\n';
            logEntry += `Model: ${this.model}\n`;
            logEntry += `Host: ${this.host}:${this.port}\n`;

            if (details) {
                // Truncate long prompts for readability
                const truncatedDetails = details.length > 2000
                    ? details.slice(0, 2000) + '\n... [truncated, ' + details.length + ' chars total]'
                    : details;
                logEntry += `Details:\n${truncatedDetails}\n`;
            }

            if (response !== null) {
                const truncatedResponse = typeof response === 'string' && response.length > 1000
                    ? response.slice(0, 1000) + '\n... [truncated, ' + response.length + ' chars total]'
                    : typeof response === 'object'
                        ? JSON.stringify(response, null, 2).slice(0, 1000)
                        : String(response);
                logEntry += `Response:\n${truncatedResponse}\n`;
            }

            logEntry += '-'.repeat(60) + '\n';

            fs.appendFileSync(logFilePath, logEntry);
        } catch {
            // Silently ignore logging errors
        }
    }

    /**
   * Check if Ollama server is available and model is loaded
   * @returns {Promise<{available: boolean, models: string[]}>}
   */
    async healthCheck() {
        this._logToFile('Health Check', 'Checking Ollama server availability...');
        try {
            const response = await this._request('GET', '/api/tags');
            const models = (response.models || []).map(m => m.name);
            const hasModel = models.some(m => m.startsWith(this.model.split(':')[0]));

            const result = {
                available: true,
                models,
                hasModel,
                selectedModel: this.model,
            };
            this._logToFile('Health Check - SUCCESS', `Available models: ${models.join(', ')}`, result);
            return result;
        } catch (error) {
            const result = {
                available: false,
                models: [],
                hasModel: false,
                error: error.message,
            };
            this._logToFile('Health Check - FAILED', `Error: ${error.message}`, result);
            return result;
        }
    }

    /**
   * Generate text completion from prompt
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Generation options
   * @returns {Promise<string>}
   */
    async generate(prompt, options = {}) {
        this._logToFile('Generate', `Prompt:\n${prompt}`, null);
        const response = await this._request('POST', '/api/generate', {
            model: this.model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.1,
                num_predict: options.maxTokens || 256,
                top_p: options.topP ?? 0.9,
                stop: options.stop || [],
            },
        });

        const result = response.response || '';
        this._logToFile('Generate - Response', `Options: ${JSON.stringify(options)}`, result);
        return result;
    }

    /**
   * Generate with structured JSON output
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Generation options
   * @returns {Promise<Object>}
   */
    async generateJSON(prompt, options = {}) {
        this._logToFile('GenerateJSON - Start', prompt, null);
        const fullPrompt = `${prompt}\n\nRespond with valid JSON only, no additional text.`;

        const response = await this.generate(fullPrompt, {
            ...options,
            temperature: options.temperature ?? 0.05, // Lower temp for JSON
        });

        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                this._logToFile('GenerateJSON - SUCCESS', 'Parsed JSON successfully', parsed);
                return parsed;
            } catch (e) {
                this._logToFile('GenerateJSON - FAILED', `Invalid JSON: ${e.message}`, response);
                throw new Error(`Invalid JSON response: ${response}`);
            }
        }

        this._logToFile('GenerateJSON - FAILED', 'No JSON found in response', response);
        throw new Error(`No JSON found in response: ${response}`);
    }

    /**
   * Classify content into predefined topics
   * @param {string} content - Content to classify
   * @param {string[]} topics - Available topic categories
   * @returns {Promise<string[]>}
   */
    async classify(content, topics) {
        const prompt = `Classify this content into relevant topics.

Available topics: ${topics.join(', ')}

Content:
${content.slice(0, 1500)}

Return a JSON array of matching topics (max 5). Example: ["topic1", "topic2"]`;

        try {
            const result = await this.generateJSON(prompt, { maxTokens: 100 });
            if (Array.isArray(result)) {
                return result.filter(t => topics.includes(t));
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
   * Summarize content
   * @param {string} content - Content to summarize
   * @param {number} maxTokens - Maximum tokens in summary
   * @returns {Promise<string>}
   */
    async summarize(content, maxTokens = 500) {
        const prompt = `Summarize this content concisely. Focus on:
- Key functionality and purpose
- Important dependencies and relationships
- Critical implementation details

Content:
${content}

Summary (${maxTokens} tokens max):`;

        return this.generate(prompt, { maxTokens });
    }

    /**
   * Extract a specific section from markdown
   * @param {string} markdown - Full markdown content
   * @param {string} sectionName - Name of section to extract
   * @returns {Promise<string>}
   */
    async extractSection(markdown, sectionName) {
        const prompt = `Extract the "${sectionName}" section from this markdown.
Return ONLY the section content without the header.
If the section is not found, return "NOT_FOUND".

Markdown:
${markdown.slice(0, 3000)}

Section content:`;

        const result = await this.generate(prompt, { maxTokens: 1000 });
        return result.trim() === 'NOT_FOUND' ? '' : result;
    }

    /**
   * Analyze task dependencies
   * @param {string} taskContent - Task description
   * @param {string[]} availableTasks - List of available task names
   * @returns {Promise<{explicit: string[], implicit: string[], reasoning: string}>}
   */
    async analyzeDependencies(taskContent, availableTasks) {
        const prompt = `Analyze this task and identify its dependencies.

Task:
${taskContent.slice(0, 2000)}

Available tasks: ${availableTasks.join(', ')}

Rules:
1. Look for explicit @dependencies declarations
2. Infer implicit dependencies (shared files, API contracts, data flow)
3. A task depends on another if it needs output/changes from that task

Return JSON: {"explicit": ["TASK1"], "implicit": ["TASK2"], "reasoning": "brief explanation"}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 300 });
        } catch {
            return { explicit: [], implicit: [], reasoning: 'Failed to analyze' };
        }
    }

    /**
   * Check if a task is fully completed
   * @param {string} todoContent - TODO.md content
   * @returns {Promise<{completed: boolean, confidence: number, reason: string}>}
   */
    async checkCompletion(todoContent) {
        const prompt = `Analyze this TODO.md and determine if the task is FULLY implemented.

Check for:
1. "Fully implemented: YES" or similar declaration
2. All checklist items marked as done
3. No pending work mentioned

TODO.md:
${todoContent.slice(0, 2000)}

Return JSON: {"completed": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 150 });
        } catch {
            return { completed: false, confidence: 0, reason: 'Failed to analyze' };
        }
    }

    /**
   * Summarize multiple context files for token reduction
   * @param {Array<{path: string, content: string}>} files - Files to summarize
   * @param {string} taskDescription - Task description for relevance
   * @returns {Promise<Array<{path: string, summary: string, relevance: number}>>}
   */
    async summarizeContext(files, taskDescription) {
        const prompt = `You are a code context summarizer. Summarize each file focusing on what's relevant to the task.

Task: ${taskDescription.slice(0, 500)}

Files to summarize:
${files.map((f, i) => `
--- FILE ${i + 1}: ${f.path} ---
${f.content.slice(0, 2000)}
`).join('\n')}

For each file, provide:
1. A concise summary (2-3 sentences)
2. Relevance score (0.0-1.0) to the task

Return JSON array: [{"path": "file.js", "summary": "...", "relevance": 0.8}, ...]`;

        try {
            const result = await this.generateJSON(prompt, { maxTokens: 1000 });
            if (Array.isArray(result)) {
                return result;
            }
            return files.map(f => ({ path: f.path, summary: f.content.slice(0, 200), relevance: 0.5 }));
        } catch {
            return files.map(f => ({ path: f.path, summary: f.content.slice(0, 200), relevance: 0.5 }));
        }
    }

    /**
   * Rank files by relevance to a task
   * @param {string[]} filePaths - File paths to rank
   * @param {string} taskDescription - Task description
   * @returns {Promise<Array<{path: string, relevance: number, reason: string}>>}
   */
    async rankFileRelevance(filePaths, taskDescription) {
        const prompt = `Rank these files by relevance to the task.

Task: ${taskDescription.slice(0, 500)}

Files:
${filePaths.slice(0, 50).map((p, i) => `${i + 1}. ${p}`).join('\n')}

For each file, estimate relevance (0.0-1.0) based on:
- File name and path patterns
- Likely content based on naming conventions
- Relationship to task keywords

Return JSON array: [{"path": "file.js", "relevance": 0.8, "reason": "brief reason"}, ...]
Order by relevance descending. Only include files with relevance > 0.3`;

        try {
            const result = await this.generateJSON(prompt, { maxTokens: 800 });
            if (Array.isArray(result)) {
                return result.sort((a, b) => b.relevance - a.relevance);
            }
            return filePaths.map(p => ({ path: p, relevance: 0.5, reason: 'Default' }));
        } catch {
            return filePaths.map(p => ({ path: p, relevance: 0.5, reason: 'Default' }));
        }
    }

    /**
   * Validate task decomposition quality
   * @param {Array<{name: string, description: string, dependencies: string[]}>} tasks - Decomposed tasks
   * @returns {Promise<{valid: boolean, issues: string[], suggestions: string[]}>}
   */
    async validateDecomposition(tasks) {
        const prompt = `Validate this task decomposition for quality issues.

Tasks:
${tasks.map(t => `
- ${t.name}: ${t.description.slice(0, 200)}
  Dependencies: ${t.dependencies.join(', ') || 'none'}
`).join('\n')}

Check for:
1. Circular dependencies
2. Tasks too large (should be split further)
3. Tasks too small (could be merged)
4. Missing dependencies
5. Unclear task descriptions

Return JSON: {
  "valid": true/false,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"],
  "circularDeps": [["TASK1", "TASK2"]]
}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 500 });
        } catch {
            return { valid: true, issues: [], suggestions: [], circularDeps: [] };
        }
    }

    /**
   * Pre-screen code for obvious issues before full review
   * @param {string} code - Code to review
   * @param {string} language - Programming language
   * @returns {Promise<{passed: boolean, issues: Array<{type: string, message: string, severity: string}>}>}
   */
    async prescreenCode(code, language = 'javascript') {
        const prompt = `Pre-screen this ${language} code for obvious issues.

Code:
\`\`\`${language}
${code.slice(0, 3000)}
\`\`\`

Check for:
1. Syntax errors
2. Missing error handling
3. Hardcoded secrets/credentials
4. Console.log/debug statements left in
5. TODO/FIXME comments
6. Unused imports/variables
7. Missing type annotations (if applicable)

Return JSON: {
  "passed": true/false,
  "issues": [{"type": "syntax|security|debug|todo|unused", "message": "...", "severity": "error|warning|info"}],
  "summary": "Overall assessment in one sentence"
}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 500 });
        } catch {
            return { passed: true, issues: [], summary: 'Pre-screening unavailable' };
        }
    }

    /**
   * Validate a proposed fix before applying
   * @param {string} command - The command that failed
   * @param {string} error - The error message
   * @param {string} proposedFix - The proposed fix
   * @returns {Promise<{valid: boolean, confidence: number, issues: string[]}>}
   */
    async validateFix(command, error, proposedFix) {
        const prompt = `Validate if this proposed fix is likely to work.

Original command: ${command}
Error: ${error.slice(0, 500)}
Proposed fix: ${proposedFix.slice(0, 1000)}

Check for:
1. Does the fix address the actual error?
2. Are there obvious syntax issues?
3. Are all required arguments present?
4. Is the fix safe to execute?

Return JSON: {
  "valid": true/false,
  "confidence": 0.0-1.0,
  "issues": ["issue1", "issue2"],
  "recommendation": "apply|review|reject"
}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 300 });
        } catch {
            return { valid: true, confidence: 0.5, issues: [], recommendation: 'apply' };
        }
    }

    /**
   * Pre-screen git diff for critical bugs
   * @param {string} diff - Git diff content
   * @returns {Promise<{issues: Array, summary: string, hasCritical: boolean}>}
   */
    async prescreenDiff(diff) {
        this._logToFile('PrescreenDiff - Start', `Git diff length: ${diff.length} chars`, null);

        const prompt = `You are a code security analyzer. Scan this git diff for CRITICAL bugs only.

CRITICAL bugs to detect (HIGH PRIORITY):
1. Hardcoded secrets, API keys, passwords (any string that looks like a credential)
2. SQL injection (user input directly in SQL queries without parameterization)
3. Empty catch blocks (errors silently swallowed)
4. Missing null/undefined checks before property access
5. Missing await on async function calls
6. Incomplete implementations (TODO: implement, placeholder code, throw "not implemented")
7. XSS vulnerabilities (unescaped user input in HTML)

NOT critical (IGNORE these):
- Code style, formatting issues
- Missing comments or documentation
- Console.log statements (only warning, not critical)
- Performance optimizations
- Minor refactoring suggestions

Git diff:
${diff.slice(0, 6000)}

Analyze each added line (+) carefully. For security issues, be very sensitive.

Return JSON with this EXACT structure:
{
  "issues": [
    {"file": "path/to/file.js", "line": 42, "type": "security", "severity": "critical", "description": "Hardcoded API key found"}
  ],
  "summary": "Found X critical issues...",
  "hasCritical": true
}

If no critical issues found, return: {"issues": [], "summary": "No critical issues detected", "hasCritical": false}`;

        try {
            const result = await this.generateJSON(prompt, { maxTokens: 800 });
            this._logToFile('PrescreenDiff - SUCCESS', `Found ${result.issues?.length || 0} issues`, result);
            return result;
        } catch (error) {
            this._logToFile('PrescreenDiff - FAILED', `Error: ${error.message}`, null);
            return { issues: [], summary: 'Pre-screening failed', hasCritical: false };
        }
    }

    /**
   * Analyze validator/test output to extract actionable errors
   * @param {string} command - Command that was run
   * @param {string} output - Command output
   * @param {number} exitCode - Exit code
   * @returns {Promise<{errors: Array, summary: string, canAutoFix: boolean}>}
   */
    async analyzeValidatorOutput(command, output, exitCode) {
        const prompt = `Analyze this test/linter output and extract actionable error information.

Command: ${command}
Exit code: ${exitCode}

Output:
${output.slice(0, 3000)}

Extract structured error information:
1. File paths where errors occurred
2. Line numbers (if available)
3. Error messages
4. Suggested fixes (if obvious from the error message)

Return JSON:
{
  "errors": [
    {"file": "src/file.js", "line": 42, "message": "TypeError: Cannot read property 'x' of undefined", "fixHint": "Add null check before accessing property"}
  ],
  "summary": "Found X errors in Y files",
  "canAutoFix": false
}

If exitCode is 0 and no errors, return: {"errors": [], "summary": "All checks passed", "canAutoFix": false}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 600 });
        } catch {
            return { errors: [], summary: 'Analysis failed', canAutoFix: false };
        }
    }

    /**
   * Generate a commit message from changes
   * @param {string} diff - Git diff or change summary
   * @param {string} taskDescription - Task description
   * @returns {Promise<{title: string, body: string}>}
   */
    async generateCommitMessage(diff, taskDescription) {
        const prompt = `Generate a concise git commit message for these changes.

Task: ${taskDescription.slice(0, 300)}

Changes:
${diff.slice(0, 2000)}

Rules:
1. Title: max 72 chars, imperative mood (e.g., "Add feature" not "Added feature")
2. Body: bullet points of key changes
3. Be specific but concise

Return JSON: {
  "title": "feat: short description",
  "body": "- Change 1\\n- Change 2"
}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 300 });
        } catch {
            return { title: 'Update code', body: '- Various changes' };
        }
    }

    /**
   * Generate a PR description from changes
   * @param {string} summary - Summary of changes (from CODE_REVIEW.md or similar)
   * @param {string} changedFiles - List of changed files
   * @param {string} commitMessages - Recent commit messages
   * @returns {Promise<{title: string, body: string}>}
   */
    async generatePRDescription(summary, changedFiles, commitMessages) {
        const prompt = `Generate a professional Pull Request description.

Summary of changes:
${summary.slice(0, 1500)}

Files changed:
${changedFiles.slice(0, 500)}

Recent commits:
${commitMessages.slice(0, 500)}

Rules:
1. Title: max 72 chars, clear and descriptive
2. Body: include Summary section (2-3 sentences), Changes section (bullet points), Test Plan (checklist)
3. Be professional, NO AI mentions, NO "Generated by" text
4. Focus on WHAT changed and WHY

Return JSON: {
  "title": "Add feature X to improve Y",
  "body": "## Summary\\nBrief description of changes.\\n\\n## Changes\\n- Change 1\\n- Change 2\\n\\n## Test Plan\\n- [ ] Test case 1\\n- [ ] Test case 2"
}`;

        try {
            return await this.generateJSON(prompt, { maxTokens: 600 });
        } catch {
            return {
                title: 'Update implementation',
                body: '## Summary\nVarious improvements and updates.\n\n## Changes\n- Code updates\n\n## Test Plan\n- [ ] Manual testing',
            };
        }
    }

    /**
   * Internal HTTP request handler
   * @private
   */
    _request(method, path, body) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.host,
                port: this.port,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout: this.timeout,
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Connection failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
}

module.exports = OllamaClient;
