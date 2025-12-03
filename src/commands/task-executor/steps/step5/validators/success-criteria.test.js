const {
    validateSuccessCriteria,
    parseSuccessCriteriaTable,
    evaluateExpected,
    detectNonExecutableCommand,
    findSection32WithFallback,
    findTableWithFallback,
    extractCommandFromCell,
} = require('./success-criteria');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');

jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

jest.mock('util', () => ({
    promisify: jest.fn((fn) => fn),
}));

jest.mock('../../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('validate-success-criteria', () => {
    describe('parseSuccessCriteriaTable', () => {
        test('should extract criteria from new 5-column BLUEPRINT.md §3.2 table', () => {
            const blueprintContent = `
# BLUEPRINT

## 3. EXECUTION CONTRACT

### 3.2 Success Criteria (VERIFY AFTER COMPLETE):
| Criterion | Source | Testable? | Command | Manual Check |
|-----------|--------|-----------|---------|--------------|
| recurringBilling query used | AI_PROMPT:L45 | AUTO | \`grep -n "recurringBillingData::getActiveRowsByUser" jobs/autopay.php\` | - |
| No syntax errors | AI_PROMPT:L47 | AUTO | \`php -l jobs/autopay.php\` | - |
| Logs show success | AI_PROMPT:L50 | MANUAL | - | Review Google Cloud Logs for success messages |
| Email sent correctly | AI_PROMPT:L52 | BOTH | \`grep "Email sent" logs/app.log\` | Check Postmark dashboard |
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toHaveLength(4);

            // AUTO test
            expect(criteria[0]).toMatchObject({
                criterion: 'recurringBilling query used',
                command: 'grep -n "recurringBillingData::getActiveRowsByUser" jobs/autopay.php',
                source: 'AI_PROMPT:L45',
                testType: 'AUTO',
                manualCheck: null,
            });

            // AUTO test
            expect(criteria[1]).toMatchObject({
                criterion: 'No syntax errors',
                command: 'php -l jobs/autopay.php',
                source: 'AI_PROMPT:L47',
                testType: 'AUTO',
            });

            // MANUAL test
            expect(criteria[2]).toMatchObject({
                criterion: 'Logs show success',
                command: null,
                source: 'AI_PROMPT:L50',
                testType: 'MANUAL',
                manualCheck: 'Review Google Cloud Logs for success messages',
            });

            // BOTH test
            expect(criteria[3]).toMatchObject({
                criterion: 'Email sent correctly',
                command: 'grep "Email sent" logs/app.log',
                source: 'AI_PROMPT:L52',
                testType: 'BOTH',
                manualCheck: 'Check Postmark dashboard',
            });
        });

        test('should still support old 2-column format for backwards compatibility', () => {
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
            expect(criteria[0]).toMatchObject({
                criterion: 'recurringBilling query used',
                command: 'grep -n "recurringBillingData::getActiveRowsByUser" jobs/autopay.php',
                source: 'BLUEPRINT.md §3.2',
                testType: 'AUTO',
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

        test('should handle 4-column table with Testable column', () => {
            const blueprintContent = `
### 3.2 Success Criteria:
| Criterion | Testable? | Command | Manual Check |
|-----------|-----------|---------|--------------|
| Query works | AUTO | \`grep "SELECT" file.sql\` | - |
| Logs valid | MANUAL | - | Review cloud logs |
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toHaveLength(2);
            expect(criteria[0]).toMatchObject({
                criterion: 'Query works',
                command: 'grep "SELECT" file.sql',
                testType: 'AUTO',
            });
            expect(criteria[1]).toMatchObject({
                criterion: 'Logs valid',
                command: null,
                testType: 'MANUAL',
                manualCheck: 'Review cloud logs',
            });
        });

        test('should handle 4-column table with Source column', () => {
            const blueprintContent = `
### 3.2 Success Criteria:
| Criterion | Source | Command | Notes |
|-----------|--------|---------|-------|
| API responds | AI_PROMPT:L10 | \`curl localhost:3000/health\` | Should return 200 |
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toHaveLength(1);
            expect(criteria[0]).toMatchObject({
                criterion: 'API responds',
                command: 'curl localhost:3000/health',
                source: 'AI_PROMPT:L10',
            });
        });

        test('should handle 3-column table (Criterion | Command | Notes)', () => {
            const blueprintContent = `
### 3.2 Success Criteria:
| Criterion | Command | Notes |
|-----------|---------|-------|
| Build passes | \`npm run build\` | No errors |
| Tests pass | \`npm test\` | All green |
            `;

            const criteria = parseSuccessCriteriaTable(blueprintContent);

            expect(criteria).toHaveLength(2);
            expect(criteria[0].criterion).toBe('Build passes');
            expect(criteria[0].command).toBe('npm run build');
            expect(criteria[1].criterion).toBe('Tests pass');
            expect(criteria[1].command).toBe('npm test');
        });
    });

    describe('findSection32WithFallback (tolerant parsing)', () => {
        test('should find section with ## Success Criteria format', () => {
            const content = `
# BLUEPRINT

## Success Criteria

| Criterion | Command |
|-----------|---------|
| Test passes | \`npm test\` |
            `;

            const section = findSection32WithFallback(content);
            expect(section).toBeTruthy();
            expect(section).toContain('Criterion');
        });

        test('should find section with **Success Criteria** format', () => {
            const content = `
# BLUEPRINT

**Success Criteria**

| Criterion | Command |
|-----------|---------|
| Build ok | \`npm run build\` |
            `;

            const section = findSection32WithFallback(content);
            expect(section).toBeTruthy();
            expect(section).toContain('Criterion');
        });

        test('should find section with 3.2) format', () => {
            const content = `
# BLUEPRINT

3.2) Success Criteria

| Criterion | Command |
|-----------|---------|
| Lint passes | \`npm run lint\` |
            `;

            const section = findSection32WithFallback(content);
            expect(section).toBeTruthy();
            expect(section).toContain('Criterion');
        });

        test('should return null if no section found', () => {
            const content = `
# BLUEPRINT

## Other Section
Some content
            `;

            const section = findSection32WithFallback(content);
            expect(section).toBeNull();
        });
    });

    describe('findTableWithFallback', () => {
        test('should detect 5-column table', () => {
            const sectionContent = `
| Criterion | Source | Testable? | Command | Manual Check |
|-----------|--------|-----------|---------|--------------|
| Test | AI:L1 | AUTO | \`npm test\` | - |
            `;

            const { rows, columnCount } = findTableWithFallback(sectionContent);
            expect(columnCount).toBe(5);
            expect(rows.length).toBeGreaterThan(0);
        });

        test('should detect 4-column table', () => {
            const sectionContent = `
| Criterion | Testable? | Command | Manual Check |
|-----------|-----------|---------|--------------|
| Test | AUTO | \`npm test\` | - |
            `;

            const { rows, columnCount } = findTableWithFallback(sectionContent);
            expect(columnCount).toBe(4);
            expect(rows.length).toBeGreaterThan(0);
        });

        test('should detect 3-column table', () => {
            const sectionContent = `
| Criterion | Command | Notes |
|-----------|---------|-------|
| Test | \`npm test\` | Should pass |
            `;

            const { rows, columnCount } = findTableWithFallback(sectionContent);
            expect(columnCount).toBe(3);
            expect(rows.length).toBeGreaterThan(0);
        });

        test('should detect 2-column table', () => {
            const sectionContent = `
| Criterion | Command |
|-----------|---------|
| Test | \`npm test\` |
            `;

            const { rows, columnCount } = findTableWithFallback(sectionContent);
            expect(columnCount).toBe(2);
            expect(rows.length).toBeGreaterThan(0);
        });

        test('should return empty for non-table content', () => {
            const sectionContent = `
Just some text without a table.
- Item 1
- Item 2
            `;

            const { rows, columnCount } = findTableWithFallback(sectionContent);
            expect(rows.length).toBe(0);
            expect(columnCount).toBe(0);
        });
    });

    describe('extractCommandFromCell', () => {
        test('should extract command from backticks', () => {
            expect(extractCommandFromCell('`npm test`')).toBe('npm test');
            expect(extractCommandFromCell('`grep "pattern" file.txt`')).toBe('grep "pattern" file.txt');
        });

        test('should recognize shell commands', () => {
            expect(extractCommandFromCell('npm test')).toBe('npm test');
            expect(extractCommandFromCell('python -m pytest')).toBe('python -m pytest');
            expect(extractCommandFromCell('go test ./...')).toBe('go test ./...');
        });

        test('should recognize paths as commands', () => {
            expect(extractCommandFromCell('/usr/bin/node script.js')).toBe('/usr/bin/node script.js');
            expect(extractCommandFromCell('./run-tests.sh')).toBe('./run-tests.sh');
        });

        test('should return null for dash or empty', () => {
            expect(extractCommandFromCell('-')).toBeNull();
            expect(extractCommandFromCell('')).toBeNull();
            expect(extractCommandFromCell('  ')).toBeNull();
        });
    });

    describe('detectNonExecutableCommand', () => {
        test('should detect human action verbs at start', () => {
            const commands = [
                'Review logs: search for pattern',
                'Check that file exists',
                'Verify in TASK2 validation',
                'Ensure tests pass',
                'Confirm database entries',
                'Validate output format',
            ];

            commands.forEach(cmd => {
                const result = detectNonExecutableCommand(cmd);
                expect(result.isInvalid).toBe(true);
                expect(result.reason).toBe('Starts with human action verb (review/check/verify)');
            });
        });

        test('should detect database query descriptions', () => {
            const cmd = 'Database query: SELECT * FROM users WHERE active = 1';
            const result = detectNonExecutableCommand(cmd);

            expect(result.isInvalid).toBe(true);
            expect(result.reason).toBe('Starts with "Database query:" instead of actual DB CLI command');
        });

        test('should detect manual verification markers', () => {
            const cmd = 'Manual verification required for this step';
            const result = detectNonExecutableCommand(cmd);

            expect(result.isInvalid).toBe(true);
            expect(result.reason).toBe('Marked as manual verification');
        });

        test('should detect parenthetical validation notes', () => {
            // Note: Input should NOT start with action verbs like "verify" since those are caught first
            const cmd = 'Run (manual validation required)';
            const result = detectNonExecutableCommand(cmd);

            expect(result.isInvalid).toBe(true);
            expect(result.reason).toContain('parenthetical notes');
        });

        test('should detect search descriptions', () => {
            const cmd = 'search for "pattern" in logs';
            const result = detectNonExecutableCommand(cmd);

            expect(result.isInvalid).toBe(true);
            expect(result.reason).toBe('Starts with "search for" instead of grep/find command');
        });

        test('should allow valid executable commands', () => {
            const validCommands = [
                'grep "pattern" file.ext',
                'test -f path/to/file',
                'npm test',
                'python -m pytest',
                'php -l file.php',
                'find . -name "*.js" -type f',
                'mysql -e "SELECT * FROM users"',
                'echo "MANUAL: description" && exit 1',
            ];

            validCommands.forEach(cmd => {
                const result = detectNonExecutableCommand(cmd);
                expect(result.isInvalid).toBe(false);
                expect(result.reason).toBe('');
            });
        });

        test('should be case-insensitive for detection', () => {
            const cmd = 'REVIEW logs for errors';
            const result = detectNonExecutableCommand(cmd);

            expect(result.isInvalid).toBe(true);
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

        test('should handle manual checks without executing commands', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
### 3.2 Success Criteria:
| Criterion | Source | Testable? | Command | Manual Check |
|-----------|--------|-----------|---------|--------------|
| Logs clean | AI_PROMPT:L45 | MANUAL | - | Review Google Cloud Logs for errors |
| Files exist | AI_PROMPT:L47 | AUTO | \`test -f file.txt\` | - |
            `);

            // Mock exec
            const { exec } = require('child_process');
            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('test -f')) {
                    return { stdout: '', stderr: '' };
                }
            });

            const results = await validateSuccessCriteria('TASK0', {
                cwd: '/project',
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(results).toHaveLength(2);

            // First result: MANUAL check
            expect(results[0].criterion).toBe('Logs clean');
            expect(results[0].passed).toBe(null); // null indicates manual check
            expect(results[0].testType).toBe('MANUAL');
            expect(results[0].manualCheck).toBe('Review Google Cloud Logs for errors');
            expect(results[0].command).toBe(null);

            // Second result: AUTO check
            expect(results[1].criterion).toBe('Files exist');
            expect(results[1].passed).toBe(true);
            expect(results[1].testType).toBe('AUTO');
            expect(results[1].command).toBe('test -f file.txt');
        });

        test('should handle BOTH testable criteria (auto + manual)', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
### 3.2 Success Criteria:
| Criterion | Source | Testable? | Command | Manual Check |
|-----------|--------|-----------|---------|--------------|
| Email sent | AI_PROMPT:L45 | BOTH | \`grep "Email sent" logs/app.log\` | Check Postmark dashboard |
            `);

            // Mock exec
            const { exec } = require('child_process');
            exec.mockImplementation(async (cmd, _opts) => {
                if (cmd.includes('grep')) {
                    return { stdout: 'Email sent to user@example.com', stderr: '' };
                }
            });

            const results = await validateSuccessCriteria('TASK0', {
                cwd: '/project',
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(results).toHaveLength(1);
            expect(results[0].criterion).toBe('Email sent');
            expect(results[0].passed).toBe(true);
            expect(results[0].testType).toBe('BOTH');
            expect(results[0].command).toBe('grep "Email sent" logs/app.log');
            expect(results[0].manualCheck).toBe('Check Postmark dashboard');
        });
    });
});
