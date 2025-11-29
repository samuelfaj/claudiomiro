const fs = require('fs');
const path = require('path');

describe('context.md template', () => {
    let templateContent;

    beforeAll(() => {
        templateContent = fs.readFileSync(
            path.join(__dirname, 'context.md'),
            'utf8'
        );
    });

    test('should have "## Files Modified" section', () => {
        expect(templateContent).toMatch(/## Files Modified/);
    });

    test('should have "## Decisions" section', () => {
        expect(templateContent).toMatch(/## Decisions/);
    });

    test('should NOT have old "## Modified Files Summary" section name', () => {
        expect(templateContent).not.toMatch(/## Modified Files Summary/);
    });

    test('should NOT have old "## Quick Notes" section name', () => {
        expect(templateContent).not.toMatch(/## Quick Notes/);
    });

    test('should have required template variables', () => {
        expect(templateContent).toMatch(/\{\{task\}\}/);
        expect(templateContent).toMatch(/\{\{attempts\}\}/);
        expect(templateContent).toMatch(/\{\{modifiedFilesCount\}\}/);
        expect(templateContent).toMatch(/\{\{modifiedFilesList\}\}/);
        expect(templateContent).toMatch(/\{\{quickNotes\}\}/);
        expect(templateContent).toMatch(/\{\{timestamp\}\}/);
    });

    test('should be compatible with context-cache extraction regex', () => {
        // These are the regex patterns from context-collector.js:118-119
        const filesModifiedPattern = /## Files Modified\s*\n([\s\S]*?)(?=\n##|$)/;
        const decisionsPattern = /## (?:Key )?Decisions?\s*\n([\s\S]*?)(?=\n##|$)/;

        expect(templateContent).toMatch(filesModifiedPattern);
        expect(templateContent).toMatch(decisionsPattern);
    });

    test('should have proper markdown structure', () => {
        expect(templateContent).toMatch(/# Context for \{\{task\}\}/);
        expect(templateContent).toMatch(/## Quick Reference/);
        expect(templateContent).toMatch(/## Full Details/);
        expect(templateContent).toMatch(/## For Future Tasks/);
    });
});
