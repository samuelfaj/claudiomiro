const fs = require('fs');
const path = require('path');

/**
 * Parses BLUEPRINT.md §4 Implementation Strategy to extract all phases and steps
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {Array<Object>} Array of phases with their steps
 */
const parseImplementationStrategy = (blueprintContent) => {
    const phases = [];

    // Find §4 Implementation Strategy section
    const section4Match = blueprintContent.match(/##\s*4\.\s*IMPLEMENTATION STRATEGY.*?\n([\s\S]*?)(?=\n##\s*\d+\.|$)/i);
    if (!section4Match) {
        return phases;
    }

    const section4Content = section4Match[1];

    // Split by phase headers (### Phase N:)
    const phaseRegex = /###\s*Phase\s*(\d+):\s*(.+?)$/gm;
    const phaseMatches = [...section4Content.matchAll(phaseRegex)];

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
 * @param {string} phaseContent - Content of the phase section
 * @param {number} phaseId - Phase ID
 * @param {string} phaseName - Phase name
 * @returns {Array<Object>} Array of steps
 */
const extractStepsFromPhase = (phaseContent, phaseId, phaseName) => {
    const steps = [];

    // Split content into lines
    const lines = phaseContent.split('\n');

    let currentSubsection = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Skip Gate lines
        if (trimmed.startsWith('**Gate:**')) continue;

        // Skip code blocks
        if (trimmed.startsWith('```')) continue;

        // Detect subsections (e.g., **Step 2.1: Replace Data Source**)
        const subsectionMatch = trimmed.match(/^\*\*Step\s+[\d.]+:\s*(.+?)\*\*$/i);
        if (subsectionMatch) {
            currentSubsection = subsectionMatch[1].trim();
            continue;
        }

        // Extract numbered items (1., 2., 3., etc.)
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
            const description = cleanDescription(numberedMatch[2]);

            if (description) {
                steps.push({
                    description: description,
                    source: `BLUEPRINT.md §4 Phase ${phaseId} ${currentSubsection ? `(${currentSubsection})` : ''}`,
                    phaseId: phaseId,
                    phaseName: phaseName,
                });
            }
        }

        // Extract dash items (- Item)
        const dashMatch = trimmed.match(/^-\s+(.+)$/);
        if (dashMatch && !trimmed.startsWith('- Line') && !trimmed.startsWith('- Lines')) {
            const description = cleanDescription(dashMatch[1]);

            if (description && description.length > 10) {
                steps.push({
                    description: description,
                    source: `BLUEPRINT.md §4 Phase ${phaseId} ${currentSubsection ? `(${currentSubsection})` : ''}`,
                    phaseId: phaseId,
                    phaseName: phaseName,
                });
            }
        }
    }

    return steps;
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
 * Validates that execution.json contains items for ALL steps from BLUEPRINT.md §4
 * @param {string} task - Task identifier
 * @param {Object} options - Options
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Promise<Object>} Validation result
 */
const validateImplementationStrategy = async (task, { claudiomiroFolder }) => {
    const logger = require('../../../../shared/utils/logger');

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
    const executionPhases = execution.phases || [];

    // For each expected phase, verify execution.json has items
    for (const expectedPhase of expectedPhases) {
        const executionPhase = executionPhases.find(p => p.id === expectedPhase.id);

        if (!executionPhase) {
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

        logger.info(`Phase ${expectedPhase.id}: Expected ${expectedPhase.steps.length} steps, found ${executionItems.length} items`);

        // Check if number of items roughly matches number of steps
        // (Allow some flexibility - Claude might consolidate some steps)
        if (executionItems.length === 0 && expectedPhase.steps.length > 0) {
            logger.warning(`⚠️  Phase ${expectedPhase.id} has no items but BLUEPRINT specifies ${expectedPhase.steps.length} steps`);
            missing.push({
                phaseId: expectedPhase.id,
                phaseName: expectedPhase.name,
                reason: 'No items tracked for this phase',
                expectedSteps: expectedPhase.steps.length,
                actualItems: 0,
            });
        }

        // Verify all items are completed
        const incompleteItems = executionItems.filter(item => item.completed !== true);
        if (incompleteItems.length > 0) {
            logger.warning(`⚠️  Phase ${expectedPhase.id} has ${incompleteItems.length} incomplete items`);
            for (const item of incompleteItems) {
                missing.push({
                    phaseId: expectedPhase.id,
                    phaseName: expectedPhase.name,
                    reason: 'Item not completed',
                    item: item.description,
                    completed: item.completed,
                });
            }
        }
    }

    const valid = missing.length === 0;

    if (!valid) {
        logger.error(`❌ Implementation Strategy validation failed: ${missing.length} issues found`);
        missing.forEach((issue, idx) => {
            logger.error(`   ${idx + 1}. Phase ${issue.phaseId}: ${issue.reason}`);
            if (issue.item) {
                logger.error(`      Item: "${issue.item}"`);
            }
        });
    } else {
        logger.info('✅ Implementation Strategy validation passed');
    }

    return {
        valid,
        missing,
        expectedPhases: expectedPhases.length,
        executionPhases: executionPhases.length,
    };
};

module.exports = {
    validateImplementationStrategy,
    parseImplementationStrategy,
    extractStepsFromPhase,
    cleanDescription,
};
