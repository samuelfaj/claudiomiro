/**
 * Optimized Prompt Templates for Local LLM
 * These prompts are designed for smaller models (7B parameters)
 * with focus on clarity, structure, and concise outputs
 */

const TOPIC_CATEGORIES = [
  'authentication',
  'api',
  'database',
  'testing',
  'config',
  'middleware',
  'service',
  'controller',
  'component',
  'validation',
  'error',
  'logging',
  'cache',
  'queue',
  'file',
  'security',
  'ui',
  'state'
];

const templates = {
  /**
   * Topic classification prompt
   */
  classifyTopics: (content, topics = TOPIC_CATEGORIES) => `Task: Classify content into topics.
Topics: ${topics.join(', ')}

Content:
${content.slice(0, 1500)}

Output JSON array of matching topics (max 5):`,

  /**
   * Section extraction prompt
   */
  extractSection: (markdown, sectionName) => `Task: Extract section "${sectionName}" from markdown.
Rules:
- Return ONLY section content (no header)
- If not found, return: NOT_FOUND

Markdown:
${markdown.slice(0, 3000)}

Section content:`,

  /**
   * Context summarization prompt
   */
  summarizeContext: (content, maxTokens = 500) => `Task: Summarize this content in ${maxTokens} tokens.
Focus on:
- Main purpose/functionality
- Key dependencies
- Important patterns

Content:
${content}

Summary:`,

  /**
   * Dependency analysis prompt
   */
  analyzeDependencies: (taskContent, availableTasks) => `Task: Identify task dependencies.

Task description:
${taskContent.slice(0, 2000)}

Available tasks: ${availableTasks.join(', ')}

Rules:
1. Find explicit @dependencies declarations
2. Infer implicit dependencies (shared files, data flow)
3. Task A depends on B if A needs B's output

Output JSON:
{"explicit": [], "implicit": [], "reasoning": ""}`,

  /**
   * Completion check prompt
   */
  checkCompletion: (todoContent) => `Task: Check if task is fully completed.

Look for:
1. "Fully implemented: YES" statement
2. All checkboxes marked [x]
3. No "TODO" or "PENDING" items

TODO.md content:
${todoContent.slice(0, 2000)}

Output JSON:
{"completed": true/false, "confidence": 0.0-1.0, "reason": ""}`,

  /**
   * Research similarity prompt
   */
  compareResearch: (research1, research2) => `Task: Compare two research documents for similarity.

Research 1:
${research1.slice(0, 1000)}

Research 2:
${research2.slice(0, 1000)}

Output JSON:
{"similarity": 0.0-1.0, "sharedTopics": [], "canReuse": true/false}`,

  /**
   * Code pattern extraction prompt
   */
  extractPatterns: (code) => `Task: Extract coding patterns from this code.

Code:
${code.slice(0, 2000)}

List patterns found (naming, structure, error handling):`,

  /**
   * Intent classification prompt
   */
  classifyIntent: (userRequest) => `Task: Classify user intent.
Categories: feature, bugfix, refactor, docs, test, config, other

Request:
${userRequest.slice(0, 500)}

Output JSON:
{"intent": "category", "confidence": 0.0-1.0, "entities": []}`,

  /**
   * File relevance scoring prompt
   */
  scoreFileRelevance: (taskDescription, filePath, fileContent) => `Task: Score file relevance to task.

Task: ${taskDescription.slice(0, 300)}
File: ${filePath}
Content preview:
${fileContent.slice(0, 500)}

Output JSON:
{"relevance": 0.0-1.0, "reason": ""}`,

  /**
   * Git diff pre-screening prompt for critical bug detection
   */
  prescreenDiff: (diff) => `Task: Pre-screen git diff for CRITICAL bugs only.

CRITICAL bugs (report these):
- Missing null/undefined checks (crashes)
- SQL injection (user input in queries)
- Hardcoded secrets/API keys
- Missing await on async calls
- Empty catch blocks (swallowed errors)
- Incomplete function bodies (TODO, placeholder)
- XSS vulnerabilities (unescaped HTML)

NOT critical (ignore):
- Code style, formatting
- Missing comments
- Performance optimizations
- Minor refactoring suggestions

Git diff:
${diff.slice(0, 8000)}

Output JSON:
{"issues": [{"file": "path", "line": 0, "type": "security|logic|incomplete", "severity": "critical|warning", "description": "..."}], "summary": "...", "hasCritical": true/false}`,

  /**
   * Validator output analysis prompt
   */
  analyzeValidatorOutput: (command, output, exitCode) => `Task: Analyze test/linter output for actionable errors.

Command: ${command}
Exit code: ${exitCode}

Output:
${output.slice(0, 4000)}

Extract:
1. File paths with errors
2. Line numbers
3. Error messages
4. Suggested fixes if obvious

Output JSON:
{"errors": [{"file": "path", "line": 0, "message": "...", "fixHint": "..."}], "summary": "...", "canAutoFix": true/false}`,

  /**
   * Commit message generation prompt
   */
  generateCommitMessage: (diff, taskDescription) => `Task: Generate a concise git commit message.

Rules:
- Use conventional commits format (feat:, fix:, refactor:, etc.)
- Title: max 72 characters, imperative mood
- Body: 2-3 bullet points explaining changes

Task context:
${taskDescription.slice(0, 300)}

Changed files:
${diff.slice(0, 1500)}

Output JSON:
{"title": "type: short description", "body": "- bullet point 1\\n- bullet point 2"}`,

  /**
   * PR description generation prompt
   */
  generatePRDescription: (summary, changedFiles, commitMessages) => `Task: Generate a Pull Request description.

Rules:
- Write a clear summary (2-3 sentences)
- List key changes as bullet points
- Include test plan checklist
- Be professional, no AI mentions

Summary of changes:
${summary.slice(0, 1500)}

Files changed:
${changedFiles.slice(0, 500)}

Recent commits:
${commitMessages.slice(0, 500)}

Output JSON:
{"title": "PR title (max 72 chars)", "body": "## Summary\\n...\\n\\n## Changes\\n- ...\\n\\n## Test Plan\\n- [ ] ..."}`
};

/**
 * Get prompt template by name
 * @param {string} name - Template name
 * @returns {Function|null}
 */
function getTemplate(name) {
  return templates[name] || null;
}

/**
 * Get all available template names
 * @returns {string[]}
 */
function getTemplateNames() {
  return Object.keys(templates);
}

module.exports = {
  templates,
  getTemplate,
  getTemplateNames,
  TOPIC_CATEGORIES
};
