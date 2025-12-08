/**
 * Model Configuration Module
 *
 * Manages Claude model selection for each step in the task-executor.
 * Supports environment variables and global CLI overrides.
 *
 * Model mapping:
 * - fast   → haiku  (cheapest, fastest)
 * - medium → sonnet (default, balanced)
 * - hard   → opus   (most capable, expensive)
 */

// Valid model values
const VALID_MODELS = ['fast', 'medium', 'hard'];

// Default models per step (based on complexity analysis)
const STEP_MODEL_DEFAULTS = {
    step0: 'medium',   // Clarification questions - needs codebase understanding
    step1: 'hard',     // AI_PROMPT generation - Chain of Thought, deep reasoning
    step2: 'hard',     // Task decomposition - architectural analysis
    step3: 'medium',   // Dependency analysis - systematic but straightforward
    step4: 'medium',   // execution.json + split analysis
    step5: 'dynamic',  // Task execution - varies by complexity
    step6: 'escalation', // Code review - fast first, then hard
    step7: 'escalation', // Global bug sweep - fast first, then hard
    step8: 'fast',     // Final commit/PR - simple message generation
};

/**
 * Get the model for a specific step
 * Priority: Global override > Step-specific env > Default
 *
 * @param {number} stepNumber - The step number (0-8)
 * @returns {string} - Model name: 'fast', 'medium', 'hard', 'dynamic', or 'escalation'
 */
const getStepModel = (stepNumber) => {
    // Check global override first
    const globalModel = process.env.CLAUDIOMIRO_MODEL;
    if (globalModel && VALID_MODELS.includes(globalModel)) {
        return globalModel;
    }

    // Check step-specific env var
    const envVar = `CLAUDIOMIRO_STEP${stepNumber}_MODEL`;
    const envModel = process.env[envVar];
    if (envModel && [...VALID_MODELS, 'dynamic', 'escalation'].includes(envModel)) {
        return envModel;
    }

    // Return default
    return STEP_MODEL_DEFAULTS[`step${stepNumber}`] || 'medium';
};

/**
 * Parse @difficulty tag from BLUEPRINT.md content
 *
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {string|null} - Difficulty level ('fast', 'medium', 'hard') or null if not found
 */
const parseDifficultyTag = (blueprintContent) => {
    if (!blueprintContent) return null;

    // Match @difficulty tag (case-insensitive)
    // Supports: @difficulty fast, @difficulty medium, @difficulty hard
    const match = blueprintContent.match(/@difficulty\s+(fast|medium|hard)/i);
    if (match) {
        return match[1].toLowerCase();
    }

    return null;
};

/**
 * Determine model for Step 5 based on task complexity
 *
 * Priority:
 * 1. Global/env override
 * 2. @difficulty tag in BLUEPRINT.md (set by step2)
 * 3. Fallback heuristics (phases, artifacts, etc.)
 *
 * @param {Object} execution - execution.json content
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {string} - Model name: 'fast', 'medium', or 'hard'
 */
const determineStep5Model = (execution, blueprintContent) => {
    // Check global/env override first
    const envModel = getStepModel(5);
    if (envModel !== 'dynamic') {
        return envModel;
    }

    // Check @difficulty tag in BLUEPRINT.md (preferred method)
    const declaredDifficulty = parseDifficultyTag(blueprintContent);
    if (declaredDifficulty) {
        return declaredDifficulty;
    }

    // Fallback: analyze complexity indicators (legacy heuristics)
    const phaseCount = execution?.phases?.length || 0;
    const artifactCount = execution?.artifacts?.length || 0;
    const hasUncertainties = (execution?.uncertainties?.length || 0) > 0;
    const attemptCount = execution?.attempts || 0;
    const blueprintLines = blueprintContent ? blueprintContent.split('\n').length : 0;

    // High complexity indicators
    const isComplex = (
        phaseCount > 3 ||
        artifactCount > 5 ||
        blueprintLines > 300 ||
        attemptCount > 2 ||
        hasUncertainties
    );

    // Medium complexity
    const isMedium = (
        phaseCount > 1 ||
        artifactCount > 2 ||
        blueprintLines > 100
    );

    if (isComplex) return 'hard';
    if (isMedium) return 'medium';
    return 'fast';
};

/**
 * Check if a step uses escalation model
 *
 * @param {number} stepNumber - The step number
 * @returns {boolean} - True if step uses escalation
 */
const isEscalationStep = (stepNumber) => {
    const model = getStepModel(stepNumber);
    return model === 'escalation';
};

/**
 * Get default model for a step (ignoring env overrides)
 *
 * @param {number} stepNumber - The step number
 * @returns {string} - Default model for the step
 */
const getDefaultModel = (stepNumber) => {
    return STEP_MODEL_DEFAULTS[`step${stepNumber}`] || 'medium';
};

module.exports = {
    VALID_MODELS,
    STEP_MODEL_DEFAULTS,
    getStepModel,
    determineStep5Model,
    isEscalationStep,
    getDefaultModel,
    parseDifficultyTag,
};
