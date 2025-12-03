const {
    validateSuccessCriteria,
    parseSuccessCriteriaTable,
    evaluateExpected,
} = require('./validate-success-criteria');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');

jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

jest.mock('util', () => ({
    promisify: jest.fn((fn) => fn),
}));

jest.mock('../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('validate-success-criteria', () => {
    describe('parseSuccessCriteriaTable', () => {
        test('should extract criteria from BLUEPRINT.md §3.2 table', () => {
            const blueprintContent = `
# BLUEPRINT

## 3. EXECUTION CONTRACT

### 3.2 Success Criteria (VERIFY AFTER COMPLETE):
| Criterion | Command |
|-----------|---------|
| recurringBilling query used | \`grep -n "recurringBillingData::getActiveRowsByUser" jobs/autopay.php\` |
| No syntax errors | \`php -l jobs/autopay.php\` |
| Student enrollment verified | \`grep -n "studentData::isCurrentlyEnrolled" jobs/autopay.php\` |
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toHaveLength(3);
            expect(criteria[0]).toEqual({
                criterion: 'recurringBilling query used',
                command: 'grep -n "recurringBillingData::getActiveRowsByUser" jobs/autopay.php',
                source: 'BLUEPRINT.md §3.2',
            });
            expect(criteria[1]).toEqual({
                criterion: 'No syntax errors',
                command: 'php -l jobs/autopay.php',
                source: 'BLUEPRINT.md §3.2',
            });
            expect(criteria[2]).toEqual({
                criterion: 'Student enrollment verified',
                command: 'grep -n "studentData::isCurrentlyEnrolled" jobs/autopay.php',
                source: 'BLUEPRINT.md §3.2',
            });
        });

        test('should return empty array if §3.2 section not found', () => {
            const blueprintContent = `
# BLUEPRINT

## 3. EXECUTION CONTRACT

### 3.1 Pre-Conditions
Some content here
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toEqual([]);
        });

        test('should return empty array if no table found in §3.2', () => {
            const blueprintContent = `
# BLUEPRINT

## 3. EXECUTION CONTRACT

### 3.2 Success Criteria
Just text, no table
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toEqual([]);
        });

        test('should handle table with extra columns', () => {
            const blueprintContent = `
### 3.2 Success Criteria:
| Criterion | Command | Notes |
|-----------|---------|-------|
| Test passes | \`npm test\` | Should be green |
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toHaveLength(1);
            expect(criteria[0].criterion).toBe('Test passes');
            expect(criteria[0].command).toBe('npm test');
        });
    });

    describe('evaluateExpected', () => {
        test('should pass grep command if output exists', () => {
            const stdout = 'Line 145: recurringBillingData::getActiveRowsByUser';
            const command = 'grep -n "recurringBillingData" file.php';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(true);
        });

        test('should fail grep command if no output', () => {
            const stdout = '';
            const command = 'grep -n "nonexistent" file.php';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(false);
        });

        test('should pass syntax check if no errors', () => {
            const stdout = 'No syntax errors detected in file.php';
            const command = 'php -l file.php';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(true);
        });

        test('should fail syntax check if errors present', () => {
            const stdout = 'Parse error: syntax error in file.php';
            const command = 'php -l file.php';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(false);
        });

        test('should pass test command if no failures', () => {
            const stdout = 'Tests passed successfully';
            const command = 'npm test';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(true);
        });

        test('should fail test command if failures present', () => {
            const stdout = '5 tests failed';
            const command = 'npm test';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(false);
        });

        test('should pass awk PASS check if output contains pass', () => {
            const stdout = 'PASS';
            const command = 'grep -c "log" file.php | awk \'{if($1>=10) print "PASS"; else print "FAIL"}\'';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(true);
        });

        test('should pass file existence check', () => {
            const stdout = '';
            const command = 'test -f file.php';

            const result = evaluateExpected(stdout, command);

            expect(result).toBe(true);
        });
    });

    describe('validateSuccessCriteria', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should return empty array if BLUEPRINT.md not found', async () => {
            fs.existsSync.mockReturnValue(false);

            const results = await validateSuccessCriteria('TASK0', {
                cwd: '/project',
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(results).toEqual([]);
        });

        test('should return empty array if no criteria found', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# BLUEPRINT\n\nNo success criteria section');

            const results = await validateSuccessCriteria('TASK0', {
                cwd: '/project',
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(results).toEqual([]);
        });

        test('should execute all success criteria commands and return results', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
### 3.2 Success Criteria:
| Criterion | Command |
|-----------|---------|
| Query used | \`grep -n "getActiveRows" file.php\` |
| No errors | \`php -l file.php\` |
            `);

            // Mock exec
            const { exec } = require('child_process');
            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('grep')) {
                    return { stdout: 'Line 145: getActiveRows', stderr: '' };
                } else if (cmd.includes('php -l')) {
                    return { stdout: 'No syntax errors', stderr: '' };
                }
            });

            const results = await validateSuccessCriteria('TASK0', {
                cwd: '/project',
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(results).toHaveLength(2);
            expect(results[0].criterion).toBe('Query used');
            expect(results[0].passed).toBe(true);
            expect(results[1].criterion).toBe('No errors');
            expect(results[1].passed).toBe(true);
        });

        test('should handle command execution errors', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
### 3.2 Success Criteria:
| Criterion | Command |
|-----------|---------|
| Test passes | \`npm test\` |
            `);

            // Mock exec to throw error
            const { exec } = require('child_process');
            exec.mockImplementation(async (_cmd, _opts) => {
                const error = new Error('Command failed');
                error.stdout = '';
                error.stderr = 'Tests failed: 5 failures';
                throw error;
            });

            const results = await validateSuccessCriteria('TASK0', {
                cwd: '/project',
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(results).toHaveLength(1);
            expect(results[0].criterion).toBe('Test passes');
            expect(results[0].passed).toBe(false);
            expect(results[0].evidence).toContain('Tests failed');
        });
    });
});
