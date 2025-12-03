const fs = require('fs');

/**
 * Checks if a task is completed based on execution.json
 * @param {string} executionPath - Path to execution.json file
 * @returns {{completed: boolean, confidence: number, reason: string}}
 */
const isCompletedFromExecution = (executionPath) => {
    if (!fs.existsSync(executionPath)) {
        return {
            completed: false,
            confidence: 1.0,
            reason: 'execution.json not found',
        };
    }

    try {
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

        // Check completion status
        if (execution.completion?.status === 'completed') {
            return {
                completed: true,
                confidence: 1.0,
                reason: 'completion.status is completed',
            };
        }

        // Check overall status
        if (execution.status === 'completed') {
            return {
                completed: true,
                confidence: 0.9,
                reason: 'status is completed',
            };
        }

        // Check if blocked
        if (execution.status === 'blocked') {
            return {
                completed: false,
                confidence: 1.0,
                reason: 'status is blocked',
            };
        }

        // Check all phases completed
        const phases = execution.phases || [];
        const allPhasesCompleted = phases.length > 0 && phases.every(p => p.status === 'completed');
        if (allPhasesCompleted) {
            return {
                completed: true,
                confidence: 0.85,
                reason: 'all phases completed',
            };
        }

        return {
            completed: false,
            confidence: 0.8,
            reason: 'task still in progress',
        };
    } catch (error) {
        return {
            completed: false,
            confidence: 0.5,
            reason: `Failed to parse execution.json: ${error.message}`,
        };
    }
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
    isCompletedFromExecution,
    hasApprovedCodeReview,
};
