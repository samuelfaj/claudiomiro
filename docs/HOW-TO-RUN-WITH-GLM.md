# GLM Integration for Claude Code

This guide explains how to set up and use GLM models with Claude Code.

## Prerequisites

- Claude Code installed and working
- A GLM API key from Z.AI Console

## Step-by-Step Setup

### 1. Get Your GLM API Key

1. Visit Z.AI Console
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key for the next steps

### 2. Create the GLM Wrapper Script

Run the following command to create the wrapper script:

```bash
cat >/opt/homebrew/bin/glm <<'EOF'
#!/bin/bash
ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic" ANTHROPIC_AUTH_TOKEN="YOUR-GLM-API-KEY" API_TIMEOUT_MS=600000 ANTHROPIC_MODEL=GLM-4.6 ANTHROPIC_SMALL_FAST_MODEL=GLM-4.5-Air CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 claude "$@"


EOF

chmod +x /opt/homebrew/bin/glm
```

### 3. Configure Your API Key

**IMPORTANT**: Replace `YOUR-GLM-API-KEY` with your actual GLM API key in the script.

Edit the script file:

```bash
nano /opt/homebrew/bin/glm
```

Find this line:
```bash
ANTHROPIC_AUTH_TOKEN="YOUR-GLM-API-KEY" \
```

Replace `YOUR-GLM-API-KEY` with your actual API key:
```bash
ANTHROPIC_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
```

## Usage

### Basic Usage

```bash
glm
```

## Troubleshooting

### Command Not Found
If you get "command not found" after installation:

1. Ensure `/opt/homebrew/bin/` is in your PATH
2. Restart your terminal or run: `source ~/.zshrc` (or `~/.bashrc`)

### API Key Issues
- Verify your GLM API key is correct
- Check that your account has sufficient credits
- Ensure the API key is properly formatted

### Connection Issues
- Check your internet connection
- Verify the GLM API endpoint is accessible
- Check if there are any service outages on Z.AI Status

## Notes

- This wrapper uses Claude Code's infrastructure but routes requests to GLM's API
- All Claude Code features and commands work the same way
- Environment variables are set only for the execution process, not permanently