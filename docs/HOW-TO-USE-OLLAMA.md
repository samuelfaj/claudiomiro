# How to Use Ollama with Claudiomiro

Claudiomiro integrates with [Ollama](https://ollama.ai) to run local LLMs that help reduce token consumption when using cloud AI providers like Claude, GPT, or Gemini.

## Table of Contents

- [What is Ollama?](#what-is-ollama)
- [Why Use Ollama with Claudiomiro?](#why-use-ollama-with-claudiomiro)
- [Installation](#installation)
- [Configuration](#configuration)
- [Using the Token Optimizer](#using-the-token-optimizer)
- [How Token Optimization Works](#how-token-optimization-works)
- [Recommended Models](#recommended-models)
- [Testing Your Setup](#testing-your-setup)
- [Troubleshooting](#troubleshooting)

---

## What is Ollama?

Ollama is a tool that lets you run large language models (LLMs) locally on your computer. It supports various open-source models like Llama, Mistral, Qwen, and many others.

**Key benefits:**
- **Privacy**: Your data stays on your machine
- **No API costs**: Run unlimited queries without paying per token
- **Offline capable**: Works without internet connection
- **Fast**: Local inference can be faster than API calls

---

## Why Use Ollama with Claudiomiro?

Claudiomiro uses cloud AI services (Claude, GPT, Gemini) which charge based on token usage. By using Ollama locally for preprocessing tasks, you can significantly reduce the number of tokens sent to these services.

### Token Savings Examples

| Scenario | Without Ollama | With Ollama | Savings |
|----------|----------------|-------------|---------|
| Filter test output (10,000 tokens) | Send all to Claude | Send only 500 filtered tokens | ~95% |
| Build log analysis (50,000 tokens) | Full log to Claude | Only errors/warnings (2,000 tokens) | ~96% |
| Code review context | Full codebase context | Relevant files only | ~70-90% |

### What Ollama Handles in Claudiomiro

1. **Token Optimizer Command** - Filters command output before sending to cloud AI
2. **File Relevance Ranking** - Identifies relevant files for a task
3. **Context Summarization** - Compresses large files into summaries
4. **Code Pre-screening** - Initial code review before Claude analysis
5. **Error Classification** - Categorizes errors for efficient processing
6. **Completion Detection** - Checks if tasks are done without API calls

---

## Installation

### Step 1: Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [ollama.ai/download](https://ollama.ai/download)

### Step 2: Start Ollama Server

Open a terminal and run:
```bash
ollama serve
```

Keep this terminal open. Ollama runs as a local server on port 11434.

### Step 3: Pull a Model

In a **new terminal**, download a model:
```bash
# Recommended for code tasks
ollama pull qwen2.5-coder:7b

# Alternative options
ollama pull codellama:7b
ollama pull deepseek-coder:6.7b
ollama pull mistral:7b
```

### Step 4: Verify Installation

Test that Ollama is working:
```bash
ollama list
# Should show your installed models

ollama run qwen2.5-coder:7b "What is JavaScript?"
# Should return a response
```

---

## Configuration

### Enable Ollama in Claudiomiro

Set the environment variable with your model name:

**Temporary (current session):**
```bash
export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

**Permanent (add to shell profile):**
```bash
# ~/.bashrc or ~/.zshrc
export CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

**Using Claudiomiro config:**
```bash
claudiomiro --config CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
```

### Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `CLAUDIOMIRO_LOCAL_LLM` | Model name to use (required to enable) | _(disabled)_ |
| `OLLAMA_HOST` | Ollama server hostname | `localhost` |
| `OLLAMA_PORT` | Ollama server port | `11434` |
| `OLLAMA_TIMEOUT` | Request timeout in milliseconds | `30000` |
| `CLAUDIOMIRO_LLM_CACHE` | Enable response caching | `true` |
| `CLAUDIOMIRO_LLM_CACHE_TTL` | Cache time-to-live (ms) | `1800000` (30min) |

### Example Configuration File

Create or edit `~/.claudiomiro/config.json`:
```json
{
  "CLAUDIOMIRO_LOCAL_LLM": "qwen2.5-coder:7b",
  "OLLAMA_HOST": "localhost",
  "OLLAMA_PORT": 11434,
  "OLLAMA_TIMEOUT": 60000,
  "CLAUDIOMIRO_LLM_CACHE": true
}
```

---

## Using the Token Optimizer

The Token Optimizer is the primary way Claudiomiro saves tokens using Ollama.

### Basic Usage

```bash
claudiomiro --token-optimizer --command="<shell-command>" --filter="<instruction>"
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--command` | Yes | Shell command to execute |
| `--filter` | Yes | Instruction for filtering the output |
| `--verbose` | No | Show detailed progress |
| `--help` | No | Show usage information |

### Examples

**Filter test output to show only errors:**
```bash
claudiomiro --token-optimizer \
  --command="npm test" \
  --filter="return only errors and failed tests"
```

**Extract warnings from build log:**
```bash
claudiomiro --token-optimizer \
  --command="npm run build" \
  --filter="show only warnings and errors, ignore success messages"
```

**Summarize git log:**
```bash
claudiomiro --token-optimizer \
  --command="git log --oneline -50" \
  --filter="summarize the main changes by category"
```

**Debug TypeScript compilation:**
```bash
claudiomiro --token-optimizer \
  --command="npx tsc --noEmit" \
  --filter="list only the file names and line numbers with errors"
```

**Analyze test coverage:**
```bash
claudiomiro --token-optimizer \
  --command="npm run test:coverage" \
  --filter="show only files with coverage below 80%"
```

### Output Storage

Filtered outputs are saved to:
```
.claudiomiro/token-optimizer/output-<timestamp>.txt
```

This allows you to reference the filtered output later or send it to Claude.

---

## How Token Optimization Works

### The Token Problem

When you run a command like `npm test`, the output can be thousands of lines. Sending all of this to Claude:
- Costs money (Claude charges per token)
- Slows down processing
- May exceed context limits
- Includes irrelevant information

### The Solution

Claudiomiro uses Ollama (running locally, for free) to preprocess and filter the output:

```
┌─────────────────────────────────────────────────────────────┐
│                     Without Ollama                          │
│                                                             │
│  npm test output     ───────────────────►    Claude API     │
│  (10,000 tokens)                              ($$$ cost)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      With Ollama                            │
│                                                             │
│  npm test output   ────►   Ollama     ────►   Claude API    │
│  (10,000 tokens)           (FREE)             (500 tokens)  │
│                          Filters to                         │
│                          errors only                        │
└─────────────────────────────────────────────────────────────┘
```

### Processing Flow

1. **Execute Command**: Claudiomiro runs your shell command
2. **Capture Output**: stdout and stderr are captured
3. **Build Prompt**: Creates a filtering instruction for Ollama
4. **Local LLM Processing**: Ollama filters the output using your instruction
5. **Save Result**: Filtered output saved to `.claudiomiro/token-optimizer/`
6. **Display**: Shows the concise, filtered result

### Fallback Behavior

If Ollama is not available (not installed, not running, etc.), Claudiomiro gracefully falls back to returning the original output. **No features break** - you just don't get the token savings.

---

## Recommended Models

### For Code Tasks

| Model | Size | Best For |
|-------|------|----------|
| `qwen2.5-coder:7b` | ~4GB | General code tasks, excellent balance |
| `deepseek-coder:6.7b` | ~4GB | Complex code analysis |
| `codellama:7b` | ~4GB | Debugging, code explanation |

### For General Tasks

| Model | Size | Best For |
|-------|------|----------|
| `mistral:7b` | ~4GB | General text processing |
| `llama3.2:3b` | ~2GB | Lightweight tasks, faster |
| `phi3:3.8b` | ~2GB | Efficient on limited hardware |

### Hardware Recommendations

| RAM | Recommended Model |
|-----|-------------------|
| 8GB | `llama3.2:3b` or `phi3:3.8b` |
| 16GB | `qwen2.5-coder:7b` or `mistral:7b` |
| 32GB+ | Any 13B or 34B model |

**GPU Acceleration**: If you have an NVIDIA GPU with CUDA, Ollama will automatically use it for faster inference.

---

## Testing Your Setup

### Test Ollama Connection

```bash
claudiomiro --test-local-llm --prompt="What is JavaScript?"
```

Expected output:
```
Testing LocalLLM connection...
Model: qwen2.5-coder:7b
Status: Connected
Response: JavaScript is a high-level, interpreted programming language...
```

### Test Token Optimizer

```bash
# Create test output
echo "Line 1: Success
Line 2: ERROR: Something failed
Line 3: Success
Line 4: WARNING: Check this
Line 5: Success" > /tmp/test-output.txt

# Test filtering
claudiomiro --token-optimizer \
  --command="cat /tmp/test-output.txt" \
  --filter="return only ERROR and WARNING lines"
```

Expected filtered output:
```
Line 2: ERROR: Something failed
Line 4: WARNING: Check this
```

### Check Logs

Review Ollama operations in the log file:
```bash
cat .claudiomiro/log.txt | grep -i ollama
```

---

## Troubleshooting

### "Ollama not available" Error

**Problem**: Claudiomiro can't connect to Ollama

**Solutions**:
1. Make sure Ollama is running: `ollama serve`
2. Check if the port is correct: `curl http://localhost:11434/api/tags`
3. Verify the model is installed: `ollama list`
4. Check environment variable: `echo $CLAUDIOMIRO_LOCAL_LLM`

### "Model not found" Error

**Problem**: The specified model isn't installed

**Solution**:
```bash
# List installed models
ollama list

# Pull the missing model
ollama pull qwen2.5-coder:7b
```

### Slow Response Times

**Problem**: Ollama takes too long to respond

**Solutions**:
1. Use a smaller model (`llama3.2:3b` instead of `7b`)
2. Enable GPU acceleration (install CUDA drivers)
3. Increase timeout: `export OLLAMA_TIMEOUT=120000`
4. Close other memory-intensive applications

### High Memory Usage

**Problem**: System becomes slow when using Ollama

**Solutions**:
1. Use a smaller model
2. Reduce `num_predict` (max tokens) in requests
3. Stop Ollama when not in use: `pkill ollama`
4. Consider running Ollama on a remote server

### Caching Issues

**Problem**: Getting stale/repeated responses

**Solution**:
```bash
# Disable cache temporarily
export CLAUDIOMIRO_LLM_CACHE=false

# Or clear the cache
rm ~/.claudiomiro/llm-cache.json
```

### Connection Refused

**Problem**: `ECONNREFUSED` error

**Solutions**:
1. Start Ollama: `ollama serve`
2. Check if another process uses port 11434
3. Try a different port:
   ```bash
   OLLAMA_HOST=0.0.0.0 OLLAMA_PORT=11435 ollama serve
   export OLLAMA_PORT=11435
   ```

---

## Best Practices

### 1. Keep Ollama Running

For best experience, run Ollama as a background service:

**macOS (launchd):**
```bash
brew services start ollama
```

**Linux (systemd):**
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 2. Choose the Right Model

- Use **7B models** for complex analysis
- Use **3B models** for simple filtering tasks
- Consider **13B+ models** only if you have 32GB+ RAM

### 3. Write Specific Filter Instructions

**Good:**
```bash
--filter="return only lines containing ERROR or FAILED, with file paths"
```

**Bad:**
```bash
--filter="show me the important stuff"
```

### 4. Leverage Caching

Caching is enabled by default. Same queries will return instant results.

### 5. Monitor Token Savings

Compare filtered vs original output sizes to track savings:
```bash
# Original output
npm test 2>&1 | wc -c
# Example: 45000 bytes

# Filtered output
claudiomiro --token-optimizer --command="npm test" --filter="only errors" 2>&1 | wc -c
# Example: 1200 bytes (97% reduction!)
```

---

## Summary

Using Ollama with Claudiomiro provides:

1. **Significant token savings** (70-95% reduction in typical cases)
2. **Faster processing** (less data to send/receive from cloud APIs)
3. **Cost reduction** (fewer tokens = lower API bills)
4. **Privacy** (sensitive code stays local during preprocessing)
5. **Offline capability** (preprocessing works without internet)

The setup requires just three steps:
1. Install Ollama
2. Pull a model
3. Set `CLAUDIOMIRO_LOCAL_LLM` environment variable

All Ollama features are **optional** - Claudiomiro works fine without it, you just miss out on the token optimization benefits.
