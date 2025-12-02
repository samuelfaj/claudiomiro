const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

/**
 * Generate Review Checklist
 *
 * Generates contextual review questions for each artifact in execution.json.
 * Creates review-checklist.json for step6 to use during code review.
 *
 * Stack-agnostic: Works for any language/framework.
 */

/**
 * Load artifacts from execution.json
 * @param {string} executionPath - Path to execution.json
 * @returns {Array} Array of artifact objects
 */
const loadArtifactsFromExecution = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        return [];
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
        return execution.artifacts || [];
    } catch {
        return [];
    }
};

/**
 * Build prompt for Claude to generate review checklist
 * @param {Array} artifacts - Array of artifact objects
 * @param {string} blueprintContent - Content of BLUEPRINT.md
 * @param {string} checklistPath - Output path for the checklist
 * @param {string} task - Task identifier
 * @returns {string} Complete prompt
 */
const buildChecklistPrompt = (artifacts, blueprintContent, checklistPath, task) => {
    const promptTemplatePath = path.join(__dirname, 'prompt-review-checklist.md');
    const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf-8');

    const artifactsList = artifacts.map(a =>
        `- **${a.path}** (${a.type.toUpperCase()})`,
    ).join('\n');

    // Extract first 1500 chars of blueprint for context
    const blueprintSummary = blueprintContent.substring(0, 1500) +
        (blueprintContent.length > 1500 ? '\n... (truncated)' : '');

    return promptTemplate
        .replace(/\{\{artifactsList\}\}/g, artifactsList)
        .replace(/\{\{blueprintSummary\}\}/g, blueprintSummary)
        .replace(/\{\{checklistPath\}\}/g, checklistPath)
        .replace(/\{\{task\}\}/g, task)
        .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
        .replace(/\{\{artifactCount\}\}/g, String(artifacts.length));
};

/**
 * Generate review checklist for a task
 * Creates review-checklist.json with verification questions for each artifact
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @param {Object} options - Options object
 * @param {string} options.cwd - Working directory for Claude execution
 * @returns {Promise<{success: boolean, checklistPath: string|null, itemCount: number}>}
 */
const generateReviewChecklist = async (task, options = {}) => {
    const logger = require('../../../../shared/utils/logger');
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    const executionPath = folder('execution.json');
    const blueprintPath = folder('BLUEPRINT.md');
    const checklistPath = folder('review-checklist.json');

    // Load artifacts from execution.json
    const artifacts = loadArtifactsFromExecution(executionPath);

    if (artifacts.length === 0) {
        logger.debug('[Step5] No artifacts to generate checklist for');
        return { success: true, checklistPath: null, itemCount: 0 };
    }

    // Load BLUEPRINT.md for context
    if (!fs.existsSync(blueprintPath)) {
        logger.warning('[Step5] BLUEPRINT.md not found, skipping checklist');
        return { success: false, checklistPath: null, itemCount: 0 };
    }

    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');

    // Remove existing checklist if present
    if (fs.existsSync(checklistPath)) {
        fs.rmSync(checklistPath);
    }

    // Build and execute prompt
    const prompt = buildChecklistPrompt(artifacts, blueprintContent, checklistPath, task);

    await executeClaude(prompt, task, options.cwd ? { cwd: options.cwd } : undefined);

    // Verify output was created
    if (!fs.existsSync(checklistPath)) {
        logger.warning('[Step5] review-checklist.json was not created');
        return { success: false, checklistPath: null, itemCount: artifacts.length };
    }

    // Count items in the generated checklist
    try {
        const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
        const itemCount = checklist.items?.length || 0;
        return { success: true, checklistPath, itemCount };
    } catch {
        return { success: true, checklistPath, itemCount: artifacts.length };
    }
};

module.exports = {
    generateReviewChecklist,
    // Export for testing
    loadArtifactsFromExecution,
    buildChecklistPrompt,
};
