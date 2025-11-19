# Claudiomiro

**Send your prompt — it decomposes, codes, reviews, builds, tests, and commits autonomously, in PARALLEL.**

With an army of AI agents, turn days of complex development into a fully automated process — without sacrificing production-grade code quality.

![Claudiomiro Terminal](https://github.com/samuelfaj/claudiomiro/blob/main/docs/claudiomiro_terminal.png?raw=true)

**Works With:**
- ✅ `claudiomiro --claude`
- ✅ `claudiomiro --codex`
- ✅ `claudiomiro --gemini`
- ✅ `claudiomiro --deep-seek` [(how to)](./docs/HOW-TO-RUN-WITH-DEEPSEEK.md)
- ✅ `claudiomiro --glm` [(how to)](./docs/HOW-TO-RUN-WITH-GLM.md)

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
Cycle 1: [Step 0-3] Planning and decomposition
         → Clarification questions → AI_PROMPT.md → Task decomposition → Execution plan (DAG)
         → EXECUTION_PLAN.md created (3 layers, max 4 parallel tasks)

Parallel Execution Started (DAG Executor):
  🚀 Running 4 tasks in parallel: TASK2, TASK3, TASK4, TASK5
  ▶️  TASK2: [Step 4-6] TODO → Research → Implement → Code Review... ✅
  ▶️  TASK3: [Step 4-6] TODO → Research → Implement → Code Review... ✅
  ▶️  TASK4: [Step 4-6] TODO → Research → Implement → Code Review... ✅
  ▶️  TASK5: [Step 4-6] TODO → Research → Implement → Code Review... ✅

  🚀 Running 1 task in parallel: TASK6 (depends on TASK2-5)
  ▶️  TASK6: [Step 4-6] Integration tests... ✅

Cycle 2: [Step 7] Global critical bug sweep
         → Analyzing ALL changes via git diff
         → Hunting for CRITICAL bugs (security, production-breaking)
         → Self-correcting in loop until 0 critical bugs found
         → CRITICAL_REVIEW_PASSED.md ✅

Cycle 3: [Step 8] Creating final commit and PR

✓ Task completed in 3 autonomous cycles (4 tasks ran in parallel)
```

No manual intervention. No "continue" prompts. Just complete, production-ready code — **now faster with parallel execution**.

### Step-by-Step Workflow

Claudiomiro executes through a refined 9-step pipeline (completely refactored in v1.9.0 following Single Responsibility Principle):

1. **Step 0** - Generate clarification questions and initial branch setup
2. **Step 1** - Generate refined AI_PROMPT.md from user answers
3. **Step 2** - Decompose task into parallelizable sub-tasks
4. **Step 3** - Analyze dependencies and create execution plan (DAG)
5. **Step 4** - Generate detailed TODO.md for each task
6. **Step 5** - Execute task (research → context → implementation)
7. **Step 6** - Senior-level code review with quality validation
8. **Step 7** - **NEW**: Global critical bug sweep across ALL changes
9. **Step 8** - Final commit and pull request creation

**What's new in Step 7?**
- Analyzes git diff of **entire branch** (not just individual tasks)
- Hunts for **CRITICAL severity bugs only** (security, data loss, production-breaking issues)
- Self-corrects in loop until **0 critical bugs remain**
- Only runs on new branches created by Claudiomiro (not --same-branch)
- Prevents shipping dangerous code to production

### Safety Mechanisms

- **Maximum 20 cycles per task** - Prevents runaway execution within each task (customize with `--limit=N` or disable with `--no-limit`)
- **Critical bug sweep** - Step 7 ensures no critical bugs ship to production
- **Progress validation** - Ensures forward progress each cycle
- **Error detection** - Stops if same error repeats
- **Branch validation** - Step 7 only runs on Claudiomiro-managed branches
- **Manual override** - Use `--push=false` to review before final commit

## Key Features

- 🔄 **Truly Autonomous**: Loops until task is 100% complete
- ⚡ **Parallel Execution**: Runs independent tasks simultaneously (2 per CPU core, max 5)
- 🧩 **Intelligent Decomposition**: Breaks complex tasks into granular, independent sub-tasks optimized for parallelism
- 📊 **Smart Dependency Analysis**: Creates execution plan with layers and critical path
- 🎯 **Dual Planning Modes**: Choose between auto (speed) or hard (maximum criticality + deep reasoning)
- 🧠 **Deep Analysis**: Understands your codebase patterns and architecture
- 👨‍💻 **Automated Code Review**: Senior-level review validates quality before testing
- 🛡️ **Global Critical Bug Sweep** (NEW v1.9.0): Final security & safety validation before shipping
- 🔧 **Command Fixing**: Automatically retries and fixes failing commands using AI
- 🧪 **Quality Enforced**: Never skips tests, always validates
- 📊 **Full Transparency**: Live logs show every decision and action
- 🏗️ **Refactored Architecture** (v1.9.0): Each step follows Single Responsibility Principle
- 🎯 **Production Ready**: Code is tested, reviewed, debugged, and ready to merge
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
claudiomiro --glm        # or
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
claudiomiro --prompt="Build REST API" --glm
claudiomiro --prompt="Implement ML pipeline" --deep-seek

# Run only specific steps
claudiomiro --steps=2,3,4  # Skip planning, only implement
claudiomiro --step=0       # Only create task decomposition

# Combine options
claudiomiro /path/to/project --prompt="Add GraphQL API" --push=false --maxConcurrent=8 --mode=hard

# Fix command execution (automatically retry and fix failing commands)
claudiomiro --glm --fix-command="npm test"
```

### Example Prompts

**Integrating frontend and backend:**
```bash
I want you to review every component inside
/project/frontend/src/app/modules/authenticated-user/pages/financial/bill
and make sure it calls the correct backend route:
   • /project/backend/src/http/routes/v1/auth/financial/bills-to-pay.ts
   • /project/backend/src/http/routes/v1/auth/financial/bills-to-receive.ts

In development, the URLs will look like this:
   • http://localhost:v1/auth/bills-to-pay/xxx
   • http://localhost:v1/auth/bills-to-receive/xxx

You must create any missing routes required by the frontend,
but all of them must stay within the /v1/auth/bills-to-pay or /v1/auth/bills-to-receive domain
and follow the RESTful pattern (GET, POST, PUT, DELETE).

You must implement controllers, routes, services, models, and anything else necessary.

You must also create unit and integration tests for all functionalities, both frontend and backend.
Tests must always use mocked data — never real data or real database connections.

Finally, create one task for each frontend file that makes a backend request.
Every single frontend functionality must be supported by the backend.
```

**Creating tons of useful tests:**
```bash
- Delete all existing tests in /project/frontend/src/app/modules/authenticated-user/pages/financial/bill (recursively).
- I want you to create a task for each component that exists in /project/src/app/modules/authenticated-user/pages/financial/bill (recursively):
    - Translate the view into Brazilian Portuguese (the code must remain in English).
    - Map out each functionality that this component performs.
    - List all possible test cases.
    - Create these tests.
        - If something isn’t working, you must fix both the frontend and the backend 
          (/project/backend/src/http/routes/v1/auth/financial/bills-to-pay.ts /project/backend/src/http/routes/v1/auth/financial/bills-to-receive.ts)
```

**Large Refactoring:**
```bash
Migrate from REST to GraphQL:
- Convert all API endpoints
- Update all frontend calls
- Maintain backward compatibility during transition
- Add comprehensive tests
```

**Bug Investigation:**
```bash
Users report intermittent data corruption.
Investigate root cause in /services/FinancialService.js
and fix with proper tests to prevent regression.
```

## Architecture & Development

Claudiomiro v1.9.0 features a completely refactored architecture following **Single Responsibility Principle**:

### Directory Structure
```
src/
├── steps/
│   ├── step0/         # Clarification questions
│   ├── step1/         # AI_PROMPT generation
│   ├── step2/         # Task decomposition
│   ├── step3/         # Dependency analysis (DAG)
│   ├── step4/         # TODO generation
│   ├── step5/         # Task execution
│   ├── step6/         # Code review
│   ├── step7/         # Global critical bug sweep (NEW)
│   └── step8/         # Final commit & PR
├── services/          # Executors (Claude, Codex, Gemini, DeepSeek, GLM)
├── utils/             # Shared utilities
└── templates/         # Output templates (TODO.md, CONTEXT.md)
```

### Key Principles
- **Each step = ONE responsibility** (no more substeps like 0.0, 0.1, 0.2)
- **Co-located tests** (test files next to source files, not in separate directories)
- **External prompts** (large prompts in `.md` files, not inline)
- **Language-agnostic** (works with JavaScript, Python, Go, Java, Rust, etc.)

### For Contributors

**Before contributing, please read:**
- 📖 [CLAUDE.md](./CLAUDE.md) - Development guide, conventions, and best practices
- 🧪 [Testing Guidelines](./CLAUDE.md#test-structure) - How to write tests
- 🏗️ [Architecture Principles](./CLAUDE.md#project-architecture) - Single Responsibility Principle
- 📝 [Code Standards](./CLAUDE.md#development-conventions) - English code, naming conventions

**Quick Start for Development:**
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# All code and tests must be in English
# All markdown files in src/steps/ must be lowercase
# Each .js file must have a corresponding .test.js file
```

## Contributing

Issues and PRs welcome! Please:
1. Read [CLAUDE.md](./CLAUDE.md) for development guidelines
2. Ensure all tests pass (`npm test`)
3. Follow Single Responsibility Principle
4. Write code and comments in English only

Check the [issues page](https://github.com/samuelfaj/claudiomiro/issues) for open tasks.
