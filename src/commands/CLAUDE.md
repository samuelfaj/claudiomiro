# Commands Development Guide

This document provides guidelines for creating, editing, and maintaining commands in Claudiomiro.

## Directory Structure

Each command lives in its own directory under `src/commands/`:

```
src/commands/
├── CLAUDE.md              # This file
├── task-executor/         # Main task execution command
│   ├── index.js          # Entry point
│   ├── index.test.js     # Tests
│   ├── cli.js            # CLI logic
│   ├── services/         # Command-specific services
│   ├── steps/            # Execution steps
│   └── utils/            # Utilities
├── fix-command/          # Fix command utility
│   ├── index.js
│   ├── index.test.js
│   ├── executor.js
│   └── executor.test.js
├── loop-fixes/           # Loop fixes command
│   ├── index.js
│   ├── index.test.js
│   ├── executor.js
│   ├── executor.test.js
│   └── prompt.md
└── help/                 # Help command
    ├── index.js
    └── index.test.js
```

## Creating a New Command

### Step 1: Create Command Directory

```bash
mkdir src/commands/my-command
```

### Step 2: Create index.js

Every command must export a `run` function:

```javascript
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');

const run = async (args) => {
    // Parse arguments
    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    // Command logic here
    logger.info('Running my-command...');
};

module.exports = { run };
```

### Step 3: Create Tests

Create `index.test.js` in the same directory:

```javascript
const { run } = require('./index');

jest.mock('../../shared/utils/logger');
jest.mock('../../shared/config/state');

describe('my-command', () => {
    test('should run successfully', async () => {
        await run([]);
        // assertions
    });
});
```

### Step 4: Register in src/index.js

Add the command to the argument parser and switch statement:

```javascript
// In parseArgs()
const myCommandArg = args.includes('--my-command');

if (myCommandArg) {
    return { command: 'my-command', args };
}

// In init() switch statement
case 'my-command':
    const { run: runMyCommand } = require('./commands/my-command');
    await runMyCommand(args);
    break;
```

### Step 5: Update Help Command (CRITICAL)

**You MUST update the help command whenever you add or modify commands.**

Edit `src/commands/help/index.js`:

1. Add to `COMMANDS` array:

```javascript
const COMMANDS = [
    // ... existing commands ...
    {
        name: 'claudiomiro --my-command [folder] [options]',
        description: 'Description of what my command does',
        options: [
            { flag: '--option1=<value>', description: 'What option1 does' },
            { flag: '--flag1', description: 'What flag1 enables' }
        ]
    }
];
```

2. Update tests in `src/commands/help/index.test.js`:

```javascript
test('should have my-command command', () => {
    const myCommand = COMMANDS.find(cmd => cmd.name.includes('--my-command'));
    expect(myCommand).toBeDefined();
});
```

### Step 6: Create Documentation

Create `docs/commands/my-command.md` with:

- Usage section
- Options table
- How it works explanation
- Examples
- Related commands

Update `docs/commands/README.md` to include the new command.

## Modifying Existing Commands

When modifying a command:

### Adding New Options

1. Update the command's `index.js` or `cli.js` to parse the new option
2. **Update `src/commands/help/index.js`** to include the new option
3. Update the command's documentation in `docs/commands/`
4. Add tests for the new option

### Changing Command Behavior

1. Update the implementation
2. Update tests to reflect new behavior
3. Update documentation if user-facing behavior changed
4. **Update help if the description needs to change**

### Renaming a Command

1. Rename the directory
2. Update `src/index.js` routing
3. **Update `src/commands/help/index.js`**
4. Update all documentation references
5. Update tests

## Help Command Synchronization Checklist

**Every time you modify commands, verify these are in sync:**

- [ ] `src/index.js` - Command routing
- [ ] `src/commands/help/index.js` - COMMANDS array
- [ ] `src/commands/help/index.js` - GLOBAL_OPTIONS array (if adding global flags)
- [ ] `src/commands/help/index.test.js` - Tests for new commands/options
- [ ] `docs/commands/<command>.md` - Command documentation
- [ ] `docs/commands/README.md` - Command index

## Command Entry Point Requirements

Every command's `index.js` must:

1. Export a `run(args)` async function
2. Accept `args` as an array of command line arguments
3. Handle its own argument parsing
4. Use `state.setFolder()` if working with directories
5. Use `logger` for output (not console.log)

## Testing Requirements

1. Every `.js` file must have a corresponding `.test.js` file
2. Tests must be self-contained (no external mock files)
3. Mock all external dependencies (`fs`, `child_process`, etc.)
4. Test both success and error scenarios
5. Test argument parsing

## Argument Parsing Conventions

Follow these conventions for consistency:

```javascript
// Boolean flags
const myFlag = args.includes('--my-flag');

// Value flags
const valueArg = args.find(arg => arg.startsWith('--value='));
const value = valueArg ? valueArg.split('=')[1] : 'default';

// Quoted values (handle quotes)
const quotedValue = valueArg
    ? valueArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '')
    : null;

// Positional argument (folder)
const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
```

## Error Handling

Commands should:

1. Validate required arguments early
2. Provide helpful error messages
3. Use `logger.error()` for errors
4. Throw errors for unrecoverable situations
5. Exit with appropriate codes (`process.exit(1)` for errors)

## Example: Complete New Command

Here's a complete example of adding a new `status` command:

### src/commands/status/index.js
```javascript
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');

const run = async (args) => {
    const folderArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
    state.setFolder(folderArg);

    const claudiomiroFolder = path.join(state.folder, '.claudiomiro');

    if (!fs.existsSync(claudiomiroFolder)) {
        logger.info('No Claudiomiro session found in this directory.');
        return;
    }

    // Show status...
    logger.info('Claudiomiro session found.');
};

module.exports = { run };
```

### src/index.js changes
```javascript
// In parseArgs()
const statusArg = args.includes('--status');
if (statusArg) {
    return { command: 'status', args };
}

// In init() switch
case 'status':
    const { run: runStatus } = require('./commands/status');
    await runStatus(args);
    break;
```

### src/commands/help/index.js changes
```javascript
const COMMANDS = [
    // ... existing ...
    {
        name: 'claudiomiro --status [folder]',
        description: 'Show status of current Claudiomiro session',
        options: []
    }
];
```

## Summary

1. **Always update help** when adding/modifying commands
2. **Always create tests** for new code
3. **Always update documentation** for user-facing changes
4. Follow existing patterns and conventions
5. Keep commands focused on a single responsibility
