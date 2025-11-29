## SHELL COMMAND RULE (MANDATORY)

**CRITICAL: ALL terminal commands that produce output MUST be executed via token-optimizer.**

### Why This Matters

Terminal commands often produce verbose output (thousands of lines) that:
- Consumes excessive tokens unnecessarily
- Obscures the actual relevant information
- Slows down task execution

The token-optimizer filters output to only what's actionable, reducing token usage by 60-90%.

---

### Default Pattern: Use token-optimizer

```bash
claudiomiro --token-optimizer --command="<command>" --filter="<what to extract>"
```

**Examples:**

```bash
# Testing
claudiomiro --token-optimizer --command="npm test" --filter="return only failed tests with error messages, file paths, and line numbers"

# Building
claudiomiro --token-optimizer --command="npm run build" --filter="return only errors and warnings with file locations"

# Linting
claudiomiro --token-optimizer --command="eslint src/" --filter="return only violations with file:line and rule name"

# Type checking
claudiomiro --token-optimizer --command="npx tsc --noEmit" --filter="return only type errors with file:line"

# Git operations
claudiomiro --token-optimizer --command="git status" --filter="return only modified, added, and deleted files"
claudiomiro --token-optimizer --command="git diff" --filter="return summary of changes per file"

# Package management
claudiomiro --token-optimizer --command="npm install" --filter="return only errors, warnings, and added packages"

# General commands
claudiomiro --token-optimizer --command="<any command>" --filter="return only relevant output for the task"
```

---

### Filter Guidelines

Write filters that extract ONLY actionable information:

| Command Type | Recommended Filter |
|--------------|-------------------|
| Tests | `"return only failed tests with error messages and stack traces"` |
| Build | `"return only errors and warnings with file locations"` |
| Lint | `"return only violations with file:line and severity"` |
| TypeScript | `"return only type errors with file:line and error message"` |
| Git status | `"return only changed files grouped by status"` |
| Git diff | `"return summary of changes: files modified and line counts"` |
| Install | `"return only errors, warnings, or security vulnerabilities"` |

---

### Exceptions (When NOT to use token-optimizer)

Use direct commands ONLY when:

1. **Writing to files** - Commands that create/modify files (output is not informational)
   ```bash
   # Direct command OK - no output to filter
   echo "content" > file.txt
   ```

2. **Interactive commands** - Commands requiring user input (not applicable here)

3. **Very short output** - Single-line responses (e.g., `pwd`, `echo $VAR`)
   ```bash
   # Direct command OK - minimal output
   pwd
   ```

---

### Anti-Patterns (NEVER DO)

```bash
# WRONG: Running verbose commands without token-optimizer
npm test                    # Can output 1000+ lines
git log                     # Can output hundreds of commits
eslint . --format stylish   # Can output hundreds of violations

# WRONG: Using token-optimizer for file writes
claudiomiro --token-optimizer --command="cat > file.txt" --filter="..."  # Unnecessary

# WRONG: Vague filters that don't reduce output
claudiomiro --token-optimizer --command="npm test" --filter="return everything"  # Defeats purpose
```

---

### Decision Flow

```
Is the command output informational (not a file write)?
├─ YES → Use token-optimizer with specific filter
└─ NO → Use direct command

Will the output likely exceed 10 lines?
├─ YES → Use token-optimizer with specific filter
└─ NO → Direct command is acceptable
```

**Remember:** When in doubt, USE token-optimizer. The overhead is minimal, but the token savings can be significant.
