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
8. **Step 7** - Global critical bug sweep across ALL changes
9. **Step 8** - Final commit and pull request creation

### Safety Mechanisms

- **Maximum 20 cycles per task** - Prevents runaway execution within each task (customize with `--limit=N` or disable with `--no-limit`)
- **Critical bug sweep** - Step 7 ensures no critical bugs ship to production
- **Progress validation** - Ensures forward progress each cycle
- **Error detection** - Stops if same error repeats
- **Branch validation** - Step 7 only runs on Claudiomiro-managed branches
- **Manual override** - Use `--push=false` to review before final commit

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

## Available Commands

Claudiomiro provides specialized commands for different workflows. [Full documentation →](./docs/commands/README.md)

| Command | Description |
|---------|-------------|
| `claudiomiro [folder]` | Full autonomous development (default) |
| `claudiomiro --fix-command="<cmd>"` | [Run & fix a command until it passes](./docs/commands/fix-command.md) |
| `claudiomiro --loop-fixes` | [Iterative issue detection and fixing](./docs/commands/loop-fixes.md) |
| `claudiomiro --fix-branch` | [Branch code review and fix](./docs/commands/fix-branch.md) |
| `claudiomiro --help` | [Show help and usage info](./docs/commands/help.md) |

### Quick Examples

```bash
# Fix failing tests automatically
claudiomiro --fix-command="npm test"

# Security audit with iterative fixes
claudiomiro --loop-fixes --prompt="Find and fix security vulnerabilities"

# Branch code review and fix before opening PR
claudiomiro --fix-branch
```