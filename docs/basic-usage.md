# Basic Usage Guide

This guide walks you through the essential steps to get started with Claudiomiro, from installation to your first automated development task.

## Table of Contents

- [Installation](#installation)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Your First Task](#your-first-task)
- [Common Workflows](#common-workflows)
- [Understanding the Output](#understanding-the-output)
- [Tips and Best Practices](#tips-and-best-practices)
- [Troubleshooting](#troubleshooting)

## Installation

### Via npm (Recommended)

```bash
npm install -g claudiomiro
```

### Verify Installation

```bash
claudiomiro --version
```

## Prerequisites

### Required

- **Node.js** 18.x or higher
- **Git** installed and configured
- **AI CLI Tool**: At least one of the following:
  - [Claude CLI](https://claude.ai/cli) (default)
  - [Codex CLI](https://openai.com)
  - [Gemini CLI](https://ai.google.dev)
  - [DeepSeek CLI](./HOW-TO-RUN-WITH-DEEPSEEK.md)
  - [GLM CLI](./HOW-TO-RUN-WITH-GLM.md)

### Recommended (for Best Results)

- **Linting**: ESLint, Pylint, or equivalent for your language
- **Unit Tests**: Jest, Pytest, or equivalent test framework
- **TypeScript** (if applicable): Configured `tsconfig.json`

Having linting and tests creates a feedback loop that allows Claudiomiro to validate and fix its own work automatically.

## Configuration

### AI Executor Setup

Claudiomiro uses Claude as the default AI executor. Ensure you have the Claude CLI installed and authenticated:

```bash
# Install Claude CLI (if not already installed)
npm install -g @anthropic-ai/claude-cli

# Authenticate
claude login
```

For other AI providers, see:
- [DeepSeek Setup](./HOW-TO-RUN-WITH-DEEPSEEK.md)
- [GLM Setup](./HOW-TO-RUN-WITH-GLM.md)

### Project Setup

No additional configuration is needed. Claudiomiro works with any project structure. Simply navigate to your project directory and run Claudiomiro.

## Your First Task

### Interactive Mode

The simplest way to start is interactive mode:

```bash
cd /path/to/your/project
claudiomiro
```

Claudiomiro will:
1. Ask for your task description
2. May ask clarification questions
3. Break down the task into subtasks
4. Execute tasks in parallel when possible
5. Review and test the code
6. Commit the changes

### Direct Prompt Mode

For quick tasks, provide the prompt directly:

```bash
claudiomiro --prompt="Add input validation to the user registration form"
```

### Example: Adding a Feature

```bash
# Navigate to your project
cd ~/projects/my-webapp

# Run Claudiomiro with a task
claudiomiro --prompt="Add a dark mode toggle to the settings page"
```

Claudiomiro will autonomously:
1. Analyze your codebase
2. Plan the implementation
3. Create the necessary components
4. Add styling
5. Review the code
6. Run tests (if available)
7. Commit with a descriptive message

## Common Workflows

### 1. Implement a New Feature

```bash
claudiomiro --prompt="Implement user authentication with JWT tokens"
```

### 2. Fix Failing Tests

When your tests are failing, let Claudiomiro fix them:

```bash
claudiomiro --fix-command="npm test"
```

This will:
- Run your test command
- If tests fail, analyze the errors
- Apply fixes automatically
- Repeat until all tests pass

### 3. Fix Linting Errors

```bash
claudiomiro --fix-command="npm run lint"
```

### 4. Security Audit

Find and fix security issues iteratively:

```bash
claudiomiro --loop-fixes --prompt="Find and fix security vulnerabilities"
```

### 5. Code Review Before PR

Get a comprehensive Staff+ level code review:

```bash
claudiomiro --fix-branch
```

### 6. Refactoring

```bash
claudiomiro --prompt="Refactor the payment processing module to use async/await"
```

### 7. Adding Tests

```bash
claudiomiro --prompt="Add unit tests for the user service module"
```

## Understanding the Output

### The .claudiomiro Folder

After running Claudiomiro, a `.claudiomiro` folder is created in your project root:

```
.claudiomiro/
├── AI_PROMPT.md                    # Generated AI instructions
├── CLARIFICATION_QUESTIONS.json    # Questions asked (if any)
├── CLARIFICATION_ANSWERS.json      # Your answers (if any)
├── CRITICAL_REVIEW_PASSED.md       # Marks successful review
├── BUGS.md                         # Any bugs found during review
├── done.txt                        # Completion marker
└── TASK1/
    ├── TASK.md                     # Task description
    ├── TODO.md                     # Implementation checklist
    ├── RESEARCH.md                 # Codebase analysis
    ├── CONTEXT.md                  # Implementation guidelines
    └── CODE_REVIEW.md              # Review results
```

### Log Files

For `--fix-command` operations:

```
.claudiomiro/
└── fix-command.log                 # Detailed execution log
```

## Tips and Best Practices

### 1. Be Specific with Prompts

```bash
# Good - Specific and clear
claudiomiro --prompt="Add email validation to the registration form using regex"

# Less effective - Too vague
claudiomiro --prompt="Fix the form"
```

### 2. Start with Small Tasks

Begin with smaller, well-defined tasks to understand how Claudiomiro works before tackling complex features.

### 3. Review Before Pushing

Use `--push=false` to review changes before they go to remote:

```bash
claudiomiro --prompt="Add caching layer" --push=false
```

### 4. Use Appropriate Limits

For complex tasks, you might want more attempts:

```bash
claudiomiro --fix-command="npm test" --limit=30
```

For quick fixes, reduce the limit:

```bash
claudiomiro --fix-command="npm run lint" --limit=5
```

### 5. Work on the Current Branch

By default, Claudiomiro creates a new branch. To work on your current branch:

```bash
claudiomiro --same-branch --prompt="Quick fix for the login bug"
```

### 6. Run Specific Steps

If you need to re-run only certain steps:

```bash
# Re-run implementation and review only
claudiomiro --steps=6,7
```

### 7. Control Parallelism

Limit concurrent tasks if you have resource constraints:

```bash
claudiomiro --maxConcurrent=2
```

## Troubleshooting

### "Claude CLI not found"

Ensure Claude CLI is installed and in your PATH:

```bash
npm install -g @anthropic-ai/claude-cli
claude --version
```

### "No changes detected"

This usually means:
- The task was already completed
- The prompt was too vague
- There were no files matching the task context

Try being more specific with your prompt.

### "Maximum attempts reached"

The task is complex or there's a persistent issue:

1. Check `.claudiomiro/` folder for logs and error details
2. Increase the limit: `--limit=50`
3. Or use `--no-limit` (use with caution)

### "Clarification questions not answered"

If Claudiomiro asked questions and you need to continue:

1. Edit `.claudiomiro/CLARIFICATION_ANSWERS.json` with your answers
2. Run: `claudiomiro --continue`

### Tests Still Failing After Fix

1. Review the `.claudiomiro/fix-command.log`
2. Check if the test framework is configured correctly
3. Try running with more verbose output in your test command

### Permission Denied Errors

Ensure you have write permissions to the project directory and Git is configured correctly:

```bash
git config user.email "your@email.com"
git config user.name "Your Name"
```

## Next Steps

- Explore [Commands Reference](./commands/README.md) for all available options
- Learn about [Task Executor](./commands/task-executor.md) in depth
- Set up [DeepSeek](./HOW-TO-RUN-WITH-DEEPSEEK.md) or [GLM](./HOW-TO-RUN-WITH-GLM.md) as alternative AI providers

## Getting Help

- [GitHub Issues](https://github.com/samuelfaj/claudiomiro/issues) - Report bugs or request features
- [GitHub Repository](https://github.com/samuelfaj/claudiomiro) - Source code and contributions
