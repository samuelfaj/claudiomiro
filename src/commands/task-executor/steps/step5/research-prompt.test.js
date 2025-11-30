const fs = require('fs');
const path = require('path');

describe('research-prompt.md template', () => {
    let promptContent;

    beforeAll(() => {
        promptContent = fs.readFileSync(
            path.join(__dirname, 'research-prompt.md'),
            'utf8',
        );
    });

    test('should have "## Code Patterns" section without "Found" suffix', () => {
        expect(promptContent).toMatch(/## Code Patterns\n/);
    });

    test('should have "## Execution Strategy" section without "Recommendation" suffix', () => {
        expect(promptContent).toMatch(/## Execution Strategy\n/);
    });

    test('should NOT have old "## Code Patterns Found" section name', () => {
        expect(promptContent).not.toMatch(/## Code Patterns Found/);
    });

    test('should NOT have old "## Execution Strategy Recommendation" section name', () => {
        expect(promptContent).not.toMatch(/## Execution Strategy Recommendation/);
    });

    test('should be compatible with context-cache extraction regex', () => {
        // These are the regex patterns from context-collector.js:195-196
        const strategyPattern = /## (?:Execution )?Strategy\s*\n([\s\S]*?)(?=\n##|$)/;
        const patternsPattern = /## (?:Code )?Patterns?\s*\n([\s\S]*?)(?=\n##|$)/;

        expect(promptContent).toMatch(strategyPattern);
        expect(promptContent).toMatch(patternsPattern);
    });

    test('should have all required research sections', () => {
        expect(promptContent).toMatch(/## Context Reference/);
        expect(promptContent).toMatch(/## Task Understanding Summary/);
        expect(promptContent).toMatch(/## Files Discovered to Read\/Modify/);
        expect(promptContent).toMatch(/## Code Patterns/);
        expect(promptContent).toMatch(/## Integration & Impact Analysis/);
        expect(promptContent).toMatch(/## Test Strategy Discovered/);
        expect(promptContent).toMatch(/## Risks & Challenges Identified/);
        expect(promptContent).toMatch(/## Execution Strategy/);
    });

    test('should use language-agnostic file patterns', () => {
        // Should use .ext instead of specific extensions
        expect(promptContent).toMatch(/\.ext/);
        expect(promptContent).toMatch(/path\/to\//);
    });

    test('should have placeholder variables', () => {
        expect(promptContent).toMatch(/\{\{todoPath\}\}/);
        expect(promptContent).toMatch(/\{\{researchPath\}\}/);
        expect(promptContent).toMatch(/\{\{task\}\}/);
    });
});
