const fs = require('fs');
const path = require('path');

jest.mock('fs');

// Import after mocks
const { findTaskFiles, validateTodoQuality } = require('./utils');

describe('step4/utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findTaskFiles', () => {
        test('should find TASK.md files recursively', () => {
            // Arrange
            const mockDirStructure = {
                '/test/project': ['subdir1', 'subdir2', 'TASK.md', 'other.txt'],
                '/test/project/subdir1': ['TASK.md', 'file1.js'],
                '/test/project/subdir2': ['nested', 'README.md'],
                '/test/project/subdir2/nested': ['TASK.md', 'data.json'],
            };

            fs.readdirSync.mockImplementation((dir) => mockDirStructure[dir] || []);

            fs.statSync.mockImplementation((filePath) => ({
                isDirectory: () => {
                    // Return true for paths that are directories based on our structure
                    return !filePath.includes('TASK.md') &&
                 !filePath.includes('.txt') &&
                 !filePath.includes('.js') &&
                 !filePath.includes('.md') &&
                 !filePath.includes('.json');
                },
            }));

            // Act
            const result = findTaskFiles('/test/project');

            // Assert
            expect(result).toHaveLength(3);
            expect(result).toContain('/test/project/TASK.md');
            expect(result).toContain('/test/project/subdir1/TASK.md');
            expect(result).toContain('/test/project/subdir2/nested/TASK.md');
        });

        test('should return empty array for empty directory', () => {
            // Arrange
            fs.readdirSync.mockReturnValue([]);

            // Act
            const result = findTaskFiles('/test/empty');

            // Assert
            expect(result).toHaveLength(0);
            expect(result).toEqual([]);
        });

        test('should filter out non-directory entries and non-TASK.md files', () => {
            // Arrange
            fs.readdirSync.mockReturnValue(['README.md', 'index.js', 'config.json', 'TODO.md']);

            fs.statSync.mockReturnValue({ isDirectory: () => false });

            // Act
            const result = findTaskFiles('/test/mixed');

            // Assert
            expect(result).toHaveLength(0);
        });

        test('should handle nested directories correctly', () => {
            // Arrange
            const mockNestedStructure = {
                '/test/root': ['level1', 'file.txt'],
                '/test/root/level1': ['level2', 'TASK.md'],
                '/test/root/level1/level2': ['level3'],
                '/test/root/level1/level2/level3': ['TASK.md'],
            };

            fs.readdirSync.mockImplementation((dir) => mockNestedStructure[dir] || []);

            fs.statSync.mockImplementation((filePath) => ({
                isDirectory: () => {
                    const basename = path.basename(filePath);
                    return basename.startsWith('level');
                },
            }));

            // Act
            const result = findTaskFiles('/test/root');

            // Assert
            expect(result).toHaveLength(2);
            expect(result).toContain('/test/root/level1/TASK.md');
            expect(result).toContain('/test/root/level1/level2/level3/TASK.md');
        });

        test('should handle directory with only TASK.md files', () => {
            // Arrange
            fs.readdirSync.mockReturnValue(['TASK.md']);

            fs.statSync.mockReturnValue({ isDirectory: () => false });

            // Act
            const result = findTaskFiles('/test/only-task');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('/test/only-task/TASK.md');
        });
    });

    describe('validateTodoQuality', () => {
        test('should return error when TODO.md does not exist', () => {
            // Arrange
            fs.existsSync.mockReturnValue(false);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('TODO.md was not created');
        });

        test('should return error for content < 500 chars', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('short content');

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('TODO.md is too short (< 500 chars) - likely missing context');
        });

        test('should return error when required sections are missing', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO

        ## Implementation Plan
        Some content here but missing other sections
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing required section: ## Context Reference');
            expect(result.errors).toContain('Missing required section: ## Verification');
            expect(result.errors).toContain('Missing required section: ## Acceptance Criteria');
            expect(result.errors).toContain('Missing required section: ## Impact Analysis');
            expect(result.errors).toContain('Missing required section: ## Follow-ups');
        });

        test('should return error for insufficient context references (0/3)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        Some content but no references to the required files
        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here
        ## Verification
        Verification steps with \`src/index.js:10-20\` references
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Insufficient context references (0/3 files) - Context Reference section appears incomplete');
            expect(result.contextScore).toBe(0);
        });

        test('should return error for insufficient context references (1/3)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        Only reference to PROMPT.md file
        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here
        ## Verification
        Verification steps with \`src/index.js:10-20\` references
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Insufficient context references (1/3 files) - Context Reference section appears incomplete');
            expect(result.contextScore).toBe(1);
        });

        test('should return error for insufficient context references (2/3)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to TASK.md and PROMPT.md files
        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here
        ## Verification
        Verification steps with \`src/index.js:10-20\` references
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Insufficient context references (2/3 files) - Context Reference section appears incomplete');
            expect(result.contextScore).toBe(2);
        });

        test('should return error when no file references with line numbers found', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to AI_PROMPT.md and TASK.md and PROMPT.md
        ## Implementation Plan
        Some content without file references like file.js or src/index.js but no line numbers
        ## Verification
        ## Acceptance Criteria
        ## Impact Analysis
        ## Follow-ups
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('No specific file references with line numbers found - context may be too vague');
            expect(result.contextScore).toBe(3);
        });

        test('should return error when Implementation Plan subsections missing', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to AI_PROMPT.md and TASK.md and PROMPT.md
        ## Implementation Plan
        Content without required subsections
        **Some other section:** but not the required ones
        ## Verification
        Reference to \`src/index.js:10-20\` for file reference
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Implementation Plan items missing required subsections');
            expect(result.contextScore).toBe(3);
        });

        test('should return valid result with all validation rules passing', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to AI_PROMPT.md and TASK.md and PROMPT.md

        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here

        ## Verification
        Verification steps with \`src/index.js:10-20\` references

        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation

        ## Impact Analysis
        Analysis with references to \`config.json:100\`

        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result).toEqual({
                valid: true,
                errors: [],
                contextScore: 3,
            });
        });

        test('should calculate contextScore correctly (0)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        ${'x'.repeat(600)} // Long enough content but no context references
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.contextScore).toBe(0);
        });

        test('should calculate contextScore correctly (1)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        Only reference to PROMPT.md file
        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here
        ## Verification
        Verification steps with \`src/index.js:10-20\` references
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.contextScore).toBe(1);
        });

        test('should calculate contextScore correctly (2)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to TASK.md and PROMPT.md files
        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here
        ## Verification
        Verification steps with \`src/index.js:10-20\` references
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.contextScore).toBe(2);
        });

        test('should calculate contextScore correctly (3)', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to AI_PROMPT.md and TASK.md and PROMPT.md
        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here
        ## Verification
        Verification steps with \`src/index.js:10-20\` references
        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation
        ## Impact Analysis
        Analysis with references to \`config.json:100\`
        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.contextScore).toBe(3);
        });

        test('should handle file reference patterns with single line numbers', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to AI_PROMPT.md and TASK.md and PROMPT.md

        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here

        ## Verification
        Verification steps with \`src/index.js:10\` references

        ## Acceptance Criteria
        All criteria met with \`utils.js:45\` implementation

        ## Impact Analysis
        Analysis with references to \`config.json:100\`

        ## Follow-ups
        Follow-up items with \`test.js:1\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should handle file reference patterns with ranges', () => {
            // Arrange
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(`
        Fully implemented: NO
        ## Context Reference
        References to AI_PROMPT.md and TASK.md and PROMPT.md

        ## Implementation Plan
        **What to do:** Implementation details here
        **Context (read-only):** Context files listed here
        **Touched (will modify/create):** Files to be modified here

        ## Verification
        Verification steps with \`src/index.js:10-20\` references

        ## Acceptance Criteria
        All criteria met with \`utils.js:45-50\` implementation

        ## Impact Analysis
        Analysis with references to \`config.json:100-150\`

        ## Follow-ups
        Follow-up items with \`test.js:1-10\` references
        ${'x'.repeat(600)} // Make content long enough
      `);

            // Act
            const result = validateTodoQuality('/path/to/TODO.md');

            // Assert
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
});
