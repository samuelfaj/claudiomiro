const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');
const state = require('../config/state');
const { executeClaude } = require('../executors/claude-executor');
const { getLocalLLMService } = require('./local-llm');

/**
 * Collects rich context for commit messages and PR descriptions
 * Gathers information from git diff, CODE_REVIEW.md files, TASK.md files, and INITIAL_PROMPT.md
 * @param {string|null} cwd - Working directory for git operations (defaults to state.folder)
 * @returns {{changedFiles: string, diffSummary: string, codeReviews: string, taskDescriptions: string, initialPrompt: string}}
 */
const collectRichContext = (cwd = null) => {
    const workDir = cwd || state.folder;
    const claudiomiroPath = state.claudiomiroFolder;

    let changedFiles = '';
    let diffSummary = '';
    let codeReviews = '';
    let taskDescriptions = '';
    let initialPrompt = '';

    try {
        // Get changed files list
        changedFiles = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only --staged 2>/dev/null || git status --porcelain', {
            cwd: workDir,
            encoding: 'utf-8',
            maxBuffer: 100 * 1024,
        }).trim();

        // Get diff summary (stats)
        diffSummary = execSync('git diff --stat HEAD 2>/dev/null || git diff --stat --staged 2>/dev/null || echo ""', {
            cwd: workDir,
            encoding: 'utf-8',
            maxBuffer: 100 * 1024,
        }).trim();
    } catch (e) {
        // Git operations failed
    }

    // Collect CODE_REVIEW.md summaries from tasks
    if (claudiomiroPath && fs.existsSync(claudiomiroPath)) {
        try {
            const taskDirs = fs.readdirSync(claudiomiroPath).filter(d => d.startsWith('TASK'));
            const reviews = [];
            const tasks = [];

            for (const taskDir of taskDirs) {
                // Collect CODE_REVIEW.md
                const reviewPath = path.join(claudiomiroPath, taskDir, 'CODE_REVIEW.md');
                if (fs.existsSync(reviewPath)) {
                    const content = fs.readFileSync(reviewPath, 'utf-8');
                    reviews.push(`### ${taskDir}\n${content.slice(0, 1000)}`);
                }

                // Collect TASK.md descriptions
                const taskPath = path.join(claudiomiroPath, taskDir, 'TASK.md');
                if (fs.existsSync(taskPath)) {
                    const content = fs.readFileSync(taskPath, 'utf-8');
                    tasks.push(`### ${taskDir}\n${content.slice(0, 500)}`);
                }
            }

            codeReviews = reviews.join('\n\n---\n\n');
            taskDescriptions = tasks.join('\n\n');
        } catch (e) {
            // Failed to read task files
        }

        // Get initial prompt
        const initialPromptPath = path.join(claudiomiroPath, 'INITIAL_PROMPT.md');
        if (fs.existsSync(initialPromptPath)) {
            try {
                initialPrompt = fs.readFileSync(initialPromptPath, 'utf-8').slice(0, 1000);
            } catch (e) {
                // Failed to read initial prompt
            }
        }
    }

    return {
        changedFiles,
        diffSummary,
        codeReviews,
        taskDescriptions,
        initialPrompt,
    };
};

/**
 * Generates a commit message using Local LLM (if available)
 * Falls back to a generic message if LLM is not available
 * @param {string} taskDescription - Description of the task/changes
 * @param {string|null} cwd - Working directory for git operations (defaults to state.folder)
 * @returns {Promise<{title: string, body: string}|null>}
 */
const generateCommitMessageLocally = async (taskDescription, cwd = null) => {
    const workDir = cwd || state.folder;
    const llm = getLocalLLMService();
    if (!llm) return null;

    try {
        await llm.initialize();
        if (!llm.isAvailable()) return null;

        // Get git diff for context
        let diff = '';
        try {
            diff = execSync('git diff --staged --stat', {
                cwd: workDir,
                encoding: 'utf-8',
                maxBuffer: 50 * 1024, // 50KB max
            }).trim();

            // If no staged changes, get unstaged
            if (!diff) {
                diff = execSync('git diff --stat', {
                    cwd: workDir,
                    encoding: 'utf-8',
                    maxBuffer: 50 * 1024,
                }).trim();
            }
        } catch (e) {
            // Git not available or not in repo
        }

        if (!diff && !taskDescription) return null;

        const commitMessage = await llm.generateCommitMessage(
            diff || 'Various code changes',
            taskDescription || 'Implementation task',
        );

        logger.debug(`[Git] Commit message generated locally: ${commitMessage.title}`);
        return commitMessage;
    } catch (error) {
        logger.debug(`[Git] Local commit message generation failed: ${error.message}`);
        return null;
    }
};

/**
 * Attempts to commit changes directly via shell using Ollama-generated message
 * Falls back to Claude if shell commit fails
 *
 * @param {Object} options - Commit options
 * @param {string} options.taskName - Task identifier (e.g., 'TASK1')
 * @param {boolean} options.shouldPush - Whether to push changes
 * @param {boolean} options.createPR - Whether to create a pull request
 * @returns {Promise<{success: boolean, method: 'shell'|'claude', error?: string}>}
 */
const smartCommit = async (options = {}) => {
    const { taskName = null, shouldPush = false, createPR = false, cwd = null } = options;
    const workDir = cwd || state.folder;

    logger.stopSpinner();

    // Step 1: Check if there are changes to commit
    let hasChanges = false;
    try {
        const status = execSync('git status --porcelain', {
            cwd: workDir,
            encoding: 'utf-8',
        }).trim();
        hasChanges = status.length > 0;
    } catch (error) {
        logger.debug(`[Git] Could not check git status: ${error.message}`);
        // Fall through to Claude
        return await _fallbackToClaude(taskName, shouldPush, createPR, 'Git status check failed', workDir);
    }

    if (!hasChanges) {
        logger.info('📝 No changes to commit');
        return { success: true, method: 'shell', message: 'No changes to commit' };
    }

    // Step 2: Try to generate commit message with Ollama
    let taskDescription = taskName || 'Implementation task';
    if (taskName) {
        const taskMdPath = path.join(state.claudiomiroFolder, taskName, 'TASK.md');
        if (fs.existsSync(taskMdPath)) {
            taskDescription = fs.readFileSync(taskMdPath, 'utf-8').slice(0, 500);
        }
    }

    const localMessage = await generateCommitMessageLocally(taskDescription, workDir);

    if (!localMessage) {
        logger.debug('[Git] Local LLM not available, falling back to Claude');
        return await _fallbackToClaude(taskName, shouldPush, createPR, 'Local LLM not available', workDir);
    }

    // Step 3: Try to commit via shell
    try {
        // Stage all changes
        logger.info('📦 Staging changes...');
        execSync('git add .', {
            cwd: workDir,
            encoding: 'utf-8',
            stdio: 'pipe',
        });

        // Build commit message (title + body)
        let fullMessage = localMessage.title;
        if (localMessage.body && localMessage.body.trim()) {
            fullMessage += '\n\n' + localMessage.body;
        }

        // Escape quotes in message for shell
        const escapedMessage = fullMessage.replace(/"/g, '\\"');

        // Commit
        logger.info(`📝 Committing: ${localMessage.title}`);
        execSync(`git commit -m "${escapedMessage}"`, {
            cwd: workDir,
            encoding: 'utf-8',
            stdio: 'pipe',
        });

        logger.success('✅ Commit successful via shell');

        // Step 4: Push if requested
        if (shouldPush) {
            try {
                logger.info('🚀 Pushing to remote...');
                execSync('git push', {
                    cwd: workDir,
                    encoding: 'utf-8',
                    stdio: 'pipe',
                    timeout: 60000, // 60s timeout for push
                });
                logger.success('✅ Push successful');
            } catch (pushError) {
                // Push failed, but commit succeeded - try with Claude for push/PR
                logger.warning(`⚠️ Push failed: ${pushError.message}`);
                if (createPR) {
                    return await _fallbackToClaude(taskName, true, true, 'Push failed, need Claude for PR', workDir);
                }
                // Just return success for commit, push can be retried
                return { success: true, method: 'shell', message: 'Commit succeeded, push failed' };
            }
        }

        // Step 5: Create PR if requested
        if (createPR) {
            const prResult = await _tryCreatePRViaShell(workDir);
            if (prResult.success) {
                return { success: true, method: 'shell' };
            }
            // Fall back to Claude for PR creation
            logger.info('🔗 Creating PR via Claude...');
            return await _fallbackToClaude(taskName, false, true, prResult.error || 'Shell PR creation failed', workDir);
        }

        return { success: true, method: 'shell' };

    } catch (commitError) {
        // Shell commit failed - fall back to Claude
        logger.debug(`[Git] Shell commit failed: ${commitError.message}`);
        return await _fallbackToClaude(taskName, shouldPush, createPR, commitError.message, workDir);
    }
};

/**
 * Generates a PR description using Local LLM (if available)
 * Falls back to a basic description if LLM is not available
 * @param {string|null} cwd - Working directory for git operations (defaults to state.folder)
 * @returns {Promise<{title: string, body: string}|null>}
 */
const generatePRDescriptionLocally = async (cwd = null) => {
    const workDir = cwd || state.folder;
    const llm = getLocalLLMService();
    if (!llm) return null;

    try {
        await llm.initialize();
        if (!llm.isAvailable()) return null;

        // Get git info for context
        let changedFiles = '';
        let commitMessages = '';
        let summary = '';

        try {
            // Get changed files
            changedFiles = execSync('git diff --name-only HEAD~5..HEAD 2>/dev/null || git diff --name-only', {
                cwd: workDir,
                encoding: 'utf-8',
                maxBuffer: 50 * 1024,
            }).trim();

            // Get recent commit messages
            commitMessages = execSync('git log --oneline -10 2>/dev/null || echo "Various changes"', {
                cwd: workDir,
                encoding: 'utf-8',
                maxBuffer: 50 * 1024,
            }).trim();

            // Try to read CODE_REVIEW.md files for summary
            const claudiomiroPath = state.claudiomiroFolder;
            if (fs.existsSync(claudiomiroPath)) {
                const taskDirs = fs.readdirSync(claudiomiroPath).filter(d => d.startsWith('TASK'));
                const reviews = [];
                for (const taskDir of taskDirs.slice(-3)) { // Last 3 tasks
                    const reviewPath = path.join(claudiomiroPath, taskDir, 'CODE_REVIEW.md');
                    if (fs.existsSync(reviewPath)) {
                        const content = fs.readFileSync(reviewPath, 'utf-8');
                        reviews.push(content.slice(0, 500));
                    }
                }
                summary = reviews.join('\n\n---\n\n');
            }
        } catch (e) {
            // Git/file operations failed, continue with what we have
        }

        if (!changedFiles && !commitMessages && !summary) return null;

        const prDescription = await llm.generatePRDescription(
            summary || 'Implementation updates',
            changedFiles || '',
            commitMessages || '',
        );

        logger.debug(`[Git] PR description generated locally: ${prDescription.title}`);
        return prDescription;
    } catch (error) {
        logger.debug(`[Git] Local PR description generation failed: ${error.message}`);
        return null;
    }
};

/**
 * Try to create PR via shell (gh pr create) with Ollama-generated description
 * @param {string|null} cwd - Working directory for git operations (defaults to state.folder)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const _tryCreatePRViaShell = async (cwd = null) => {
    const workDir = cwd || state.folder;
    // Check if gh CLI is available
    try {
        execSync('gh --version', { cwd: workDir, stdio: 'pipe' });
    } catch (error) {
        return { success: false, error: 'GitHub CLI (gh) not installed' };
    }

    // Generate PR description with Ollama
    const prDescription = await generatePRDescriptionLocally(workDir);
    if (!prDescription) {
        return { success: false, error: 'Could not generate PR description locally' };
    }

    try {
        logger.info('🔗 Creating PR via shell...');

        // Escape quotes and special chars for shell
        const escapedTitle = prDescription.title.replace(/"/g, '\\"').replace(/`/g, '\\`');
        const escapedBody = prDescription.body.replace(/"/g, '\\"').replace(/`/g, '\\`');

        // Create PR using gh CLI
        const result = execSync(`gh pr create --title "${escapedTitle}" --body "${escapedBody}"`, {
            cwd: workDir,
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 60000,
        });

        logger.success('✅ PR created successfully via shell');
        logger.info(`📎 ${result.trim()}`);
        return { success: true };
    } catch (error) {
        logger.debug(`[Git] Shell PR creation failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Internal helper: Falls back to Claude for git operations
 * Collects rich context to generate detailed commit messages and PR descriptions
 * @param {string|null} taskName - Task identifier
 * @param {boolean} shouldPush - Whether to push changes
 * @param {boolean} createPR - Whether to create a pull request
 * @param {string} reason - Reason for fallback
 * @param {string|null} cwd - Working directory for git operations (defaults to state.folder)
 * @private
 */
const _fallbackToClaude = async (taskName, shouldPush, createPR, reason, cwd = null) => {
    logger.info(`🤖 Using Claude for git operations (${reason})`);

    // Collect rich context for detailed commit/PR
    const context = collectRichContext(cwd);

    let prompt = 'Execute the following git operations:\n\n';
    prompt += '1. git add . (stage all changes)\n';
    prompt += '2. git commit with a DETAILED commit message\n';
    if (shouldPush) prompt += '3. git push\n';
    if (createPR) prompt += `${shouldPush ? '4' : '3'}. Create a pull request with DETAILED description\n`;

    // Add rich context for better commit messages
    prompt += '\n## CONTEXT FOR COMMIT MESSAGE AND PR\n\n';

    if (context.initialPrompt) {
        prompt += `### Original Request\n${context.initialPrompt}\n\n`;
    }

    if (context.taskDescriptions) {
        prompt += `### Tasks Implemented\n${context.taskDescriptions}\n\n`;
    }

    if (context.changedFiles) {
        prompt += `### Changed Files\n\`\`\`\n${context.changedFiles}\n\`\`\`\n\n`;
    }

    if (context.diffSummary) {
        prompt += `### Diff Summary\n\`\`\`\n${context.diffSummary}\n\`\`\`\n\n`;
    }

    if (context.codeReviews) {
        prompt += `### Code Review Summaries\n${context.codeReviews}\n\n`;
    }

    // Instructions for commit message
    prompt += `## COMMIT MESSAGE REQUIREMENTS

Write a commit message that:
- Uses conventional commits format (feat:, fix:, refactor:, etc.)
- Has a clear, descriptive title (max 72 chars)
- Has a body explaining WHAT was changed and WHY
- Lists the main changes/features implemented
- Does NOT mention AI or automation

Example format:
\`\`\`
feat: implement user authentication with JWT

- Add login/logout endpoints with session management
- Implement JWT token generation and validation
- Add password hashing with bcrypt
- Create auth middleware for protected routes
- Add unit tests for auth service
\`\`\`
`;

    // Instructions for PR if needed
    if (createPR) {
        prompt += `
## PR DESCRIPTION REQUIREMENTS

Create a PR with:
- Clear title summarizing all changes
- Body with sections:
  - ## Summary (2-3 sentences explaining the PR)
  - ## Changes (bullet list of what was done)
  - ## Testing (how to test the changes)

Example format:
\`\`\`
## Summary
This PR implements the user authentication system, including login, logout, and session management using JWT tokens.

## Changes
- Added authentication endpoints (POST /login, POST /logout)
- Implemented JWT token generation with 24h expiration
- Created auth middleware for protected routes
- Added password hashing using bcrypt
- Included comprehensive unit tests

## Testing
1. Run \`npm test\` to execute unit tests
2. Test login endpoint with valid/invalid credentials
3. Verify protected routes require valid JWT
\`\`\`
`;
    }

    try {
        await commitOrFix(prompt, taskName, cwd);
        return { success: true, method: 'claude' };
    } catch (error) {
        return { success: false, method: 'claude', error: error.message };
    }
};

/**
 * Commits changes using Claude (main method)
 * Optionally tries Local LLM first for commit message generation
 * @param {string} prompt - The commit prompt
 * @param {string|null} taskName - Task identifier (e.g., 'TASK1')
 * @param {string|null} cwd - Working directory for git operations (defaults to state.folder)
 */
const commitOrFix = async (prompt, taskName = null, cwd = null) => {
    const workDir = cwd || state.folder;
    logger.stopSpinner();
    logger.info('Git committing via Claude...');

    // Try to generate commit message locally first (saves tokens)
    let localCommitHint = '';
    if (taskName) {
        const taskMdPath = path.join(state.claudiomiroFolder, taskName, 'TASK.md');
        let taskDescription = taskName;
        if (fs.existsSync(taskMdPath)) {
            taskDescription = fs.readFileSync(taskMdPath, 'utf-8').slice(0, 300);
        }

        const localMessage = await generateCommitMessageLocally(taskDescription, workDir);
        if (localMessage) {
            localCommitHint = `\n\nSUGGESTED COMMIT MESSAGE (from local analysis):\nTitle: ${localMessage.title}\nBody: ${localMessage.body}\nFeel free to use or improve this message.\n`;
        }
    }

    try {
        const shellCommandRule = fs.readFileSync(
            path.join(__dirname, '..', 'templates', 'SHELL-COMMAND-RULE.md'),
            'utf-8',
        );

        await executeClaude(
            `${prompt}${localCommitHint}\n\n` +
            'HARD RULES:\n' +
            ' - NEVER mention that you are an AI model\n' +
            ' - NEVER mention Authored or Co-Authored\n' +
            ' - NEVER mention any AI model (example: Claude, ChatGPT, GLM, Deepseek)\n' +
            ' - The Authorship must be the user and only the user\n' +
            ' - NOBODY can know that AI was used\n' +
            ' - If you need to commit, use git commit -m "message"\n' +
            ' - If you need to push, use git push\n' +
            ' - If you need to create a PR, use the available git tools (GitHub, GitLab, etc.)\n' +
            '\n\n---\n\n' +
            shellCommandRule,
            taskName,
            { cwd: workDir },
        );

        logger.newline();
        logger.newline();
        logger.separator();
        logger.success('Git commit/PR process completed');
        return true;
    } catch (e) {
        logger.warning(`⚠️  Git commit/PR process failed: ${e.message}`);
        return true;
    }
};

module.exports = { commitOrFix, collectRichContext, generateCommitMessageLocally, generatePRDescriptionLocally, smartCommit };
