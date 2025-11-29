# Task Executor Command

The **task-executor** is the primary command of Claudiomiro. It provides autonomous AI-powered task decomposition and implementation, managing the entire development lifecycle from planning to commit.

## Usage

```bash
claudiomiro [folder] [options]
```

If no folder is specified, the current working directory is used.

## Options

| Option | Description |
|--------|-------------|
| `--executor=<name>` | AI executor to use: `claude`, `codex`, `gemini`, `deepseek`, `glm` (default: `claude`) |
| `--claude` | Shorthand for `--executor=claude` |
| `--codex` | Shorthand for `--executor=codex` |
| `--gemini` | Shorthand for `--executor=gemini` |
| `--deep-seek` | Shorthand for `--executor=deepseek` |
| `--glm` | Shorthand for `--executor=glm` |
| `--prompt="<text>"` | Provide the task prompt directly (activates `--fresh`) |
| `--fresh` | Start fresh, removing any existing `.claudiomiro` folder |
| `--continue` | Resume after answering clarification questions |
| `--same-branch` | Work on the current branch instead of creating a new one |
| `--push=false` | Skip pushing to remote repository |
| `--steps=<n,n,...>` | Run only specific steps (e.g., `--steps=4,5,6`) |
| `--step=<n>` | Alias for `--steps` |
| `--maxConcurrent=<n>` | Maximum concurrent tasks in parallel execution |
| `--limit=<n>` | Maximum attempts per task (default: 20) |
| `--no-limit` | Run without attempt limit |
| `--backend=<path>` | Backend repository path (enables multi-repo mode) |
| `--frontend=<path>` | Frontend repository path (enables multi-repo mode) |

## Execution Steps

The task-executor runs through the following steps:

### Step 0: Initial Setup
- Creates the `.claudiomiro` working folder
- Reads the user prompt (interactive or via `--prompt`)
- May ask clarification questions before proceeding
- Creates initial task structure

### Step 1: AI Prompt Generation
- Generates `AI_PROMPT.md` from user input
- Incorporates clarification answers if provided

### Step 2: Task Decomposition
- Breaks down the main task into subtasks
- Creates `TASK.md` for each subtask
- Defines dependencies between tasks

### Step 3: Dependency Analysis
- Analyzes task dependencies
- Builds the dependency graph (DAG)
- Prepares for parallel execution

### Step 4: TODO Generation
- Creates `TODO.md` for each task
- Defines specific implementation steps
- Analyzes if tasks should be split further

### Step 5: Research & Context
- Generates `RESEARCH.md` with relevant codebase analysis
- Creates `CONTEXT.md` with implementation guidelines
- Prepares AI with project-specific knowledge

### Step 6: Implementation & Review
- Implements each task according to TODO items
- Performs automated code review
- Re-analyzes failed implementations

### Step 7: Critical Bug Sweep
- Global analysis of all changes
- Identifies critical bugs across the codebase
- Creates `BUGS.md` with findings
- Loops until all critical issues are resolved

### Step 8: Finalization
- Commits all changes
- Pushes to remote (unless `--push=false`)
- Creates `done.txt` marker file

## Parallel Execution

When tasks have dependencies defined via `@dependencies` tags in `TASK.md`, Claudiomiro uses a **DAG (Directed Acyclic Graph) Executor** to run independent tasks in parallel.

```
@dependencies [TASK1, TASK2]
```

Tasks without dependencies run first, and dependent tasks wait for their dependencies to complete.

## Examples

### Basic Usage
```bash
# Run in current directory with interactive prompt
claudiomiro

# Run in a specific project folder
claudiomiro ./my-project
```

### With Direct Prompt
```bash
# Provide prompt directly (starts fresh automatically)
claudiomiro --prompt="Add user authentication with JWT"
```

### Using Different AI Executors
```bash
# Use Codex instead of Claude
claudiomiro --codex

# Use Gemini
claudiomiro --gemini
```

### Resuming After Clarification
```bash
# After answering CLARIFICATION_QUESTIONS.json
claudiomiro --continue
```

### Running Specific Steps
```bash
# Only run implementation and review steps
claudiomiro --steps=4,5,6

# Only run final commit step
claudiomiro --step=8
```

### Controlling Parallel Execution
```bash
# Limit to 2 concurrent tasks
claudiomiro --maxConcurrent=2

# Unlimited retries per task
claudiomiro --no-limit
```

## Output Structure

After execution, the `.claudiomiro` folder contains:

```
.claudiomiro/
├── AI_PROMPT.md              # Generated AI prompt
├── CLARIFICATION_QUESTIONS.json  # Questions (if any)
├── CLARIFICATION_ANSWERS.json    # User answers (if any)
├── CRITICAL_REVIEW_PASSED.md     # Created when step 7 passes
├── BUGS.md                   # Critical bugs found (step 7)
├── done.txt                  # Completion marker
├── TASK1/
│   ├── TASK.md              # Task description
│   ├── TODO.md              # Implementation checklist
│   ├── RESEARCH.md          # Codebase analysis
│   ├── CONTEXT.md           # Implementation context
│   ├── CODE_REVIEW.md       # Review results
│   └── split.txt            # Split analysis marker
├── TASK2/
│   └── ...
└── TASK3/
    └── ...
```

## Error Handling

- If a step fails, Claudiomiro logs detailed error information
- Use `--limit=<n>` to control retry attempts
- Check the `.claudiomiro` folder for detailed logs and intermediate files
- The `--continue` flag allows resuming from clarification phase

## Multi-Repository Mode

When working with separate backend and frontend codebases, use multi-repo mode:

```bash
claudiomiro --backend=./api --frontend=./web --prompt="Add user authentication"
```

### How It Works

1. **Git Detection**: Claudiomiro automatically detects if the paths are in a monorepo or separate repositories
2. **Configuration Persistence**: Settings are saved to `.claudiomiro/multi-repo.json` for `--continue` support
3. **Scope Tags**: Each task must include a `@scope` tag in its `TASK.md`:

```markdown
@scope backend
@dependencies [TASK1]

Implement JWT token generation...
```

### Scope Values

| Scope | Description |
|-------|-------------|
| `backend` | Task executes in the backend repository |
| `frontend` | Task executes in the frontend repository |
| `integration` | Task involves both repositories (e.g., API contract verification) |

### Integration Verification

In Step 7 (Critical Bug Sweep), Claudiomiro analyzes integration points between repositories:
- Endpoint URL mismatches
- Request/response payload differences
- Missing or undefined endpoints
- HTTP method inconsistencies

### Multi-Repo Output Structure

```
.claudiomiro/
├── multi-repo.json           # Multi-repo configuration
├── AI_PROMPT.md
├── TASK1/
│   ├── TASK.md              # Contains @scope backend
│   └── ...
├── TASK2/
│   ├── TASK.md              # Contains @scope frontend
│   └── ...
└── TASK3/
    ├── TASK.md              # Contains @scope integration
    └── ...
```

## Related Commands

- [`fix-command`](./fix-command.md) - Fix a failing command automatically
- [`loop-fixes`](./loop-fixes.md) - Continuous issue detection and fixing
- [`help`](./help.md) - Show help information
