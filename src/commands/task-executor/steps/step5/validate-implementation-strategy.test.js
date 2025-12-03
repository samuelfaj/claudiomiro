const {
    validateImplementationStrategy,
    parseImplementationStrategy,
    cleanDescription,
} = require('./validate-implementation-strategy');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../../shared/utils/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('validate-implementation-strategy', () => {
    describe('cleanDescription', () => {
        test('should remove backticks', () => {
            expect(cleanDescription('`code here`')).toBe('code here');
        });

        test('should remove bold markers', () => {
            expect(cleanDescription('**bold text**')).toBe('bold text');
        });

        test('should remove italic markers', () => {
            expect(cleanDescription('*italic text*')).toBe('italic text');
        });

        test('should remove markdown links', () => {
            expect(cleanDescription('[link text](http://example.com)')).toBe('link text');
        });

        test('should handle combined formatting', () => {
            expect(cleanDescription('**Read `autopay.php` lines** 90-302')).toBe('Read autopay.php lines 90-302');
        });
    });

    describe('parseImplementationStrategy', () => {
        test('should extract phases from BLUEPRINT.md §4', () => {
            const blueprintContent = `
# BLUEPRINT

## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read autopay.php lines 90-302 to understand full context
2. Read recurringBillingData.php:82-88 to confirm method signature
3. Verify all pre-conditions pass

**Gate:** All pre-conditions verified

### Phase 2: Core Implementation
1. Replace data source at lines 119-135
2. Implement calculation loop at lines 150-180
3. Add validation logging

**Gate:** Core functionality implemented
            `;

            const phases = parseImplementationStrategy(blueprintContent);

            expect(phases).toHaveLength(2);
            expect(phases[0]).toMatchObject({
                id: 1,
                name: 'Preparation',
            });
            expect(phases[0].steps).toHaveLength(3);
            expect(phases[0].steps[0].description).toContain('Read autopay.php');

            expect(phases[1]).toMatchObject({
                id: 2,
                name: 'Core Implementation',
            });
            expect(phases[1].steps).toHaveLength(3);
        });

        test('should handle subsections (Step X.Y format)', () => {
            const blueprintContent = `
## 4. IMPLEMENTATION STRATEGY

### Phase 2: Core Implementation

**Step 2.1: Replace Data Source (Lines ~119-135)**
1. Remove existing code at line 119
2. Add new code with recurringBillingData query

**Step 2.2: Implement Calculation Loop**
1. Initialize totalTuition variable
2. Loop through recurringBillingRecords
            `;

            const phases = parseImplementationStrategy(blueprintContent);

            expect(phases).toHaveLength(1);
            expect(phases[0].steps).toHaveLength(4);
            expect(phases[0].steps[0].source).toContain('(Replace Data Source');
            expect(phases[0].steps[2].source).toContain('(Implement Calculation Loop');
        });

        test('should skip code blocks', () => {
            const blueprintContent = `
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read file
\`\`\`php
$code = "should be ignored";
\`\`\`
2. Verify something
            `;

            const phases = parseImplementationStrategy(blueprintContent);

            expect(phases[0].steps).toHaveLength(2);
            expect(phases[0].steps[0].description).toBe('Read file');
            expect(phases[0].steps[1].description).toBe('Verify something');
        });

        test('should return empty array if §4 not found', () => {
            const blueprintContent = `
# BLUEPRINT

## 3. EXECUTION CONTRACT
Some content here
            `;

            const phases = parseImplementationStrategy(blueprintContent);

            expect(phases).toEqual([]);
        });

        test('should handle dash items as steps', () => {
            const blueprintContent = `
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
- Read autopay.php to understand context
- Verify methods exist in codebase
- Create backup of files
            `;

            const phases = parseImplementationStrategy(blueprintContent);

            expect(phases[0].steps).toHaveLength(3);
            expect(phases[0].steps[0].description).toContain('Read autopay.php');
        });
    });

    describe('validateImplementationStrategy', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should return valid=true if BLUEPRINT.md not found', async () => {
            fs.existsSync.mockReturnValue(false);

            const result = await validateImplementationStrategy('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });

        test('should return valid=true if no implementation strategy found', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('BLUEPRINT.md')) {
                    return '# BLUEPRINT\n\nNo §4 section';
                }
                if (path.includes('execution.json')) {
                    return JSON.stringify({ phases: [] });
                }
            });

            const result = await validateImplementationStrategy('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
        });

        test('should validate that all phases have items', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('BLUEPRINT.md')) {
                    return `
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read file A
2. Read file B

### Phase 2: Implementation
1. Modify file C
2. Test changes
                    `;
                }
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        phases: [
                            {
                                id: 1,
                                name: 'Preparation',
                                items: [
                                    { description: 'Read file A', completed: true },
                                    { description: 'Read file B', completed: true },
                                ],
                            },
                            {
                                id: 2,
                                name: 'Implementation',
                                items: [
                                    { description: 'Modify file C', completed: true },
                                    { description: 'Test changes', completed: true },
                                ],
                            },
                        ],
                    });
                }
            });

            const result = await validateImplementationStrategy('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });

        test('should fail if phase has no items', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('BLUEPRINT.md')) {
                    return `
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read file A
2. Read file B
                    `;
                }
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        phases: [
                            {
                                id: 1,
                                name: 'Preparation',
                                items: [],  // ❌ No items!
                            },
                        ],
                    });
                }
            });

            const result = await validateImplementationStrategy('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0].reason).toBe('No items tracked for this phase');
        });

        test('should fail if phase is missing from execution.json', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('BLUEPRINT.md')) {
                    return `
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read file A

### Phase 2: Implementation
1. Modify file C
                    `;
                }
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        phases: [
                            {
                                id: 1,
                                name: 'Preparation',
                                items: [{ description: 'Read file A', completed: true }],
                            },
                            // ❌ Phase 2 missing!
                        ],
                    });
                }
            });

            const result = await validateImplementationStrategy('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0].phaseId).toBe(2);
            expect(result.missing[0].reason).toBe('Phase missing from execution.json');
        });

        test('should fail if items are not completed', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('BLUEPRINT.md')) {
                    return `
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read file A
2. Read file B
                    `;
                }
                if (path.includes('execution.json')) {
                    return JSON.stringify({
                        phases: [
                            {
                                id: 1,
                                name: 'Preparation',
                                items: [
                                    { description: 'Read file A', completed: true },
                                    { description: 'Read file B', completed: false },  // ❌ Not completed!
                                ],
                            },
                        ],
                    });
                }
            });

            const result = await validateImplementationStrategy('TASK0', {
                claudiomiroFolder: '/.claudiomiro',
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0].reason).toBe('Item not completed');
            expect(result.missing[0].item).toBe('Read file B');
        });
    });
});
