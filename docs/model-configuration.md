# Model Configuration

Claudiomiro uses intelligent model selection to optimize cost and performance across different execution steps. This guide explains how model selection works and how to customize it.

## Overview

Each step in the task-executor uses an AI model appropriate for its complexity:

| Model Level | Claude Model | Use Case |
|-------------|--------------|----------|
| `fast` | Haiku | Simple tasks, low cost, fast execution |
| `medium` | Sonnet | Balanced performance and cost (default) |
| `hard` | Opus | Complex reasoning, architectural decisions |

## Default Model Assignment

Each step has an optimized default model:

| Step | Default Model | Rationale |
|------|---------------|-----------|
| Step 0 | `medium` | Clarification questions - needs codebase understanding |
| Step 1 | `hard` | AI_PROMPT generation - deep reasoning, Chain of Thought |
| Step 2 | `hard` | Task decomposition - architectural analysis |
| Step 3 | `medium` | Dependency analysis - systematic but straightforward |
| Step 4 | `medium` | execution.json + split analysis |
| Step 5 | `dynamic` | Task execution - varies by complexity |
| Step 6 | `escalation` | Code review - fast first, then hard |
| Step 7 | `escalation` | Critical bug sweep - fast first, then hard |
| Step 8 | `fast` | Final commit/PR - simple message generation |

## Dynamic Model Selection (Step 5)

Step 5 (task execution) uses **dynamic model selection** based on task complexity. The model is determined by:

### Priority Order

1. **Environment Override** - Highest priority
2. **@difficulty Tag** - Declared in BLUEPRINT.md
3. **Heuristic Fallback** - Automatic complexity analysis

### @difficulty Tag

The recommended way to control Step 5 model selection is through the `@difficulty` tag in BLUEPRINT.md:

```markdown
@dependencies [TASK0, TASK1]
@scope backend
@difficulty medium

# BLUEPRINT: TASK2
...
```

#### Valid Values

- **`@difficulty fast`** - Simple task, straightforward implementation
  - Single file changes, <100 LOC
  - Well-defined patterns exist in codebase
  - No architectural decisions needed
  - Uses Haiku model

- **`@difficulty medium`** - Moderate complexity (default)
  - Multiple files, cross-module interaction
  - Some integration points
  - Following existing patterns with minor adaptations
  - Uses Sonnet model

- **`@difficulty hard`** - Complex task, deep reasoning required
  - System-wide impact, multiple integration points
  - Architectural decisions needed
  - New patterns or significant refactoring
  - Complex business logic, edge cases
  - Uses Opus model

### Heuristic Fallback

When no `@difficulty` tag is present, Claudiomiro analyzes task complexity automatically:

**Hard complexity triggers:**
- More than 3 phases in execution.json
- More than 5 artifacts
- BLUEPRINT.md longer than 300 lines
- More than 2 previous attempts
- Uncertainties present

**Medium complexity triggers:**
- More than 1 phase
- More than 2 artifacts
- BLUEPRINT.md longer than 100 lines

**Fast complexity:**
- None of the above conditions met

## Escalation Model (Steps 6 & 7)

Steps 6 (code review) and 7 (critical bug sweep) use an **escalation strategy**:

1. **First pass**: Run with `fast` model (Haiku)
2. **If issues found**: Escalate to `hard` model (Opus) for thorough analysis
3. **Final validation**: Always uses `hard` model before completion

This approach minimizes cost while ensuring quality:
- Simple, well-implemented code passes quickly with the fast model
- Complex or problematic code gets deeper analysis with the capable model

## Environment Variable Overrides

### Global Override

Force a specific model for ALL steps:

```bash
export CLAUDIOMIRO_MODEL=fast
claudiomiro --prompt="Simple task"
```

**Note:** Global override only accepts `fast`, `medium`, or `hard`.

### Step-Specific Override

Override the model for a specific step:

```bash
# Force Step 5 to always use hard model
export CLAUDIOMIRO_STEP5_MODEL=hard

# Force Step 6 to use medium (disables escalation)
export CLAUDIOMIRO_STEP6_MODEL=medium
```

**Step-specific overrides accept:** `fast`, `medium`, `hard`, `dynamic`, `escalation`

### Override Priority

```
Global Override (CLAUDIOMIRO_MODEL)
    ↓ (if not set)
Step-Specific Override (CLAUDIOMIRO_STEP{N}_MODEL)
    ↓ (if not set)
Default Model for Step
    ↓ (if dynamic)
@difficulty Tag / Heuristics
```

## Configuration File

You can set model configuration in `.claudiomiro.config.json`:

```json
{
  "CLAUDIOMIRO_MODEL": "medium",
  "CLAUDIOMIRO_STEP5_MODEL": "dynamic",
  "CLAUDIOMIRO_STEP6_MODEL": "escalation"
}
```

Or use the interactive config manager:

```bash
claudiomiro --config CLAUDIOMIRO_STEP5_MODEL=hard
```

## Cost Optimization Tips

### 1. Let Dynamic Selection Work

The default configuration is optimized for cost-effectiveness. Trust the automatic selection unless you have specific needs.

### 2. Use @difficulty Tags

When creating tasks manually or reviewing auto-generated BLUEPRINTs, add appropriate `@difficulty` tags:

```markdown
@difficulty fast    # Simple bug fix
@difficulty medium  # Standard feature
@difficulty hard    # Architectural change
```

### 3. Start Fast, Escalate When Needed

For development and testing, you can force fast models globally:

```bash
CLAUDIOMIRO_MODEL=fast claudiomiro --prompt="Quick prototype"
```

### 4. Monitor Model Usage

Check the logs for model selection messages:

```
[Step5] Model selected: medium
[Step6] Code review with FAST model (escalation step 1)
[Step6] Fast review passed, escalating to HARD model for final validation
```

## Examples

### Force Fast Model for Simple Tasks

```bash
CLAUDIOMIRO_MODEL=fast claudiomiro --prompt="Update README"
```

### Disable Escalation for Code Review

```bash
CLAUDIOMIRO_STEP6_MODEL=medium claudiomiro
```

### Always Use Opus for Complex Project

```bash
CLAUDIOMIRO_MODEL=hard claudiomiro --prompt="Refactor authentication system"
```

### Mix of Overrides

```bash
export CLAUDIOMIRO_STEP1_MODEL=hard  # Deep analysis for prompt generation
export CLAUDIOMIRO_STEP5_MODEL=fast  # Quick execution
export CLAUDIOMIRO_STEP6_MODEL=hard  # Thorough review

claudiomiro --prompt="Add feature"
```

## Concurrency Configuration

Claudiomiro supports configurable parallel task execution for faster performance.

### Default Concurrency

By default, Claudiomiro runs **CPU cores × 2** concurrent tasks (capped at 10):

| CPU Cores | Default Concurrency |
|-----------|---------------------|
| 1-2       | 2-4 tasks           |
| 4         | 8 tasks             |
| 6+        | 10 tasks (cap)      |

### Environment Variable Override

Control maximum concurrent tasks with `CLAUDIOMIRO_CONCURRENCY`:

```bash
# Run up to 4 tasks in parallel
export CLAUDIOMIRO_CONCURRENCY=4
claudiomiro --prompt="Complex multi-task project"

# Or inline
CLAUDIOMIRO_CONCURRENCY=6 claudiomiro --prompt="Feature implementation"
```

### Configuration File

Set in `.claudiomiro.config.json`:

```json
{
  "CLAUDIOMIRO_CONCURRENCY": "8"
}
```

## File Conflict Prevention

When tasks run in parallel, Claudiomiro automatically prevents file overwrite conflicts.

### @files Tag

Tasks declare which files they modify using the `@files` tag in BLUEPRINT.md:

```markdown
@dependencies [TASK0, TASK1]
@scope backend
@difficulty medium
@files [src/models/user.js, src/models/user.test.js, src/validators/userValidator.js]

# BLUEPRINT: TASK2 - User Validation
...
```

### Automatic Conflict Resolution

When two parallel tasks declare the same files, Claudiomiro automatically adds a dependency to serialize them:

```
⚠️  FILE CONFLICTS DETECTED - Auto-resolving:
   TASK2 ↔ TASK5: src/models/user.js
   → TASK5 now depends on TASK2

✅ Conflicts resolved. Tasks will run sequentially to prevent overwrites.
```

### How It Works

1. **Detection**: Before execution, Claudiomiro scans all `@files` declarations
2. **Conflict Check**: Identifies pairs of tasks that could run in parallel but modify the same files
3. **Auto-Resolution**: Adds a dependency from the later task to the earlier one (alphabetically)
4. **Execution**: Tasks with shared files now run sequentially, preventing conflicts

### Best Practices for @files

1. **Be Specific**: List all files the task will modify, including test files
2. **Include Related Files**: If modifying a module, include its test file
3. **Granular Tasks**: Smaller tasks with fewer files maximize parallelism

```markdown
# Good: Specific file listing
@files [src/services/auth.js, src/services/auth.test.js]

# Avoid: Vague or missing file declarations
@files []  # No files declared - potential conflicts
```

## Granular Task Decomposition

To maximize parallelism and use cheaper models (Haiku), Claudiomiro decomposes tasks by responsibility layer:

### Decomposition Strategy

| Layer | Description | Example Task |
|-------|-------------|--------------|
| Model | Data structures, schemas | "Add User model with validation" |
| Validation | Input/output validation | "Add userValidator for registration" |
| Service | Business logic | "Implement createUser service" |
| Controller/API | Request handling | "Add POST /api/users endpoint" |
| Tests | Unit/integration tests | "Add tests for User registration" |

### Benefits

1. **More Parallelism**: Independent layers run simultaneously
2. **Cheaper Execution**: Simpler tasks qualify for `@difficulty fast` (Haiku)
3. **Better Isolation**: Failures don't affect unrelated layers
4. **Cleaner Code**: Clear separation of concerns

### Example Decomposition

A feature like "Add user registration" becomes:

```
TASK1: Add User model with email/password fields
  @files [src/models/user.js]
  @difficulty fast

TASK2: Add userValidator for registration
  @files [src/validators/userValidator.js]
  @difficulty fast

TASK3: Implement createUser service
  @dependencies [TASK1, TASK2]
  @files [src/services/userService.js]
  @difficulty medium

TASK4: Add POST /api/users endpoint
  @dependencies [TASK3]
  @files [src/controllers/userController.js]
  @difficulty fast

TASK5: Add User model tests
  @files [src/models/user.test.js]
  @difficulty fast

TASK6: Add userValidator tests
  @files [src/validators/userValidator.test.js]
  @difficulty fast
```

TASK1, TASK2, TASK5, and TASK6 can all run in parallel with Haiku, while TASK3 and TASK4 run sequentially using Sonnet.

## Related Documentation

- [Task Executor Command](./commands/task-executor.md) - Main command documentation
- [Basic Usage Guide](./basic-usage.md) - Getting started with Claudiomiro
