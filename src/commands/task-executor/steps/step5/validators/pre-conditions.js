/**
 * Pre-conditions validator for step5
 * Verifies all pre-conditions before executing a phase
 */

const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const { isDangerousCommand } = require('../utils/security');

const exec = promisify(execCallback);

/**
 * Verify all pre-conditions for all phases
 * @param {Object} execution - execution.json content
 * @returns {Promise<{passed: boolean, blocked: boolean}>}
 */
const verifyPreConditions = async (execution) => {
    const logger = require('../../../../../shared/utils/logger');

    for (const phase of execution.phases || []) {
        for (const pc of phase.preConditions || []) {
            // Handle missing command field gracefully
            if (!pc.command || typeof pc.command !== 'string' || pc.command.trim() === '') {
                logger.info(`Skipping pre-condition without command: ${pc.check || 'unknown'}`);
                pc.passed = true;
                pc.evidence = 'No command specified - auto-passed';
                continue;
            }

            // Handle informational-only pre-conditions
            if (pc.command.startsWith('echo "no command') || pc.command === 'true') {
                logger.info(`Skipping informational pre-condition: ${pc.check || 'unknown'}`);
                pc.passed = true;
                pc.evidence = 'Informational pre-condition - auto-passed';
                continue;
            }

            logger.info(`Checking: ${pc.check || 'unknown'} with command: ${pc.command}`);

            // Security check
            if (isDangerousCommand(pc.command)) {
                pc.passed = false;
                pc.evidence = 'Command rejected: contains dangerous patterns';
                logger.warning(`Pre-condition FAILED: ${pc.check}. Evidence: ${pc.evidence}`);
                execution.status = 'blocked';
                return { passed: false, blocked: true };
            }

            try {
                const { stdout } = await exec(pc.command, { timeout: 5000 });
                pc.evidence = stdout.trim();
                const expectedValue = pc.expected || '';
                pc.passed = expectedValue === '' || stdout.includes(expectedValue);
            } catch (error) {
                pc.evidence = error.killed
                    ? 'Command timed out after 5000ms'
                    : error.message;
                pc.passed = false;
            }

            if (!pc.passed) {
                logger.warning(`Pre-condition FAILED: ${pc.check}. Evidence: ${pc.evidence}`);
                execution.status = 'blocked';
                return { passed: false, blocked: true };
            }
        }
    }

    logger.info('All pre-conditions passed');
    return { passed: true, blocked: false };
};

module.exports = {
    verifyPreConditions,
};
