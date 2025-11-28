const fs = require('fs');

// Local LLM service for enhanced completion detection (lazy loaded)
let localLLMService = null;
const getLocalLLM = () => {
    if (!localLLMService) {
        try {
            const { getLocalLLMService } = require('../../../shared/services/local-llm');
            localLLMService = getLocalLLMService();
        } catch (error) {
            localLLMService = null;
        }
    }
    return localLLMService;
};

/**
 * Checks if a task is fully implemented (sync version - heuristic only)
 * @param {string} file - Path to TODO.md file
 * @returns {boolean}
 */
const isFullyImplemented = (file) => {
    const todo = fs.readFileSync(file, 'utf-8');
    return isFullyImplementedFromContent(todo);
};

/**
 * Checks if content indicates full implementation (heuristic)
 * @param {string} content - TODO.md content
 * @returns {boolean}
 */
const isFullyImplementedFromContent = (content) => {
    const lines = content.split('\n').slice(0, 10); // Check first 10 lines

    for (const line of lines) {
        const trimmedLine = line.trim().toLowerCase();
        // Check if line is exactly "fully implemented: yes" (not inside a task)
        if (trimmedLine === 'fully implemented: yes' || trimmedLine.startsWith('fully implemented: yes')) {
            // Make sure it's not part of a task (doesn't start with - [ ])
            if (!line.trim().startsWith('-')) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Checks if a task is fully implemented using Local LLM when available
 * @param {string} file - Path to TODO.md file
 * @returns {Promise<{completed: boolean, confidence: number}>}
 */
const isFullyImplementedAsync = async (file) => {
    const content = fs.readFileSync(file, 'utf-8');

    // Try Local LLM for enhanced detection
    const llm = getLocalLLM();
    if (llm) {
        try {
            await llm.initialize();
            if (llm.isAvailable()) {
                const result = await llm.checkCompletion(content);
                if (result && typeof result.completed === 'boolean') {
                    return result;
                }
            }
        } catch (error) {
            // Fall through to heuristic
        }
    }

    // Fallback to heuristic
    const completed = isFullyImplementedFromContent(content);
    return {
        completed,
        confidence: 0.8,
        reason: 'Heuristic check',
    };
};

const hasApprovedCodeReview = (file) => {
    if (!fs.existsSync(file)) {
        return false;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const statusIndex = lines.findIndex(line => line.trim().toLowerCase() === '## status');

    if (statusIndex === -1) {
        return false;
    }

    for (let i = statusIndex + 1; i < lines.length; i++) {
        const value = lines[i].trim();
        if (value === '') {
            continue;
        }

        return value.toLowerCase().includes('approved');
    }

    return false;
};

module.exports = {
    isFullyImplemented,
    isFullyImplementedAsync,
    isFullyImplementedFromContent,
    hasApprovedCodeReview,
};
