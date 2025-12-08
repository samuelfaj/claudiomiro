# Claudiomiro Documentation

Welcome to the Claudiomiro documentation. This folder contains detailed guides for using and developing Claudiomiro.

## Contents

### Getting Started

- [Basic Usage Guide](./basic-usage.md) - Complete guide from installation to your first task

### Commands

Detailed documentation for each Claudiomiro command:

- [Commands Overview](./commands/README.md) - Quick reference for all commands
- [Task Executor](./commands/task-executor.md) - Main autonomous development command
- [Fix Command](./commands/fix-command.md) - Automatic command fixing
- [Loop Fixes](./commands/loop-fixes.md) - Iterative issue detection and fixing
- [Help](./commands/help.md) - Help and version information

### Advanced Features

- [Model Configuration](./model-configuration.md) - AI model selection and cost optimization
- [Multi-Repository Mode](./multi-repository-mode.md) - Working with backend + frontend codebases
- [Local LLM Setup](./HOW-TO-RUN-WITH-LOCAL-LLM.md) - Using Ollama for token optimization

### AI Executors

Guides for using different AI providers:

- [DeepSeek Setup](./HOW-TO-RUN-WITH-DEEPSEEK.md) - Using DeepSeek as executor
- [GLM Setup](./HOW-TO-RUN-WITH-GLM.md) - Using GLM as executor

## Quick Start

### Installation

```bash
npm install -g claudiomiro
```

### Basic Usage

```bash
# Run task executor (default command)
claudiomiro

# Fix failing tests
claudiomiro --fix-command="npm test"

# Loop fixes with custom prompt
claudiomiro --loop-fixes --prompt="Fix security issues"

# Multi-repository mode (backend + frontend)
claudiomiro --backend=./api --frontend=./web --prompt="Add user authentication"

# Show help
claudiomiro --help
```

## Development

For development guidelines, see:

- [CLAUDE.md](../CLAUDE.md) - Main development guide
- [Commands CLAUDE.md](../src/commands/CLAUDE.md) - Guide for adding/editing commands

## Support

- [GitHub Issues](https://github.com/samuelfaj/claudiomiro/issues) - Report bugs or request features
- [GitHub Repository](https://github.com/samuelfaj/claudiomiro) - Source code
