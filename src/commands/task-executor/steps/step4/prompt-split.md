## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

## SHELL COMMAND RULE (MANDATORY)

**CRITICAL: ALL shell commands SHOULD be executed via token-optimizer, with exceptions.**

### Default: Use token-optimizer
```bash
# ✅ CORRECT - Use token-optimizer for informational output:
claudiomiro --token-optimizer --command="npm test" --filter="return only failed tests with errors"
claudiomiro --token-optimizer --command="git status" --filter="return only changed files"
claudiomiro --token-optimizer --command="eslint src/" --filter="return only violations with file:line"
```

**Filter suggestions:**
- Tests: `--filter="return only failed tests with error messages"`
- Build: `--filter="return only errors and warnings"`
- Lint: `--filter="return only violations with file:line"`
- Git: `--filter="return only changed files summary"`
- General: `--filter="return only relevant output"`

### EXCEPTION: When NOT to use token-optimizer

**Execute commands DIRECTLY (without token-optimizer) when:**

1. **Deterministic output expected** - You need exact/structured output for programmatic decisions:
   ```bash
   npm pkg get version          # needs exact version string
   git rev-parse HEAD           # needs exact commit hash
   cat package.json | jq '.x'   # needs exact JSON value
   ```

2. **Precise diagnosis needed** - You need complete output for accurate debugging:
   ```bash
   npm test -- --verbose        # investigating specific failure
   ```

3. **Structured parsing** - Output will be parsed programmatically:
   ```bash
   git log --format="%H %s" -n 5
   npm ls --json
   ```

**Rule of thumb:** Use token-optimizer for verbose/diagnostic output.
Skip when you need exact values for decisions.

**Note:** Falls back to original output if CLAUDIOMIRO_LOCAL_LLM not configured.

Carefully analyze the task located at: {{taskFolder}}
1. Evaluate complexity and parallelism
	•	If this task can be divided into independent and asynchronous subtasks, perform this division in a logical and cohesive manner.
	•	Each subtask should represent a clear functional unit, with a well-defined beginning and end.

## Split Decision (only if it truly helps)
- If this task is **small, straightforward, or fast to implement**, **do NOT split**. Keep it as a single unit.
- Split **only** when it enables **meaningful parallelism** or clarifies complex, interdependent work.

If you choose **NOT** to split:
- Make **no** changes to the folder structure.

## 2) When splitting is justified
  If you determine splitting is beneficial:
  - Delete the original folder:
    {{taskFolder}}

  - Create numbered subtask folders (contiguous numbering):
    - {{taskFolder}}.1
    - {{taskFolder}}.2
    - {{taskFolder}}.3
    (Create only as many as are logically necessary. Do not create empty subtasks.)

  - You MUST update all TASK.md files inside {{claudiomiroFolder}} with the new dependencies and numbering.

### Required structure for EACH subtask
  You MUST create for each subtask:
  - TASK.md   → objective, scope, and acceptance criteria
  - PROMPT.md → the precise execution prompt for this subtask
  - TODO.md   → concrete, verifiable steps to complete the subtask

Example:
  {{taskFolder}}.1
    ├─ TASK.md
    ├─ PROMPT.md
    └─ TODO.md

CRITICAL: First line of EACH TASK.md MUST be the updated dependencies list:
`@dependencies [LIST]`

CRITICAL: If you split a task: You MUST update all TASK.md files inside {{claudiomiroFolder}} with the new dependencies and numbering.

### Dependency & coherence rules
- Each subtask must be independently executable and testable.
- Avoid artificial fragmentation (don't split trivial steps).

## 4) Quality bar
- Split only if it **reduces cycle time** or **reduces cognitive load** without harming cohesion.
- Keep naming, numbering, and dependencies consistent and minimal.
