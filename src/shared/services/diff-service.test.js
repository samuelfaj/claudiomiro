const fs = require('fs');
const path = require('path');
const os = require('os');
const { DiffService, processOutput, processSingleDiff } = require('./diff-service');

// Create temp directory for tests
const createTempDir = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-service-test-'));
    return tempDir;
};

// Clean up temp directory
const cleanupTempDir = (dir) => {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

// Create test file
const createTestFile = (dir, relativePath, content) => {
    const fullPath = path.join(dir, relativePath);
    const fileDir = path.dirname(fullPath);
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return fullPath;
};

describe('DiffService', () => {
    let tempDir;
    let service;

    beforeEach(() => {
        tempDir = createTempDir();
        service = new DiffService(tempDir);
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
    });

    describe('processOutput', () => {
        test('should return success with no diffs when output has no diffs', () => {
            const output = 'Here is some text without any diffs.';
            const result = service.processOutput(output);

            expect(result.success).toBe(true);
            expect(result.message).toBe('No diffs found in output');
            expect(result.applied).toHaveLength(0);
            expect(result.failed).toHaveLength(0);
        });

        test('should apply a simple diff from LLM output', () => {
            createTestFile(tempDir, 'test.js', `const a = 1;
const c = 3;
`);

            const output = `Here are the changes:

\`\`\`diff
--- a/test.js
+++ b/test.js
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 const c = 3;
\`\`\`

Done!`;

            const result = service.processOutput(output);

            expect(result.success).toBe(true);
            expect(result.applied).toHaveLength(1);

            const fileContent = fs.readFileSync(path.join(tempDir, 'test.js'), 'utf-8');
            expect(fileContent).toContain('const b = 2;');
        });

        test('should handle multiple diffs in output', () => {
            createTestFile(tempDir, 'file1.js', 'const a = 1;\n');
            createTestFile(tempDir, 'file2.js', 'const x = 10;\n');

            const output = `First change:

\`\`\`diff
--- a/file1.js
+++ b/file1.js
@@ -1 +1,2 @@
 const a = 1;
+const b = 2;
\`\`\`

Second change:

\`\`\`diff
--- a/file2.js
+++ b/file2.js
@@ -1 +1,2 @@
 const x = 10;
+const y = 20;
\`\`\``;

            const result = service.processOutput(output);

            expect(result.success).toBe(true);
            expect(result.applied).toHaveLength(2);

            const file1 = fs.readFileSync(path.join(tempDir, 'file1.js'), 'utf-8');
            const file2 = fs.readFileSync(path.join(tempDir, 'file2.js'), 'utf-8');

            expect(file1).toContain('const b = 2;');
            expect(file2).toContain('const y = 20;');
        });

        test('should handle new file creation', () => {
            const output = `Creating new file:

\`\`\`diff
--- /dev/null
+++ b/newfile.js
@@ -0,0 +1,3 @@
+const newFile = true;
+// New file content
+module.exports = newFile;
\`\`\``;

            const result = service.processOutput(output);

            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(tempDir, 'newfile.js'))).toBe(true);

            const content = fs.readFileSync(path.join(tempDir, 'newfile.js'), 'utf-8');
            expect(content).toContain('const newFile = true;');
        });

        test('should dry run without modifying files', () => {
            createTestFile(tempDir, 'test.js', 'const a = 1;\n');

            const output = `\`\`\`diff
--- a/test.js
+++ b/test.js
@@ -1 +1,2 @@
 const a = 1;
+const b = 2;
\`\`\``;

            const result = service.processOutput(output, { dryRun: true });

            expect(result.success).toBe(true);

            const fileContent = fs.readFileSync(path.join(tempDir, 'test.js'), 'utf-8');
            expect(fileContent).not.toContain('const b = 2;');
        });

        test('should create backup files when backup option is true', () => {
            createTestFile(tempDir, 'test.js', 'const original = true;\n');

            const output = `\`\`\`diff
--- a/test.js
+++ b/test.js
@@ -1 +1 @@
-const original = true;
+const modified = true;
\`\`\``;

            service.processOutput(output, { backup: true });

            expect(fs.existsSync(path.join(tempDir, 'test.js.backup'))).toBe(true);
        });
    });

    describe('processSingleDiff', () => {
        test('should apply a valid diff', () => {
            createTestFile(tempDir, 'test.js', `const a = 1;
const c = 3;
`);

            const diff = `--- a/test.js
+++ b/test.js
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 const c = 3;
`;

            const result = service.processSingleDiff(diff);

            expect(result.success).toBe(true);
            expect(result.files).toContain('test.js');
        });

        test('should reject invalid diff', () => {
            const diff = 'This is not a valid diff';
            const result = service.processSingleDiff(diff);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid diff');
        });

        test('should handle missing file', () => {
            const diff = `--- a/nonexistent.js
+++ b/nonexistent.js
@@ -1 +1 @@
-old
+new
`;

            const result = service.processSingleDiff(diff);

            expect(result.success).toBe(false);
        });
    });

    describe('rollback', () => {
        test('should rollback applied changes', () => {
            const originalContent = 'const original = true;\n';
            createTestFile(tempDir, 'test.js', originalContent);

            const output = `\`\`\`diff
--- a/test.js
+++ b/test.js
@@ -1 +1 @@
-const original = true;
+const modified = true;
\`\`\``;

            service.processOutput(output, { backup: true });

            // Verify modification
            let content = fs.readFileSync(path.join(tempDir, 'test.js'), 'utf-8');
            expect(content).toContain('const modified = true;');

            // Rollback
            const rollbackResult = service.rollback();

            expect(rollbackResult.success).toBe(true);

            // Verify rollback
            content = fs.readFileSync(path.join(tempDir, 'test.js'), 'utf-8');
            expect(content).toBe(originalContent);
        });
    });

    describe('cleanupBackups', () => {
        test('should remove backup files', () => {
            createTestFile(tempDir, 'test.js', 'const a = 1;\n');

            const output = `\`\`\`diff
--- a/test.js
+++ b/test.js
@@ -1 +1,2 @@
 const a = 1;
+const b = 2;
\`\`\``;

            service.processOutput(output, { backup: true });

            expect(fs.existsSync(path.join(tempDir, 'test.js.backup'))).toBe(true);

            service.cleanupBackups();

            expect(fs.existsSync(path.join(tempDir, 'test.js.backup'))).toBe(false);
        });
    });

    describe('resolveFilePath', () => {
        test('should resolve path from newFileName', () => {
            const patch = {
                oldFileName: 'a/src/file.js',
                newFileName: 'b/src/file.js',
            };

            const result = service.resolveFilePath(patch);
            expect(result).toBe('src/file.js');
        });

        test('should resolve path from oldFileName when newFileName is /dev/null', () => {
            const patch = {
                oldFileName: 'a/src/deleted.js',
                newFileName: '/dev/null',
            };

            const result = service.resolveFilePath(patch);
            expect(result).toBe('src/deleted.js');
        });

        test('should return null for invalid patch', () => {
            const patch = {
                oldFileName: '/dev/null',
                newFileName: '/dev/null',
            };

            const result = service.resolveFilePath(patch);
            expect(result).toBeNull();
        });
    });

    describe('module exports', () => {
        test('should export processOutput function', () => {
            const output = 'No diffs here';
            const result = processOutput(output);
            expect(result.success).toBe(true);
        });

        test('should export processSingleDiff function', () => {
            const diff = 'Invalid diff';
            const result = processSingleDiff(diff);
            expect(result.success).toBe(false);
        });
    });
});
