# Claudiomiro Commands

Claudiomiro provides several commands for different automation workflows.

## Available Commands

| Command | Description |
|---------|-------------|
| [task-executor](./task-executor.md) | Autonomous AI-powered task decomposition and implementation |
| [fix-command](./fix-command.md) | Run a command repeatedly until it succeeds |
| [loop-fixes](./loop-fixes.md) | Continuous issue detection and fixing loop |
| [fix-branch](./fix-branch.md) | Staff+ Engineer code review before PR |
| [token-optimizer](./token-optimizer.md) | Filter command output with local LLM to reduce tokens |
| [test-local-llm](./test-local-llm.md) | Test Ollama integration for local LLM features |
| [help](./help.md) | Display help information and version |

## Quick Reference

### Task Executor (Default)
```bash
claudiomiro [folder] [options]
```
Full development automation from planning to commit.

### Fix Command
```bash
claudiomiro --fix-command="npm test" [options]
```
Automatically fix failing commands (tests, builds, linting).

### Loop Fixes
```bash
claudiomiro --loop-fixes --prompt="<prompt>" [options]
```
Iteratively find and fix issues based on a custom prompt.

### Fix Branch
```bash
claudiomiro --fix-branch [options]
```
Comprehensive Staff+ code review of your branch before opening a PR.

### Token Optimizer
```bash
claudiomiro --token-optimizer --command="<cmd>" --filter="<instruction>"
```
Filter command output using local LLM to reduce token usage.

### Test Local LLM
```bash
claudiomiro --test-local-llm [--prompt="<prompt>"]
```
Test if Ollama integration is working correctly.

### Help
```bash
claudiomiro --help
claudiomiro --version
```
Show usage information or version.

## Common Options

These options work across multiple commands:

| Option | Description |
|--------|-------------|
| `--limit=<n>` | Maximum attempts/iterations |
| `--no-limit` | Remove attempt limit |
| `--verbose` | Show detailed progress logs |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Choosing the Right Command

### Use `task-executor` when:
- Starting a new feature from scratch
- Need complete automation (planning → implementation → commit)
- Working on complex, multi-step tasks
- Want AI to decompose and parallelize work

### Use `fix-command` when:
- You have a failing test suite
- Build is broken and needs fixing
- Linting errors need to be resolved
- Any repeatable command needs to pass

### Use `loop-fixes` when:
- Need to audit code for specific issues
- Want to improve code quality iteratively
- Adding documentation or tests throughout codebase
- Performing security audits or refactoring

### Use `fix-branch` when:
- About to open a Pull Request
- Need comprehensive code review before merge
- Want to catch blockers, warnings, and suggestions
- Ensuring branch meets quality standards

### Use `token-optimizer` when:
- Command output is too verbose to paste to AI assistants
- You need to extract specific information from command output
- Reducing token usage when sharing logs or test results
- Quick summarization of errors, warnings, or specific patterns

### Use `test-local-llm` when:
- Setting up Ollama for the first time
- Verifying local LLM integration is working
- Debugging connection issues with Ollama
- Testing different local models

## See Also

- [Main README](../../README.md) - Project overview
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
