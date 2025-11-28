# Local LLM Co-Pilot with Ollama

This guide explains how to set up a local LLM as a co-pilot for Claudiomiro using Ollama.

## What is the Local LLM Co-Pilot?

The Local LLM Co-Pilot is an **optional** feature that runs a local language model alongside the main AI (Claude, Codex, etc.) to:

- **Reduce token consumption** - Offload trivial operations to the local model
- **Decrease latency** - Process well-defined tasks locally without API calls
- **Lower costs** - Handle repetitive tasks without using paid API tokens

**Important**: The local LLM does NOT replace the main AI. It acts as an auxiliary module handling specific, low-ambiguity tasks like:

- Topic classification
- Section extraction from markdown
- Completion detection
- Dependency analysis

When Ollama is unavailable, Claudiomiro automatically falls back to heuristic-based methods (regex, keyword matching) - so everything works without Ollama installed.

## Prerequisites

- Claudiomiro installed and working
- [Ollama](https://ollama.ai/) installed on your machine
- A compatible model pulled in Ollama

## Step-by-Step Setup

### 1. Install Ollama

#### macOS

```bash
brew install ollama
```

Or download from [ollama.ai](https://ollama.ai/download)

#### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Windows

Download the installer from [ollama.ai/download](https://ollama.ai/download)

### 2. Start the Ollama Server

```bash
ollama serve
```

The server runs on `http://localhost:11434` by default.

### 3. Pull a Model

Choose a model optimized for coding tasks:

```bash
# Recommended for coding (7B parameters, good balance of speed/quality)
ollama pull qwen2.5-coder:7b

# Alternative options
ollama pull codellama:7b
ollama pull deepseek-coder:6.7b
ollama pull mistral:7b
```

**Tip**: Smaller models (7B) are faster but less accurate. Larger models (13B, 34B) are more accurate but slower. For the co-pilot use case, 7B models work well since tasks are well-defined.

### 4. Verify Installation

```bash
# List available models
ollama list

# Test the model
ollama run qwen2.5-coder:7b "Hello, write a simple JavaScript function"
```

## Usage

### Enable Local LLM Co-Pilot

Set the `CLAUDIOMIRO_LOCAL_LLM` environment variable to your model name:

```bash
# Enable with qwen2.5-coder
CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b claudiomiro --prompt="Add user authentication"

# Enable with codellama
CLAUDIOMIRO_LOCAL_LLM=codellama:7b claudiomiro --prompt="Refactor database queries"

# Enable with deepseek-coder
CLAUDIOMIRO_LOCAL_LLM=deepseek-coder:6.7b claudiomiro --prompt="Fix security vulnerabilities"
```

### Persistent Configuration

**Option 1: Use the interactive config manager (recommended)**

```bash
claudiomiro --config
```

This opens an interactive menu where you can set and persist all configuration options.

**Option 2: Quick set via command line**

```bash
claudiomiro --config CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

**Option 3: Add to your shell profile**

Add to your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

Then restart your terminal or run `source ~/.zshrc`.

Configuration is stored in `claudiomiro.config.json` in the package installation directory and loaded automatically on startup.

### Disable Local LLM (Default)

The local LLM is **disabled by default**. To explicitly disable:

```bash
# Any of these disable the local LLM
unset CLAUDIOMIRO_LOCAL_LLM
CLAUDIOMIRO_LOCAL_LLM= claudiomiro ...
CLAUDIOMIRO_LOCAL_LLM=false claudiomiro ...
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDIOMIRO_LOCAL_LLM` | _(not set)_ | Model name to enable (e.g., `qwen2.5-coder:7b`). Not set = disabled. |
| `OLLAMA_HOST` | `localhost` | Ollama server hostname |
| `OLLAMA_PORT` | `11434` | Ollama server port |
| `OLLAMA_TIMEOUT` | `30000` | Request timeout in milliseconds |
| `CLAUDIOMIRO_LLM_CACHE` | `true` | Enable response caching |
| `CLAUDIOMIRO_LLM_CACHE_SIZE` | `1000` | Maximum cache entries |

### Example: Remote Ollama Server

```bash
CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b \
OLLAMA_HOST=192.168.1.100 \
OLLAMA_PORT=11434 \
claudiomiro --prompt="Add payment processing"
```

## Recommended Models

| Model | Parameters | Best For | Speed |
|-------|-----------|----------|-------|
| `qwen2.5-coder:7b` | 7B | General coding | Fast |
| `codellama:7b` | 7B | Code generation | Fast |
| `deepseek-coder:6.7b` | 6.7B | Code understanding | Fast |
| `codellama:13b` | 13B | Complex tasks | Medium |
| `qwen2.5-coder:14b` | 14B | Better accuracy | Medium |

**Note**: The co-pilot handles well-defined tasks, so smaller/faster models are usually sufficient.

## How It Works

When enabled, the local LLM handles specific tasks:

1. **Topic Classification** - Categorizes content into topics (api, database, authentication, etc.)
2. **Section Extraction** - Extracts specific sections from markdown documents
3. **Summarization** - Creates concise summaries of code/documentation
4. **Completion Detection** - Determines if a task is fully completed
5. **Dependency Analysis** - Identifies explicit and implicit task dependencies

The main AI (Claude, Codex, etc.) still handles:
- Code generation
- Complex reasoning
- Architecture decisions
- Bug fixing
- Code review

## Fallback Behavior

If Ollama is unavailable or returns an error, Claudiomiro automatically falls back to:

- **Keyword-based classification** - Uses weighted keyword matching
- **Regex section extraction** - Pattern-based markdown parsing
- **Heuristic completion detection** - String matching for completion markers
- **Regex dependency parsing** - Pattern-based dependency extraction

This means Claudiomiro works identically whether or not Ollama is running.

## Testing the Integration

Use the `--test-local-llm` command to verify your Ollama setup:

```bash
# Interactive test (will prompt for input)
CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b claudiomiro --test-local-llm

# Test with a specific prompt
CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b claudiomiro --test-local-llm --prompt="Write a hello world in JavaScript"
```

This command will:
1. Check if Ollama server is running
2. Verify the model is available
3. Send your prompt to the local LLM
4. Display the response

## Troubleshooting

### Ollama Not Found

```
Error: Connection refused
```

**Solution**: Ensure Ollama server is running:
```bash
ollama serve
```

### Model Not Found

```
Error: Model not found
```

**Solution**: Pull the model first:
```bash
ollama pull qwen2.5-coder:7b
```

### Slow Responses

**Solutions**:
1. Use a smaller model (7B instead of 13B/34B)
2. Check system resources (RAM, CPU)
3. Increase timeout:
   ```bash
   OLLAMA_TIMEOUT=60000 claudiomiro ...
   ```

### Connection to Remote Server

If connecting to a remote Ollama server:

1. Ensure the server is accessible:
   ```bash
   curl http://192.168.1.100:11434/api/tags
   ```

2. Check firewall rules allow port 11434

3. On the Ollama server, ensure it listens on all interfaces:
   ```bash
   OLLAMA_HOST=0.0.0.0 ollama serve
   ```

### Verify Local LLM Status

Check if the local LLM is active programmatically:

```javascript
const { getLocalLLMService } = require('claudiomiro/src/shared/services/local-llm');

const llm = getLocalLLMService();
await llm.initialize();

console.log(llm.getStatus());
// { initialized: true, available: true, fallbackMode: false, model: 'qwen2.5-coder:7b' }
```

## Performance Tips

1. **Keep Ollama running** - Starting the server has overhead; keep it running in the background
2. **Use caching** - Response caching is enabled by default, reducing repeated API calls
3. **Choose the right model** - 7B models offer the best speed/quality balance for co-pilot tasks
4. **Monitor memory** - 7B models need ~8GB RAM, 13B models need ~16GB RAM

## Notes

- The local LLM is completely optional - Claudiomiro works fine without it
- No data is sent externally when using the local LLM (all processing is local)
- The local LLM only handles auxiliary tasks; the main AI remains primary
- Response caching prevents redundant local model calls
