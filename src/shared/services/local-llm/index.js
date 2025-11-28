/**
 * Local LLM Service
 * Main entry point for local LLM co-pilot functionality
 * Provides graceful fallback when Ollama is not available
 */

const fs = require('fs');
const path = require('path');
const OllamaClient = require('./ollama-client');
const LocalLLMCache = require('./cache');
const { templates, TOPIC_CATEGORIES } = require('./prompt-templates');

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

// Fallback implementations (will be loaded lazily)
let fallbacks = null;

class LocalLLMService {
  constructor(options = {}) {
    this.options = options;
    this.client = null;
    this.cache = null;
    this.available = false;
    this.fallbackMode = true;
    this.initialized = false;
    this.initError = null;
  }

  /**
   * Log LocalLLMService activity to log.txt
   * @param {string} action - Action being performed
   * @param {string} details - Details of the action
   * @private
   */
  _logToFile(action, details) {
    try {
      const currentState = getState();
      if (!currentState.claudiomiroFolder) return;

      const logFilePath = path.join(currentState.claudiomiroFolder, 'log.txt');
      const timestamp = new Date().toISOString();

      let logEntry = `\n[${timestamp}] [LocalLLM] ${action}\n`;
      logEntry += `Mode: ${this.fallbackMode ? 'Fallback (no Ollama)' : 'Ollama'}\n`;
      if (details) {
        logEntry += `${details}\n`;
      }

      fs.appendFileSync(logFilePath, logEntry);
    } catch {
      // Silently ignore logging errors
    }
  }

  /**
   * Initialize the service - check Ollama availability
   * @returns {Promise<{available: boolean, fallbackMode: boolean}>}
   */
  async initialize() {
    if (this.initialized) {
      return { available: this.available, fallbackMode: this.fallbackMode };
    }

    this._logToFile('Initialize - Start', 'Checking Ollama availability...');

    // Check if Local LLM is enabled (opt-in, disabled by default)
    // User must set CLAUDIOMIRO_LOCAL_LLM=<model_name> to enable
    const localLLMEnv = process.env.CLAUDIOMIRO_LOCAL_LLM;

    // Disabled if not set, empty, or boolean-like values (no default model)
    if (!localLLMEnv || localLLMEnv === '' || localLLMEnv === 'false' || localLLMEnv === '0' || localLLMEnv === 'true' || localLLMEnv === '1') {
      this.initialized = true;
      this.fallbackMode = true;
      this._logToFile('Initialize - Disabled', 'CLAUDIOMIRO_LOCAL_LLM not set or invalid. Using fallback mode (regex only).');
      return { available: false, fallbackMode: true, reason: 'Local LLM not enabled (set CLAUDIOMIRO_LOCAL_LLM=<model_name> to enable, e.g., qwen2.5-coder:7b)' };
    }

    // Use the model specified in the environment variable
    const modelName = localLLMEnv;
    this._logToFile('Initialize - Model', `Attempting to connect to Ollama with model: ${modelName}`);

    try {
      this.client = new OllamaClient({ ...this.options, model: modelName });
      const health = await this.client.healthCheck();

      if (health.available) {
        this.available = true;
        this.fallbackMode = false;

        // Initialize cache
        this.cache = new LocalLLMCache({
          enabled: this.options.cacheEnabled !== false,
          persistPath: this.options.cachePath || null
        });

        this.initialized = true;
        this._logToFile('Initialize - SUCCESS', `Ollama available! Model: ${modelName}, HasModel: ${health.hasModel}`);
        return {
          available: true,
          fallbackMode: false,
          model: this.client.model,
          hasModel: health.hasModel
        };
      } else {
        throw new Error(health.error || 'Ollama not available');
      }
    } catch (error) {
      this.available = false;
      this.fallbackMode = true;
      this.initError = error.message;
      this.initialized = true;

      this._logToFile('Initialize - FAILED', `Ollama connection failed: ${error.message}. Using fallback mode.`);
      return {
        available: false,
        fallbackMode: true,
        error: error.message
      };
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Load fallback implementations lazily
   * @private
   */
  _loadFallbacks() {
    if (!fallbacks) {
      fallbacks = {
        topicClassifier: require('./fallbacks/topic-classifier'),
        sectionExtractor: require('./fallbacks/section-extractor'),
        completionDetector: require('./fallbacks/completion-detector'),
        dependencyParser: require('./fallbacks/dependency-parser')
      };
    }
    return fallbacks;
  }

  /**
   * Classify content into topics
   * @param {string} content - Content to classify
   * @returns {Promise<string[]>}
   */
  async classifyTopics(content) {
    await this._ensureInitialized();

    if (this.fallbackMode) {
      const { classifyTopics } = this._loadFallbacks().topicClassifier;
      return classifyTopics(content);
    }

    // Check cache
    const cacheKey = `classify:${content.slice(0, 100)}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.classify(content, TOPIC_CATEGORIES);
      this.cache?.set(cacheKey, {}, result);
      return result;
    } catch (error) {
      // Fallback on error
      const { classifyTopics } = this._loadFallbacks().topicClassifier;
      return classifyTopics(content);
    }
  }

  /**
   * Extract a section from markdown
   * @param {string} markdown - Full markdown content
   * @param {string} sectionName - Section to extract
   * @returns {Promise<string>}
   */
  async extractSection(markdown, sectionName) {
    await this._ensureInitialized();

    if (this.fallbackMode) {
      const { extractSection } = this._loadFallbacks().sectionExtractor;
      return extractSection(markdown, sectionName);
    }

    try {
      return await this.client.extractSection(markdown, sectionName);
    } catch (error) {
      const { extractSection } = this._loadFallbacks().sectionExtractor;
      return extractSection(markdown, sectionName);
    }
  }

  /**
   * Summarize content
   * @param {string} content - Content to summarize
   * @param {number} maxTokens - Maximum tokens
   * @returns {Promise<string>}
   */
  async summarize(content, maxTokens = 500) {
    await this._ensureInitialized();

    if (this.fallbackMode) {
      // Simple truncation fallback
      return content.slice(0, maxTokens * 4);
    }

    // Check cache
    const cacheKey = `summarize:${content.slice(0, 50)}:${maxTokens}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.summarize(content, maxTokens);
      this.cache?.set(cacheKey, {}, result);
      return result;
    } catch (error) {
      return content.slice(0, maxTokens * 4);
    }
  }

  /**
   * Check if task is completed
   * @param {string} todoContent - TODO.md content
   * @returns {Promise<{completed: boolean, confidence: number}>}
   */
  async checkCompletion(todoContent) {
    await this._ensureInitialized();

    if (this.fallbackMode) {
      const { isFullyImplemented } = this._loadFallbacks().completionDetector;
      return {
        completed: isFullyImplemented(todoContent),
        confidence: 0.8,
        reason: 'Heuristic check'
      };
    }

    try {
      return await this.client.checkCompletion(todoContent);
    } catch (error) {
      const { isFullyImplemented } = this._loadFallbacks().completionDetector;
      return {
        completed: isFullyImplemented(todoContent),
        confidence: 0.8,
        reason: 'Fallback heuristic'
      };
    }
  }

  /**
   * Analyze task dependencies
   * @param {string} taskContent - Task content
   * @param {string[]} availableTasks - Available task names
   * @returns {Promise<{explicit: string[], implicit: string[]}>}
   */
  async analyzeDependencies(taskContent, availableTasks) {
    await this._ensureInitialized();

    if (this.fallbackMode) {
      const { parseDependencies } = this._loadFallbacks().dependencyParser;
      return {
        explicit: parseDependencies(taskContent),
        implicit: [],
        reasoning: 'Regex extraction'
      };
    }

    try {
      return await this.client.analyzeDependencies(taskContent, availableTasks);
    } catch (error) {
      const { parseDependencies } = this._loadFallbacks().dependencyParser;
      return {
        explicit: parseDependencies(taskContent),
        implicit: [],
        reasoning: 'Fallback regex extraction'
      };
    }
  }

  /**
   * Generate text completion (direct access to LLM)
   * @param {string} prompt - The prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string|null>}
   */
  async generate(prompt, options = {}) {
    await this._ensureInitialized();

    if (this.fallbackMode) {
      return null;
    }

    // Check cache
    const cached = this.cache?.get(prompt, options);
    if (cached) return cached;

    try {
      const result = await this.client.generate(prompt, options);
      this.cache?.set(prompt, options, result);
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Summarize context files for token reduction
   * @param {Array<{path: string, content: string}>} files - Files to summarize
   * @param {string} taskDescription - Task description for relevance
   * @returns {Promise<Array<{path: string, summary: string, relevance: number}>>}
   */
  async summarizeContext(files, taskDescription) {
    await this._ensureInitialized();

    if (!files || files.length === 0) {
      return [];
    }

    if (this.fallbackMode) {
      // Fallback: simple truncation with basic relevance scoring
      return files.map(f => ({
        path: f.path,
        summary: f.content.slice(0, 300) + (f.content.length > 300 ? '...' : ''),
        relevance: this._estimateRelevance(f.path, taskDescription)
      }));
    }

    // Check cache
    const cacheKey = `summarizeCtx:${taskDescription.slice(0, 30)}:${files.length}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.summarizeContext(files, taskDescription);
      this.cache?.set(cacheKey, {}, result);
      return result;
    } catch (error) {
      // Fallback on error
      return files.map(f => ({
        path: f.path,
        summary: f.content.slice(0, 300) + (f.content.length > 300 ? '...' : ''),
        relevance: this._estimateRelevance(f.path, taskDescription)
      }));
    }
  }

  /**
   * Rank files by relevance to a task
   * @param {string[]} filePaths - File paths to rank
   * @param {string} taskDescription - Task description
   * @returns {Promise<Array<{path: string, relevance: number, reason: string}>>}
   */
  async rankFileRelevance(filePaths, taskDescription) {
    await this._ensureInitialized();

    if (!filePaths || filePaths.length === 0) {
      return [];
    }

    if (this.fallbackMode) {
      // Fallback: keyword-based relevance scoring
      return filePaths
        .map(p => ({
          path: p,
          relevance: this._estimateRelevance(p, taskDescription),
          reason: 'Keyword matching'
        }))
        .sort((a, b) => b.relevance - a.relevance);
    }

    // Check cache
    const cacheKey = `rankFiles:${taskDescription.slice(0, 30)}:${filePaths.length}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.rankFileRelevance(filePaths, taskDescription);
      this.cache?.set(cacheKey, {}, result);
      return result;
    } catch (error) {
      return filePaths
        .map(p => ({
          path: p,
          relevance: this._estimateRelevance(p, taskDescription),
          reason: 'Fallback keyword matching'
        }))
        .sort((a, b) => b.relevance - a.relevance);
    }
  }

  /**
   * Validate task decomposition quality
   * @param {Array<{name: string, description: string, dependencies: string[]}>} tasks - Decomposed tasks
   * @returns {Promise<{valid: boolean, issues: string[], suggestions: string[]}>}
   */
  async validateDecomposition(tasks) {
    await this._ensureInitialized();

    if (!tasks || tasks.length === 0) {
      return { valid: true, issues: [], suggestions: [], circularDeps: [] };
    }

    // Always check for circular dependencies (local check)
    const circularDeps = this._detectCircularDeps(tasks);

    if (this.fallbackMode) {
      return {
        valid: circularDeps.length === 0,
        issues: circularDeps.length > 0 ? [`Circular dependencies detected: ${circularDeps.map(c => c.join(' -> ')).join('; ')}`] : [],
        suggestions: [],
        circularDeps
      };
    }

    try {
      const result = await this.client.validateDecomposition(tasks);
      // Merge local circular dep detection with LLM result
      if (circularDeps.length > 0 && !result.circularDeps?.length) {
        result.circularDeps = circularDeps;
        result.valid = false;
        result.issues = result.issues || [];
        result.issues.push(`Circular dependencies: ${circularDeps.map(c => c.join(' -> ')).join('; ')}`);
      }
      return result;
    } catch (error) {
      return {
        valid: circularDeps.length === 0,
        issues: circularDeps.length > 0 ? [`Circular dependencies: ${circularDeps.map(c => c.join(' -> ')).join('; ')}`] : [],
        suggestions: [],
        circularDeps
      };
    }
  }

  /**
   * Pre-screen code for obvious issues before full review
   * @param {string} code - Code to review
   * @param {string} language - Programming language
   * @returns {Promise<{passed: boolean, issues: Array<{type: string, message: string, severity: string}>}>}
   */
  async prescreenCode(code, language = 'javascript') {
    await this._ensureInitialized();

    if (!code) {
      return { passed: true, issues: [], summary: 'No code to review' };
    }

    // Local checks (always run)
    const localIssues = this._localCodeChecks(code);

    if (this.fallbackMode) {
      return {
        passed: localIssues.filter(i => i.severity === 'error').length === 0,
        issues: localIssues,
        summary: localIssues.length > 0 ? `Found ${localIssues.length} potential issues` : 'No obvious issues'
      };
    }

    try {
      const result = await this.client.prescreenCode(code, language);
      // Merge local checks with LLM result
      result.issues = [...localIssues, ...(result.issues || [])];
      result.passed = result.issues.filter(i => i.severity === 'error').length === 0;
      return result;
    } catch (error) {
      return {
        passed: localIssues.filter(i => i.severity === 'error').length === 0,
        issues: localIssues,
        summary: 'LLM unavailable, local checks only'
      };
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
    await this._ensureInitialized();

    if (!proposedFix) {
      return { valid: false, confidence: 0, issues: ['No fix provided'], recommendation: 'reject' };
    }

    if (this.fallbackMode) {
      // Basic validation - check for obvious issues
      const issues = [];
      if (proposedFix.includes('undefined') || proposedFix.includes('null')) {
        issues.push('Fix contains undefined/null values');
      }
      if (proposedFix.trim().length < 5) {
        issues.push('Fix seems too short');
      }
      return {
        valid: issues.length === 0,
        confidence: 0.6,
        issues,
        recommendation: issues.length === 0 ? 'apply' : 'review'
      };
    }

    try {
      return await this.client.validateFix(command, error, proposedFix);
    } catch (err) {
      return { valid: true, confidence: 0.5, issues: [], recommendation: 'apply' };
    }
  }

  /**
   * Pre-screen git diff for critical bugs before full Claude review
   * @param {string} diff - Git diff content
   * @returns {Promise<{issues: Array, summary: string, hasCritical: boolean}>}
   */
  async prescreenDiff(diff) {
    this._logToFile('prescreenDiff - Start', `Diff length: ${diff?.length || 0} chars`);
    await this._ensureInitialized();

    if (!diff || diff.trim().length === 0) {
      this._logToFile('prescreenDiff - Empty', 'No changes to analyze');
      return { issues: [], summary: 'No changes to analyze', hasCritical: false };
    }

    // Local regex checks (always run, even in fallback mode)
    const localIssues = this._localDiffChecks(diff);
    this._logToFile('prescreenDiff - LocalChecks', `Found ${localIssues.length} local issues`);

    if (this.fallbackMode) {
      const result = {
        issues: localIssues,
        summary: localIssues.length > 0
          ? `Local scan found ${localIssues.length} potential issue(s)`
          : 'No obvious issues detected (local scan only)',
        hasCritical: localIssues.some(i => i.severity === 'critical')
      };
      this._logToFile('prescreenDiff - Fallback Result', `Issues: ${result.issues.length}, HasCritical: ${result.hasCritical}`);
      return result;
    }

    // Check cache
    const cacheKey = `prescreenDiff:${diff.slice(0, 100)}:${diff.length}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) {
      this._logToFile('prescreenDiff - Cache Hit', 'Returning cached result');
      return cached;
    }

    try {
      this._logToFile('prescreenDiff - Calling Ollama', 'Sending diff to Ollama for analysis...');
      const result = await this.client.prescreenDiff(diff);
      // Merge local checks with LLM result
      const mergedIssues = [...localIssues];

      if (result.issues && Array.isArray(result.issues)) {
        for (const issue of result.issues) {
          // Avoid duplicates
          const isDuplicate = mergedIssues.some(
            i => i.file === issue.file && i.type === issue.type
          );
          if (!isDuplicate) {
            mergedIssues.push(issue);
          }
        }
      }

      const finalResult = {
        issues: mergedIssues,
        summary: (result.summary && !result.summary.toLowerCase().includes('failed'))
          ? result.summary
          : `Found ${mergedIssues.length} potential issue(s)`,
        hasCritical: mergedIssues.some(i => i.severity === 'critical')
      };

      this._logToFile('prescreenDiff - Ollama Result', `Issues: ${finalResult.issues.length}, HasCritical: ${finalResult.hasCritical}, Summary: ${finalResult.summary}`);
      this.cache?.set(cacheKey, {}, finalResult);
      return finalResult;
    } catch (error) {
      this._logToFile('prescreenDiff - ERROR', `Ollama failed: ${error.message}. Falling back to local checks.`);
      // Fallback to local checks only
      return {
        issues: localIssues,
        summary: 'LLM unavailable, local checks only',
        hasCritical: localIssues.some(i => i.severity === 'critical')
      };
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
    await this._ensureInitialized();

    if (!output || output.trim().length === 0) {
      return {
        errors: [],
        summary: exitCode === 0 ? 'Command passed' : 'Command failed with no output',
        canAutoFix: false
      };
    }

    // Local regex-based error extraction (always run)
    const localErrors = this._extractErrorsFromOutput(output);

    if (this.fallbackMode) {
      return {
        errors: localErrors,
        summary: localErrors.length > 0
          ? `Extracted ${localErrors.length} error(s) from output`
          : exitCode !== 0 ? 'Command failed but no specific errors extracted' : 'Command passed',
        canAutoFix: localErrors.some(e => e.fixHint)
      };
    }

    // Check cache
    const cacheKey = `validator:${command}:${output.slice(0, 50)}:${exitCode}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.analyzeValidatorOutput(command, output, exitCode);
      // Merge with local extraction
      const mergedErrors = [...localErrors];

      if (result.errors && Array.isArray(result.errors)) {
        for (const error of result.errors) {
          const isDuplicate = mergedErrors.some(
            e => e.file === error.file && e.line === error.line
          );
          if (!isDuplicate) {
            mergedErrors.push(error);
          }
        }
      }

      const finalResult = {
        errors: mergedErrors,
        summary: result.summary || `Found ${mergedErrors.length} error(s)`,
        canAutoFix: result.canAutoFix || mergedErrors.some(e => e.fixHint)
      };

      this.cache?.set(cacheKey, {}, finalResult);
      return finalResult;
    } catch (error) {
      return {
        errors: localErrors,
        summary: 'LLM unavailable, regex extraction only',
        canAutoFix: localErrors.some(e => e.fixHint)
      };
    }
  }

  /**
   * Generate a commit message from changes
   * @param {string} diff - Git diff or change summary
   * @param {string} taskDescription - Task description
   * @returns {Promise<{title: string, body: string}>}
   */
  async generateCommitMessage(diff, taskDescription) {
    await this._ensureInitialized();

    if (!diff) {
      return { title: 'Update code', body: '- Various changes' };
    }

    if (this.fallbackMode) {
      // Simple fallback based on diff analysis
      const lines = diff.split('\n');
      const addedFiles = lines.filter(l => l.startsWith('+')).length;
      const removedFiles = lines.filter(l => l.startsWith('-')).length;

      let title = 'Update code';
      if (taskDescription) {
        // Extract first meaningful words from task
        const words = taskDescription.split(/\s+/).slice(0, 5).join(' ');
        title = words.length > 50 ? words.slice(0, 47) + '...' : words;
      }

      return {
        title,
        body: `- ${addedFiles} additions, ${removedFiles} deletions`
      };
    }

    // Check cache
    const cacheKey = `commitMsg:${diff.slice(0, 50)}:${taskDescription?.slice(0, 30)}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.generateCommitMessage(diff, taskDescription);
      this.cache?.set(cacheKey, {}, result);
      return result;
    } catch (error) {
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
    await this._ensureInitialized();

    const defaultPR = {
      title: 'Update implementation',
      body: '## Summary\nVarious improvements and updates.\n\n## Changes\n- Code updates\n\n## Test Plan\n- [ ] Manual testing'
    };

    if (!summary && !changedFiles && !commitMessages) {
      return defaultPR;
    }

    if (this.fallbackMode) {
      // Generate a basic PR description from available info
      let title = 'Update implementation';
      if (commitMessages) {
        // Use first commit message as title
        const firstCommit = commitMessages.split('\n')[0];
        if (firstCommit && firstCommit.length > 5) {
          title = firstCommit.slice(0, 72);
        }
      }

      const body = [
        '## Summary',
        summary ? summary.slice(0, 500) : 'Various improvements and updates.',
        '',
        '## Changes',
        changedFiles ? changedFiles.split('\n').map(f => `- ${f}`).join('\n') : '- Code updates',
        '',
        '## Test Plan',
        '- [ ] Manual testing'
      ].join('\n');

      return { title, body };
    }

    // Check cache
    const cacheKey = `prDesc:${summary?.slice(0, 30)}:${changedFiles?.slice(0, 30)}`;
    const cached = this.cache?.get(cacheKey, {});
    if (cached) return cached;

    try {
      const result = await this.client.generatePRDescription(summary, changedFiles, commitMessages);
      this.cache?.set(cacheKey, {}, result);
      return result;
    } catch (error) {
      return defaultPR;
    }
  }

  /**
   * Estimate relevance based on keywords (fallback)
   * @private
   */
  _estimateRelevance(filePath, taskDescription) {
    if (!taskDescription) return 0.5;

    const keywords = taskDescription.toLowerCase().split(/\s+/);
    const pathLower = filePath.toLowerCase();

    let matches = 0;
    for (const keyword of keywords) {
      if (keyword.length > 3 && pathLower.includes(keyword)) {
        matches++;
      }
    }

    // Higher score for test files if task mentions testing
    if (taskDescription.toLowerCase().includes('test') && pathLower.includes('test')) {
      matches += 2;
    }

    return Math.min(1, 0.3 + (matches * 0.15));
  }

  /**
   * Detect circular dependencies (local check)
   * @private
   */
  _detectCircularDeps(tasks) {
    const cycles = [];
    const taskMap = new Map(tasks.map(t => [t.name, t.dependencies || []]));
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (taskName, path = []) => {
      if (recursionStack.has(taskName)) {
        const cycleStart = path.indexOf(taskName);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), taskName]);
        }
        return;
      }

      if (visited.has(taskName)) return;

      visited.add(taskName);
      recursionStack.add(taskName);
      path.push(taskName);

      const deps = taskMap.get(taskName) || [];
      for (const dep of deps) {
        if (taskMap.has(dep)) {
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(taskName);
    };

    for (const task of tasks) {
      if (!visited.has(task.name)) {
        dfs(task.name);
      }
    }

    return cycles;
  }

  /**
   * Local code checks (regex-based)
   * @private
   */
  _localCodeChecks(code) {
    const issues = [];

    // Check for console.log
    if (/console\.(log|debug|info)\s*\(/.test(code)) {
      issues.push({ type: 'debug', message: 'Console statements found', severity: 'warning' });
    }

    // Check for TODO/FIXME
    if (/\/\/\s*(TODO|FIXME|XXX|HACK)/i.test(code)) {
      issues.push({ type: 'todo', message: 'TODO/FIXME comments found', severity: 'info' });
    }

    // Check for hardcoded secrets patterns
    if (/(api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]+['"]/i.test(code)) {
      issues.push({ type: 'security', message: 'Possible hardcoded secret', severity: 'error' });
    }

    // Check for debugger statements
    if (/\bdebugger\b/.test(code)) {
      issues.push({ type: 'debug', message: 'Debugger statement found', severity: 'error' });
    }

    return issues;
  }

  /**
   * Local git diff checks for critical bugs (regex-based)
   * @private
   */
  _localDiffChecks(diff) {
    const issues = [];
    const lines = diff.split('\n');
    let currentFile = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track current file
      if (line.startsWith('+++ b/')) {
        currentFile = line.slice(6);
        continue;
      }

      // Only check added lines
      if (!line.startsWith('+') || line.startsWith('+++')) {
        continue;
      }

      const content = line.slice(1); // Remove the '+' prefix

      // Check for hardcoded secrets
      if (/(api[_-]?key|password|secret|token|credential)\s*[:=]\s*['"][^'"]{8,}['"]/i.test(content)) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'security',
          severity: 'critical',
          description: 'Possible hardcoded secret or API key'
        });
      }

      // Check for SQL injection patterns
      if (/(\$\{|\+\s*req\.|`.*\$\{.*\}.*SELECT|`.*\$\{.*\}.*INSERT|`.*\$\{.*\}.*UPDATE|`.*\$\{.*\}.*DELETE)/i.test(content) &&
          /(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i.test(content)) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'security',
          severity: 'critical',
          description: 'Possible SQL injection - user input in query string'
        });
      }

      // Check for empty catch blocks
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'logic',
          severity: 'critical',
          description: 'Empty catch block - errors are silently swallowed'
        });
      }

      // Check for TODO/FIXME in new code (incomplete implementation)
      if (/\/\/\s*(TODO|FIXME|XXX):\s*implement/i.test(content)) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'incomplete',
          severity: 'critical',
          description: 'Incomplete implementation - TODO marker found'
        });
      }

      // Check for placeholder function bodies
      if (/\{\s*(\/\/\s*\.\.\.|\.\.\.|pass|throw new Error\(['"]not implemented['"]\))\s*\}/.test(content)) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'incomplete',
          severity: 'critical',
          description: 'Placeholder function body detected'
        });
      }

      // Check for debugger statements
      if (/\bdebugger\b/.test(content)) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'debug',
          severity: 'critical',
          description: 'Debugger statement in production code'
        });
      }

      // Check for console.log in non-test files
      if (/console\.(log|debug)\s*\(/.test(content) && !currentFile.includes('.test.')) {
        issues.push({
          file: currentFile,
          line: i,
          type: 'debug',
          severity: 'warning',
          description: 'Console statement in production code'
        });
      }
    }

    return issues;
  }

  /**
   * Extract errors from validator/test output (regex-based)
   * @private
   */
  _extractErrorsFromOutput(output) {
    const errors = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Jest/Mocha test failure pattern
      const jestMatch = line.match(/FAIL\s+(.+\.(?:js|ts|jsx|tsx))/);
      if (jestMatch) {
        errors.push({
          file: jestMatch[1],
          line: 0,
          message: 'Test file failed',
          fixHint: 'Check test assertions and implementation'
        });
      }

      // ESLint/TSLint error pattern: file:line:col: message
      const lintMatch = line.match(/^(.+\.(?:js|ts|jsx|tsx)):(\d+):(\d+):\s*(.+)/);
      if (lintMatch) {
        errors.push({
          file: lintMatch[1],
          line: parseInt(lintMatch[2], 10),
          message: lintMatch[4],
          fixHint: null
        });
      }

      // TypeScript error pattern: file(line,col): error TS...
      const tsMatch = line.match(/^(.+\.(?:ts|tsx))\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
      if (tsMatch) {
        errors.push({
          file: tsMatch[1],
          line: parseInt(tsMatch[2], 10),
          message: `${tsMatch[4]}: ${tsMatch[5]}`,
          fixHint: null
        });
      }

      // Python error pattern: File "path", line N
      const pyMatch = line.match(/File "(.+\.py)", line (\d+)/);
      if (pyMatch) {
        // Get the error message from next line
        const errorMsg = lines[i + 1] || 'Unknown error';
        errors.push({
          file: pyMatch[1],
          line: parseInt(pyMatch[2], 10),
          message: errorMsg.trim(),
          fixHint: null
        });
      }

      // Go error pattern: file.go:line:col: message
      const goMatch = line.match(/^(.+\.go):(\d+):(\d+):\s*(.+)/);
      if (goMatch) {
        errors.push({
          file: goMatch[1],
          line: parseInt(goMatch[2], 10),
          message: goMatch[4],
          fixHint: null
        });
      }

      // Generic "Error:" pattern
      const genericMatch = line.match(/^Error:\s*(.+)/i);
      if (genericMatch && errors.length === 0) {
        errors.push({
          file: 'unknown',
          line: 0,
          message: genericMatch[1],
          fixHint: null
        });
      }
    }

    return errors;
  }

  /**
   * Get service status
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.initialized,
      available: this.available,
      fallbackMode: this.fallbackMode,
      error: this.initError,
      model: this.client?.model || null,
      cacheStats: this.cache?.getStats() || null
    };
  }

  /**
   * Check if LLM features are available (not in fallback mode)
   * @returns {boolean}
   */
  isAvailable() {
    return this.available && !this.fallbackMode;
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton LocalLLMService instance
 * @param {Object} options - Service options
 * @returns {LocalLLMService}
 */
function getLocalLLMService(options = {}) {
  if (!instance) {
    instance = new LocalLLMService(options);
  }
  return instance;
}

/**
 * Reset the singleton (mainly for testing)
 */
function resetLocalLLMService() {
  instance = null;
}

module.exports = {
  LocalLLMService,
  getLocalLLMService,
  resetLocalLLMService
};
