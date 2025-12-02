const fs = require('fs');
const path = require('path');
const {
    loadCache,
    saveCache: _saveCache,
    addCompletedTask,
    getLastProcessedTask,
    getAllCompletedTasks: _getAllCompletedTasks,
    getCachedAiPromptSummary,
    updateAiPromptCache,
    hasAiPromptChanged,
    storeCodebasePatterns,
    getCodebasePatterns,
} = require('./cache-manager');

// Code index for smart symbol discovery (lazy loaded)
let codeIndexModule = null;
const getCodeIndex = () => {
    if (!codeIndexModule) {
        try {
            codeIndexModule = require('../code-index');
        } catch (error) {
            // Code index not available
            codeIndexModule = null;
        }
    }
    return codeIndexModule;
};

// Local LLM service for enhanced summarization (lazy loaded)
let localLLMService = null;
const getLocalLLM = () => {
    if (!localLLMService) {
        try {
            const { getLocalLLMService } = require('../local-llm');
            localLLMService = getLocalLLMService();
        } catch (error) {
            localLLMService = null;
        }
    }
    return localLLMService;
};

/**
 * Context Collector - Collects context incrementally to reduce token consumption
 * Instead of reading all files every time, tracks what has been processed
 */

/**
 * Extracts task number from task ID for ordering
 * @param {string} taskId - Task identifier (e.g., 'TASK1', 'TASK2.1')
 * @returns {number} Numeric order value
 */
const getTaskOrder = (taskId) => {
    const match = taskId.match(/TASK(\d+)/);
    if (!match) return 0;
    const mainNum = parseInt(match[1], 10);
    const subMatch = taskId.match(/\.(\d+)/);
    const subNum = subMatch ? parseInt(subMatch[1], 10) / 100 : 0;
    return mainNum + subNum;
};

/**
 * Gets list of task folders from claudiomiro directory
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @returns {string[]} Array of task folder names
 */
const getTaskFolders = (claudiomiroFolder) => {
    if (!fs.existsSync(claudiomiroFolder)) {
        return [];
    }

    return fs.readdirSync(claudiomiroFolder)
        .filter(f => {
            const fullPath = path.join(claudiomiroFolder, f);
            return f.startsWith('TASK') && fs.statSync(fullPath).isDirectory();
        })
        .sort((a, b) => getTaskOrder(a) - getTaskOrder(b));
};

/**
 * Checks if a task is completed based on execution.json
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} taskId - Task identifier
 * @returns {boolean} True if completed
 */
const isTaskCompleted = (claudiomiroFolder, taskId) => {
    const executionPath = path.join(claudiomiroFolder, taskId, 'execution.json');
    if (!fs.existsSync(executionPath)) {
        return false;
    }
    try {
        const content = fs.readFileSync(executionPath, 'utf8');
        const execution = JSON.parse(content);
        return execution.status === 'completed' || execution.completion?.status === 'completed';
    } catch {
        return false;
    }
};

/**
 * Checks if task folder has required files (BLUEPRINT.md + execution.json)
 * @param {string} taskFolder - Full path to task folder
 * @returns {boolean} True if task has valid structure
 */
const hasValidTaskStructure = (taskFolder) => {
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
    const executionPath = path.join(taskFolder, 'execution.json');
    return fs.existsSync(blueprintPath) && fs.existsSync(executionPath);
};

/**
 * Extracts summary from execution.json completion section (internal helper)
 * @param {string} executionPath - Path to execution.json
 * @returns {object|null} Summary object or null if missing/malformed
 */
const extractContextSummaryFromExecutionJson = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(executionPath, 'utf8');
        const execution = JSON.parse(content);

        if (execution.completion && Array.isArray(execution.completion.summary)) {
            return {
                summary: execution.completion.summary.join('\n'),
                fullPath: executionPath,
            };
        }
        // completion.summary exists but empty
        return { summary: '', fullPath: executionPath };
    } catch {
        // JSON parse error - return null
        return null;
    }
};

/**
 * Extracts summary from a task folder using execution.json
 * @param {string} taskFolder - Full path to task folder
 * @returns {object|null} Summary object or null
 */
const extractContextSummary = (taskFolder) => {
    const executionPath = path.join(taskFolder, 'execution.json');
    return extractContextSummaryFromExecutionJson(executionPath);
};

/**
 * @deprecated CONTEXT.md is no longer used. Use execution.json instead.
 * Extracts summary from CONTEXT.md content (sync, heuristic version)
 * Kept for backward compatibility with legacy code.
 * @param {string} content - CONTEXT.md content
 * @param {string} contextPath - Path for reference
 * @returns {object} Summary object
 */
const extractContextSummaryFromContent = (content, contextPath = '') => {
    console.warn('[DEPRECATED] extractContextSummaryFromContent is deprecated. CONTEXT.md is no longer used. Use execution.json instead.');

    // Extract key sections with regex
    const filesModifiedMatch = content.match(/## Files Modified\s*\n([\s\S]*?)(?=\n##|$)/);
    const decisionsMatch = content.match(/## (?:Key )?Decisions?\s*\n([\s\S]*?)(?=\n##|$)/);

    return {
        filesModified: filesModifiedMatch ? filesModifiedMatch[1].trim().slice(0, 500) : '',
        decisions: decisionsMatch ? decisionsMatch[1].trim().slice(0, 500) : '',
        fullPath: contextPath,
    };
};

/**
 * Extracts summary from a task folder using execution.json
 * execution.json data is already structured, no LLM needed
 * @param {string} taskFolder - Full path to task folder
 * @param {string} _taskDescription - Unused (kept for API compatibility)
 * @returns {Promise<object|null>} Summary object or null
 */
const extractContextSummaryAsync = async (taskFolder, _taskDescription = null) => {
    const executionPath = path.join(taskFolder, 'execution.json');
    return extractContextSummaryFromExecutionJson(executionPath);
};

/**
 * @deprecated RESEARCH.md is no longer used. Use execution.json instead.
 * Kept for backward compatibility with legacy code.
 */
const extractResearchPatterns = (_researchPath) => {
    console.warn('[DEPRECATED] extractResearchPatterns is deprecated. RESEARCH.md is no longer used. Use execution.json instead.');
    return null;
};

/**
 * @deprecated RESEARCH.md is no longer used. Use execution.json instead.
 * Kept for backward compatibility with legacy code.
 */
const extractResearchPatternsFromContent = (_content, _researchPath = '') => {
    console.warn('[DEPRECATED] extractResearchPatternsFromContent is deprecated. RESEARCH.md is no longer used. Use execution.json instead.');
    return null;
};

/**
 * @deprecated RESEARCH.md is no longer used. Use execution.json instead.
 * Kept for backward compatibility with legacy code.
 */
const extractResearchPatternsAsync = async (_researchPath) => {
    console.warn('[DEPRECATED] extractResearchPatternsAsync is deprecated. RESEARCH.md is no longer used. Use execution.json instead.');
    return null;
};

/**
 * Creates a condensed summary of AI_PROMPT.md
 * @param {string} aiPromptPath - Path to AI_PROMPT.md
 * @returns {string} Condensed summary (~500 tokens)
 */
const createAiPromptSummary = (aiPromptPath) => {
    if (!fs.existsSync(aiPromptPath)) {
        return '';
    }

    const content = fs.readFileSync(aiPromptPath, 'utf8');
    return createAiPromptSummaryFromContent(content);
};

/**
 * Creates a condensed summary from AI_PROMPT content (sync, heuristic version)
 * @param {string} content - AI_PROMPT.md content
 * @returns {string} Condensed summary (~500 tokens)
 */
const createAiPromptSummaryFromContent = (content) => {
    // Extract key sections with limits
    const sections = [];

    // Tech stack section
    const techMatch = content.match(/##\s*(?:Tech Stack|Technology|Stack)\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (techMatch) {
        sections.push(`**Tech Stack:**\n${techMatch[1].trim().slice(0, 400)}`);
    }

    // Architecture section
    const archMatch = content.match(/##\s*(?:Architecture|Structure)\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (archMatch) {
        sections.push(`**Architecture:**\n${archMatch[1].trim().slice(0, 400)}`);
    }

    // Conventions section
    const convMatch = content.match(/##\s*(?:Conventions?|Patterns?|Guidelines?)\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (convMatch) {
        sections.push(`**Conventions:**\n${convMatch[1].trim().slice(0, 300)}`);
    }

    // If no sections found, take first 1000 chars
    if (sections.length === 0) {
        return content.slice(0, 1500);
    }

    return sections.join('\n\n');
};

/**
 * Creates a condensed summary of AI_PROMPT.md using Local LLM when available
 * @param {string} aiPromptPath - Path to AI_PROMPT.md
 * @returns {Promise<string>} Condensed summary (~500 tokens)
 */
const createAiPromptSummaryAsync = async (aiPromptPath) => {
    if (!fs.existsSync(aiPromptPath)) {
        return '';
    }

    const content = fs.readFileSync(aiPromptPath, 'utf8');

    // Try Local LLM for better summarization
    const llm = getLocalLLM();
    if (llm) {
        try {
            await llm.initialize();
            if (llm.isAvailable()) {
                const summary = await llm.summarize(content, 500);
                if (summary && summary.length > 100) {
                    return summary;
                }
            }
        } catch (error) {
            // Fall through to heuristic
        }
    }

    // Fallback to heuristic extraction
    return createAiPromptSummaryFromContent(content);
};

/**
 * Extracts codebase patterns from AI_PROMPT.md content
 * @param {string} content - AI_PROMPT.md content
 * @returns {object} Extracted patterns
 */
const extractCodebasePatterns = (content) => {
    const patterns = {};

    // Detect testing framework
    const testFrameworkPatterns = [
        { name: 'jest', regex: /\bjest\b/i },
        { name: 'mocha', regex: /\bmocha\b/i },
        { name: 'vitest', regex: /\bvitest\b/i },
        { name: 'pytest', regex: /\bpytest\b/i },
        { name: 'go test', regex: /\bgo\s+test\b/i },
        { name: 'junit', regex: /\bjunit\b/i },
        { name: 'rspec', regex: /\brspec\b/i },
    ];

    for (const { name, regex } of testFrameworkPatterns) {
        if (regex.test(content)) {
            patterns.testingFramework = name;
            break;
        }
    }

    // Detect import style
    if (/\brequire\s*\(/.test(content)) {
        patterns.importStyle = 'commonjs';
    } else if (/\bimport\s+.*\s+from\s+['"]/.test(content)) {
        patterns.importStyle = 'esm';
    }

    // Detect naming convention from examples
    if (/[\w-]+\.test\.(js|ts|jsx|tsx)/.test(content)) {
        patterns.testFileNaming = 'file.test.ext';
    } else if (/__tests__/.test(content)) {
        patterns.testFileNaming = '__tests__/file.ext';
    }

    // Detect language
    const languagePatterns = [
        { name: 'javascript', regex: /\.(js|jsx)\b/i },
        { name: 'typescript', regex: /\.(ts|tsx)\b/i },
        { name: 'python', regex: /\.py\b/i },
        { name: 'go', regex: /\.go\b/i },
        { name: 'java', regex: /\.java\b/i },
        { name: 'ruby', regex: /\.rb\b/i },
    ];

    for (const { name, regex } of languagePatterns) {
        if (regex.test(content)) {
            patterns.primaryLanguage = name;
            break;
        }
    }

    // Detect code style from conventions section
    if (/class\s+\w+/.test(content)) {
        patterns.codeStyle = 'class-based';
    } else if (/function\s+\w+|const\s+\w+\s*=\s*\(/.test(content)) {
        patterns.codeStyle = 'functional';
    }

    // Extract key directories mentioned
    const dirMatch = content.match(/src\/[\w-/]+/g);
    if (dirMatch) {
        patterns.keyDirectories = [...new Set(dirMatch)].slice(0, 10);
    }

    return patterns;
};

/**
 * Gets incremental context for a task (only new context since last run)
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} currentTask - Current task being processed
 * @param {object} options - Options for context collection
 * @returns {object} Context object with summaries
 */
const getIncrementalContext = (claudiomiroFolder, currentTask, options = {}) => {
    const cache = loadCache(claudiomiroFolder);
    const lastProcessed = options.lastProcessedTask || getLastProcessedTask(claudiomiroFolder);

    const context = {
        aiPromptSummary: null,
        codebasePatterns: null,
        newTasks: {},
        allCompletedSummary: '',
        contextFiles: [],
    };

    // Get AI_PROMPT summary (cached or generate new)
    const aiPromptPath = path.join(claudiomiroFolder, 'AI_PROMPT.md');
    if (hasAiPromptChanged(claudiomiroFolder, cache)) {
        const content = fs.existsSync(aiPromptPath) ? fs.readFileSync(aiPromptPath, 'utf8') : '';
        const summary = createAiPromptSummary(aiPromptPath);
        updateAiPromptCache(claudiomiroFolder, cache, summary);
        context.aiPromptSummary = summary;

        // Extract and store codebase patterns
        if (content) {
            const patterns = extractCodebasePatterns(content);
            storeCodebasePatterns(claudiomiroFolder, patterns);
            context.codebasePatterns = patterns;
        }
    } else {
        context.aiPromptSummary = getCachedAiPromptSummary(claudiomiroFolder);
        context.codebasePatterns = getCodebasePatterns(claudiomiroFolder);
    }

    // Get task folders
    const taskFolders = getTaskFolders(claudiomiroFolder);
    const lastProcessedOrder = lastProcessed ? getTaskOrder(lastProcessed) : -1;
    const currentTaskOrder = getTaskOrder(currentTask);

    // Collect context from completed tasks
    for (const taskId of taskFolders) {
        if (taskId === currentTask) continue;

        const taskOrder = getTaskOrder(taskId);

        // Skip tasks after current task
        if (taskOrder >= currentTaskOrder) continue;

        if (!isTaskCompleted(claudiomiroFolder, taskId)) continue;

        const taskFolder = path.join(claudiomiroFolder, taskId);

        // Determine if this is a "new" task (processed after lastProcessed)
        const isNewTask = taskOrder > lastProcessedOrder;

        if (isNewTask) {
            // Full summary for new tasks - extractContextSummary uses execution.json
            context.newTasks[taskId] = {
                context: extractContextSummary(taskFolder),
            };
        }

        // Add BLUEPRINT.md to context files list
        const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');
        if (fs.existsSync(blueprintPath)) {
            context.contextFiles.push(blueprintPath);
        }
    }

    return context;
};

/**
 * Builds a consolidated context string for prompt inclusion
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} currentTask - Current task being processed
 * @returns {string} Consolidated context string
 */
const buildConsolidatedContext = (claudiomiroFolder, currentTask) => {
    const context = getIncrementalContext(claudiomiroFolder, currentTask);
    const parts = [];

    // AI_PROMPT summary
    if (context.aiPromptSummary) {
        parts.push('## Environment Summary (from AI_PROMPT.md)\n' + context.aiPromptSummary);
    }

    // Codebase patterns (quick reference)
    if (context.codebasePatterns && Object.keys(context.codebasePatterns).length > 0) {
        const patternLines = ['## Detected Codebase Patterns'];
        const p = context.codebasePatterns;
        if (p.primaryLanguage) patternLines.push(`- **Language:** ${p.primaryLanguage}`);
        if (p.testingFramework) patternLines.push(`- **Test Framework:** ${p.testingFramework}`);
        if (p.importStyle) patternLines.push(`- **Import Style:** ${p.importStyle}`);
        if (p.testFileNaming) patternLines.push(`- **Test Naming:** ${p.testFileNaming}`);
        if (p.codeStyle) patternLines.push(`- **Code Style:** ${p.codeStyle}`);
        if (p.keyDirectories && p.keyDirectories.length > 0) {
            patternLines.push(`- **Key Dirs:** ${p.keyDirectories.slice(0, 5).join(', ')}`);
        }
        parts.push(patternLines.join('\n'));
    }

    // New tasks since last run
    if (Object.keys(context.newTasks).length > 0) {
        parts.push('\n## Recently Completed Tasks');
        for (const [taskId, taskData] of Object.entries(context.newTasks)) {
            let taskSection = `\n### ${taskId}`;
            if (taskData.context && taskData.context.summary) {
                taskSection += `\n**Summary:**\n${taskData.context.summary}`;
            }
            parts.push(taskSection);
        }
    }

    // Reference to full context files (if needed)
    if (context.contextFiles.length > 0) {
        parts.push('\n## Full Context Files (read if more detail needed)');
        parts.push(context.contextFiles.map(f => `- ${f}`).join('\n'));
    }

    return parts.join('\n\n');
};

/**
 * Builds consolidated context with code index symbols (async version)
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} currentTask - Current task being processed
 * @param {string} projectFolder - Project root folder for code indexing
 * @param {string} taskDescription - Task description for relevant symbol search
 * @returns {Promise<string>} Consolidated context string with code symbols
 */
const buildConsolidatedContextAsync = async (claudiomiroFolder, currentTask, projectFolder = null, taskDescription = null) => {
    // Get base context
    let contextString = buildConsolidatedContext(claudiomiroFolder, currentTask);

    // Add code index symbols if available
    if (projectFolder && taskDescription) {
        const symbolContext = await getRelevantSymbols(projectFolder, taskDescription, {
            maxSymbols: 15,
        });

        if (symbolContext && symbolContext.formatted) {
            const symbolSection = [
                '\n## Relevant Code Symbols (from index)',
                `**Codebase:** ${symbolContext.overview.totalFiles} files, ${symbolContext.overview.totalSymbols} symbols`,
                '',
                symbolContext.formatted,
            ].join('\n');

            contextString += '\n\n' + symbolSection;
        }
    }

    return contextString;
};

/**
 * Marks a task as completed and updates cache
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} taskId - Task identifier
 */
const markTaskCompleted = (claudiomiroFolder, taskId) => {
    const taskFolder = path.join(claudiomiroFolder, taskId);

    const taskSummary = {
        context: extractContextSummary(taskFolder),
        completedAt: new Date().toISOString(),
    };

    addCompletedTask(claudiomiroFolder, taskId, taskSummary);
};

/**
 * Gets relevant symbols from code index for a task
 * Uses semantic search with Ollama when available, falls back to keyword matching
 * @param {string} projectFolder - Project root folder
 * @param {string} taskDescription - Task description or keywords
 * @param {object} options - Options for symbol retrieval
 * @returns {Promise<object|null>} Symbol context or null if not available
 */
const getRelevantSymbols = async (projectFolder, taskDescription, options = {}) => {
    const { maxSymbols = 15, kinds = null, useSemantic = true } = options;

    const codeIndex = getCodeIndex();
    if (!codeIndex) {
        return null;
    }

    try {
        const { CodeIndex } = codeIndex;
        const index = new CodeIndex();

        // Try to load from cache first, build if needed
        const loaded = index.loadFromCache(projectFolder);
        if (!loaded) {
            await index.build(projectFolder, { incremental: true });
        }

        let symbols = [];
        let searchMethod = 'keyword';

        // Try semantic search first (uses Ollama if available)
        if (useSemantic) {
            try {
                symbols = await index.semanticSearch(taskDescription, {
                    maxResults: maxSymbols,
                    kinds,
                });
                if (symbols.length > 0) {
                    searchMethod = await index.isLLMAvailable() ? 'semantic-llm' : 'semantic-fallback';
                }
            } catch {
                // Fall through to keyword search
            }
        }

        // Fallback to keyword-based search
        if (symbols.length === 0) {
            symbols = index.findRelevantSymbols(taskDescription, {
                maxResults: maxSymbols,
                kinds,
            });
            searchMethod = 'keyword';
        }

        if (symbols.length === 0) {
            return null;
        }

        // Format symbols for context
        const formatted = index.formatForPrompt(symbols);
        const overview = index.getOverview();

        return {
            symbols: index.toHandles(symbols),
            formatted,
            overview: {
                totalFiles: overview.totalFiles,
                totalSymbols: overview.totalSymbols,
                byKind: overview.byKind,
            },
            searchMethod,
        };
    } catch (error) {
    // Index not available or failed
        return null;
    }
};

/**
 * Gets file summary from code index
 * @param {string} projectFolder - Project root folder
 * @param {string} filePath - Relative file path
 * @returns {Promise<object|null>} File summary or null
 */
const getFileSummary = async (projectFolder, filePath) => {
    const codeIndex = getCodeIndex();
    if (!codeIndex) {
        return null;
    }

    try {
        const { CodeIndex } = codeIndex;
        const index = new CodeIndex();

        const loaded = index.loadFromCache(projectFolder);
        if (!loaded) {
            return null;
        }

        return index.getFileSummary(filePath);
    } catch (error) {
        return null;
    }
};

/**
 * Gets context file paths without reading content (for reference only)
 * Returns BLUEPRINT.md + execution.json for valid task structures
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} currentTask - Current task
 * @param {object} options - Filter options
 * @returns {string[]} Array of context file paths
 */
const getContextFilePaths = (claudiomiroFolder, currentTask, options = {}) => {
    const {
        onlyCompleted = true,
    } = options;

    const paths = [];
    const taskFolders = getTaskFolders(claudiomiroFolder);

    for (const taskId of taskFolders) {
        if (taskId === currentTask) continue;

        const taskPath = path.join(claudiomiroFolder, taskId);

        // Check completion if required
        if (onlyCompleted && !isTaskCompleted(claudiomiroFolder, taskId)) {
            continue;
        }

        // Only return paths for valid task structures (BLUEPRINT.md + execution.json)
        const blueprintPath = path.join(taskPath, 'BLUEPRINT.md');
        const executionPath = path.join(taskPath, 'execution.json');

        if (fs.existsSync(blueprintPath)) {
            paths.push(blueprintPath);
        }
        if (fs.existsSync(executionPath)) {
            paths.push(executionPath);
        }
    }

    return paths;
};

/**
 * Builds optimized context using Local LLM for summarization and relevance ranking
 * This can reduce token consumption by 40-60% compared to full context
 * @param {string} claudiomiroFolder - Path to .claudiomiro folder
 * @param {string} currentTask - Current task being processed
 * @param {string} projectFolder - Project root folder
 * @param {string} taskDescription - Task description for relevance scoring
 * @param {object} options - Optimization options
 * @returns {Promise<{context: string, tokenSavings: number, filesIncluded: number}>}
 */
const buildOptimizedContextAsync = async (claudiomiroFolder, currentTask, projectFolder, taskDescription, options = {}) => {
    const {
        maxFiles = 10,
        minRelevance = 0.3,
        summarize = true,
        maxSummaryTokens: _maxSummaryTokens = 300,
    } = options;

    const llm = getLocalLLM();
    const _startTokenEstimate = 0;
    let optimizedContext = '';
    let filesIncluded = 0;

    // Get base context (always include)
    const baseContext = buildConsolidatedContext(claudiomiroFolder, currentTask);
    optimizedContext = baseContext;

    // Get all context file paths
    const contextPaths = getContextFilePaths(claudiomiroFolder, currentTask, {
        includeResearch: true,
        includeContext: true,
        includeTodo: false,
        onlyCompleted: true,
    });

    if (contextPaths.length === 0) {
        return {
            context: optimizedContext,
            tokenSavings: 0,
            filesIncluded: 0,
            method: 'base-only',
        };
    }

    // Estimate original token count
    let originalTokens = 0;
    const fileContents = [];
    for (const filePath of contextPaths) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            originalTokens += Math.ceil(content.length / 4); // Rough token estimate
            fileContents.push({ path: filePath, content });
        } catch (e) {
            // Skip unreadable files
        }
    }

    // Try to use Local LLM for optimization
    if (llm && taskDescription) {
        try {
            await llm.initialize();

            if (llm.isAvailable()) {
                // Step 1: Rank files by relevance
                const rankedFiles = await llm.rankFileRelevance(
                    contextPaths,
                    taskDescription,
                );

                // Filter by relevance threshold
                const relevantFiles = rankedFiles
                    .filter(f => f.relevance >= minRelevance)
                    .slice(0, maxFiles);

                if (relevantFiles.length > 0) {
                    // Step 2: Summarize relevant files
                    const filesToSummarize = [];
                    for (const rankedFile of relevantFiles) {
                        const fileData = fileContents.find(f => f.path === rankedFile.path);
                        if (fileData) {
                            filesToSummarize.push(fileData);
                        }
                    }

                    if (summarize && filesToSummarize.length > 0) {
                        const summaries = await llm.summarizeContext(filesToSummarize, taskDescription);

                        // Build optimized context section
                        const optimizedSection = [
                            '\n## Relevant Context (Optimized)',
                            `*${summaries.length} files selected from ${contextPaths.length} based on relevance*\n`,
                        ];

                        for (const summary of summaries) {
                            if (summary.relevance >= minRelevance) {
                                optimizedSection.push(`### ${path.basename(summary.path)} (relevance: ${(summary.relevance * 100).toFixed(0)}%)`);
                                optimizedSection.push(summary.summary);
                                optimizedSection.push('');
                                filesIncluded++;
                            }
                        }

                        optimizedContext += '\n' + optimizedSection.join('\n');

                        // Calculate token savings
                        const optimizedTokens = Math.ceil(optimizedContext.length / 4);
                        const tokenSavings = Math.max(0, originalTokens - optimizedTokens);

                        return {
                            context: optimizedContext,
                            tokenSavings,
                            filesIncluded,
                            method: 'llm-optimized',
                            relevanceScores: relevantFiles.map(f => ({ path: f.path, relevance: f.relevance })),
                        };
                    }
                }
            }
        } catch (error) {
            // Fall through to fallback method
        }
    }

    // Fallback: Include all files without optimization
    // Still use code index if available
    if (projectFolder && taskDescription) {
        const symbolContext = await getRelevantSymbols(projectFolder, taskDescription, {
            maxSymbols: 15,
        });

        if (symbolContext && symbolContext.formatted) {
            optimizedContext += '\n\n## Relevant Code Symbols\n' + symbolContext.formatted;
        }
    }

    // Add truncated file references as fallback
    const fallbackSection = ['\n## Context Files (references)'];
    for (const { path: filePath, content } of fileContents.slice(0, maxFiles)) {
        fallbackSection.push(`- ${path.basename(filePath)}: ${content.slice(0, 150).replace(/\n/g, ' ')}...`);
        filesIncluded++;
    }
    optimizedContext += '\n' + fallbackSection.join('\n');

    return {
        context: optimizedContext,
        tokenSavings: 0,
        filesIncluded,
        method: 'fallback',
    };
};

module.exports = {
    getTaskOrder,
    getTaskFolders,
    isTaskCompleted,
    // Structure validation
    hasValidTaskStructure,
    // Context extraction (sync + async)
    extractContextSummary,
    extractContextSummaryAsync,
    extractContextSummaryFromContent,
    // Research patterns (deprecated - kept for backward compatibility)
    extractResearchPatterns,
    extractResearchPatternsAsync,
    extractResearchPatternsFromContent,
    // Codebase patterns
    extractCodebasePatterns,
    // AI Prompt summary (sync + async with LLM)
    createAiPromptSummary,
    createAiPromptSummaryAsync,
    createAiPromptSummaryFromContent,
    // Context building
    getIncrementalContext,
    buildConsolidatedContext,
    buildConsolidatedContextAsync,
    buildOptimizedContextAsync,
    markTaskCompleted,
    getContextFilePaths,
    // Code index integration (uses semantic search with Ollama)
    getRelevantSymbols,
    getFileSummary,
};
