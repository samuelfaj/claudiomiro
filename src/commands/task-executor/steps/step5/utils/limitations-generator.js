/**
 * Limitations Generator
 *
 * Generates LIMITATIONS.md files documenting blocked criteria,
 * workarounds, and recommendations for future work.
 */

const fs = require('fs');
const path = require('path');

const { CriterionStatus } = require('../validators/criteria-relaxation');

/**
 * Generates the content for LIMITATIONS.md
 * @param {Object} execution - execution.json content
 * @param {Object} options - Generation options
 * @returns {string|null} Generated content or null if no limitations
 */
const generateLimitationsContent = (execution, options = {}) => {
    const {
        taskId = execution.taskId || 'Unknown',
        includeTimestamp = true,
    } = options;

    const blockedCriteria = (execution.successCriteria || [])
        .filter(c => c.status === CriterionStatus.BLOCKED);

    if (blockedCriteria.length === 0) {
        return null;
    }

    const timestamp = includeTimestamp
        ? `Generated: ${new Date().toISOString()}\n\n`
        : '';

    const sections = [
        '# Limitations',
        '',
        `Task: ${taskId}`,
        timestamp,
        '---',
        '',
        '## Summary',
        '',
        `This task completed with **${blockedCriteria.length} blocked criteria** that could not be automatically validated.`,
        'Each blocked criterion has a documented workaround that should be verified manually.',
        '',
        '---',
        '',
        '## Blocked Success Criteria',
        '',
    ];

    for (const criterion of blockedCriteria) {
        sections.push(`### ${criterion.criterion || 'Unnamed Criterion'}`);
        sections.push('');
        sections.push('| Field | Value |');
        sections.push('|-------|-------|');
        sections.push('| **Status** | Blocked |');
        sections.push(`| **Reason** | ${escapeMarkdown(criterion.blockReason || 'Not specified')} |`);
        sections.push(`| **Workaround** | ${escapeMarkdown(criterion.workaround || 'Not specified')} |`);

        if (criterion.attemptCount) {
            sections.push(`| **Attempts** | ${criterion.attemptCount} |`);
        }

        if (criterion.blockedAt) {
            sections.push(`| **Blocked At** | ${criterion.blockedAt} |`);
        }

        if (criterion.lastError) {
            sections.push(`| **Last Error** | ${escapeMarkdown(criterion.lastError)} |`);
        }

        sections.push('');
    }

    sections.push('---');
    sections.push('');
    sections.push('## Recommendations for Future');
    sections.push('');

    for (const criterion of blockedCriteria) {
        const recommendation = criterion.forFuture
            || `Review and address blocked criterion: "${criterion.criterion}"`;
        sections.push(`- [ ] ${recommendation}`);
    }

    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('## Auto-Adjust Information');
    sections.push('');

    if (execution.autoAdjustMode) {
        sections.push(`Auto-adjust mode was enabled: ${execution.autoAdjustReason || 'After multiple failed attempts'}`);
        if (execution.autoAdjustEnabledAt) {
            sections.push(`Enabled at: ${execution.autoAdjustEnabledAt}`);
        }
    } else {
        sections.push('Auto-adjust mode was not enabled for this task.');
    }

    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('## How to Resolve');
    sections.push('');
    sections.push('1. Review each blocked criterion above');
    sections.push('2. Follow the workaround instructions');
    sections.push('3. Check off recommendations as they are addressed');
    sections.push('4. Re-run validation if environment changes');
    sections.push('');

    return sections.join('\n');
};

/**
 * Escapes markdown special characters in table cells
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const escapeMarkdown = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
};

/**
 * Generates and writes LIMITATIONS.md to the task folder
 * @param {Object} execution - execution.json content
 * @param {string} taskFolder - Path to task folder
 * @param {Object} options - Generation options
 * @returns {{generated: boolean, path: string|null, blockedCount: number}}
 */
const generateLimitations = (execution, taskFolder, options = {}) => {
    const content = generateLimitationsContent(execution, options);

    if (!content) {
        return {
            generated: false,
            path: null,
            blockedCount: 0,
        };
    }

    const limitationsPath = path.join(taskFolder, 'LIMITATIONS.md');

    // Check if file exists and append or replace
    const { append = false } = options;

    if (append && fs.existsSync(limitationsPath)) {
        const existingContent = fs.readFileSync(limitationsPath, 'utf-8');
        const separator = '\n\n---\n\n# Previous Limitations\n\n';
        fs.writeFileSync(limitationsPath, content + separator + existingContent, 'utf-8');
    } else {
        fs.writeFileSync(limitationsPath, content, 'utf-8');
    }

    const blockedCount = (execution.successCriteria || [])
        .filter(c => c.status === CriterionStatus.BLOCKED).length;

    return {
        generated: true,
        path: limitationsPath,
        blockedCount,
    };
};

/**
 * Checks if LIMITATIONS.md should be generated
 * @param {Object} execution - execution.json content
 * @returns {boolean}
 */
const shouldGenerateLimitations = (execution) => {
    const blockedCriteria = (execution.successCriteria || [])
        .filter(c => c.status === CriterionStatus.BLOCKED);

    return blockedCriteria.length > 0;
};

/**
 * Gets a summary of blocked criteria for logging
 * @param {Object} execution - execution.json content
 * @returns {Object} Summary information
 */
const getBlockedSummary = (execution) => {
    const criteria = execution.successCriteria || [];
    const blocked = criteria.filter(c => c.status === CriterionStatus.BLOCKED);
    const passed = criteria.filter(c => c.passed === true);

    return {
        total: criteria.length,
        passed: passed.length,
        blocked: blocked.length,
        failed: criteria.length - passed.length - blocked.length,
        blockedCriteria: blocked.map(c => ({
            criterion: c.criterion,
            reason: c.blockReason,
        })),
    };
};

module.exports = {
    generateLimitationsContent,
    generateLimitations,
    shouldGenerateLimitations,
    getBlockedSummary,
    escapeMarkdown,
};
