const fs = require('fs');
const path = require('path');

/**
 * Parses BLUEPRINT.md §4 Implementation Strategy to extract all phases and steps
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {Array<Object>} Array of phases with their steps
 */
/**
 * Attempts to find phases using multiple regex patterns (tolerant parsing)
 * @param {string} content - Section content to parse
 * @returns {Array} Array of regex matches
 */
const findPhasesWithFallback = (content) => {
    // Primary patterns (most specific to most general)
    const phasePatterns = [
        /###\s*Phase\s*(\d+):\s*(.+?)$/gim,          // ### Phase 1: Name
        /##\s*Phase\s*(\d+):\s*(.+?)$/gim,           // ## Phase 1: Name
        /###\s*Phase\s*(\d+)\s*[:\-–]\s*(.+?)$/gim,  // ### Phase 1 - Name (with dash)
        /\*\*Phase\s*(\d+):\s*(.+?)\*\*/gim,         // **Phase 1: Name**
        /###\s*(\d+)\.\s*(.+?)$/gim,                  // ### 1. Name
        /##\s*(\d+)\.\s*(.+?)$/gim,                   // ## 1. Name
    ];

    for (const regex of phasePatterns) {
        const matches = [...content.matchAll(regex)];
        if (matches.length > 0) {
            return matches;
        }
    }

    return [];
};

const parseImplementationStrategy = (blueprintContent) => {
    const phases = [];

    // Find §4 Implementation Strategy section (tolerant matching)
    // Note: These patterns capture content until the next ## (section header) or end of file
    const section4Patterns = [
        /##\s*4\.\s*IMPLEMENTATION STRATEGY.*?\n([\s\S]*?)(?=\n##\s*\d+\.|$)/i,
        /##\s*4[.)]\s*Implementation\s+Strategy.*?\n([\s\S]*?)(?=\n##\s*\d+\.|$)/i,
        /##\s*Implementation\s+Strategy\s*\n([\s\S]*?)(?=\n##\s*\d+\.|$)/i,
        /#\s*4\.\s*IMPLEMENTATION.*?\n([\s\S]*?)(?=\n#\s*\d+\.|$)/i,
    ];

    let section4Content = null;
    for (const pattern of section4Patterns) {
        const match = blueprintContent.match(pattern);
        if (match) {
            section4Content = match[1];
            break;
        }
    }

    if (!section4Content) {
        return phases;
    }

    // Find phases using fallback patterns
    const phaseMatches = findPhasesWithFallback(section4Content);

    for (let i = 0; i < phaseMatches.length; i++) {
        const match = phaseMatches[i];
        const phaseId = parseInt(match[1], 10);
        const phaseName = match[2].trim();

        // Get content from this phase to next phase (or end)
        const startIndex = match.index + match[0].length;
        const endIndex = i < phaseMatches.length - 1
            ? phaseMatches[i + 1].index
            : section4Content.length;

        const phaseContent = section4Content.substring(startIndex, endIndex);

        // Extract steps from phase content
        const steps = extractStepsFromPhase(phaseContent, phaseId, phaseName);

        phases.push({
            id: phaseId,
            name: phaseName,
            steps: steps,
        });
    }

    return phases;
};

/**
 * Extracts individual steps from a phase content
 * Uses lenient parsing that only extracts top-level numbered items,
 * ignoring code blocks, examples, and nested content.
 *
 * @param {string} phaseContent - Content of the phase section
 * @param {number} phaseId - Phase ID
 * @param {string} phaseName - Phase name
 * @returns {Array<Object>} Array of steps
 */
const extractStepsFromPhase = (phaseContent, phaseId, phaseName) => {
    const steps = [];

    // Split content into lines
    const lines = phaseContent.split('\n');

    let inCodeBlock = false;
    let currentSubsection = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Track code block state (skip content inside code blocks)
        if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        // Skip everything inside code blocks
        if (inCodeBlock) continue;

        // Skip Gate lines
        if (trimmed.startsWith('**Gate:**')) continue;

        // Skip example lines (common in documentation)
        if (trimmed.toLowerCase().startsWith('example:')) continue;
        if (trimmed.toLowerCase().startsWith('**example')) continue;

        // Skip lines that look like notes/warnings
        if (trimmed.startsWith('**Note:**')) continue;
        if (trimmed.startsWith('**Warning:**')) continue;
        if (trimmed.startsWith('**CRITICAL:**')) continue;
        if (trimmed.startsWith('**Important:**')) continue;

        // Skip checkbox items (these are documentation, not implementation steps)
        if (trimmed.match(/^-\s*\[[ x]\]/i)) continue;

        // Detect subsections (e.g., **Step 2.1: Replace Data Source**)
        const subsectionMatch = trimmed.match(/^\*\*Step\s+[\d.]+:\s*(.+?)\*\*$/i);
        if (subsectionMatch) {
            currentSubsection = subsectionMatch[1].trim();
            continue;
        }

        // Extract numbered items (1., 2., 3., etc.) - only at start of line (top-level)
        // Must be a real step, not documentation or nested content
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
            const description = cleanDescription(numberedMatch[2]);

            // Skip very short descriptions (likely documentation fragments)
            if (description && description.length > 15) {
                // Skip items that look like documentation/examples
                if (!isDocumentationItem(description)) {
                    steps.push({
                        description: description,
                        source: `BLUEPRINT.md §4 Phase ${phaseId} ${currentSubsection ? `(${currentSubsection})` : ''}`,
                        phaseId: phaseId,
                        phaseName: phaseName,
                    });
                }
            }
        }

        // NOTE: Dash items (-) are now SKIPPED by default
        // They are typically documentation bullets, not implementation steps
        // Real implementation steps should be numbered (1., 2., 3.)
    }

    return steps;
};

/**
 * Checks if an item looks like documentation rather than an implementation step
 * @param {string} description - Item description
 * @returns {boolean} true if this looks like documentation
 */
const isDocumentationItem = (description) => {
    const lower = description.toLowerCase();

    // Documentation patterns
    const docPatterns = [
        /^if\s+/i,              // "If you do X..."
        /^when\s+/i,            // "When doing X..."
        /^note:/i,              // "Note: ..."
        /^warning:/i,           // "Warning: ..."
        /^example:/i,           // "Example: ..."
        /^e\.g\./i,             // "e.g. ..."
        /^for example/i,        // "For example..."
        /^this\s+(is|will|should)/i,  // "This is..." / "This will..."
        /^you\s+(can|should|must|will)/i, // "You can..." / "You should..."
        /^see\s+/i,             // "See the documentation..."
        /^refer\s+to/i,         // "Refer to..."
        /^\(optional\)/i,       // "(Optional)..."
    ];

    return docPatterns.some(pattern => pattern.test(lower));
};

/**
 * Cleans step description (removes markdown formatting, code blocks, etc.)
 * @param {string} description - Raw description
 * @returns {string} Cleaned description
 */
const cleanDescription = (description) => {
    return description
        .replace(/`/g, '')  // Remove backticks
        .replace(/\*\*/g, '')  // Remove bold markers
        .replace(/\*/g, '')  // Remove italic markers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove markdown links
        .trim();
};

/**
 * Validates that execution.json contains items for steps from BLUEPRINT.md §4
 *
 * LENIENT VALIDATION APPROACH:
 * - Phases must exist in execution.json
 * - Phases must have at least one item tracked (Claude can consolidate steps)
 * - Phase status must be 'completed' OR all items must be completed
 * - We do NOT require 1:1 mapping between BLUEPRINT steps and execution items
 *   (Claude is allowed to consolidate or split steps as needed)
 *
 * @param {string} task - Task identifier
 * @param {Object} options - Options
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Promise<Object>} Validation result
 */
const validateImplementationStrategy = async (task, { claudiomiroFolder }) => {
    const logger = require('../../../../../shared/utils/logger');

    const blueprintPath = path.join(claudiomiroFolder, task, 'BLUEPRINT.md');
    const executionPath = path.join(claudiomiroFolder, task, 'execution.json');

    if (!fs.existsSync(blueprintPath)) {
        logger.warning('BLUEPRINT.md not found, skipping implementation strategy validation');
        return { valid: true, missing: [], extra: [] };
    }

    if (!fs.existsSync(executionPath)) {
        logger.warning('execution.json not found, skipping implementation strategy validation');
        return { valid: true, missing: [], extra: [] };
    }

    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

    // Parse BLUEPRINT.md §4 to extract expected phases and steps
    const expectedPhases = parseImplementationStrategy(blueprintContent);

    if (expectedPhases.length === 0) {
        logger.info('No implementation strategy found in BLUEPRINT.md §4');
        return { valid: true, missing: [], extra: [] };
    }

    logger.info(`Found ${expectedPhases.length} phases in BLUEPRINT.md §4 Implementation Strategy`);

    const missing = [];
    const warnings = [];
    const executionPhases = execution.phases || [];

    // For each expected phase, verify execution.json has the phase
    for (const expectedPhase of expectedPhases) {
        const executionPhase = executionPhases.find(p => p.id === expectedPhase.id);

        if (!executionPhase) {
            // Phase completely missing - this is a real error
            logger.warning(`⚠️  Phase ${expectedPhase.id} (${expectedPhase.name}) not found in execution.json`);
            missing.push({
                phaseId: expectedPhase.id,
                phaseName: expectedPhase.name,
                reason: 'Phase missing from execution.json',
                expectedSteps: expectedPhase.steps.length,
            });
            continue;
        }

        const executionItems = executionPhase.items || [];
        const phaseStatus = executionPhase.status;

        logger.info(`Phase ${expectedPhase.id}: Expected ${expectedPhase.steps.length} steps, found ${executionItems.length} items, status: ${phaseStatus}`);

        // If phase status is 'completed', we trust it (lenient validation)
        if (phaseStatus === 'completed') {
            // Phase is completed - no issues
            continue;
        }

        // Phase not completed - check if it has items and they're tracked
        if (executionItems.length === 0 && expectedPhase.steps.length > 0) {
            // No items tracked but phase not completed - this is an issue
            logger.warning(`⚠️  Phase ${expectedPhase.id} has no items and status is "${phaseStatus}"`);
            missing.push({
                phaseId: expectedPhase.id,
                phaseName: expectedPhase.name,
                reason: `Phase has no items tracked and status is "${phaseStatus}"`,
                expectedSteps: expectedPhase.steps.length,
                actualItems: 0,
            });
            continue;
        }

        // Phase has items - check if they're completed
        const incompleteItems = executionItems.filter(item => item.completed !== true);
        if (incompleteItems.length > 0) {
            // Some items incomplete - add as warning (not blocking error)
            // Unless MORE THAN HALF are incomplete (then it's a real issue)
            const incompleteRatio = incompleteItems.length / executionItems.length;

            if (incompleteRatio > 0.5) {
                // More than half incomplete - this is a real issue
                logger.warning(`⚠️  Phase ${expectedPhase.id} has ${incompleteItems.length}/${executionItems.length} incomplete items`);
                missing.push({
                    phaseId: expectedPhase.id,
                    phaseName: expectedPhase.name,
                    reason: `${incompleteItems.length}/${executionItems.length} items not completed`,
                    incompleteCount: incompleteItems.length,
                    totalCount: executionItems.length,
                });
            } else {
                // Less than half incomplete - just a warning
                logger.info(`   Phase ${expectedPhase.id}: ${incompleteItems.length}/${executionItems.length} items pending (acceptable)`);
                warnings.push({
                    phaseId: expectedPhase.id,
                    phaseName: expectedPhase.name,
                    reason: `${incompleteItems.length}/${executionItems.length} items pending`,
                    incompleteCount: incompleteItems.length,
                    totalCount: executionItems.length,
                });
            }
        }
    }

    const valid = missing.length === 0;

    if (!valid) {
        logger.error(`❌ Implementation Strategy validation failed: ${missing.length} issues found`);
        missing.forEach((issue, idx) => {
            logger.error(`   ${idx + 1}. Phase ${issue.phaseId}: ${issue.reason}`);
        });
    } else if (warnings.length > 0) {
        logger.info(`✅ Implementation Strategy validation passed with ${warnings.length} warnings`);
    } else {
        logger.info('✅ Implementation Strategy validation passed');
    }

    return {
        valid,
        missing,
        warnings,
        expectedPhases: expectedPhases.length,
        executionPhases: executionPhases.length,
    };
};

module.exports = {
    validateImplementationStrategy,
    parseImplementationStrategy,
    extractStepsFromPhase,
    cleanDescription,
    isDocumentationItem,
    findPhasesWithFallback,
};
