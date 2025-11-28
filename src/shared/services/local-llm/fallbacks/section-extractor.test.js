/**
 * Section Extractor Fallback Tests
 * Self-contained tests following Claudiomiro conventions
 */

const {
  extractSection,
  extractAllSections,
  hasSection,
  extractCodeBlocks,
  extractListItems
} = require('./section-extractor');

describe('section-extractor', () => {
  describe('extractSection', () => {
    test('should extract h2 section by exact name', () => {
      const markdown = `# Title

## Implementation Plan

Step 1: Do something
Step 2: Do another thing

## Next Section

Other content`;

      const result = extractSection(markdown, 'Implementation Plan');

      expect(result).toContain('Step 1');
      expect(result).toContain('Step 2');
      expect(result).not.toContain('Other content');
    });

    test('should extract section case-insensitively', () => {
      const markdown = `## IMPLEMENTATION PLAN

Content here`;

      const result = extractSection(markdown, 'implementation plan');

      expect(result).toContain('Content here');
    });

    test('should extract section with prefix (e.g., "Code Patterns")', () => {
      const markdown = `## Code Patterns

Pattern 1
Pattern 2`;

      const result = extractSection(markdown, 'Patterns');

      expect(result).toContain('Pattern 1');
    });

    test('should extract h3 sections', () => {
      const markdown = `## Main Section

### Subsection

Subsection content

### Another Sub

More content`;

      const result = extractSection(markdown, 'Subsection');

      expect(result).toContain('Subsection content');
      expect(result).not.toContain('More content');
    });

    test('should extract bold-style sections', () => {
      const markdown = `**Context:**

Some context here

**Next:**

Other`;

      const result = extractSection(markdown, 'Context');

      expect(result).toContain('Some context here');
    });

    test('should return empty string for missing section', () => {
      const markdown = '## Existing Section\nContent';

      const result = extractSection(markdown, 'Missing Section');

      expect(result).toBe('');
    });

    test('should handle empty input', () => {
      expect(extractSection('', 'Section')).toBe('');
      expect(extractSection(null, 'Section')).toBe('');
      expect(extractSection('Content', '')).toBe('');
    });

    test('should handle section at end of document', () => {
      const markdown = `## First

First content

## Last

Last content`;

      const result = extractSection(markdown, 'Last');

      expect(result).toBe('Last content');
    });
  });

  describe('extractAllSections', () => {
    test('should extract all h2 sections', () => {
      const markdown = `## Section One

Content one

## Section Two

Content two

## Section Three

Content three`;

      const sections = extractAllSections(markdown);

      expect(Object.keys(sections)).toHaveLength(3);
      expect(sections['Section One']).toContain('Content one');
      expect(sections['Section Two']).toContain('Content two');
      expect(sections['Section Three']).toContain('Content three');
    });

    test('should return empty object for no sections', () => {
      const markdown = 'Just plain text without sections';

      const sections = extractAllSections(markdown);

      expect(Object.keys(sections)).toHaveLength(0);
    });

    test('should handle empty input', () => {
      expect(extractAllSections('')).toEqual({});
      expect(extractAllSections(null)).toEqual({});
    });
  });

  describe('hasSection', () => {
    test('should return true for existing section', () => {
      const markdown = '## My Section\nContent';

      expect(hasSection(markdown, 'My Section')).toBe(true);
    });

    test('should return false for missing section', () => {
      const markdown = '## Other Section\nContent';

      expect(hasSection(markdown, 'My Section')).toBe(false);
    });
  });

  describe('extractCodeBlocks', () => {
    test('should extract code blocks with language', () => {
      const content = `Some text

\`\`\`javascript
const x = 1;
\`\`\`

More text

\`\`\`python
y = 2
\`\`\``;

      const blocks = extractCodeBlocks(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].code).toBe('const x = 1;');
      expect(blocks[1].language).toBe('python');
      expect(blocks[1].code).toBe('y = 2');
    });

    test('should handle code blocks without language', () => {
      const content = `\`\`\`
plain code
\`\`\``;

      const blocks = extractCodeBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('text');
      expect(blocks[0].code).toBe('plain code');
    });

    test('should return empty array for no code blocks', () => {
      const content = 'No code here';

      expect(extractCodeBlocks(content)).toEqual([]);
    });

    test('should handle empty input', () => {
      expect(extractCodeBlocks('')).toEqual([]);
      expect(extractCodeBlocks(null)).toEqual([]);
    });
  });

  describe('extractListItems', () => {
    test('should extract bullet points with dash', () => {
      const content = `- Item one
- Item two
- Item three`;

      const items = extractListItems(content);

      expect(items).toContain('Item one');
      expect(items).toContain('Item two');
      expect(items).toContain('Item three');
    });

    test('should extract bullet points with asterisk', () => {
      const content = `* Item one
* Item two`;

      const items = extractListItems(content);

      expect(items).toContain('Item one');
      expect(items).toContain('Item two');
    });

    test('should extract numbered items', () => {
      const content = `1. First
2. Second
3. Third`;

      const items = extractListItems(content);

      expect(items).toContain('First');
      expect(items).toContain('Second');
      expect(items).toContain('Third');
    });

    test('should extract mixed list types', () => {
      const content = `- Bullet item
1. Numbered item
* Another bullet`;

      const items = extractListItems(content);

      expect(items).toHaveLength(3);
    });

    test('should return empty array for no lists', () => {
      const content = 'Just plain text';

      expect(extractListItems(content)).toEqual([]);
    });

    test('should handle indented list items', () => {
      const content = `  - Indented item
    - More indented`;

      const items = extractListItems(content);

      expect(items).toContain('Indented item');
      expect(items).toContain('More indented');
    });
  });
});
