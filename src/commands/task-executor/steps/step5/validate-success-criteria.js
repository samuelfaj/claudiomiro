const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const fs = require('fs');
const path = require('path');

const exec = promisify(execCallback);

/**
 * Parses BLUEPRINT.md §3.2 Success Criteria table
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {Array<Object>} Array of success criteria objects
 */
const parseSuccessCriteriaTable = (blueprintContent) => {
    const criteria = [];

    // Find §3.2 section
    const section32Match = blueprintContent.match(/###\s*3\.2\s+Success Criteria.*?\n([\s\S]*?)(?=\n###|\n##|$)/i);
    if (!section32Match) {
        return criteria;
    }

    const section32Content = section32Match[1];

    // Find markdown table
    const tableMatch = section32Content.match(/\|.*Criterion.*\|.*Command.*\|\s*\n\|[\s\S]*?\n((?:\|.*\|.*\|\s*\n)+)/i);
    if (!tableMatch) {
        return criteria;
    }

    const tableRows = tableMatch[1].trim().split('\n');

    for (const row of tableRows) {
        const cells = row.split('|').map(cell => cell.trim()).filter(Boolean);

        if (cells.length >= 2) {
            const criterion = cells[0];
            const command = cells[1];

            // Skip header separator rows
            if (criterion.startsWith('---') || command.startsWith('---')) {
                continue;
            }

            // Extract command from backticks if present
            const commandClean = command.replace(/`/g, '').trim();

            if (commandClean && criterion) {
                criteria.push({
                    criterion,
                    command: commandClean,
                    source: 'BLUEPRINT.md §3.2',
                });
            }
        }
    }

    return criteria;
};

/**
 * Evaluates if command output matches expected result
 * @param {string} stdout - Command output
 * @param {string} command - Original command
 * @returns {boolean} true if output indicates success
 */
const evaluateExpected = (stdout, command) => {
    const output = stdout.toLowerCase().trim();

    // grep commands: success if any output (match found)
    if (command.includes('grep')) {
        return output.length > 0;
    }

    // Syntax check commands: success if no errors
    if (command.includes('-l') || command.includes('--check') || command.includes('lint')) {
        // "No syntax errors" is a success message
        if (output.includes('no') && output.includes('error')) {
            return true;
        }
        // "Error:" or "Fatal:" indicates failure
        if (output.includes('error:') || output.includes('fatal')) {
            return false;
        }
        // Default: no errors in output means success
        return true;
    }

    // Test commands: success if no failures
    if (command.includes('test')) {
        return !output.includes('failed') && !output.includes('error');
    }

    // awk commands checking for PASS
    if (command.includes('awk') && command.includes('PASS')) {
        return output.includes('pass');
    }

    // File existence checks
    if (command.startsWith('test -f') || command.startsWith('test -d')) {
        return true; // If command succeeds, file exists
    }

    // Default: any output means success
    return output.length > 0;
};

/**
 * Executes ALL success criteria from BLUEPRINT.md §3.2
 * @param {string} task - Task identifier
 * @param {Object} options - Options
 * @param {string} options.cwd - Working directory
 * @param {string} options.claudiomiroFolder - Path to .claudiomiro folder
 * @returns {Promise<Array<Object>>} Results array with pass/fail for each criterion
 */
const validateSuccessCriteria = async (task, { cwd, claudiomiroFolder }) => {
    const logger = require('../../../../shared/utils/logger');

    const blueprintPath = path.join(claudiomiroFolder, task, 'BLUEPRINT.md');

    if (!fs.existsSync(blueprintPath)) {
        logger.warning('BLUEPRINT.md not found, skipping success criteria validation');
        return [];
    }

    const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
    const criteria = parseSuccessCriteriaTable(blueprintContent);

    if (criteria.length === 0) {
        logger.info('No success criteria found in BLUEPRINT.md §3.2');
        return [];
    }

    logger.info(`Found ${criteria.length} success criteria to validate`);

    const results = [];

    for (const criterion of criteria) {
        try {
            logger.info(`Running: ${criterion.command}`);

            const { stdout, stderr } = await exec(criterion.command, {
                cwd,
                timeout: 30000, // 30 second timeout
                encoding: 'utf8',
            });

            const output = stdout || stderr || '';
            const passed = evaluateExpected(output, criterion.command);

            results.push({
                criterion: criterion.criterion,
                command: criterion.command,
                source: criterion.source,
                expected: 'Command should succeed',
                passed: passed,
                evidence: output.trim().substring(0, 500), // Limit evidence length
            });

            if (passed) {
                logger.info(`✅ PASSED: ${criterion.criterion}`);
            } else {
                logger.error(`❌ FAILED: ${criterion.criterion}`);
                logger.error(`   Command: ${criterion.command}`);
                logger.error(`   Output: ${output.trim().substring(0, 200)}`);
            }

        } catch (error) {
            // Command failed (non-zero exit code)
            const output = error.stdout || error.stderr || error.message;

            // Check if this is expected to fail for grep (no match found)
            const passed = false;

            results.push({
                criterion: criterion.criterion,
                command: criterion.command,
                source: criterion.source,
                expected: 'Command should succeed',
                passed: passed,
                evidence: output.toString().trim().substring(0, 500),
            });

            logger.error(`❌ FAILED: ${criterion.criterion}`);
            logger.error(`   Command: ${criterion.command}`);
            logger.error(`   Error: ${output.toString().trim().substring(0, 200)}`);
        }
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    logger.info(`Success Criteria Results: ${passedCount} passed, ${failedCount} failed`);

    return results;
};

module.exports = {
    validateSuccessCriteria,
    parseSuccessCriteriaTable,
    evaluateExpected,
};
