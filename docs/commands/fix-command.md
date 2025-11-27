# Fix Command

The **fix-command** is a powerful utility that runs a shell command repeatedly, using AI to automatically fix any failures until the command succeeds. This is particularly useful for fixing failing tests, linting errors, or build issues.

## Usage

```bash
claudiomiro --fix-command="<command>" [folder] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--fix-command="<cmd>"` | The command to run and fix (required) |
| `--limit=<n>` | Maximum fix attempts (default: 20) |
| `--no-limit` | Run without attempt limit |

## How It Works

1. **Execute Command**: Runs the specified shell command
2. **Capture Output**: Logs stdout and stderr to `.claudiomiro/fix-command.log`
3. **Check Result**: If the command succeeds (exit code 0), the process completes
4. **AI Analysis**: If the command fails, sends the error output to Claude AI
5. **Apply Fix**: Claude analyzes the error and applies fixes to the codebase
6. **Retry**: Runs the command again and repeats until success or max attempts

## Examples

### Fix Failing Tests
```bash
# Fix Jest tests
claudiomiro --fix-command="npm test"

# Fix specific test file
claudiomiro --fix-command="npm test -- user.test.js"

# Fix Python tests
claudiomiro --fix-command="pytest tests/"
```

### Fix Linting Errors
```bash
# Fix ESLint errors
claudiomiro --fix-command="npm run lint"

# Fix TypeScript errors
claudiomiro --fix-command="npx tsc --noEmit"
```

### Fix Build Issues
```bash
# Fix build errors
claudiomiro --fix-command="npm run build"

# Fix Webpack build
claudiomiro --fix-command="npx webpack"
```

### With Custom Limits
```bash
# Allow up to 50 attempts
claudiomiro --fix-command="npm test" --limit=50

# Run until success (no limit)
claudiomiro --fix-command="npm test" --no-limit
```

### In Specific Directory
```bash
# Run in a different project folder
claudiomiro --fix-command="npm test" ./my-project
```

## Output

The fix-command creates logs in the `.claudiomiro` folder:

```
.claudiomiro/
└── fix-command.log    # Detailed execution log with timestamps
```

### Log Format

```
================================================================================
FIX COMMAND EXECUTION
================================================================================
Timestamp: 2024-01-15T10:30:45.123Z
Command: npm test
================================================================================

[stdout and stderr output here]

================================================================================
Exit Code: 1
================================================================================
```

## Platform Support

The fix-command handles platform-specific shell execution:

| Platform | Shell Used |
|----------|-----------|
| Linux | `bash` |
| macOS | `bash` |
| Windows | `cmd.exe` |

## Error Handling

### Command Not Found
If the command doesn't exist, the fix-command will report the error and Claude will suggest solutions.

### Permission Denied
File permission issues are detected and can be fixed automatically.

### Timeout
Long-running commands are supported. The process waits for completion.

### Max Attempts Reached
When the limit is reached without success:
- A summary of the last error is displayed
- The log file contains all attempt details
- You can increase the limit with `--limit=<n>` or use `--no-limit`

## Best Practices

1. **Start with a low limit**: Use `--limit=5` initially to test
2. **Review the logs**: Check `.claudiomiro/fix-command.log` for details
3. **Be specific**: Use specific commands rather than generic ones
4. **Check the fixes**: Review AI-applied fixes before committing

## Use Cases

### Continuous Integration Fix
```bash
# Fix all CI checks before pushing
claudiomiro --fix-command="npm run ci"
```

### Type Error Resolution
```bash
# Fix TypeScript type errors
claudiomiro --fix-command="tsc --noEmit" --limit=30
```

### Database Migration Issues
```bash
# Fix migration scripts
claudiomiro --fix-command="npm run migrate"
```

## Related Commands

- [`task-executor`](./task-executor.md) - Full autonomous development workflow
- [`loop-fixes`](./loop-fixes.md) - Prompt-based issue detection and fixing
- [`help`](./help.md) - Show help information
