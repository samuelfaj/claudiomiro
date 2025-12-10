const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const state = require('../../../../shared/config/state');
const logger = require('../../../../shared/utils/logger');
const { smartCommit, collectRichContext } = require('../../../../shared/services/git-commit');

/**
 * Step 8: Final Commit and Pull Request
 *
 * Finalizes the entire workflow by:
 * 1. Generating a summary from all task CODE_REVIEW.md files
 * 2. Creating a final commit with all changes (using Ollama for message, shell for git)
 * 3. Creating a pull request (if shouldPush is true, falls back to Claude for PR)
 * 4. Ensuring no traces of automation are visible in commits or PRs
 *
 * Token optimization: Uses shell + Ollama for commits, only falls back to Claude on errors or for PR creation.
 *
 * Multi-repo support:
 * - Single-repo / Monorepo: Uses smartCommit with createPR: true (existing behavior)
 * - Separate git mode: Creates independent PRs in each repo with cross-references
 */

/**
 * Generates a detailed PR description based on collected context
 * @param {string} featureName - Name/description of the feature
 * @param {string} repoType - Type of repo ('Backend', 'Frontend', or null for single repo)
 * @param {string} cwd - Working directory
 * @returns {{title: string, body: string}}
 */
const generateDetailedPRDescription = (featureName, repoType = null, cwd = null) => {
    const context = collectRichContext(cwd);
    const repoLabel = repoType ? ` (${repoType})` : '';

    // Generate title
    let title = `feat: ${featureName}${repoLabel}`;
    if (title.length > 72) {
        title = title.substring(0, 69) + '...';
    }

    // Build PR body
    let body = '## Summary\n\n';

    if (context.initialPrompt) {
        body += `${context.initialPrompt.split('\n')[0]}\n\n`;
    } else {
        body += `Implementation of ${featureName}${repoLabel}.\n\n`;
    }

    // Add changes section
    body += '## Changes\n\n';

    if (context.taskDescriptions) {
        // Extract task summaries
        const taskLines = context.taskDescriptions.split('\n')
            .filter(line => line.trim() && !line.startsWith('###'))
            .slice(0, 10)
            .map(line => `- ${line.trim().replace(/^[-*]\s*/, '')}`);
        if (taskLines.length > 0) {
            body += taskLines.join('\n') + '\n\n';
        }
    } else if (context.changedFiles) {
        // Fallback to changed files
        const files = context.changedFiles.split('\n').slice(0, 10);
        body += files.map(f => `- Modified: \`${f.trim()}\``).join('\n') + '\n\n';
    }

    // Add diff summary if available
    if (context.diffSummary) {
        body += '## Diff Summary\n\n';
        body += '```\n' + context.diffSummary.slice(0, 500) + '\n```\n\n';
    }

    // Add code review highlights if available
    if (context.codeReviews) {
        body += '## Code Review Notes\n\n';
        // Extract key points from reviews
        const reviewHighlights = context.codeReviews
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('###') && !line.startsWith('---'))
            .slice(0, 5)
            .map(line => `- ${line.trim().replace(/^[-*]\s*/, '')}`);
        if (reviewHighlights.length > 0) {
            body += reviewHighlights.join('\n') + '\n\n';
        }
    }

    // Add testing section
    body += '## Testing\n\n';
    body += '- [ ] Automated tests pass\n';
    body += '- [ ] Manual testing completed\n';
    body += '- [ ] Code review approved\n';

    return { title, body };
};

/**
 * Creates a pull request using gh CLI
 * @param {string} cwd - Working directory for the git operation
 * @param {string} title - PR title
 * @param {string} body - PR body/description
 * @returns {string|null} PR URL or null on failure
 */
const createPullRequest = (cwd, title, body) => {
    try {
        // Use heredoc pattern for safe shell escaping
        const command = `gh pr create --title "$(cat <<'TITLE_EOF'
${title}
TITLE_EOF
)" --body "$(cat <<'BODY_EOF'
${body}
BODY_EOF
)"`;

        const result = execSync(command, {
            cwd,
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 60000,
        });

        // Extract PR URL from output (last non-empty line)
        const lines = result.trim().split('\n');
        const prUrl = lines[lines.length - 1].trim();
        return prUrl;
    } catch (error) {
        logger.warning(`Failed to create PR in ${cwd}: ${error.message}`);
        return null;
    }
};

/**
 * Updates a PR body with the given content
 * @param {string} cwd - Working directory for the git operation
 * @param {string} body - New PR body
 * @returns {boolean} True if update succeeded
 */
const updatePrBody = (cwd, body) => {
    try {
        const updateCommand = `gh pr edit --body "$(cat <<'BODY_EOF'
${body}
BODY_EOF
)"`;

        execSync(updateCommand, {
            cwd,
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 30000,
        });
        return true;
    } catch (error) {
        logger.warning(`Failed to update PR in ${cwd}: ${error.message}`);
        return false;
    }
};

/**
 * Creates pull requests for multi-repo setup with cross-references
 * Creates both PRs first, then updates with cross-references to avoid race conditions
 * @param {string} featureName - Name of the feature for PR titles
 * @returns {Promise<void>}
 */
const createMultiRepoPullRequests = async (featureName) => {
    const backendCwd = state.getRepository('backend');
    const frontendCwd = state.getRepository('frontend');

    const safeName = featureName || 'Multi-repo changes';

    // Generate detailed descriptions for both repos
    const backendPR = generateDetailedPRDescription(safeName, 'Backend', backendCwd);
    const frontendPR = generateDetailedPRDescription(safeName, 'Frontend', frontendCwd);

    // Create both PRs first without cross-references
    logger.info('Creating backend PR...');
    const backendPrUrl = createPullRequest(
        backendCwd,
        backendPR.title,
        backendPR.body,
    );

    if (backendPrUrl) {
        logger.info(`Created backend PR: ${backendPrUrl}`);
    }

    logger.info('Creating frontend PR...');
    const frontendPrUrl = createPullRequest(
        frontendCwd,
        frontendPR.title,
        frontendPR.body,
    );

    if (frontendPrUrl) {
        logger.info(`Created frontend PR: ${frontendPrUrl}`);
    }

    // Now update both PRs with cross-references
    if (backendPrUrl && frontendPrUrl) {
        // Update backend PR with frontend link
        logger.info('Updating PRs with cross-references...');
        updatePrBody(backendCwd, `${backendPR.body}
## Related PRs

- Frontend PR: ${frontendPrUrl}`);

        // Update frontend PR with backend link
        updatePrBody(frontendCwd, `${frontendPR.body}
## Related PRs

- Backend PR: ${backendPrUrl}`);

        logger.info('PRs updated with cross-references');
    } else if (backendPrUrl && !frontendPrUrl) {
        // Frontend PR failed - update backend to reflect this
        logger.warning('Frontend PR creation failed, updating backend PR...');
        updatePrBody(backendCwd, `${backendPR.body}
## Related PRs

- Frontend PR: ⚠️ Failed to create`);
    } else if (!backendPrUrl && frontendPrUrl) {
        // Backend PR failed - update frontend to reflect this
        logger.warning('Backend PR creation failed, updating frontend PR...');
        updatePrBody(frontendCwd, `${frontendPR.body}
## Related PRs

- Backend PR: ⚠️ Failed to create`);
    }
};

const step8 = async (tasks, shouldPush = true) => {
    try {
        // Use workspace-scoped paths that don't change during multi-repo execution
        const workspaceFolder = state.workspaceClaudiomiroFolder;
        const workspaceRoot = state.workspaceRoot;

        // Check if we're in multi-repo mode
        const isMultiRepo = state.isMultiRepo();
        const gitMode = state.getGitMode();

        if (isMultiRepo && shouldPush) {
            // Get repository paths
            const backendCwd = state.getRepository('backend');
            const frontendCwd = state.getRepository('frontend');

            if (!backendCwd || !frontendCwd) {
                throw new Error('Multi-repo mode requires both backend and frontend repositories configured');
            }

            if (gitMode === 'separate') {
                // Separate git repos: commit and create PRs in each repo independently
                logger.info('📦 Multi-repo (separate git) mode: creating commits and PRs for each repository');

                // Commit in backend repo
                await smartCommit({
                    taskName: null,
                    shouldPush: true,
                    createPR: false, // We'll create PRs separately with cross-references
                    cwd: backendCwd,
                });
                logger.info('📦 Backend commit complete');

                // Commit in frontend repo
                await smartCommit({
                    taskName: null,
                    shouldPush: true,
                    createPR: false,
                    cwd: frontendCwd,
                });
                logger.info('📦 Frontend commit complete');

                // Extract feature name from INITIAL_PROMPT.md for meaningful PR titles
                const initialPromptPath = path.join(workspaceFolder, 'INITIAL_PROMPT.md');
                let featureName = 'Multi-repo changes';
                if (fs.existsSync(initialPromptPath)) {
                    const content = fs.readFileSync(initialPromptPath, 'utf-8').trim();
                    // Take first line or first 80 chars as feature name
                    const firstLine = content.split('\n')[0].trim();
                    featureName = firstLine.substring(0, 80) || featureName;
                }

                // Create PRs with cross-references
                await createMultiRepoPullRequests(featureName);
            } else {
                // Monorepo mode: single commit at git root, single PR
                logger.info('📦 Multi-repo (monorepo) mode: creating single commit and PR at git root');

                // Get the git root (should be the same for both repos in monorepo)
                const gitRoots = state.getGitRoots();
                const gitRoot = gitRoots && gitRoots.length > 0 ? gitRoots[0] : workspaceRoot;

                const commitResult = await smartCommit({
                    taskName: null,
                    shouldPush,
                    createPR: shouldPush,
                    cwd: gitRoot, // Use git root for monorepo
                });

                if (commitResult.method === 'shell') {
                    logger.info('📦 Final commit via shell (saved Claude tokens)');
                } else if (commitResult.method === 'claude') {
                    logger.info('📦 Final commit/PR via Claude');
                }
            }
        } else {
            // Single-repo: use existing behavior with workspace root
            const commitResult = await smartCommit({
                taskName: null, // Final commit, no specific task
                shouldPush,
                createPR: shouldPush, // Create PR if pushing
                cwd: workspaceRoot, // Use workspace root to ensure correct directory
            });

            if (commitResult.method === 'shell') {
                logger.info('📦 Final commit via shell (saved Claude tokens)');
            } else if (commitResult.method === 'claude') {
                logger.info('📦 Final commit/PR via Claude');
            }
        }

        fs.writeFileSync(path.join(workspaceFolder, 'done.txt'), '1');
    } catch (error) {
        // Log but don't block execution
        logger.warning('⚠️  Commit/PR failed in step8, continuing anyway:', error.message);
    }

    logger.info(`✅ Claudiomiro has been successfully executed. Check out: ${state.workspaceRoot || state.folder}`);
    process.exit(0);
};

module.exports = { step8 };
