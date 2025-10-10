# Claudiomiro

![Claudiomiro](https://github.com/samuelfaj/claudiomiro/blob/main/claudiomiro.png?raw=true)


**Send your prompt — get a fully planned, executed, reviewed, tested and committed task.**

Turn days of complex development into a fully automated process — without sacrificing production-grade code quality.

**Works With:**
- ✅ `claudiomiro --claude`
- ✅ `claudiomiro --codex`
- ✅ `claudiomiro --gemini`
- ✅ `claudiomiro --deep-seek` [(how to)](./DEEPSEEK.md)

**Examples:**
- 💬 [“Implement Express.js with some basic routes and JWT.”](https://github.com/samuelfaj/claudiomiro-express-example) - Claude
- 💬 [“Create the classic Snake game entirely in JavaScript to run in the browser.”](https://github.com/samuelfaj/claudiomiro-snake-game-example) - Codex
- 💬 [“Implement support for Claudiomiro to use the Gemini CLI.”](https://github.com/samuelfaj/claudiomiro/pull/8) - DeepSeek

------

## The Problem with Agents

When using Claude Code / Cursor / Codex for complex tasks, you've probably noticed it **stops before completing the job**. The result? You find yourself typing "continue", testing, reviewing, over and over again, managing all the workflow manually.

------

## What is Claudiomiro?

**Claudiomiro** is a Node.js CLI that wraps Claude AI or OpenAI Codex in a structured, **autonomous workflow** with **parallel task execution**. Unlike simple code generators, Claudiomiro:

- ✅ Thinks through complex problems
- ✅ Analyzes your entire codebase
- ✅ Identifies patterns and best practices
- ✅ **Maximizes parallelism** - executes independent tasks simultaneously
- ✅ Implements comprehensive solutions
- ✅ **Runs autonomously until completion** (up to 20 cycles per task)

-----

### The Magic: Autonomous Looping + Parallel Execution

Claudiomiro doesn't just run once. It **loops autonomously** until the entire task is complete, and **executes independent tasks in parallel** to maximize speed:

```
Cycle 1: [Step 0] Decomposing complex task into 5 parallelizable sub-tasks
Cycle 2: [Step 1] Analyzing dependencies and creating execution plan
         → EXECUTION_PLAN.md created (3 layers, max 4 parallel tasks)

Parallel Execution Started (DAG Executor):
  🚀 Running 4 tasks in parallel: TASK2, TASK3, TASK4, TASK5
  ▶️  TASK2: Research → Implement → Code Review → Tests... ✅
  ▶️  TASK3: Research → Implement → Code Review → Tests... ✅
  ▶️  TASK4: Research → Implement → Code Review → Tests... ✅
  ▶️  TASK5: Research → Implement → Code Review → Tests... ✅

  🚀 Running 1 task in parallel: TASK6 (depends on TASK2-5)
  ▶️  TASK6: Integration tests... ✅

Cycle 3: [Step 5] Creating commit and pushing

✓ Task completed in 3 autonomous cycles (4 tasks ran in parallel)
```

No manual intervention. No "continue" prompts. Just complete, production-ready code — **now faster with parallel execution**.

### Safety Mechanisms

- **Maximum 20 cycles per task** - Prevents runaway execution within each task (customize with `--limit=N` or disable with `--no-limit`)
- **Progress validation** - Ensures forward progress each cycle
- **Error detection** - Stops if same error repeats
- **Manual override** - Use `--push=false` to review before final commit

## Key Features

- 🔄 **Truly Autonomous**: Loops until task is 100% complete
- ⚡ **Parallel Execution**: Runs independent tasks simultaneously (2 per CPU core, max 5)
- 🧩 **Intelligent Decomposition**: Breaks complex tasks into granular, independent sub-tasks optimized for parallelism
- 📊 **Smart Dependency Analysis**: Creates execution plan with layers and critical path
- 🎯 **Dual Planning Modes**: Choose between auto (speed) or hard (maximum criticality + deep reasoning)
- 🧠 **Deep Analysis**: Understands your codebase patterns and architecture
- 👨‍💻 **Automated Code Review**: Senior-level review validates quality before testing
- 🧪 **Quality Enforced**: Never skips tests, always validates
- 📊 **Full Transparency**: Live logs show every decision and action
- 🎯 **Production Ready**: Code is tested, reviewed, documented, and ready to merge
- ⚡ **Massive Time Savings**: 95-98% reduction in development time

## Prerequisites for Optimal Performance

For best results, your project should have:

**Minimum:**
- Basic linting (ESLint, Pylint, etc.)
- Some unit tests for core functionality

**Optimal:**
- Comprehensive linting with strict rules
- High test coverage (>80%)
- Integration tests for critical paths
- MCPs configured (gives Claude/Codex superpowers)

**Why?** Linting and tests create a **feedback loop** that enables Claudiomiro to validate its work and iterate autonomously until everything is perfect.

## Installation

```bash
npm install -g claudiomiro
```

## Quick Start

```bash
# Run with a complex task
claudiomiro --prompt="Your complex task description here"

# Or run interactively
claudiomiro
```

That's it! Claudiomiro will autonomously handle the rest.

### Selecting the Executor

- Claude CLI remains the default executor; pass `--claude` to force it explicitly.
- To run the workflow with OpenAI Codex, install the Codex CLI and add `--codex` to your command.
- Both executors share the same prompts and parallel workflow. Pick the one that best matches your environment or credential setup.

## Usage Examples

### Basic Usage
```bash
# Run in current directory with a task
claudiomiro --prompt="Add user authentication with JWT"

# Run in specific directory
claudiomiro /path/to/project --prompt="Refactor payment processing"

# Interactive mode (prompts you for task description)
claudiomiro
```

### Advanced Options
```bash
# Review changes before pushing (recommended for first use)
claudiomiro --prompt="Implement dark mode" --push=false

# Work on current branch (no new branch created)
claudiomiro --prompt="Fix login bug" --same-branch

# Start fresh (removes all generated files)
claudiomiro --fresh

# Change cycle limit per task (default: 20)
claudiomiro --prompt="Complex refactoring" --limit=50

# Remove cycle limit per task (use with caution)
claudiomiro --prompt="Very complex task" --no-limit

# Control parallel execution (default: 2 per core, max 5)
claudiomiro --prompt="Build microservices" --maxConcurrent=10

# Task planning mode (auto or hard)
claudiomiro --prompt="Build REST API" --mode=hard  # Maximum criticality + reasoning
claudiomiro --prompt="Add feature" --mode=auto     # Default: parallelism-focused

# Choose AI executor (default: Claude)
claudiomiro --prompt="Migrate to microfrontends" --codex
claudiomiro --prompt="Run security audit" --claude

# Run only specific steps
claudiomiro --steps=2,3,4  # Skip planning, only implement
claudiomiro --step=0       # Only create task decomposition

# Combine options
claudiomiro /path/to/project --prompt="Add GraphQL API" --push=false --maxConcurrent=8 --mode=hard
```

### Example Prompts

**Eliminating Duplication:**
```bash
claudiomiro --prompt="These files are nearly identical:
/src/modules/bills-to-pay-form
/src/modules/bills-to-receive-form
Unify them into shared components to eliminate duplication."
```

**Feature Implementation:**
```bash
claudiomiro --prompt="Create a user onboarding system with:
- Multi-step form (profile, company, preferences)
- Email verification
- Progress saving
- Mobile responsive
- Full test coverage"
```

**Large Refactoring:**
```bash
claudiomiro --prompt="Migrate from REST to GraphQL:
- Convert all API endpoints
- Update all frontend calls
- Maintain backward compatibility during transition
- Add comprehensive tests"
```

**Bug Investigation:**
```bash
claudiomiro --prompt="Users report intermittent data corruption.
Investigate root cause in /services/FinancialService.js
and fix with proper tests to prevent regression."
```


## Generated Files

Claudiomiro creates a `.claudiomiro/` folder to organize tasks and track progress:

```
.claudiomiro/
├── EXECUTION_PLAN.md        # Parallel execution strategy with dependency graph
├── TASK1/
│   ├── TASK.md              # Self-contained task with dependencies (Depends on: NONE)
│   ├── PROMPT.md            # Enhanced description with parallelization notes
│   ├── TODO.md              # Detailed breakdown (`Fully implemented: YES/NO`)
│   └── CODE_REVIEW.md       # Automated code review report
├── TASK2/
│   ├── TASK.md              # Dependencies: TASK1 | Parallel with: TASK3, TASK4
│   └── ...
├── TASK3/
│   └── ...
└── log.txt                  # Complete execution log with timestamps
```

**Key Files:**
- **EXECUTION_PLAN.md**: Visual map showing execution layers, dependency graph, critical path, and parallelism ratio
- **TASK.md**: Each task is fully self-contained with explicit dependencies (or NONE for parallel tasks)
- **PROMPT.md**: Includes parallelization notes (layer, parallel siblings, complexity)
- **TODO.md**: Tracks implementation status; must begin with `Fully implemented: YES/NO`
- **CODE_REVIEW.md**: Approval status for the task; Claudiomiro waits for an approved review before considering a task done

**Tip:** Review `EXECUTION_PLAN.md` early to validate the parallel execution strategy. Use `--fresh` to start over.

## Planning Modes

Claudiomiro offers two planning modes to balance speed vs. criticality:

### **Auto Mode (Default)** — Optimized for Speed
```bash
claudiomiro --prompt="Add new feature" --mode=auto
```

**Best for:**
- Standard features and refactorings
- Projects with good existing test coverage
- Quick iterations and prototyping

**Characteristics:**
- ⚡ Maximum parallelization focus
- 📋 Standard task decomposition
- ✅ Essential acceptance criteria (3-5 items)
- 🎯 Streamlined execution

### **Hard Mode** — Maximum Criticality
```bash
claudiomiro --prompt="Build payment system" --mode=hard
```

**Best for:**
- Critical systems (payments, auth, security)
- Complex business logic
- Projects requiring extensive documentation
- Mission-critical features

**Characteristics:**
- 🧠 **Deep reasoning traces** for every decision
- 📝 **Explicit assumptions** documented per task
- 🔬 **Research summaries** with edge cases
- ✅ **Rigorous acceptance criteria** (5-10 items per task)
- 🔄 **Self-verification logic** for each task
- 🚨 **Escalation protocols** for blockers
- 📊 **Dependency reasoning** with risk analysis
- ⚡ **Maintains full parallelization** from auto mode

**Example Hard Mode Output:**

Each task includes:
```markdown
## Assumptions
- Database uses PostgreSQL 14+
- Payment provider is Stripe API v2023-10-16
- User sessions last 24 hours

## Reasoning Trace
- Why this approach? Separates payment intent from confirmation for better error handling
- What alternatives were rejected? Direct charge API (no retry mechanism)
- What risks exist? Race conditions on concurrent payments → mitigated with idempotency keys

## Acceptance Criteria (Rigorous)
- [ ] Payment intent created with idempotency key
- [ ] Webhook signature verified using Stripe SDK
- [ ] Failed payments logged with full context
- [ ] Retry mechanism implemented with exponential backoff
- [ ] All error cases have specific handling
- [ ] Database transaction rollback on payment failure
- [ ] Unit tests cover 95%+ of payment logic
- [ ] Integration tests mock Stripe API calls
- [ ] Load tested with 100 concurrent payments
- [ ] Security audit passes (no secrets in logs)
```

**When to use Hard Mode:**
- 💰 Financial/payment systems
- 🔐 Authentication/authorization
- 📊 Critical business logic
- 🏥 Healthcare/compliance-heavy domains
- ⚠️ Any feature where errors = major issues

## Requirements

- **Node.js** (v14+)
- **Git repository** (initialized with at least one commit)
- **Claude CLI** installed and configured ([Setup Guide](https://docs.anthropic.com/claude/docs)) or 
- **Codex CLI** installed and authenticated (only if you plan to use `--codex`, see [Codex exec docs](https://github.com/openai/codex/blob/main/docs/exec.md))

## What Makes This Different?

Traditional AI assistants:
- ❌ Stop after one response
- ❌ Handle one monolithic task
- ❌ No code quality validation
- ❌ You manually run tests
- ❌ You manually fix failures
- ❌ You create commits/PRs
- ❌ No structured approach

**Claudiomiro:**
- ✅ Runs autonomously until complete (up to 20 cycles per task)
- ✅ Decomposes complex tasks with parallelism optimization
- ✅ Executes independent tasks simultaneously (DAG executor)
- ✅ Smart dependency analysis and execution planning
- ✅ Built-in senior-level code review
- ✅ Automatically runs tests
- ✅ Automatically fixes test failures
- ✅ Creates commits and PRs
- ✅ Structured 6-step workflow with quality gates
- ✅ Production-ready output — faster with parallel execution

## Contributing

Issues and PRs welcome! Please check the [issues page](https://github.com/yourusername/claudiomiro/issues).

## TypeScript Migration

This project has been configured for gradual TypeScript migration. The current setup supports:

### Current Configuration
- **TypeScript** with strict mode enabled
- **ESLint** with TypeScript support
- **Jest** configured for TypeScript testing
- **Build scripts** for TypeScript compilation

### Migration Strategy
1. **Incremental Migration**: Existing `.js` files can be gradually converted to `.ts`
2. **Type Safety**: Strict TypeScript configuration ensures type safety
3. **Mixed Codebase**: Both `.js` and `.ts` files can coexist during migration

### Available Commands
```bash
# Build TypeScript
npm run build

# Type checking only
npm run typecheck

# Lint TypeScript/JavaScript
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Next Steps for Migration
1. Convert individual `.js` files to `.ts` incrementally
2. Run `npm run typecheck` to identify type issues
3. Use `npm run lint` to maintain code quality
4. Update tests to work with TypeScript

## License

ISC
