# Fix Branch Command

The **fix-branch** command performs a comprehensive Staff+ Engineer code review of your entire branch before opening a Pull Request. It uses the same self-correcting loop as `loop-fixes`, but with a predefined expert-level review prompt.

## Usage

```bash
claudiomiro --fix-branch [options] [folder]
```

## Options

| Option | Description |
|--------|-------------|
| `--fix-branch` | Activate fix-branch mode (required) |
| `--limit=<n>` | Maximum iterations (default: 10) |
| `--no-limit` | Run without iteration limit |

## How It Works

1. **Detect Stack**: Identifies languages, frameworks, and architecture patterns
2. **Analyze Diff**: Reviews all changes in the branch
3. **Track Issues**: Creates `TODO.md` with blockers, warnings, and suggestions
4. **Fix Issues**: Implements fixes for each identified problem
5. **Iterate**: Continues until all blockers and warnings are resolved
6. **Generate Report**: Creates `BRANCH_REVIEW.md` when complete

### Review Scope

The command performs a thorough review covering:

- **Architecture & Responsibility**: SRP violations, layer leakage, unclear boundaries
- **Code Quality**: Naming, structure, complexity, dead code, magic values
- **Security**: Injection vulnerabilities, input validation, secrets handling
- **Performance**: N+1 queries, blocking I/O, memory waste
- **Testing**: Coverage gaps, test quality, edge cases
- **Git Hygiene**: Mixed changes, unnecessary diffs

## Examples

### Basic Usage
```bash
# Review current branch
claudiomiro --fix-branch

# Review in specific directory
claudiomiro --fix-branch ./my-project
```

### With Custom Limits
```bash
# Allow up to 20 iterations for complex branches
claudiomiro --fix-branch --limit=20

# Run until all issues fixed (no limit)
claudiomiro --fix-branch --no-limit
```

## Output Files

The command creates files in the `.claudiomiro` folder:

```
.claudiomiro/
├── TODO.md           # Issue tracking with status
└── BRANCH_REVIEW.md  # Final review report (on completion)
```

### TODO.md Format

```markdown
# TODO - Branch Review

## Current Iteration: 2

### Pending Issues

- [ ] [BLOCKER] Missing null check - File: src/api/handler.js:45
- [ ] [WARNING] N+1 query detected - File: src/services/user.js:78

### Fixed Issues

- [x] [BLOCKER] SQL injection vulnerability - FIXED in iteration 1
  - Solution: Used parameterized query
- [x] [WARNING] Unused import - FIXED in iteration 1
  - Solution: Removed dead import
```

### BRANCH_REVIEW.md Format

```markdown
# BRANCH_REVIEW - Complete

**Date**: 2024-01-15 14:30:00
**Total Iterations**: 3
**Confidence**: High

## 1) HIGH-LEVEL SUMMARY

- Added user authentication feature
- Implemented JWT token handling
- Fixed 3 security vulnerabilities
- Code quality is good with minor improvements made

## 2) BLOCKERS (must be fixed before merge)

None - all blockers have been resolved.

## 3) WARNINGS (should be fixed soon)

None - all warnings have been addressed.

## 4) SUGGESTIONS & IMPROVEMENTS

- [SUGGESTION] Consider adding rate limiting to auth endpoints
- [SUGGESTION] Add integration tests for token refresh flow

## 5) FILE-BY-FILE NOTES

- src/auth/handler.js
  - Clean implementation of JWT verification
  - Good error handling

## 6) TESTS & CONFIDENCE

- Test coverage: Adequate
- Confidence level: High
- All critical paths are tested
```

## Progress Tracking

During execution:

```
Starting fix-branch (Staff+ Engineer Code Review)...
Running fix-branch (max iterations: 10)

🔄 Starting loop-fixes...
📝 Prompt: "You are a Staff+ Engineer and elite code reviewer..."
🔄 Max iterations: 10

🔄 Iteration 1/10
📋 Issues tracked: 0 fixed, 4 pending

🔄 Iteration 2/10
📋 Issues tracked: 3 fixed, 1 pending

🔄 Iteration 3/10
📋 Issues tracked: 4 fixed, 0 pending
✅ Loop completed! OVERVIEW.md created.
📊 Summary: 4 issue(s) fixed across 3 iteration(s)
```

## Review Categories

### Blockers (Must Fix)
Issues that will block the PR:
- Security vulnerabilities
- Critical bugs
- Breaking changes without migration
- Missing tests for critical logic

### Warnings (Should Fix)
Issues that should be addressed:
- Performance problems
- Code smells
- Minor security concerns
- Test coverage gaps

### Suggestions (Nice to Have)
Improvements for consideration:
- Refactoring opportunities
- Better patterns
- Documentation improvements
- Future considerations

## Use Cases

### Pre-PR Review
```bash
# Review before opening PR
git checkout feature/my-feature
claudiomiro --fix-branch
# Review BRANCH_REVIEW.md, then open PR
```

### CI/CD Integration
```bash
# In your CI pipeline
claudiomiro --fix-branch --limit=5
if [ -f ".claudiomiro/BRANCH_REVIEW.md" ]; then
  echo "Review passed"
else
  echo "Review found issues"
  exit 1
fi
```

### Large Feature Branches
```bash
# For complex branches with many changes
claudiomiro --fix-branch --no-limit
```

## Comparison with loop-fixes

| Feature | fix-branch | loop-fixes |
|---------|------------|------------|
| Prompt | Predefined (Staff+ review) | Custom (user-provided) |
| Focus | Branch review before PR | General issue fixing |
| Output | BRANCH_REVIEW.md | OVERVIEW.md |
| Use Case | Pre-PR quality gate | Ad-hoc code improvements |

## Best Practices

1. **Run Before PR**: Always run `fix-branch` before opening a Pull Request
2. **Review Output**: Check `BRANCH_REVIEW.md` even if all issues are fixed
3. **Start with Default Limit**: Use default 10 iterations initially
4. **Address Blockers First**: Focus on blockers before warnings
5. **Keep Branches Small**: Smaller branches get faster, more accurate reviews

## Error Handling

### Max Iterations Reached
If the limit is reached with issues remaining:
- Check `TODO.md` for pending items
- Increase limit with `--limit=<n>`
- Or manually fix remaining issues

### No Changes in Branch
If the branch has no diff from main:
- The review will complete quickly
- `BRANCH_REVIEW.md` will note no changes found

## Related Commands

- [`loop-fixes`](./loop-fixes.md) - Custom prompt-based issue fixing
- [`fix-command`](./fix-command.md) - Fix failing commands automatically
- [`task-executor`](./task-executor.md) - Full autonomous development workflow
