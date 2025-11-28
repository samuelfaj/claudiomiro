# Context Cache Service

A token-efficient context management system for Claudiomiro that reduces token consumption by caching and incrementally collecting context.

## Overview

The Context Cache Service optimizes LLM token usage by:

1. **Caching AI_PROMPT.md summaries** - Extracts and caches key sections (tech stack, architecture, conventions)
2. **Tracking completed tasks incrementally** - Only processes new tasks since last run
3. **Building consolidated context** - Produces a compact summary instead of reading all files
4. **Detecting codebase patterns** - Auto-detects testing framework, import style, language, etc.

## Architecture

```
context-cache/
├── index.js              # Main exports
├── cache-manager.js      # Low-level cache operations
├── context-collector.js  # Context collection logic
└── README.md             # This file
```

## Usage

### Basic Usage

```javascript
const {
  buildConsolidatedContext,
  markTaskCompleted
} = require('./context-cache');

// Get consolidated context for a task
const context = buildConsolidatedContext(claudiomiroFolder, 'TASK1');

// Mark task as completed after execution
markTaskCompleted(claudiomiroFolder, 'TASK1');
```

### In Prompt Templates

Add the `{{contextSection}}` placeholder in your prompt templates:

```markdown
## CONSOLIDATED CONTEXT (Token-Optimized)

{{contextSection}}
```

The context will be replaced with:
- Environment summary from AI_PROMPT.md
- Detected codebase patterns
- Recently completed tasks (files modified, decisions made)
- Reference to full context files

## API Reference

### Context Collection

#### `buildConsolidatedContext(claudiomiroFolder, currentTask)`

Builds a consolidated context string for prompt inclusion.

**Parameters:**
- `claudiomiroFolder` - Path to `.claudiomiro` folder
- `currentTask` - Current task being processed (e.g., 'TASK1')

**Returns:** String with consolidated context

**Example output:**
```markdown
## Environment Summary (from AI_PROMPT.md)
**Tech Stack:**
- Node.js v18
- Express 4.x
- Jest for testing

## Detected Codebase Patterns
- **Language:** javascript
- **Test Framework:** jest
- **Import Style:** commonjs
- **Test Naming:** file.test.ext

## Recently Completed Tasks
### TASK1
**Files Modified:**
- src/auth/index.js
- src/auth/middleware.js
**Decisions:**
- Used JWT for authentication

## Full Context Files (read if more detail needed)
- /path/to/.claudiomiro/TASK1/CONTEXT.md
```

#### `getIncrementalContext(claudiomiroFolder, currentTask, options)`

Gets incremental context (only new context since last run).

**Parameters:**
- `claudiomiroFolder` - Path to `.claudiomiro` folder
- `currentTask` - Current task being processed
- `options.lastProcessedTask` - Override last processed task

**Returns:** Object with:
- `aiPromptSummary` - Cached or freshly generated summary
- `codebasePatterns` - Detected patterns from AI_PROMPT.md
- `newTasks` - Tasks completed since last run
- `contextFiles` - List of context file paths

#### `markTaskCompleted(claudiomiroFolder, taskId)`

Marks a task as completed and updates the cache.

#### `getContextFilePaths(claudiomiroFolder, currentTask, options)`

Gets context file paths without reading content.

**Options:**
- `includeResearch` - Include RESEARCH.md files (default: true)
- `includeContext` - Include CONTEXT.md files (default: true)
- `includeTodo` - Include TODO.md files (default: false)
- `onlyCompleted` - Only include completed tasks (default: true)

### Cache Management

#### `loadCache(claudiomiroFolder)`

Loads cache from disk or returns empty cache.

#### `saveCache(claudiomiroFolder, cache)`

Saves cache to disk.

#### `clearCache(claudiomiroFolder)`

Deletes the cache file.

### AI_PROMPT Caching

#### `hasAiPromptChanged(claudiomiroFolder, cache)`

Checks if AI_PROMPT.md has changed since last cache.

#### `getCachedAiPromptSummary(claudiomiroFolder)`

Returns cached summary if valid.

#### `updateAiPromptCache(claudiomiroFolder, cache, summary)`

Updates cache with new AI_PROMPT hash and summary.

#### `createAiPromptSummary(aiPromptPath)`

Creates a condensed summary (~500 tokens) from AI_PROMPT.md.

### Codebase Patterns

#### `storeCodebasePatterns(claudiomiroFolder, patterns)`

Stores detected codebase patterns in cache.

#### `getCodebasePatterns(claudiomiroFolder)`

Retrieves cached codebase patterns.

#### `extractCodebasePatterns(content)`

Extracts patterns from AI_PROMPT.md content.

**Detected patterns:**
- `testingFramework` - jest, pytest, mocha, vitest, etc.
- `importStyle` - commonjs or esm
- `testFileNaming` - file.test.ext or __tests__/file.ext
- `primaryLanguage` - javascript, typescript, python, go, etc.
- `codeStyle` - class-based or functional
- `keyDirectories` - Important directories in the codebase

### Task Tracking

#### `addCompletedTask(claudiomiroFolder, taskId, summary)`

Adds a completed task to the cache.

#### `getAllCompletedTasks(claudiomiroFolder)`

Returns all completed tasks from cache.

#### `getNewCompletedTasks(claudiomiroFolder, afterTask)`

Returns tasks completed after a specific task.

#### `getLastProcessedTask(claudiomiroFolder)`

Returns the last processed task ID.

## Cache File Format

The cache is stored in `.claudiomiro/cache/context-cache.json`:

```json
{
  "version": "1.0",
  "aiPrompt": {
    "hash": "md5-hash-of-ai-prompt",
    "summary": "Extracted summary content",
    "lastUpdated": "2025-01-18T10:00:00.000Z"
  },
  "codebasePatterns": {
    "testingFramework": "jest",
    "importStyle": "commonjs",
    "primaryLanguage": "javascript",
    "lastUpdated": "2025-01-18T10:00:00.000Z"
  },
  "completedTasks": {
    "TASK1": {
      "context": { "filesModified": "...", "decisions": "..." },
      "research": { "strategy": "...", "patterns": "...", "topics": [...] },
      "completedAt": "2025-01-18T10:30:00.000Z"
    }
  },
  "lastProcessedTask": "TASK1",
  "lastUpdated": "2025-01-18T10:30:00.000Z"
}
```

## Token Optimization Strategy

### Before (Without Cache)

Each task execution would:
1. Read full AI_PROMPT.md (~5000 tokens)
2. Read all previous CONTEXT.md files (~500 tokens each)
3. Read all previous RESEARCH.md files (~300 tokens each)

**Total for TASK5:** ~5000 + (4 * 500) + (4 * 300) = ~8200 tokens

### After (With Cache)

Each task execution:
1. Uses cached AI_PROMPT summary (~500 tokens)
2. Uses detected patterns (~50 tokens)
3. Includes only delta from new tasks (~300 tokens)
4. References files (no content read) (~50 tokens)

**Total for TASK5:** ~900 tokens

**Savings:** ~89% token reduction

## Integration Points

### Step 4 (Generate TODO.md)

```javascript
const { buildConsolidatedContext } = require('../context-cache');

const contextSection = buildConsolidatedContext(
  state.claudiomiroFolder,
  taskId
);

const prompt = promptTemplate.replace('{{contextSection}}', contextSection);
```

### Step 5 (Execute Task)

```javascript
const { buildConsolidatedContext, markTaskCompleted } = require('../context-cache');

// Before execution
const contextSection = buildConsolidatedContext(claudiomiroFolder, taskId);

// After successful execution
markTaskCompleted(claudiomiroFolder, taskId);
```

### Step 6 (Code Review)

```javascript
const { buildConsolidatedContext } = require('../context-cache');

const contextSection = buildConsolidatedContext(claudiomiroFolder, taskId);
```

## Invalidation

The cache is automatically invalidated when:

1. **AI_PROMPT.md changes** - Hash comparison detects modifications
2. **Cache version mismatch** - Upgrading cache format clears old cache
3. **Manual clear** - Using `clearCache()` function

## Testing

Run tests with:

```bash
npm test -- --testPathPattern='context-cache'
```

## Best Practices

1. **Always call `markTaskCompleted`** after successful task execution
2. **Use `buildConsolidatedContext`** instead of reading individual files
3. **Include `{{contextSection}}` placeholder** in prompt templates
4. **Initialize cache early** in the CLI with `state.initializeCache()`
5. **Trust the cache** - it's invalidated automatically when needed
