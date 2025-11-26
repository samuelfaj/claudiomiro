# Reorganization Plan: Modular Commands Architecture

## Overview

This document describes the complete plan to reorganize Claudiomiro's folder structure into a **modular, vertical-sliced** architecture where each command is self-contained.

---

## Current Structure Analysis

```
src/
├── config/
│   └── state.js                    # Global state singleton
├── utils/
│   ├── cli.js                      # Main CLI entrypoint (mixed concerns)
│   ├── logger.js                   # Shared logger
│   ├── validation.js               # task-executor specific
│   ├── terminal-renderer.js        # task-executor specific
│   ├── progress-calculator.js      # task-executor specific
│   └── auto-update.js              # Shared
├── steps/                          # 100% task-executor specific
│   ├── index.js
│   ├── step0/ - step8/
│   ├── templates/
│   └── CLAUDE.md
├── services/
│   ├── dag-executor.js             # task-executor specific
│   ├── parallel-state-manager.js   # task-executor specific
│   ├── parallel-ui-renderer.js     # task-executor specific
│   ├── deadlock-resolver.js        # task-executor specific
│   ├── file-manager.js             # task-executor specific
│   ├── fix-command.js              # fix-command specific
│   ├── git-commit.js               # Shared
│   ├── git-status.js               # Shared
│   ├── prompt-reader.js            # Shared
│   ├── claude-executor.js          # Shared
│   ├── claude-logger.js            # Shared
│   ├── codex-executor.js           # Shared
│   ├── codex-logger.js             # Shared
│   ├── gemini-executor.js          # Shared
│   ├── gemini-logger.js            # Shared
│   ├── deep-seek-executor.js       # Shared
│   ├── deep-seek-logger.js         # Shared
│   ├── glm-executor.js             # Shared
│   └── glm-logger.js               # Shared
└── templates/
    ├── TODO.md                     # task-executor specific
    └── CONTEXT.md                  # task-executor specific
```

---

## Target Structure

```
src/
├── commands/
│   ├── task-executor/
│   │   ├── index.js                      # Command entry point
│   │   ├── cli.js                        # CLI logic (extracted from utils/cli.js)
│   │   ├── steps/
│   │   │   ├── index.js
│   │   │   ├── step0/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   └── prompt.md
│   │   │   ├── step1/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   └── prompt.md
│   │   │   ├── step2/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   └── prompt.md
│   │   │   ├── step3/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   └── prompt.md
│   │   │   ├── step4/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   ├── analyze-split.js
│   │   │   │   ├── analyze-split.test.js
│   │   │   │   ├── generate-todo.js
│   │   │   │   ├── generate-todo.test.js
│   │   │   │   ├── utils.js
│   │   │   │   ├── utils.test.js
│   │   │   │   ├── prompt-generate-todo.md
│   │   │   │   └── prompt-split.md
│   │   │   ├── step5/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   ├── generate-research.js
│   │   │   │   ├── generate-research.test.js
│   │   │   │   ├── generate-context.js
│   │   │   │   ├── generate-context.test.js
│   │   │   │   ├── prompt.md
│   │   │   │   ├── research-prompt.md
│   │   │   │   └── RESEARCH.md
│   │   │   ├── step6/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   ├── review-code.js
│   │   │   │   ├── review-code.test.js
│   │   │   │   ├── reanalyze-failed.js
│   │   │   │   ├── reanalyze-failed.test.js
│   │   │   │   ├── prompt-review.md
│   │   │   │   └── reanalyze-prompt.md
│   │   │   ├── step7/
│   │   │   │   ├── index.js
│   │   │   │   ├── index.test.js
│   │   │   │   └── prompt.md
│   │   │   ├── step8/
│   │   │   │   ├── index.js
│   │   │   │   └── index.test.js
│   │   │   ├── index.js
│   │   │   ├── index.test.js
│   │   │   └── CLAUDE.md
│   │   ├── services/
│   │   │   ├── dag-executor.js
│   │   │   ├── dag-executor.test.js
│   │   │   ├── parallel-state-manager.js
│   │   │   ├── parallel-state-manager.test.js
│   │   │   ├── parallel-ui-renderer.js
│   │   │   ├── parallel-ui-renderer.test.js
│   │   │   ├── deadlock-resolver.js
│   │   │   ├── deadlock-resolver.test.js
│   │   │   ├── file-manager.js
│   │   │   └── file-manager.test.js
│   │   ├── utils/
│   │   │   ├── validation.js
│   │   │   ├── validation.test.js
│   │   │   ├── progress-calculator.js
│   │   │   ├── progress-calculator.test.js
│   │   │   ├── terminal-renderer.js
│   │   │   └── terminal-renderer.test.js
│   │   └── templates/
│   │       ├── TODO.md
│   │       └── CONTEXT.md
│   │
│   ├── fix-command/
│   │   ├── index.js                      # Command entry point
│   │   ├── index.test.js
│   │   ├── executor.js                   # Main fix logic
│   │   └── executor.test.js
│   │
│   └── loop-fixes/
│       ├── index.js                      # Command entry point (new)
│       └── index.test.js
│
├── shared/
│   ├── config/
│   │   └── state.js
│   ├── executors/
│   │   ├── index.js                      # Executor factory
│   │   ├── claude-executor.js
│   │   ├── claude-executor.test.js
│   │   ├── claude-logger.js
│   │   ├── claude-logger.test.js
│   │   ├── codex-executor.js
│   │   ├── codex-executor.test.js
│   │   ├── codex-logger.js
│   │   ├── codex-logger.test.js
│   │   ├── gemini-executor.js
│   │   ├── gemini-executor.test.js
│   │   ├── gemini-logger.js
│   │   ├── gemini-logger.test.js
│   │   ├── deep-seek-executor.js
│   │   ├── deep-seek-executor.test.js
│   │   ├── deep-seek-logger.js
│   │   ├── deep-seek-logger.test.js
│   │   ├── glm-executor.js
│   │   ├── glm-executor.test.js
│   │   ├── glm-logger.js
│   │   └── glm-logger.test.js
│   ├── services/
│   │   ├── git-commit.js
│   │   ├── git-commit.test.js
│   │   ├── git-status.js
│   │   ├── git-status.test.js
│   │   ├── prompt-reader.js
│   │   └── prompt-reader.test.js
│   └── utils/
│       ├── logger.js
│       ├── logger.test.js
│       ├── auto-update.js
│       └── auto-update.test.js
│
└── index.js                              # Main CLI router
```

---

## Classification: Shared vs Command-Specific

### Shared (used by multiple commands)

| File | Reason |
|------|--------|
| `config/state.js` | Global state used by all commands |
| `utils/logger.js` | Logger used everywhere |
| `utils/auto-update.js` | Update check for CLI |
| `services/git-commit.js` | Git operations |
| `services/git-status.js` | Git status checks |
| `services/prompt-reader.js` | Prompt file reading |
| `*-executor.js` | AI executor for each provider |
| `*-logger.js` | AI logger for each provider |

### task-executor Specific

| File | Reason |
|------|--------|
| `steps/*` | All 9 steps (step0-step8) |
| `dag-executor.js` | DAG parallel execution |
| `parallel-state-manager.js` | Parallel task state |
| `parallel-ui-renderer.js` | Parallel UI rendering |
| `deadlock-resolver.js` | Deadlock resolution |
| `file-manager.js` | Uses claudiomiroFolder |
| `utils/validation.js` | isFullyImplemented, hasApprovedCodeReview |
| `utils/progress-calculator.js` | Task progress calculation |
| `utils/terminal-renderer.js` | Task terminal rendering |
| `templates/TODO.md` | TODO template |
| `templates/CONTEXT.md` | Context template |

### fix-command Specific

| File | Reason |
|------|--------|
| `services/fix-command.js` | Command execution + fix loop |

---

## Implementation Steps

### Phase 1: Create Directory Structure

```bash
# Create command directories
mkdir -p src/commands/task-executor/steps
mkdir -p src/commands/task-executor/services
mkdir -p src/commands/task-executor/utils
mkdir -p src/commands/task-executor/templates
mkdir -p src/commands/fix-command
mkdir -p src/commands/loop-fixes

# Create shared directories
mkdir -p src/shared/config
mkdir -p src/shared/executors
mkdir -p src/shared/services
mkdir -p src/shared/utils
```

### Phase 2: Move Shared Files

```bash
# Move shared config
mv src/config/state.js src/shared/config/

# Move shared utils
mv src/utils/logger.js src/shared/utils/
mv src/utils/logger.test.js src/shared/utils/
mv src/utils/auto-update.js src/shared/utils/
mv src/utils/auto-update.test.js src/shared/utils/

# Move shared services
mv src/services/git-commit.js src/shared/services/
mv src/services/git-commit.test.js src/shared/services/
mv src/services/git-status.js src/shared/services/
mv src/services/git-status.test.js src/shared/services/
mv src/services/prompt-reader.js src/shared/services/
mv src/services/prompt-reader.test.js src/shared/services/

# Move executors
mv src/services/claude-executor.js src/shared/executors/
mv src/services/claude-executor.test.js src/shared/executors/
mv src/services/claude-logger.js src/shared/executors/
mv src/services/claude-logger.test.js src/shared/executors/
mv src/services/codex-executor.js src/shared/executors/
mv src/services/codex-executor.test.js src/shared/executors/
mv src/services/codex-logger.js src/shared/executors/
mv src/services/codex-logger.test.js src/shared/executors/
mv src/services/gemini-executor.js src/shared/executors/
mv src/services/gemini-executor.test.js src/shared/executors/
mv src/services/gemini-logger.js src/shared/executors/
mv src/services/gemini-logger.test.js src/shared/executors/
mv src/services/deep-seek-executor.js src/shared/executors/
mv src/services/deep-seek-executor.test.js src/shared/executors/
mv src/services/deep-seek-logger.js src/shared/executors/
mv src/services/deep-seek-logger.test.js src/shared/executors/
mv src/services/glm-executor.js src/shared/executors/
mv src/services/glm-executor.test.js src/shared/executors/
mv src/services/glm-logger.js src/shared/executors/
mv src/services/glm-logger.test.js src/shared/executors/
```

### Phase 3: Move task-executor Files

```bash
# Move steps (entire directory)
mv src/steps/* src/commands/task-executor/steps/

# Move task-executor specific services
mv src/services/dag-executor.js src/commands/task-executor/services/
mv src/services/dag-executor.test.js src/commands/task-executor/services/
mv src/services/parallel-state-manager.js src/commands/task-executor/services/
mv src/services/parallel-state-manager.test.js src/commands/task-executor/services/
mv src/services/parallel-ui-renderer.js src/commands/task-executor/services/
mv src/services/parallel-ui-renderer.test.js src/commands/task-executor/services/
mv src/services/deadlock-resolver.js src/commands/task-executor/services/
mv src/services/deadlock-resolver.test.js src/commands/task-executor/services/
mv src/services/file-manager.js src/commands/task-executor/services/
mv src/services/file-manager.test.js src/commands/task-executor/services/

# Move task-executor specific utils
mv src/utils/validation.js src/commands/task-executor/utils/
mv src/utils/validation.test.js src/commands/task-executor/utils/
mv src/utils/progress-calculator.js src/commands/task-executor/utils/
mv src/utils/progress-calculator.test.js src/commands/task-executor/utils/
mv src/utils/terminal-renderer.js src/commands/task-executor/utils/
mv src/utils/terminal-renderer.test.js src/commands/task-executor/utils/

# Move templates
mv src/templates/* src/commands/task-executor/templates/

# Extract CLI logic for task-executor
# (this requires creating new file, see Phase 5)
```

### Phase 4: Move fix-command Files

```bash
# Move fix-command
mv src/services/fix-command.js src/commands/fix-command/executor.js
mv src/services/fix-command.test.js src/commands/fix-command/executor.test.js
```

### Phase 5: Create New Entry Points

#### 5.1 Main CLI Router (`src/index.js`)

```javascript
const logger = require('./shared/utils/logger');
const state = require('./shared/config/state');
const { checkForUpdatesAsync } = require('./shared/utils/auto-update');

const parseArgs = () => {
    const args = process.argv.slice(2);

    // Check for command flags
    const fixCommandArg = args.find(arg => arg.startsWith('--fix-command='));
    const loopFixesArg = args.includes('--loop-fixes');

    // Determine which command to run
    if (fixCommandArg) {
        return { command: 'fix-command', args };
    }

    if (loopFixesArg) {
        return { command: 'loop-fixes', args };
    }

    // Default command
    return { command: 'task-executor', args };
};

const init = async () => {
    logger.banner();
    checkForUpdatesAsync('claudiomiro');

    const { command, args } = parseArgs();

    // Route to appropriate command
    switch (command) {
        case 'task-executor':
            const { run: runTaskMaker } = require('./commands/task-executor');
            await runTaskMaker(args);
            break;

        case 'fix-command':
            const { run: runFixCommand } = require('./commands/fix-command');
            await runFixCommand(args);
            break;

        case 'loop-fixes':
            const { run: runLoopFixes } = require('./commands/loop-fixes');
            await runLoopFixes(args);
            break;

        default:
            logger.error(`Unknown command: ${command}`);
            process.exit(1);
    }
};

module.exports = { init };
```

#### 5.2 task-executor Entry Point (`src/commands/task-executor/index.js`)

```javascript
const { init } = require('./cli');

const run = async (args) => {
    await init(args);
};

module.exports = { run };
```

#### 5.3 fix-command Entry Point (`src/commands/fix-command/index.js`)

```javascript
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { fixCommand } = require('./executor');

const run = async (args) => {
    // Parse fix-command specific args
    const fixCommandArg = args.find(arg => arg.startsWith('--fix-command='));
    const fixCommandText = fixCommandArg
        ? fixCommandArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '')
        : null;

    const noLimit = args.includes('--no-limit');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

    // Get folder
    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    // Execute
    logger.info(`Fixing command: ${fixCommandText} (max attempts: ${noLimit ? 'no limit' : maxAttemptsPerTask})`);
    await fixCommand(fixCommandText, noLimit ? Infinity : maxAttemptsPerTask);
};

module.exports = { run };
```

#### 5.4 loop-fixes Entry Point (`src/commands/loop-fixes/index.js`)

```javascript
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');

const run = async (args) => {
    // Parse loop-fixes specific args
    const noLimit = args.includes('--no-limit');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const maxIterations = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

    // Get folder
    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    logger.info(`Running loop-fixes (max iterations: ${noLimit ? 'no limit' : maxIterations})`);

    // TODO: Implement loop-fixes logic
    logger.warning('loop-fixes command not yet implemented');
};

module.exports = { run };
```

### Phase 6: Update All Import Paths

This is the most critical phase. Every file needs its imports updated.

#### 6.1 Pattern for task-executor files

**Before:**
```javascript
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('../services/claude-executor');
```

**After:**
```javascript
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');
const { executeClaude } = require('../../../shared/executors/claude-executor');
```

#### 6.2 Pattern for shared files

**Before:**
```javascript
const logger = require('../utils/logger');
```

**After:**
```javascript
const logger = require('../utils/logger'); // No change if in same shared directory
```

#### 6.3 Files to Update (task-executor)

| File | Imports to Update |
|------|-------------------|
| `commands/task-executor/cli.js` | logger, state, executors, steps, services |
| `commands/task-executor/steps/step*/index.js` | logger, state, executors, prompt-reader |
| `commands/task-executor/services/dag-executor.js` | logger, state, steps, validation |
| `commands/task-executor/services/parallel-*.js` | logger, state |
| `commands/task-executor/services/deadlock-resolver.js` | logger |
| `commands/task-executor/services/file-manager.js` | logger, state |
| `commands/task-executor/utils/validation.js` | fs only (no changes) |
| `commands/task-executor/utils/progress-calculator.js` | check dependencies |
| `commands/task-executor/utils/terminal-renderer.js` | check dependencies |

#### 6.4 Files to Update (shared)

| File | Imports to Update |
|------|-------------------|
| `shared/executors/claude-executor.js` | claude-logger (same dir) |
| `shared/executors/codex-executor.js` | codex-logger (same dir) |
| `shared/executors/*-executor.js` | corresponding logger |
| `shared/services/git-commit.js` | check dependencies |
| `shared/services/git-status.js` | check dependencies |

#### 6.5 Files to Update (fix-command)

| File | Imports to Update |
|------|-------------------|
| `commands/fix-command/executor.js` | logger, state, executors |

### Phase 7: Create Executor Factory (`src/shared/executors/index.js`)

```javascript
const { executeClaude } = require('./claude-executor');
const { executeCodex } = require('./codex-executor');
const { executeGemini } = require('./gemini-executor');
const { executeDeepSeek } = require('./deep-seek-executor');
const { executeGlm } = require('./glm-executor');

const getExecutor = (type) => {
    const executors = {
        'claude': executeClaude,
        'codex': executeCodex,
        'gemini': executeGemini,
        'deep-seek': executeDeepSeek,
        'glm': executeGlm
    };

    const executor = executors[type];
    if (!executor) {
        throw new Error(`Unknown executor type: ${type}`);
    }

    return executor;
};

module.exports = {
    getExecutor,
    executeClaude,
    executeCodex,
    executeGemini,
    executeDeepSeek,
    executeGlm
};
```

### Phase 8: Update Root index.js

```javascript
#!/usr/bin/env node

const logger = require('./src/shared/utils/logger');
const { init } = require('./src/index');

init().catch((error) => {
    logger.newline();
    logger.failSpinner('An error occurred');
    logger.error(error.message);
    logger.newline();
    process.exit(1);
});
```

### Phase 9: Cleanup

```bash
# Remove old empty directories
rmdir src/config
rmdir src/utils
rmdir src/services
rmdir src/steps
rmdir src/templates
```

### Phase 10: Update Tests

1. Update all test file imports to match new paths
2. Ensure Jest config can find tests in new locations
3. Run full test suite to verify nothing breaks

```bash
npm test
```

---

## Import Path Reference

### From task-executor files

```javascript
// From src/commands/task-executor/steps/step0/index.js
const logger = require('../../../../shared/utils/logger');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { readPrompt } = require('../../../../shared/services/prompt-reader');

// From src/commands/task-executor/cli.js
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { step0, step1, ... } = require('./steps');
const { DAGExecutor } = require('./services/dag-executor');
```

### From fix-command files

```javascript
// From src/commands/fix-command/executor.js
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { executeClaude } = require('../../shared/executors/claude-executor');
```

### From shared files

```javascript
// From src/shared/executors/claude-executor.js
const claudeLogger = require('./claude-logger');

// From src/shared/services/git-commit.js
const logger = require('../utils/logger');
```

---

## Validation Checklist

After completing all phases, verify:

- [ ] `npm test` passes all tests
- [ ] `claudiomiro --help` works
- [ ] `claudiomiro .` (default task-executor) works
- [ ] `claudiomiro --fix-command="npm test"` works
- [ ] All imports resolve correctly (no "Cannot find module" errors)
- [ ] No circular dependencies
- [ ] Git history preserved (use `git mv` for moves)

---

## Notes

### Preserving Git History

Use `git mv` instead of `mv` to preserve file history:

```bash
git mv src/config/state.js src/shared/config/state.js
```

### Handling Circular Dependencies

If circular dependencies occur, consider:

1. Extract shared interfaces to separate files
2. Use lazy loading with `require()` inside functions
3. Restructure to break the cycle

### Future Commands

When adding new commands:

1. Create `src/commands/new-command/`
2. Create `index.js` entry point
3. Add command-specific logic
4. Update main `src/index.js` router
5. Keep command-specific files inside command folder
6. Import shared modules from `../../shared/`

---

## Summary

This reorganization:

1. **Isolates commands** - Each command is self-contained in `src/commands/[name]/`
2. **Shares common code** - Executors, logger, state in `src/shared/`
3. **Enables scalability** - Easy to add new commands
4. **Maintains consistency** - Clear patterns for where code belongs
5. **Preserves functionality** - Same behavior, better organization
