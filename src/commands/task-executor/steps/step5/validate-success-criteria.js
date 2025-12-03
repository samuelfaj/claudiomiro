const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const fs = require('fs');
const path = require('path');

const exec = promisify(execCallback);

/**
 * Checks if a command looks like a human-readable description rather than executable command
 * @param {string} command - Command string to check
 * @returns {Object} {isInvalid: boolean, reason: string}
 */
const detectNonExecutableCommand = (command) => {
    // Patterns that indicate human descriptions, not commands
    const invalidPatterns = [
        { pattern: /^(review|check|verify|ensure|confirm|validate)\s/i, reason: 'Starts with human action verb (review/check/verify)' },
        { pattern: /^database query:/i, reason: 'Starts with "Database query:" instead of actual DB CLI command' },
        { pattern: /^manual/i, reason: 'Marked as manual verification' },
        { pattern: /\(.*validation.*\)/i, reason: 'Contains parenthetical notes instead of being executable' },
        { pattern: /^search for/i, reason: 'Starts with "search for" instead of grep/find command' },
    ];

    for (const { pattern, reason } of invalidPatterns) {
        if (pattern.test(command)) {
            return { isInvalid: true, reason };
        }
    }

    return { isInvalid: false, reason: '' };
};

/**
 * Parses BLUEPRINT.md §3.2 Success Criteria table (5-column format)
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {Array<Object>} Array of success criteria objects
 */
const parseSuccessCriteriaTable = (blueprintContent) => {
    const criteria = [];
    const logger = require('../../../../shared/utils/logger');

    // Find §3.2 section
    const section32Match = blueprintContent.match(/###\s*3\.2\s+Success Criteria.*?\n([\s\S]*?)(?=\n###|\n##|$)/i);
    if (!section32Match) {
        return criteria;
    }

    const section32Content = section32Match[1];

    // Try new 5-column format first: | Criterion | Source | Testable? | Command | Manual Check |
    let tableMatch = section32Content.match(/\|\s*Criterion\s*\|[\s\S]*?\n\|[\s-]+\|[\s-]+\|[\s-]+\|[\s-]+\|[\s-]+\|\s*\n((?:\|.*\|.*\|.*\|.*\|.*\|\s*\n)+)/i);
    const isFiveColumn = !!tableMatch;

    // Fallback to old 2-column format: | Criterion | Command |
    if (!tableMatch) {
        tableMatch = section32Content.match(/\|.*Criterion.*\|.*Command.*\|\s*\n\|[\s\S]*?\n((?:\|.*\|.*\|\s*\n)+)/i);
    }

    if (!tableMatch) {
        return criteria;
    }

    const tableRows = tableMatch[1].trim().split('\n');

    for (const row of tableRows) {
        const cells = row.split('|').map(cell => cell.trim()).filter(Boolean);

        // Skip header separator rows
        if (cells[0] && cells[0].startsWith('---')) {
            continue;
        }

        if (isFiveColumn && cells.length >= 5) {
            // New format: | Criterion | Source | Testable? | Command | Manual Check |
            const [criterion, source, testable, command, manualCheck] = cells;

            const commandClean = command.replace(/`/g, '').trim();
            const manualCheckClean = manualCheck.trim();
            const testableType = testable.toUpperCase();

            // Skip empty criteria
            if (!criterion) continue;

            // Determine test type
            const isAuto = testableType === 'AUTO' || testableType === 'BOTH';
            const isManual = testableType === 'MANUAL' || testableType === 'BOTH';

            if (isAuto && commandClean && commandClean !== '-') {
                // Automated test with command
                const validation = detectNonExecutableCommand(commandClean);
                if (validation.isInvalid) {
                    logger.warning(`⚠️  Success criterion may not be executable: "${criterion}"`);
                    logger.warning(`   Command: "${commandClean}"`);
                    logger.warning(`   Reason: ${validation.reason}`);
                    logger.warning('   Expected: Actual shell command (e.g., grep, test, mysql -e, etc.)');
                }

                criteria.push({
                    criterion,
                    command: commandClean,
                    source: source || 'BLUEPRINT.md §3.2',
                    testType: isManual ? 'BOTH' : 'AUTO',
                    manualCheck: isManual ? manualCheckClean : null,
                });
            } else if (isManual && manualCheckClean && manualCheckClean !== '-') {
                // Manual check only (no automated command)
                criteria.push({
                    criterion,
                    command: null, // No automated command
                    source: source || 'BLUEPRINT.md §3.2',
                    testType: 'MANUAL',
                    manualCheck: manualCheckClean,
                });
            }

        } else if (!isFiveColumn && cells.length >= 2) {
            // Old format: | Criterion | Command |
            const criterion = cells[0];
            const command = cells[1];

            const commandClean = command.replace(/`/g, '').trim();

            if (commandClean && criterion) {
                // Warn if command looks like a human description
                const validation = detectNonExecutableCommand(commandClean);
                if (validation.isInvalid) {
                    logger.warning(`⚠️  Success criterion may not be executable: "${criterion}"`);
                    logger.warning(`   Command: "${commandClean}"`);
                    logger.warning(`   Reason: ${validation.reason}`);
                    logger.warning('   Expected: Actual shell command (e.g., grep, test, mysql -e, etc.)');
                    logger.warning('   Consider using new 5-column format with Manual Check column');
                }

                criteria.push({
                    criterion,
                    command: commandClean,
                    source: 'BLUEPRINT.md §3.2',
                    testType: 'AUTO',
                    manualCheck: null,
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
        // Handle MANUAL-only checks (no automated command)
        if (criterion.testType === 'MANUAL') {
            logger.info(`📋 MANUAL CHECK: ${criterion.criterion}`);
            logger.info(`   Action: ${criterion.manualCheck}`);

            results.push({
                criterion: criterion.criterion,
                command: null,
                source: criterion.source,
                expected: 'Manual verification required',
                passed: null, // null indicates manual check (not auto-testable)
                evidence: `MANUAL: ${criterion.manualCheck}`,
                testType: 'MANUAL',
                manualCheck: criterion.manualCheck,
            });
            continue;
        }

        // Handle AUTO and BOTH checks (has automated command)
        try {
            logger.info(`Running: ${criterion.command}`);

            const { stdout, stderr } = await exec(criterion.command, {
                cwd,
                timeout: 30000, // 30 second timeout
                encoding: 'utf8',
            });

            const output = stdout || stderr || '';
            const passed = evaluateExpected(output, criterion.command);

            const result = {
                criterion: criterion.criterion,
                command: criterion.command,
                source: criterion.source,
                expected: 'Command should succeed',
                passed: passed,
                evidence: output.trim().substring(0, 500), // Limit evidence length
                testType: criterion.testType,
            };

            if (criterion.manualCheck) {
                result.manualCheck = criterion.manualCheck;
            }

            results.push(result);

            if (passed) {
                logger.info(`✅ PASSED: ${criterion.criterion}`);
                if (criterion.testType === 'BOTH') {
                    logger.info(`   📋 Also verify manually: ${criterion.manualCheck}`);
                }
            } else {
                logger.error(`❌ FAILED: ${criterion.criterion}`);
                logger.error(`   Command: ${criterion.command}`);
                logger.error(`   Output: ${output.trim().substring(0, 200)}`);
            }

        } catch (error) {
            // Command failed (non-zero exit code)
            const output = error.stdout || error.stderr || error.message;

            const result = {
                criterion: criterion.criterion,
                command: criterion.command,
                source: criterion.source,
                expected: 'Command should succeed',
                passed: false,
                evidence: output.toString().trim().substring(0, 500),
                testType: criterion.testType,
            };

            if (criterion.manualCheck) {
                result.manualCheck = criterion.manualCheck;
            }

            results.push(result);

            logger.error(`❌ FAILED: ${criterion.criterion}`);
            logger.error(`   Command: ${criterion.command}`);
            logger.error(`   Error: ${output.toString().trim().substring(0, 200)}`);
        }
    }

    const passedCount = results.filter(r => r.passed === true).length;
    const failedCount = results.filter(r => r.passed === false).length;
    const manualCount = results.filter(r => r.passed === null).length;

    logger.info(`Success Criteria Results: ${passedCount} passed, ${failedCount} failed${manualCount > 0 ? `, ${manualCount} manual checks` : ''}`);

    return results;
};

module.exports = {
    validateSuccessCriteria,
    parseSuccessCriteriaTable,
    evaluateExpected,
    detectNonExecutableCommand,
};
