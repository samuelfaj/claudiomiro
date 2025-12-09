/**
 * Finishing Touches Inference
 * Analyzes generated code and infers obvious consequences that may have been forgotten
 */

const fs = require('fs');
const path = require('path');
const { executeClaude } = require('../../../../../shared/executors/claude-executor');
const logger = require('../../../../../shared/utils/logger');

/**
 * Categories of finishing touches
 */
const CATEGORIES = {
    UI_STATE: 'ui_state',
    NAVIGATION: 'navigation',
    DATA_SYNC: 'data_sync',
    VALIDATION: 'validation',
    CLEANUP: 'cleanup',
    ERROR_HANDLING: 'error_handling',
};

/**
 * Confidence thresholds
 */
const CONFIDENCE = {
    HIGH: 0.9,
    MEDIUM: 0.7,
    LOW: 0.5,
};

/**
 * Infers finishing touches based on generated code
 * @param {string} taskDescription - Task description from BLUEPRINT
 * @param {string[]} modifiedFiles - List of modified file paths (relative)
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory to read files from
 * @param {string} options.blueprintPath - Path to BLUEPRINT.md
 * @returns {Promise<Object>} { finishingTouches: [], summary: {} }
 */
const inferFinishingTouches = async (taskDescription, modifiedFiles, options = {}) => {
    const cwd = options.cwd || process.cwd();

    // Load prompt template
    const promptPath = path.join(__dirname, '../prompts/finishing-touches.md');
    if (!fs.existsSync(promptPath)) {
        logger.warning('[Finishing Touches] Prompt template not found');
        return { finishingTouches: [], summary: { total: 0 } };
    }

    let promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Read content of modified files
    const generatedCode = readModifiedFiles(modifiedFiles, cwd);

    if (!generatedCode.trim()) {
        logger.info('[Finishing Touches] No code to analyze');
        return { finishingTouches: [], summary: { total: 0 } };
    }

    // Replace placeholders in prompt
    const prompt = promptTemplate
        .replace('{{TASK_DESCRIPTION}}', taskDescription || 'No description provided')
        .replace('{{GENERATED_CODE}}', generatedCode)
        .replace('{{MODIFIED_FILES}}', modifiedFiles.join(', '));

    try {
        // Execute Claude to infer finishing touches
        const result = await executeClaude(prompt, null, {
            model: 'fast',
            parseJson: true,
        });

        // Parse result
        const parsed = parseInferenceResult(result);

        logger.info(`[Finishing Touches] Inferred ${parsed.finishingTouches.length} items`);

        return parsed;
    } catch (error) {
        logger.warning(`[Finishing Touches] Inference failed: ${error.message}`);
        return { finishingTouches: [], summary: { total: 0, error: error.message } };
    }
};

/**
 * Reads content of modified files
 * @param {string[]} files - List of file paths
 * @param {string} cwd - Base directory
 * @returns {string} Combined file contents
 */
const readModifiedFiles = (files, cwd) => {
    const contents = [];

    for (const file of files) {
        const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);

        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                contents.push(`// File: ${file}\n${content}`);
            } catch (error) {
                logger.warning(`[Finishing Touches] Could not read file: ${file}`);
            }
        }
    }

    return contents.join('\n\n---\n\n');
};

/**
 * Parses the inference result from Claude
 * @param {string|Object} result - Raw result from executeClaude
 * @returns {Object} Parsed result with finishingTouches array
 */
const parseInferenceResult = (result) => {
    // If already an object, use it directly
    if (typeof result === 'object' && result !== null) {
        return normalizeResult(result);
    }

    // Try to parse JSON from string
    if (typeof result === 'string') {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : result;

        try {
            const parsed = JSON.parse(jsonStr);
            return normalizeResult(parsed);
        } catch (error) {
            logger.warning('[Finishing Touches] Could not parse JSON result');
            return { finishingTouches: [], summary: { total: 0, parseError: true } };
        }
    }

    return { finishingTouches: [], summary: { total: 0 } };
};

/**
 * Normalizes the result structure
 * @param {Object} result - Raw parsed result
 * @returns {Object} Normalized result
 */
const normalizeResult = (result) => {
    const finishingTouches = (result.finishingTouches || [])
        .filter(touch => touch.confidence >= CONFIDENCE.LOW)
        .map(touch => ({
            action: touch.action || 'unknown',
            inference: touch.inference || touch.description || '',
            category: touch.category || CATEGORIES.UI_STATE,
            confidence: touch.confidence || 0.5,
            reason: touch.reason || '',
            suggestion: touch.suggestion || null,
        }));

    const summary = result.summary || {
        total: finishingTouches.length,
        highConfidence: finishingTouches.filter(t => t.confidence >= CONFIDENCE.HIGH).length,
        categories: countByCategory(finishingTouches),
    };

    return { finishingTouches, summary };
};

/**
 * Counts finishing touches by category
 * @param {Array} touches - Array of finishing touches
 * @returns {Object} Count by category
 */
const countByCategory = (touches) => {
    const counts = {};
    for (const cat of Object.values(CATEGORIES)) {
        counts[cat] = touches.filter(t => t.category === cat).length;
    }
    return counts;
};

/**
 * Applies finishing touches automatically when confidence is high
 * @param {Array} touches - Array of finishing touches
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory
 * @param {boolean} options.dryRun - If true, don't actually apply changes
 * @returns {Promise<Object>} { applied: [], pending: [] }
 */
const applyFinishingTouches = async (touches, options = {}) => {
    const applied = [];
    const pending = [];

    for (const touch of touches) {
        if (touch.confidence >= CONFIDENCE.HIGH && touch.suggestion && !options.dryRun) {
            // High confidence with suggestion: try to apply
            const success = await applyTouchSuggestion(touch, options);
            if (success) {
                applied.push({ ...touch, status: 'applied' });
            } else {
                pending.push({ ...touch, status: 'apply_failed' });
            }
        } else {
            // Lower confidence or no suggestion: mark as pending
            pending.push({
                ...touch,
                status: touch.confidence >= CONFIDENCE.HIGH ? 'no_suggestion' : 'low_confidence',
            });
        }
    }

    return { applied, pending };
};

/**
 * Applies a single touch suggestion to the codebase
 * @param {Object} touch - Finishing touch with suggestion
 * @param {Object} options - Options
 * @returns {Promise<boolean>} Success status
 */
const applyTouchSuggestion = async (touch, options = {}) => {
    const cwd = options.cwd || process.cwd();
    const suggestion = touch.suggestion;

    if (!suggestion || !suggestion.file || !suggestion.code) {
        return false;
    }

    const filePath = path.isAbsolute(suggestion.file)
        ? suggestion.file
        : path.join(cwd, suggestion.file);

    if (!fs.existsSync(filePath)) {
        logger.warning(`[Finishing Touches] File not found: ${suggestion.file}`);
        return false;
    }

    // For now, we don't auto-apply code changes
    // This is a safety measure - we report what should be done
    // Future: could use AST manipulation or Claude to apply changes safely
    logger.info(`[Finishing Touches] Suggestion for ${suggestion.file}: ${suggestion.description}`);

    return false; // Return false to mark as pending for manual review
};

/**
 * Updates BLUEPRINT.md with finishing touches section
 * @param {string} blueprintPath - Path to BLUEPRINT.md
 * @param {Object} data - { applied: [], pending: [] }
 * @returns {boolean} Success status
 */
const updateBlueprintFinishingTouches = (blueprintPath, data) => {
    if (!fs.existsSync(blueprintPath)) {
        logger.warning('[Finishing Touches] BLUEPRINT.md not found');
        return false;
    }

    const content = fs.readFileSync(blueprintPath, 'utf-8');
    const { applied, pending } = data;

    // Build the finishing touches section
    const sectionContent = buildFinishingTouchesSection(applied, pending);

    // Check if section already exists
    const sectionRegex = /### 3\.4 FINISHING TOUCHES[\s\S]*?(?=\n## |\n### [^3]|$)/;

    let newContent;
    if (sectionRegex.test(content)) {
        // Replace existing section
        newContent = content.replace(sectionRegex, sectionContent);
    } else {
        // Find the end of section 3 to insert new subsection
        const section3End = content.match(/### 3\.3 [\s\S]*?(?=\n## 4\.|$)/);
        if (section3End) {
            const insertPoint = section3End.index + section3End[0].length;
            newContent = content.slice(0, insertPoint) + '\n\n' + sectionContent + content.slice(insertPoint);
        } else {
            // Append at end if section 3 not found
            newContent = content + '\n\n' + sectionContent;
        }
    }

    fs.writeFileSync(blueprintPath, newContent, 'utf-8');
    logger.info('[Finishing Touches] Updated BLUEPRINT.md with finishing touches');

    return true;
};

/**
 * Builds the markdown content for finishing touches section
 * @param {Array} applied - Applied touches
 * @param {Array} pending - Pending touches
 * @returns {string} Markdown content
 */
const buildFinishingTouchesSection = (applied, pending) => {
    const lines = [
        '### 3.4 FINISHING TOUCHES (Auto-inferred)',
        '',
    ];

    const allTouches = [...applied, ...pending];

    if (allTouches.length === 0) {
        lines.push('No finishing touches identified.');
        return lines.join('\n');
    }

    lines.push('| Action | Finishing Touch | Category | Status |');
    lines.push('|--------|-----------------|----------|--------|');

    for (const touch of allTouches) {
        const status = touch.status === 'applied' ? '✅ Applied' : '⚠️ Pending';
        lines.push(`| ${touch.action} | ${touch.inference} | ${touch.category} | ${status} |`);
    }

    if (pending.length > 0) {
        lines.push('');
        lines.push('**Pending items require manual review.**');
    }

    return lines.join('\n');
};

/**
 * Updates execution.json with finishing touches data
 * @param {string} executionPath - Path to execution.json
 * @param {Object} data - { applied: [], pending: [] }
 * @returns {boolean} Success status
 */
const updateExecutionFinishingTouches = (executionPath, data) => {
    if (!fs.existsSync(executionPath)) {
        logger.warning('[Finishing Touches] execution.json not found');
        return false;
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

        execution.finishingTouches = {
            inferred: data.applied.length + data.pending.length,
            applied: data.applied.map(t => ({
                action: t.action,
                inference: t.inference,
                category: t.category,
                file: t.suggestion?.file || null,
            })),
            pending: data.pending.map(t => ({
                action: t.action,
                inference: t.inference,
                category: t.category,
                reason: t.status,
            })),
        };

        fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf-8');
        logger.info('[Finishing Touches] Updated execution.json');

        return true;
    } catch (error) {
        logger.warning(`[Finishing Touches] Could not update execution.json: ${error.message}`);
        return false;
    }
};

module.exports = {
    inferFinishingTouches,
    applyFinishingTouches,
    updateBlueprintFinishingTouches,
    updateExecutionFinishingTouches,
    readModifiedFiles,
    parseInferenceResult,
    CATEGORIES,
    CONFIDENCE,
};
