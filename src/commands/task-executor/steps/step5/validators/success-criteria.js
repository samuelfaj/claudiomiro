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
 * Attempts to find §3.2 section using multiple regex patterns (tolerant parsing)
 * @param {string} content - BLUEPRINT.md content
 * @returns {string|null} Section content or null
 */
const findSection32WithFallback = (content) => {
    const sectionPatterns = [
        /###\s*3\.2\s+Success Criteria.*?\n([\s\S]*?)(?=\n###|\n##|$)/i,
        /##\s*3\.2\s+Success Criteria.*?\n([\s\S]*?)(?=\n##|$)/i,
        /###\s*Success Criteria.*?\n([\s\S]*?)(?=\n###|\n##|$)/i,
        /##\s*Success Criteria.*?\n([\s\S]*?)(?=\n##|$)/i,
        /\*\*Success Criteria\*\*.*?\n([\s\S]*?)(?=\n##|\n\*\*|$)/i,
        /3\.2[.)]\s*Success Criteria.*?\n([\s\S]*?)(?=\n##|\n###|$)/i,
    ];

    for (const pattern of sectionPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

/**
 * Attempts to find table in section using multiple patterns (tolerant parsing)
 * Returns table rows and detected column count
 * @param {string} sectionContent - Section content to parse
 * @returns {Object} {rows: Array<string>, columnCount: number}
 */
const findTableWithFallback = (sectionContent) => {
    // Pattern for detecting tables with different column counts
    // Try to find any table-like structure
    const tablePatterns = [
        // 5-column table (new format)
        {
            pattern: /\|\s*Criterion\s*\|[\s\S]*?\n\|[\s-]+\|[\s-]+\|[\s-]+\|[\s-]+\|[\s-]+\|\s*\n((?:\|.*\|.*\|.*\|.*\|.*\|\s*\n?)+)/i,
            columns: 5,
        },
        // 4-column table
        {
            pattern: /\|\s*Criterion\s*\|[\s\S]*?\n\|[\s-]+\|[\s-]+\|[\s-]+\|[\s-]+\|\s*\n((?:\|.*\|.*\|.*\|.*\|\s*\n?)+)/i,
            columns: 4,
        },
        // 3-column table
        {
            pattern: /\|\s*Criterion\s*\|[\s\S]*?\n\|[\s-]+\|[\s-]+\|[\s-]+\|\s*\n((?:\|.*\|.*\|.*\|\s*\n?)+)/i,
            columns: 3,
        },
        // 2-column table (old format)
        {
            pattern: /\|.*Criterion.*\|.*\n\|[\s-]+\|[\s-]+\|\s*\n((?:\|.*\|.*\|\s*\n?)+)/i,
            columns: 2,
        },
        // Generic table fallback - any markdown table
        {
            pattern: /\|[^|\n]+\|[^|\n]*\|\s*\n\|[\s:-]+\|[\s:-]+\|\s*\n((?:\|[^|\n]+\|[^|\n]*\|\s*\n?)+)/i,
            columns: 0, // Will detect from actual content
        },
    ];

    for (const { pattern, columns } of tablePatterns) {
        const match = sectionContent.match(pattern);
        if (match && match[1]) {
            const rows = match[1].trim().split('\n').filter(row => row.trim());
            return { rows, columnCount: columns };
        }
    }

    return { rows: [], columnCount: 0 };
};

/**
 * Extracts command from a cell (handles backticks, shell patterns)
 * @param {string} cell - Cell content
 * @returns {string|null} Extracted command or null
 */
const extractCommandFromCell = (cell) => {
    if (!cell || cell.trim() === '-' || cell.trim() === '') {
        return null;
    }

    // Remove backticks and clean
    const cleaned = cell.replace(/`/g, '').trim();

    // Check if it looks like an executable command
    const commandPatterns = [
        /^(grep|find|test|npm|yarn|python|php|node|go|java|cargo|ruby|bash|sh|cat|echo|awk|sed|curl|wget|mysql|psql)/i,
        /^\//,  // Absolute path
        /^\.\//,  // Relative path
    ];

    for (const pattern of commandPatterns) {
        if (pattern.test(cleaned)) {
            return cleaned;
        }
    }

    // If it contains shell operators, likely a command
    if (/[|&><;]/.test(cleaned)) {
        return cleaned;
    }

    return cleaned;
};

/**
 * Parses BLUEPRINT.md §3.2 Success Criteria table (flexible format)
 * Supports 2, 3, 4, and 5-column formats with fallback patterns
 * @param {string} blueprintContent - BLUEPRINT.md content
 * @returns {Array<Object>} Array of success criteria objects
 */
const parseSuccessCriteriaTable = (blueprintContent) => {
    const criteria = [];
    const logger = require('../../../../../shared/utils/logger');

    // Find §3.2 section using fallback patterns
    const section32Content = findSection32WithFallback(blueprintContent);
    if (!section32Content) {
        return criteria;
    }

    // Find table using fallback patterns
    const { rows: tableRows, columnCount } = findTableWithFallback(section32Content);

    if (tableRows.length === 0) {
        return criteria;
    }

    // Determine format type
    const isFiveColumn = columnCount === 5;

    for (const row of tableRows) {
        const cells = row.split('|').map(cell => cell.trim()).filter(Boolean);

        // Skip header separator rows
        if (cells[0] && cells[0].startsWith('---')) {
            continue;
        }

        // Skip if first cell is empty or separator
        if (!cells[0] || cells[0].match(/^[-:]+$/)) {
            continue;
        }

        const criterion = cells[0];
        const cellCount = cells.length;

        if (isFiveColumn && cellCount >= 5) {
            // 5-column format: | Criterion | Source | Testable? | Command | Manual Check |
            const [, source, testable, command, manualCheck] = cells;

            const commandClean = command ? command.replace(/`/g, '').trim() : '';
            const manualCheckClean = manualCheck ? manualCheck.trim() : '';
            const testableType = (testable || 'AUTO').toUpperCase();

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
                    manualCheck: isManual && manualCheckClean !== '-' ? manualCheckClean : null,
                });
            } else if (isManual && manualCheckClean && manualCheckClean !== '-') {
                // Manual check only (no automated command)
                criteria.push({
                    criterion,
                    command: null,
                    source: source || 'BLUEPRINT.md §3.2',
                    testType: 'MANUAL',
                    manualCheck: manualCheckClean,
                });
            }

        } else if (columnCount === 4 && cellCount >= 4) {
            // 4-column format: | Criterion | Testable? | Command | Manual Check |
            // OR: | Criterion | Source | Command | Notes |
            const [, col2, col3, col4] = cells;

            // Try to detect which format
            const col2Upper = (col2 || '').toUpperCase();
            const isTestableCol = col2Upper === 'AUTO' || col2Upper === 'MANUAL' || col2Upper === 'BOTH';

            if (isTestableCol) {
                // Format: | Criterion | Testable? | Command | Manual Check |
                const testableType = col2Upper;
                const commandClean = col3 ? col3.replace(/`/g, '').trim() : '';
                const manualCheckClean = col4 ? col4.trim() : '';

                const isAuto = testableType === 'AUTO' || testableType === 'BOTH';
                const isManual = testableType === 'MANUAL' || testableType === 'BOTH';

                if (isAuto && commandClean && commandClean !== '-') {
                    criteria.push({
                        criterion,
                        command: commandClean,
                        source: 'BLUEPRINT.md §3.2',
                        testType: isManual ? 'BOTH' : 'AUTO',
                        manualCheck: isManual && manualCheckClean !== '-' ? manualCheckClean : null,
                    });
                } else if (isManual && manualCheckClean && manualCheckClean !== '-') {
                    criteria.push({
                        criterion,
                        command: null,
                        source: 'BLUEPRINT.md §3.2',
                        testType: 'MANUAL',
                        manualCheck: manualCheckClean,
                    });
                }
            } else {
                // Format: | Criterion | Source | Command | Notes | (or similar)
                const source = col2;
                const commandClean = extractCommandFromCell(col3);

                if (commandClean && commandClean !== '-') {
                    criteria.push({
                        criterion,
                        command: commandClean,
                        source: source || 'BLUEPRINT.md §3.2',
                        testType: 'AUTO',
                        manualCheck: null,
                    });
                }
            }

        } else if (columnCount === 3 && cellCount >= 3) {
            // 3-column format: | Criterion | Command | Notes |
            // OR: | Criterion | Source | Command |
            const [, col2, col3] = cells;

            // Try to detect command location
            const cmd2 = extractCommandFromCell(col2);
            const cmd3 = extractCommandFromCell(col3);

            // If col3 looks more like a command, use it
            const commandClean = cmd3 && /^(grep|find|test|npm|yarn|python|php|node|go|java|cargo)/i.test(cmd3.replace(/`/g, ''))
                ? cmd3
                : (cmd2 || cmd3);

            if (commandClean && commandClean !== '-') {
                criteria.push({
                    criterion,
                    command: commandClean.replace(/`/g, '').trim(),
                    source: 'BLUEPRINT.md §3.2',
                    testType: 'AUTO',
                    manualCheck: null,
                });
            }

        } else if (cellCount >= 2) {
            // 2-column format: | Criterion | Command |
            const command = cells[1];

            const commandClean = command ? command.replace(/`/g, '').trim() : '';

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
    const logger = require('../../../../../shared/utils/logger');

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
    findSection32WithFallback,
    findTableWithFallback,
    extractCommandFromCell,
};
