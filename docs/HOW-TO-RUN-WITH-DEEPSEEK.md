# DeepSeek Integration for Claude Code

This guide explains how to set up and use DeepSeek models with Claude Code.

## Prerequisites

- Claude Code installed and working
- A DeepSeek API key from [DeepSeek Console](https://platform.deepseek.com/)

## Step-by-Step Setup

### 1. Get Your DeepSeek API Key

1. Visit [DeepSeek Console](https://platform.deepseek.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key for the next steps

### 2. Create the DeepSeek Wrapper Script

Run the following command to create the wrapper script:

```bash
cat >/opt/homebrew/bin/deepseek <<'EOF'
#!/bin/bash
ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic" ANTHROPIC_AUTH_TOKEN="YOUR-DEEPSEEK-API-KEY" API_TIMEOUT_MS=600000 ANTHROPIC_MODEL=deepseek-chat ANTHROPIC_SMALL_FAST_MODEL=deepseek-chat CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 claude "$@"


EOF

chmod +x /opt/homebrew/bin/deepseek
```

### 3. Configure Your API Key

**IMPORTANT**: Replace `YOUR-DEEPSEEK-API-KEY` with your actual DeepSeek API key in the script.

Edit the script file:

```bash
nano /opt/homebrew/bin/deepseek
```

Find this line:
```bash
ANTHROPIC_AUTH_TOKEN="YOUR-DEEPSEEK-API-KEY" \
```

Replace `YOUR-DEEPSEEK-API-KEY` with your actual API key:
```bash
ANTHROPIC_AUTH_TOKEN="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
```

## Usage

### Basic Usage

```bash
deepseek
```

## Troubleshooting

### Command Not Found
If you get "command not found" after installation:

1. Ensure `/opt/homebrew/bin/` is in your PATH
2. Restart your terminal or run: `source ~/.zshrc` (or `~/.bashrc`)

### API Key Issues
- Verify your DeepSeek API key is correct
- Check that your account has sufficient credits
- Ensure the API key is properly formatted (starts with `sk-`)

### Connection Issues
- Check your internet connection
- Verify the DeepSeek API endpoint is accessible
- Check if there are any service outages on [DeepSeek Status](https://status.deepseek.com/)

## Notes

- This wrapper uses Claude Code's infrastructure but routes requests to DeepSeek's API
- All Claude Code features and commands work the same way
- Environment variables are set only for the execution process, not permanently