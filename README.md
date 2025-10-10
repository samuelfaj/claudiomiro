# Claudiomiro

**Send your prompt — it decomposes, codes, reviews, builds, tests, and commits autonomously, in PARALLEL.**

With an army of AI agents, turn days of complex development into a fully automated process — without sacrificing production-grade code quality.

![Claudiomiro Terminal](https://github.com/samuelfaj/claudiomiro/blob/main/claudiomiro-terminal.png?raw=true)

**Works With:**
- ✅ `claudiomiro --claude`
- ✅ `claudiomiro --codex`
- ✅ `claudiomiro --gemini`
- ✅ `claudiomiro --deep-seek` [(how to)](./DEEPSEEK.md)

**Examples:**
- 💬 [“Implement Express.js with some basic routes and JWT.”](https://github.com/samuelfaj/claudiomiro-express-example) - Claude
- 💬 [“Create the classic Snake game entirely in JavaScript to run in the browser.”](https://github.com/samuelfaj/claudiomiro-snake-game-example) - Codex
- 💬 [“Refactor Claudiomiro to typescript.”](https://github.com/samuelfaj/claudiomiro/pull/10) - DeepSeek

------

## The Problem with Agents

Today's AI coding assistants are powerful but fundamentally **incomplete**. They give you great starting points, but then stop, leaving you to:

- 🔄 Manually type "continue" over and over
- 🧪 Run tests and fix failures yourself
- 🔍 Review code quality manually
- 📝 Manage the entire development workflow
- ⏱️ Spend hours on what should be automated

This creates a **productivity paradox**: AI tools that save time on writing code but waste time on managing the process.

------

## What is Claudiomiro?

**Claudiomiro** solves this by creating a **truly autonomous development workflow** that handles complex tasks from start to finish. It's not just another code generator — it's a complete development automation system that:

- 🧠 **Decomposes complex problems** into manageable, parallelizable tasks
- 🔄 **Loops autonomously** until everything is complete (no more "continue" prompts)
- ⚡ **Executes tasks in parallel** for maximum speed
- 🧪 **Automatically tests and fixes** failures
- 👨‍💻 **Performs code reviews** with senior-level scrutiny
- 📊 **Creates production-ready commits** with proper documentation

Unlike traditional AI assistants that stop after one response, Claudiomiro **owns the entire development lifecycle** — from analysis to deployment-ready code.

-----

### How Claudiomiro Solves the Problem

Claudiomiro eliminates the manual workflow management by combining **autonomous looping** with **parallel execution**:

**Autonomous Looping** - Instead of stopping after one response, Claudiomiro continuously:
- Analyzes what's been completed
- Identifies what's still needed
- Executes the next necessary steps
- Validates progress through tests and reviews
- Repeats until everything is production-ready

**Parallel Execution** - Claudiomiro intelligently breaks down complex tasks into independent sub-tasks that can run simultaneously, dramatically reducing completion time:

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
- High test coverage of any kind
- Integration tests for critical paths
- MCPs configured

**Why?** Linting and tests create a **feedback loop** that enables Claudiomiro to validate its work and iterate autonomously until everything is perfect.

## Installation

```bash
npm install -g claudiomiro
```

### Choose Your AI Executor

```bash
# Use any of these:
claudiomiro --claude     # or
claudiomiro --codex      # or
claudiomiro --gemini     # or
claudiomiro --deep-seek  # or
```

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
claudiomiro  --mode=hard --prompt="Create a user onboarding system with:
- Multi-step form (profile, company, preferences)
- Email verification
- Progress saving
- Mobile responsive
- Full test coverage"
```

**Large Refactoring:**
```bash
claudiomiro --mode=hard --prompt="Migrate from REST to GraphQL:
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

## Contributing

Issues and PRs welcome! Please check the [issues page](https://github.com/yourusername/claudiomiro/issues).
