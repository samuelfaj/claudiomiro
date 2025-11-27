# Loop Fixes Command

The **loop-fixes** command provides a self-correcting loop that analyzes code based on a custom prompt, identifies issues, tracks them in a TODO list, and fixes them iteratively until all issues are resolved.

## Usage

```bash
claudiomiro --loop-fixes [options] [folder]
```

## Options

| Option | Description |
|--------|-------------|
| `--loop-fixes` | Activate loop-fixes mode (required) |
| `--prompt="<text>"` | The analysis/fix prompt (or enter interactively) |
| `--limit=<n>` | Maximum iterations (default: 10) |
| `--no-limit` | Run without iteration limit |

## How It Works

1. **Initialize**: Creates `.claudiomiro` folder if needed
2. **Analyze**: Uses AI to analyze code based on your prompt
3. **Track Issues**: Creates/updates `TODO.md` with findings
4. **Fix Issues**: AI implements fixes for pending items
5. **Mark Complete**: Marks fixed items as `[x]` in TODO.md
6. **Loop**: Repeats until no pending items remain
7. **Finalize**: Creates `OVERVIEW.md` summarizing the work

### Loop Termination Conditions

The loop ends when:
- `OVERVIEW.md` is created (success)
- Maximum iterations reached (failure)
- No more pending items and no new issues found

## Examples

### Interactive Prompt
```bash
# Enter prompt interactively
claudiomiro --loop-fixes
```

### With Direct Prompt
```bash
# Check for security vulnerabilities
claudiomiro --loop-fixes --prompt="Find and fix security vulnerabilities"

# Improve code documentation
claudiomiro --loop-fixes --prompt="Add JSDoc comments to all exported functions"

# Fix code style issues
claudiomiro --loop-fixes --prompt="Ensure consistent code formatting and naming conventions"
```

### With Custom Limits
```bash
# Allow up to 20 iterations
claudiomiro --loop-fixes --limit=20

# Run until complete (no limit)
claudiomiro --loop-fixes --no-limit
```

### In Specific Directory
```bash
# Run in a different project
claudiomiro --loop-fixes --prompt="Fix TypeScript errors" ./my-project
```

## Output Files

The loop-fixes command creates files in the `.claudiomiro` folder:

```
.claudiomiro/
├── TODO.md       # Issue tracking with checkboxes
└── OVERVIEW.md   # Summary created upon completion
```

### TODO.md Format

```markdown
# Issues Found

## Security
- [x] SQL injection vulnerability in user.js:45
- [x] Missing input validation in auth.js:23
- [ ] Hardcoded API key in config.js:12

## Performance
- [x] N+1 query in products.js:78
- [ ] Missing database index for users.email
```

### OVERVIEW.md Format

```markdown
# Loop Fixes Summary

## Work Completed
- Fixed 5 security vulnerabilities
- Improved 3 performance issues
- Added input validation to 8 endpoints

## Iterations: 4

## Files Modified
- src/user.js
- src/auth.js
- src/products.js
```

## Progress Tracking

During execution, the command displays:

```
🔄 Starting loop-fixes...
📝 Prompt: "Find and fix security vulnerabilities..."
🔄 Max iterations: 10

🔄 Iteration 1/10
📋 Issues tracked: 0 fixed, 5 pending

🔄 Iteration 2/10
📋 Issues tracked: 3 fixed, 2 pending

🔄 Iteration 3/10
📋 Issues tracked: 5 fixed, 0 pending
✅ Loop completed! OVERVIEW.md created.
📊 Summary: 5 issue(s) fixed across 3 iteration(s)
```

## Use Cases

### Security Audit
```bash
claudiomiro --loop-fixes --prompt="Audit the codebase for OWASP Top 10 vulnerabilities and fix them"
```

### Code Quality Improvement
```bash
claudiomiro --loop-fixes --prompt="Identify code smells and refactor for better maintainability"
```

### Documentation Generation
```bash
claudiomiro --loop-fixes --prompt="Add comprehensive documentation to all public APIs"
```

### Test Coverage
```bash
claudiomiro --loop-fixes --prompt="Identify untested functions and add unit tests"
```

### Accessibility Fixes
```bash
claudiomiro --loop-fixes --prompt="Find and fix accessibility issues in React components"
```

### Dependency Updates
```bash
claudiomiro --loop-fixes --prompt="Update deprecated API calls to use modern alternatives"
```

## Error Handling

### Max Iterations Reached
When the limit is reached without completion:
- The error is displayed with remaining issues
- `TODO.md` shows what's still pending
- Increase limit with `--limit=<n>` or use `--no-limit`

### Empty Prompt
A prompt is required. If not provided via `--prompt=`, you'll be prompted interactively.

### AI Execution Failure
If Claude fails during an iteration:
- The error is logged
- The process stops
- Check `.claudiomiro/` for partial progress

## Best Practices

1. **Be Specific**: Use detailed prompts for better results
2. **Start Small**: Use `--limit=5` initially to validate the approach
3. **Review Progress**: Check `TODO.md` between iterations if needed
4. **Iterate on Prompts**: Refine your prompt based on initial results

## Comparison with Other Commands

| Feature | loop-fixes | fix-command | task-executor |
|---------|------------|-------------|---------------|
| Input | Custom prompt | Shell command | Task description |
| Tracking | TODO.md | Log file | Multiple files |
| Focus | Issue detection | Error fixing | Full development |
| Output | OVERVIEW.md | Fixed code | Complete feature |

## Related Commands

- [`task-executor`](./task-executor.md) - Full autonomous development workflow
- [`fix-command`](./fix-command.md) - Fix a failing command automatically
- [`fix-branch`](./fix-branch.md) - Staff+ code review before PR (uses loop-fixes with predefined prompt)
- [`help`](./help.md) - Show help information
