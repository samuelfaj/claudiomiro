const fs = require('fs');
const path = require('path');
const { executeClaude } = require('../../../shared/executors/claude-executor');
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');

/**
 * Prompt template for AI scope detection
 * @param {string} blueprintContent - Content of the BLUEPRINT.md file
 * @param {string} taskName - Name of the task (e.g., 'TASK1')
 * @returns {string} Prompt for AI
 */
const buildScopeDetectionPrompt = (blueprintContent, taskName) => {
    return `## Task: Determine the correct @scope for ${taskName}

You are analyzing a task BLUEPRINT to determine which scope it belongs to.

## Valid Scopes

- **backend** - Task modifies ONLY server-side code (API endpoints, database models, server logic, backend tests, CLI tools, background jobs)
- **frontend** - Task modifies ONLY client-side code (UI components, frontend state, client logic, frontend tests, browser utilities)
- **integration** - Task touches BOTH layers OR verifies their interaction (API contract verification, E2E testing, shared types/contracts)

## BLUEPRINT Content

\`\`\`markdown
${blueprintContent}
\`\`\`

## Decision Rules

1. If the task ONLY mentions backend/server/API files -> @scope backend
2. If the task ONLY mentions frontend/client/UI files -> @scope frontend
3. If the task mentions BOTH backend AND frontend files -> @scope integration
4. If the task creates shared contracts/types used by both -> @scope integration
5. If the task involves E2E tests -> @scope integration
6. When in doubt -> @scope integration

## Required Output

Analyze the BLUEPRINT and respond with ONLY the scope value (no explanation, no markdown, just the word):
backend
OR
frontend
OR
integration

Your answer:`;
};

/**
 * Uses AI to determine the correct scope for a task based on its BLUEPRINT.md content
 * @param {string} taskFolder - Path to the task folder
 * @param {string} taskName - Name of the task (e.g., 'TASK1')
 * @returns {Promise<string|null>} - Detected scope ('backend', 'frontend', 'integration') or null if detection fails
 */
const detectScopeWithAI = async (taskFolder, taskName) => {
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');

    if (!fs.existsSync(blueprintPath)) {
        logger.warning(`[ScopeFixer] BLUEPRINT.md not found for ${taskName}`);
        return null;
    }

    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
    const prompt = buildScopeDetectionPrompt(blueprintContent, taskName);

    logger.info(`[ScopeFixer] Detecting scope for ${taskName} using AI...`);

    try {
        // Create a temp file to capture Claude's output
        const outputFile = path.join(taskFolder, '.scope-detection-output.txt');

        // Execute Claude with a prompt that asks it to write to the temp file
        const fullPrompt = `${prompt}

IMPORTANT: Write ONLY the scope value to this file: ${outputFile}
Use the Write tool to write ONLY one word: backend, frontend, or integration
Do not include any other text, explanation, or formatting.`;

        await executeClaude(fullPrompt, null, { model: 'fast' });

        // Read the output file
        if (fs.existsSync(outputFile)) {
            const result = fs.readFileSync(outputFile, 'utf-8').trim().toLowerCase();
            fs.unlinkSync(outputFile); // Cleanup

            const validScopes = ['backend', 'frontend', 'integration'];
            if (validScopes.includes(result)) {
                logger.success(`[ScopeFixer] Detected scope: ${result}`);
                return result;
            } else {
                logger.warning(`[ScopeFixer] Invalid scope detected: "${result}", defaulting to integration`);
                return 'integration';
            }
        }

        // If output file wasn't created, default to integration
        logger.warning('[ScopeFixer] Could not detect scope, defaulting to integration');
        return 'integration';

    } catch (error) {
        logger.error(`[ScopeFixer] AI scope detection failed: ${error.message}`);
        return 'integration'; // Safe default
    }
};

/**
 * Adds the @scope tag to a BLUEPRINT.md file
 * @param {string} blueprintPath - Path to BLUEPRINT.md
 * @param {string} scope - Scope value to add
 * @returns {boolean} - True if successful
 */
const addScopeToBlueprint = (blueprintPath, scope) => {
    if (!fs.existsSync(blueprintPath)) {
        return false;
    }

    let content = fs.readFileSync(blueprintPath, 'utf-8');

    // Check if @scope already exists
    if (content.match(/^@scope\s+(backend|frontend|integration)\s*$/mi)) {
        logger.debug(`[ScopeFixer] @scope already exists in ${blueprintPath}`);
        return true;
    }

    // Find the right place to insert @scope (after @dependencies)
    const dependenciesMatch = content.match(/^(@dependencies\s*\[[^\]]*\])\s*$/mi);

    if (dependenciesMatch) {
        // Insert @scope after @dependencies
        const insertPosition = content.indexOf(dependenciesMatch[0]) + dependenciesMatch[0].length;
        content = content.slice(0, insertPosition) + `\n@scope ${scope}` + content.slice(insertPosition);
    } else {
        // If no @dependencies, insert at the beginning (after comment line if present)
        const commentMatch = content.match(/^<!--[^>]*-->\s*\n?/);
        if (commentMatch) {
            const insertPosition = commentMatch[0].length;
            content = content.slice(0, insertPosition) + `@scope ${scope}\n` + content.slice(insertPosition);
        } else {
            // Insert at the very beginning
            content = `@scope ${scope}\n${content}`;
        }
    }

    fs.writeFileSync(blueprintPath, content, 'utf-8');
    logger.success(`[ScopeFixer] Added @scope ${scope} to ${blueprintPath}`);
    return true;
};

/**
 * Auto-fixes missing @scope in a task's BLUEPRINT.md
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @returns {Promise<string|null>} - The scope that was added, or null if fix failed
 */
const autoFixScope = async (task) => {
    const taskFolder = path.join(state.claudiomiroFolder, task);
    const blueprintPath = path.join(taskFolder, 'BLUEPRINT.md');

    logger.info(`[ScopeFixer] Auto-fixing @scope for ${task}...`);

    // First, try to detect scope using simple heuristics
    let detectedScope = detectScopeWithHeuristics(blueprintPath);

    // If heuristics are inconclusive, use AI
    if (!detectedScope) {
        detectedScope = await detectScopeWithAI(taskFolder, task);
    }

    if (!detectedScope) {
        logger.error(`[ScopeFixer] Failed to detect scope for ${task}`);
        return null;
    }

    // Add the scope to the BLUEPRINT.md
    if (addScopeToBlueprint(blueprintPath, detectedScope)) {
        return detectedScope;
    }

    return null;
};

/**
 * Detects scope using simple heuristics (faster than AI)
 * @param {string} blueprintPath - Path to BLUEPRINT.md
 * @returns {string|null} - Detected scope or null if inconclusive
 */
const detectScopeWithHeuristics = (blueprintPath) => {
    if (!fs.existsSync(blueprintPath)) {
        return null;
    }

    const content = fs.readFileSync(blueprintPath, 'utf-8').toLowerCase();

    // Backend indicators
    const backendIndicators = [
        'api endpoint', 'api route', 'server', 'database', 'model',
        'controller', 'service layer', 'backend', 'prisma', 'migration',
        'rest api', 'graphql resolver', 'middleware', 'authentication',
        '/api/', '/server/', '/backend/', 'express', 'fastify', 'nest',
    ];

    // Frontend indicators
    const frontendIndicators = [
        'ui component', 'frontend', 'client', 'react', 'vue', 'angular',
        'component', 'hook', 'state management', 'redux', 'zustand',
        '/web/', '/client/', '/frontend/', '/app/', 'css', 'tailwind',
        'page component', 'layout', 'navigation', 'form', 'button',
    ];

    // Integration indicators
    const integrationIndicators = [
        'e2e', 'end-to-end', 'integration test', 'contract', 'shared type',
        'dto', 'both layers', 'frontend and backend', 'api contract',
        'full stack', 'cross-layer',
    ];

    let backendScore = 0;
    let frontendScore = 0;
    let integrationScore = 0;

    // Count indicator matches
    for (const indicator of backendIndicators) {
        if (content.includes(indicator)) backendScore++;
    }
    for (const indicator of frontendIndicators) {
        if (content.includes(indicator)) frontendScore++;
    }
    for (const indicator of integrationIndicators) {
        if (content.includes(indicator)) integrationScore++;
    }

    // Decision logic
    if (integrationScore >= 2) {
        return 'integration';
    }

    // Clear winner with significant margin
    if (backendScore > frontendScore + 2 && frontendScore === 0) {
        return 'backend';
    }
    if (frontendScore > backendScore + 2 && backendScore === 0) {
        return 'frontend';
    }

    // Both have scores - likely integration
    if (backendScore > 0 && frontendScore > 0) {
        return 'integration';
    }

    // Single indicator - be confident
    if (backendScore >= 3 && frontendScore === 0) {
        return 'backend';
    }
    if (frontendScore >= 3 && backendScore === 0) {
        return 'frontend';
    }

    // Inconclusive - return null to trigger AI detection
    return null;
};

module.exports = {
    autoFixScope,
    detectScopeWithAI,
    detectScopeWithHeuristics,
    addScopeToBlueprint,
    buildScopeDetectionPrompt,
};
