# Test Local LLM Command

The **test-local-llm** command allows you to test if the Ollama integration is working correctly. This is useful for verifying your local LLM setup before using Ollama-powered features in Claudiomiro.

## Usage

```bash
claudiomiro --test-local-llm [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--test-local-llm` | Run the local LLM test (required) |
| `--prompt="<text>"` | Prompt to send to the model (optional, interactive if not provided) |

## How It Works

1. **Check Configuration**: Verifies that `CLAUDIOMIRO_LOCAL_LLM` environment variable is set
2. **Connect to Ollama**: Attempts to connect to the Ollama server
3. **Health Check**: Verifies the server is running and the configured model is available
4. **Display Status**: Shows connection status, configured model, and available models
5. **Generate Response**: If everything is working, allows you to test with a prompt

## Prerequisites

### Install Ollama

First, install Ollama on your system:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or download from https://ollama.com
```

### Start Ollama Server

```bash
ollama serve
```

### Pull a Model

```bash
ollama pull qwen2.5-coder:7b
```

### Configure Claudiomiro

Set the environment variable:

```bash
export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

Or add to your `.claudiomiro.config.json`:

```json
{
  "CLAUDIOMIRO_LOCAL_LLM": "qwen2.5-coder:7b"
}
```

## Examples

### Basic Test (Interactive)

```bash
# Test the connection and enter a prompt interactively
claudiomiro --test-local-llm
```

### Test with Prompt

```bash
# Test with a specific prompt
claudiomiro --test-local-llm --prompt="Explain what a closure is in JavaScript"
```

### One-liner with Environment Variable

```bash
# Run test with model specified inline
CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b claudiomiro --test-local-llm
```

## Output

### Successful Connection

```
  Local LLM Test
  Test your Ollama integration

  Checking connection...

  CONNECTION STATUS

    * Ollama server: Connected
    * Model: qwen2.5-coder:7b
    * Model available: Yes

    Available models:
      -> qwen2.5-coder:7b
         llama3.2:3b
         codellama:7b

  Enter your prompt: _
```

### Connection Failed

```
  Local LLM Test
  Test your Ollama integration

  Checking connection...

  CONNECTION STATUS

    * Ollama server: Not available
    * Error: Connection failed

    Make sure Ollama is running:
      $ ollama serve
```

### Model Not Installed

```
  CONNECTION STATUS

    * Ollama server: Connected
    * Model: qwen2.5-coder:7b
    * Model available: No

  Model "qwen2.5-coder:7b" is not installed.

  Install it with:
    $ ollama pull qwen2.5-coder:7b
```

### LLM Not Enabled

```
  Local LLM is not enabled.

  To enable, set the CLAUDIOMIRO_LOCAL_LLM environment variable:
    $ CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b claudiomiro --test-local-llm

  Or set it permanently in your shell profile:
    export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

## Supported Models

Any model available in Ollama can be used. Recommended models for code tasks:

| Model | Size | Best For |
|-------|------|----------|
| `qwen2.5-coder:7b` | ~4GB | Code generation, analysis |
| `codellama:7b` | ~4GB | Code completion |
| `llama3.2:3b` | ~2GB | General tasks (faster) |
| `deepseek-coder:6.7b` | ~4GB | Code understanding |

## Troubleshooting

### "Ollama server: Not available"

1. Make sure Ollama is installed
2. Start the server: `ollama serve`
3. Check if running: `curl http://localhost:11434/api/tags`

### "Model not installed"

Pull the model first:

```bash
ollama pull qwen2.5-coder:7b
```

### "Local LLM is not enabled"

Set the environment variable:

```bash
export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

### Slow Response Times

- Small models (3B-7B) are faster but less capable
- Ensure you have enough RAM (8GB+ recommended)
- GPU acceleration significantly improves speed

## Related Commands

- [`task-executor`](./task-executor.md) - Full autonomous development workflow
- [`help`](./help.md) - Show help information

## See Also

- [Ollama Documentation](https://ollama.com/library)
- [CLAUDE.md - Local LLM Integration](../../CLAUDE.md#local-llm-ollama-integration)
