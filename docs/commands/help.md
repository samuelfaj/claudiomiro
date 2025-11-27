# Help Command

The **help** command displays usage information, available commands, options, and examples for Claudiomiro.

## Usage

```bash
# Show full help
claudiomiro --help
claudiomiro -h

# Show version only
claudiomiro --version
claudiomiro -v
```

## Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Display full help information |
| `-v, --version` | Display version number only |

## Help Output

When running `claudiomiro --help`, you'll see:

```
Claudiomiro v1.9.5
AI-Powered Development Agent

USAGE

  $ claudiomiro [command] [options]

COMMANDS

  claudiomiro [folder] [options]
    Execute autonomous AI-powered task decomposition and implementation

    --executor=<name>         AI executor to use (claude, codex, gemini, deepseek, glm)
    --model=<name>            Specific model to use with the executor
    --skip-research           Skip the research phase

  claudiomiro --fix-command="<command>" [folder] [options]
    Run a command repeatedly until it succeeds (useful for fixing tests/linting)

    --limit=<n>               Maximum attempts per task (default: 20)
    --no-limit                Run without attempt limit

  claudiomiro --loop-fixes [folder] [options]
    Continuously fix issues in a loop until all pass

    --limit=<n>               Maximum attempts per task (default: 20)
    --no-limit                Run without attempt limit

GLOBAL OPTIONS

  -h, --help                Show this help message
  -v, --version             Show version number

EXAMPLES

  # Run task executor in current directory
  $ claudiomiro

  # Run task executor in a specific folder with Claude
  $ claudiomiro ./my-project --executor=claude

  # Fix failing tests automatically
  $ claudiomiro --fix-command="npm test"

  # Loop fixes with custom limit
  $ claudiomiro --loop-fixes --limit=50

For more information, visit:
https://github.com/samuelfaj/claudiomiro
```

## Version Output

When running `claudiomiro --version`:

```
claudiomiro v1.9.5
```

## Implementation Details

The help command is implemented in `src/commands/help/index.js` and exports:

- `run(args)` - Main entry point
- `showHelp()` - Display full help
- `showVersion()` - Display version only
- `COMMANDS` - Array of command definitions
- `GLOBAL_OPTIONS` - Array of global option definitions

## Extending Help

When adding new commands or options, update the `COMMANDS` and `GLOBAL_OPTIONS` arrays in `src/commands/help/index.js`.

See [CLAUDE.md](../../src/commands/CLAUDE.md) for detailed instructions on keeping help synchronized with new commands.

## Related Commands

- [`task-executor`](./task-executor.md) - Full autonomous development workflow
- [`fix-command`](./fix-command.md) - Fix a failing command automatically
- [`loop-fixes`](./loop-fixes.md) - Prompt-based issue detection and fixing
