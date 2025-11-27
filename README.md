# Claudiomiro

Turn days of complex development into a fully automated process — without sacrificing production-grade code quality.

**Send your prompt — it decomposes, codes, reviews, builds, tests, and commits autonomously, in PARALLEL.**
- No "continue" prompts.
- No manual intervention.
- No Bugs.
**✅ Just results!**

![Claudiomiro Terminal](https://github.com/samuelfaj/claudiomiro/blob/main/docs/claudiomiro_terminal.png?raw=true)

## The AI Poductivity Paradox

Today’s AI coding assistants are powerful, but **still fundamentally unfinished**. 

They generate promising first drafts, then hand the burden back to you — forcing manual review, debugging, and cleanup.

The result is a **productivity paradox**: tools that speed up typing but slow down everything else.

**Claudiomiro breaks this cycle**.

Give Claudiomiro a task and it will:

1. Break it into smaller, parallelizable tasks
2. Execute tasks simultaneously using AI agents
3. Review the code
4. Run tests and fix failures automatically
5. Create production-ready commits and pull request

## Documentation

- [Basic Usage Guide](./docs/basic-usage.md) - Complete guide from installation to your first task
- [Commands Reference](./docs/commands/README.md) - All available commands and options

### Examples

```bash
# Install
npm install -g claudiomiro

# Interactive mode
claudiomiro

# Basic usage with a prompt
claudiomiro --prompt="Add user authentication with JWT"

# Run in a specific directory
claudiomiro /path/to/project --prompt="Refactor payment processing"

# Fix failing tests automatically
claudiomiro --fix-command="npm test"

# Security audit with iterative fixes
claudiomiro --loop-fixes --prompt="Find and fix security vulnerabilities"

# Review and fix current branch before PR
claudiomiro --fix-branch
```

## Supported AI Models

```bash
claudiomiro --claude      # Anthropic Claude
claudiomiro --codex       # OpenAI Codex
claudiomiro --gemini      # Google Gemini
claudiomiro --deep-seek   # DeepSeek
claudiomiro --glm         # GLM
```

- [DeepSeek Setup](./docs/HOW-TO-RUN-WITH-DEEPSEEK.md)
- [GLM Setup](./docs/HOW-TO-RUN-WITH-GLM.md)

## Requirements

For best results, your project should have:
- Linting (ESLint, Pylint, etc.)
- Unit tests

These create a feedback loop that lets Claudiomiro validate and fix its own work.

## Safety

- Max 20 cycles per task (customize with `--limit=N`)
- Critical bug detection before commit
- Use `--push=false` to review before pushing