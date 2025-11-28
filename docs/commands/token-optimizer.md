# Token Optimizer

The **token-optimizer** command runs a shell command and uses a local LLM (via Ollama) to filter and summarize the output. This is useful for reducing verbose command output to only the relevant information, saving tokens when passing output to AI assistants.

## Usage

```bash
claudiomiro --token-optimizer --command="<cmd>" --filter="<instruction>" [--verbose]
```

## Options

| Option | Description |
|--------|-------------|
| `--command="<cmd>"` | Shell command to execute (required) |
| `--filter="<text>"` | Instruction for filtering output (required) |
| `--verbose` | Show detailed progress logs |
| `-h, --help` | Show usage information |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDIOMIRO_LOCAL_LLM` | Local LLM model to use (e.g., `qwen2.5-coder:7b`) |
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |

## How It Works

1. **Execute Command**: Runs the specified shell command
2. **Capture Output**: Collects both stdout and stderr
3. **Filter with LLM**: Sends output to local LLM with your filter instruction
4. **Save Full Output**: Saves complete output to `.claudiomiro/token-optimizer/`
5. **Return Filtered**: Displays only the filtered/summarized result

### Fallback Behavior

If the local LLM is not available (Ollama not running or `CLAUDIOMIRO_LOCAL_LLM` not set), the command will:
- Return the original unfiltered output
- Set `fallback: true` in the result
- Display a warning when `--verbose` is enabled

## Examples

### Filter Test Output to Errors Only
```bash
claudiomiro --token-optimizer --command="npx jest" --filter="return only errors"
```

### Summarize Build Warnings
```bash
claudiomiro --token-optimizer --command="npm run build" --filter="show only warnings and errors"
```

### Summarize Test Failures
```bash
claudiomiro --token-optimizer --command="cargo test" --filter="summarize test failures" --verbose
```

### Extract Specific Information
```bash
# Get only deprecation warnings
claudiomiro --token-optimizer --command="npm install" --filter="extract deprecation warnings"

# List only failing lint rules
claudiomiro --token-optimizer --command="npm run lint" --filter="list the failing ESLint rules"

# Summarize coverage gaps
claudiomiro --token-optimizer --command="npm run test:coverage" --filter="show files with less than 80% coverage"
```

### With Verbose Output
```bash
claudiomiro --token-optimizer --command="npm test" --filter="show failing tests" --verbose
```

## Output

### Console Output

The filtered output is displayed directly to the console. With `--verbose`, you'll also see:
- `Running: <command>` - When command starts
- `Filtering output with Local LLM...` - When LLM processing begins
- `Output saved to: <path>` - Where full output was saved

### Saved Files

Full command output is saved to `.claudiomiro/token-optimizer/`:

```
.claudiomiro/
└── token-optimizer/
    └── output-2024-01-15T10-30-45-123Z.txt
```

### File Format

```markdown
# Token Optimizer Output
## Command
```
npm test
```

## Output
[full stdout + stderr content here]
```

## Setup

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull a Model

```bash
ollama pull qwen2.5-coder:7b
```

### 3. Set Environment Variable

```bash
export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

Or add to `.claudiomiro.config.json`:

```json
{
  "CLAUDIOMIRO_LOCAL_LLM": "qwen2.5-coder:7b"
}
```

### 4. Start Ollama (if not running)

```bash
ollama serve
```

## Use Cases

### Reduce Token Usage
When passing command output to Claude or other AI assistants, large outputs consume many tokens. Use token-optimizer to extract only relevant information:

```bash
# Instead of pasting 500 lines of test output
claudiomiro --token-optimizer --command="npm test" --filter="list only failing test names and their error messages"
```

### Quick Error Summary
Get a quick summary of what went wrong without reading through verbose logs:

```bash
claudiomiro --token-optimizer --command="docker-compose up" --filter="summarize any errors or warnings"
```

### CI/CD Integration
Filter CI output for specific information:

```bash
claudiomiro --token-optimizer --command="npm run ci" --filter="show only failed checks and their reasons"
```

### Log Analysis
Extract specific patterns from log files:

```bash
claudiomiro --token-optimizer --command="cat app.log" --filter="show only ERROR level messages from today"
```

## Error Handling

### Missing Arguments
```bash
$ claudiomiro --token-optimizer --command="npm test"
# Error: Missing required arguments.
# [Usage information displayed]
```

### Ollama Not Available
When Ollama is not running or configured:
- Command still executes successfully
- Original output is returned (fallback mode)
- Warning displayed with `--verbose`

### Command Failure
The exit code from the original command is preserved:
```bash
claudiomiro --token-optimizer --command="npm test" --filter="show errors"
# Exit code matches npm test exit code
```

## Best Practices

1. **Be specific in filter instructions**: Instead of "summarize", use "list the 3 most critical errors"
2. **Use verbose for debugging**: Add `--verbose` when troubleshooting LLM issues
3. **Check saved output**: The full output is always saved for reference
4. **Test filter instructions**: Try different phrasings to get optimal results

## Related Commands

- [`fix-command`](./fix-command.md) - Automatically fix failing commands
- [`test-local-llm`](./test-local-llm.md) - Test Ollama integration
- [`help`](./help.md) - Show help information
