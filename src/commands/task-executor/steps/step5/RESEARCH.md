# RESEARCH.md Generation Guide — Learn from the Codebase

## 🎯 Purpose

This document defines how step5 should generate RESEARCH.md files that help the agent leverage existing codebase patterns and components for consistency.

**CRITICAL PRINCIPLE:** Don't reinvent the wheel. Find and learn from what already exists.

---

## 🔍 What RESEARCH.md Should Contain

RESEARCH.md is the agent's **learning phase** before execution. It should answer:

1. **What patterns already exist** that I can follow?
2. **What components can I reuse** instead of creating new ones?
3. **How have similar problems been solved** in this codebase?
4. **What are the integration points** and dependencies?
5. **What tests patterns exist** that I should follow?

---

## 📚 Research Methodology

### Phase 1: Find Similar Implementations

**Goal:** Locate code that solves similar problems to learn from.

#### 1.1 Search Strategy

```markdown
## Finding Similar Components

**Search patterns to use:**

1. **By functionality:**
   - Search for keywords from the task (e.g., "validation", "parser", "handler")
   - Look for similar feature names or concepts
   - Find related domain logic

2. **By file patterns:**
   - If creating `user-service.ext`, search for `*-service.ext`
   - If creating `data-validator.ext`, search for `*-validator.ext`
   - Match naming conventions from the codebase

3. **By architectural layer:**
   - Controllers: `src/controllers/**/*.ext`
   - Services: `src/services/**/*.ext`
   - Models: `src/models/**/*.ext`
   - Utils: `src/utils/**/*.ext`
   - Middleware: `src/middleware/**/*.ext`

4. **By test patterns:**
   - Find test files for similar components
   - Look for test helpers and mocks
   - Understand testing approach (unit vs integration)
```

#### 1.2 Analysis Depth

For each similar component found, document:

```markdown
## Similar Components Found

### Component: `path/to/similar-component.ext`
- **Similarity:** [How it relates to your task]
- **Patterns to reuse:**
  - Line X-Y: [Pattern description]
  - Line A-B: [Another pattern]
- **Key learnings:**
  - Error handling approach at line Z
  - Validation pattern at line W
  - Dependencies used (imports)
  - Testing approach from `test-file.ext:lines`

**Reuse decision:**
- [ ] Use as-is (import/extend)
- [ ] Adapt pattern
- [ ] Learn structure only
```

---

### Phase 2: Identify Reusable Components

**Goal:** Find existing utilities, helpers, and libraries to leverage.

#### 2.1 Common Reusable Patterns

```markdown
## Reusable Components Checklist

**Before creating new code, check if these exist:**

- [ ] **Validation utilities:**
  - Search: `grep -r "validate" src/utils`
  - Search: `grep -r "schema" src/`
  - Common locations: `src/utils/validation.ext`, `src/validators/`

- [ ] **Error handling:**
  - Search: `grep -r "Error" src/utils`
  - Search: `grep -r "throw" src/services`
  - Common locations: `src/utils/errors.ext`, `src/exceptions/`

- [ ] **Data processing:**
  - Search: `grep -r "transform" src/utils`
  - Search: `grep -r "format" src/utils`
  - Common locations: `src/utils/formatters.ext`, `src/transformers/`

- [ ] **Database/API helpers:**
  - Search: `grep -r "query" src/`
  - Search: `grep -r "request" src/`
  - Common locations: `src/db/`, `src/api/`, `src/services/`

- [ ] **Authentication/Authorization:**
  - Search: `grep -r "auth" src/`
  - Search: `grep -r "permission" src/`
  - Common locations: `src/middleware/auth.ext`, `src/auth/`

- [ ] **Configuration:**
  - Search: `config`, `.env`, `settings`
  - Common locations: `src/config/`, `.env.example`

- [ ] **Logging:**
  - Search: `grep -r "log" src/`
  - Common locations: `src/utils/logger.ext`, `logger.js`

- [ ] **Test utilities:**
  - Search: `grep -r "mock" __tests__`
  - Search: `grep -r "helper" __tests__`
  - Common locations: `__tests__/helpers/`, `__tests__/__mocks__/`
```

#### 2.2 Document Reusable Components

```markdown
## Reusable Components Found

### 1. [Component Name] - `path/to/component.ext`
**Purpose:** [What it does]
**How to use:**
- Import: `import { X } from 'path/to/component'`
- Usage example from `reference-file.ext:lines`
- Parameters: [signature]
**Integration:** [How to integrate into your task]

### 2. [Another Component] - `path/to/other.ext`
...
```

---

### Phase 3: Understand Codebase Conventions

**Goal:** Learn the project's style, patterns, and conventions.

#### 3.1 Convention Discovery

```markdown
## Codebase Conventions Discovered

### File Organization
- **Pattern found in:** `src/services/example-service.ext`
- **Structure:**
  ```
  - imports (dependencies)
  - constants/types
  - helper functions
  - main exported functions
  - module.exports or export default
  ```

### Naming Conventions
- **Files:** `kebab-case.ext` (e.g., `user-service.js`)
- **Classes:** `PascalCase` (e.g., `UserService`)
- **Functions:** `camelCase` (e.g., `getUserById`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Discovered from:** `path/to/reference-file.ext`

### Error Handling Pattern
- **Pattern:** Try-catch with custom errors
- **Example from:** `path/to/service.ext:45-60`
  ```
  try {
    // operation
  } catch (error) {
    logger.error('Context', error);
    throw new CustomError('Message', { cause: error });
  }
  ```

### Testing Patterns
- **Test file location:** `__tests__/` or `*.test.ext` next to source
- **Test structure:** Describe-it with arrange-act-assert
- **Mocking approach:** [Jest mocks / manual mocks / etc.]
- **Example from:** `path/to/example.test.ext:20-50`

### Import/Export Style
- **CommonJS:** `const X = require('...')` and `module.exports = { X }`
- **ES Modules:** `import X from '...'` and `export { X }`
- **Detected from:** [analysis of existing files]

### Documentation Style
- **Comments:** [JSDoc / docstrings / inline comments]
- **Example from:** `path/to/documented-file.ext:10-15`
```

---

### Phase 4: Map Integration Points

**Goal:** Understand how your changes fit into the larger system.

#### 4.1 Integration Analysis

```markdown
## Integration & Impact Analysis

### Upstream Dependencies (What I need from previous work)
1. **[Component/Module Name]** from `path/to/file.ext`
   - **What I need:** [Data structure / function / API]
   - **Contract:** [Interface definition]
   - **Location:** `file.ext:lines`
   - **How to access:** [Import path / API endpoint]

2. **[Another Dependency]**
   ...

### Downstream Consumers (What depends on my changes)
1. **[Component/Module]** at `path/to/consumer.ext:lines`
   - **What it expects:** [Interface / contract]
   - **Breaking changes risk:** YES/NO
   - **Migration needed:** YES/NO
   - **Verification:** [How to verify integration]

2. **[Another Consumer]**
   ...

### Shared Interfaces / Contracts
```markdown
**Interface 1: [Name]**
- **Type/Schema:** [Definition]
- **Used by:** [List of files]
- **Defined in:** `path/to/types.ext:lines`
- **Must maintain:** [Compatibility requirements]

**Interface 2: [Name]**
...
```

### Database Schema Dependencies
- **Tables affected:** [table names]
- **Columns needed:** [column list]
- **Constraints:** [foreign keys, indexes]
- **Migration strategy:** [How to handle schema changes]

### API Endpoints Involved
- **Existing endpoints to modify:**
  - `METHOD /path` in `file.ext:lines`
- **New endpoints to create:**
  - `METHOD /new-path` - [purpose]
- **Compatibility:** [Breaking changes? Versioning needed?]

### Configuration Dependencies
- **Environment variables:** [List with purposes]
- **Config files:** `path/to/config.ext`
- **Defaults:** [Where to set defaults]
```

---

### Phase 5: Test Strategy Discovery

**Goal:** Understand how to test following project conventions.

#### 5.1 Test Pattern Analysis

```markdown
## Test Strategy from Codebase

### Testing Framework Detected
- **Framework:** [Jest / pytest / go test / JUnit / RSpec / etc.]
- **Test runner command:** `[actual command from package.json or scripts]`
- **Config location:** `[jest.config.js / pytest.ini / etc.]`

### Test File Patterns Found
- **Unit tests:** `__tests__/*.test.ext` or `*.test.ext`
- **Integration tests:** `__tests__/integration/*.test.ext`
- **E2E tests:** `__tests__/e2e/*.test.ext` (if exists)

### Test Structure Pattern
**Found in:** `path/to/example.test.ext`

```[language]
describe('[Component]', () => {
  // Setup (beforeEach, fixtures)

  describe('[function/method]', () => {
    it('should [expected behavior]', () => {
      // Arrange
      const input = ...

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe(...)
    })
  })
})
```

### Mocking Patterns
- **Mock location:** `__tests__/__mocks__/`
- **Mock pattern from:** `path/to/mock-example.ext:lines`
- **How to mock:**
  - External APIs: [pattern]
  - Database: [pattern]
  - File system: [pattern]
  - Time/Date: [pattern]

### Test Data / Fixtures
- **Location:** `__tests__/fixtures/` or `__tests__/mocks/`
- **Pattern:** [How test data is organized]
- **Example from:** `path/to/fixture.ext`

### Coverage Expectations
- **Current project coverage:** [percentage from config or CI]
- **Coverage command:** `[actual command]`
- **Minimum required:** [threshold from config]
```

---

### Phase 6: Risk and Challenge Assessment

**Goal:** Identify potential issues before implementation.

```markdown
## Risks & Challenges Identified

### Technical Risks

1. **[Risk Name]**
   - **Description:** [What could go wrong]
   - **Likelihood:** Low / Medium / High
   - **Impact:** Low / Medium / High
   - **Evidence:** [Why you think this is a risk]
   - **Mitigation:** [How to prevent or handle it]
   - **Fallback:** [Plan B if mitigation fails]

2. **[Another Risk]**
   ...

### Complexity Assessment
- **Overall complexity:** Low / Medium / High
- **Reasoning:** [Why this complexity level]
- **Complex areas:**
  1. [Area]: [Why complex]
  2. [Area]: [Why complex]

### Missing Information / Ambiguities
- [ ] **[What's unclear]**
  - **Context:** [Why this is needed]
  - **Impact:** [What happens if we don't clarify]
  - **Recommendation:** [Suggested approach]

### External Dependencies
- **Third-party packages needed:** [list]
- **API dependencies:** [external services]
- **Version constraints:** [compatibility requirements]
```

---

## 🎯 RESEARCH.md Template Output

After completing all research phases, generate this structured file:

```markdown
# Research for [TASK-NAME]

## Context Reference
**For tech stack and conventions, see:**
- `path/to/AI_PROMPT.md` - Universal context
- `path/to/TASK.md` - Task-level context
- `path/to/PROMPT.md` - Task-specific context

**This file contains ONLY new information discovered during research.**

---

## Task Understanding Summary
[1-2 sentence summary - reference TODO.md for full details]

---

## Similar Components Found (LEARN FROM THESE)

### 1. [Component Name] - `path/to/similar.ext:lines`
**Why similar:** [Explanation]
**Patterns to reuse:**
- Lines X-Y: [Pattern description]
- Lines A-B: [Another pattern]
**Key learnings:**
- [Learning 1]
- [Learning 2]

### 2. [Another Component] - `path/to/other.ext:lines`
...

---

## Reusable Components (USE THESE, DON'T RECREATE)

### 1. [Utility Name] - `path/to/utility.ext`
**Purpose:** [What it does]
**How to use:**
```[language]
import { X } from 'path/to/utility';
// Usage example
X.method(params);
```
**Integration into task:** [How you'll use it]

### 2. [Another Utility] - `path/to/other-utility.ext`
...

---

## Codebase Conventions Discovered

### File Organization
- Pattern: [Structure found in reference files]
- Example: `path/to/example.ext`

### Naming Conventions
- Files: [convention]
- Functions: [convention]
- Classes: [convention]
- Constants: [convention]

### Error Handling Pattern
```[language]
// Pattern from path/to/reference.ext:lines
[code example]
```

### Testing Pattern
```[language]
// Pattern from path/to/test-example.test.ext:lines
[code example]
```

---

## Integration & Impact Analysis

### Functions/Classes/Components Being Modified:
1. **`functionName`** in `path/to/file.ext:lines`
   - **Called by:**
     - `path/to/caller1.ext:line`
     - `path/to/caller2.ext:line`
   - **Parameter contract:** `function(param1: type1, param2: type2): returnType`
   - **Impact:** [How changes affect callers]
   - **Breaking changes:** YES/NO - [Explanation]

### API/Database/External Integration:
[Only if applicable]
- **API endpoints affected:**
  - `METHOD /path` in `file.ext:lines` - [impact]
- **Database schema changes:**
  - Table: [changes needed]
- **External dependencies:**
  - [service/library] - [how used]

---

## Test Strategy Discovered

### Testing Framework
- **Framework:** [Name]
- **Test command:** `[actual command]`
- **Config:** `path/to/config`

### Test Patterns Found
- **Test file location:** [pattern]
- **Test structure:** [describe-it / def test / etc.]
- **Example from:** `path/to/example.test.ext:lines`

### Mocking Approach
- **Mock location:** `path/to/mocks/`
- **Pattern:** [how to mock]
- **Example:** `path/to/mock-example.ext:lines`

---

## Risks & Challenges Identified

### Technical Risks
1. **[Risk]**
   - Impact: [High/Medium/Low]
   - Mitigation: [Strategy]

### Complexity Assessment
- Overall: [Low/Medium/High]
- Reasoning: [Why]

### Missing Information
- [ ] [What's unclear and why it matters]

---

## Execution Strategy Recommendation

**Based on research findings, execute in this order:**

1. **[Step 1]** - [Specific action]
   - Read: `path/to/pattern.ext:lines`
   - Create/Modify: `path/to/target.ext`
   - Follow pattern from: [reference]
   - Test with: `[command]`

2. **[Step 2]** - [Next action]
   - Reuse component: `path/to/utility.ext`
   - Integration point: `path/to/integration.ext:lines`
   - Verify: [how to verify]

3. **[Step 3]** - [Final action]
   - Follow test pattern: `path/to/test-example.test.ext:lines`
   - Run: `[test command] path/to/new-test`
   - Acceptance: [criteria]

---

**Research completed:** [timestamp]
**Total similar components found:** [number]
**Total reusable components identified:** [number]
**Estimated complexity:** [Low/Medium/High]
```

---

## 🚫 Anti-Patterns to Avoid in RESEARCH.md

❌ **Copying context already in AI_PROMPT.md/TASK.md/PROMPT.md**
- These files already contain tech stack, conventions, etc.
- RESEARCH.md should only contain NEW discoveries

✅ **Reference existing context and add new findings**
- "See AI_PROMPT.md for tech stack"
- "New pattern found in [file] not mentioned in existing context"

---

❌ **Vague pattern references**
- "Follow best practices"
- "Similar code exists somewhere"

✅ **Specific file:line references**
- "Follow pattern in `src/services/user-service.js:45-80`"
- "Reuse validation from `src/utils/validator.js:20`"

---

❌ **Not searching for existing solutions**
- Immediately creating new utilities
- Reinventing existing patterns

✅ **Thoroughly search before creating**
- "Searched for validation utils - found reusable `validateInput` at `src/utils/validation.js:15`"
- "No similar handler found - will create following pattern from `src/handlers/example.js`"

---

❌ **Generic integration analysis**
- "Will integrate with other modules"
- "May affect some components"

✅ **Specific integration mapping**
- "Modifies `getUserData` which is called by 3 components at [specific files:lines]"
- "Breaking change: signature changes from (id) to (id, options)"

---

❌ **Shallow test strategy**
- "Will write tests"
- "Use Jest"

✅ **Detailed test pattern discovery**
- "Follow test structure from `__tests__/user-service.test.js:20-80`"
- "Use existing mock helpers from `__tests__/__mocks__/database.js`"

---

## ✅ Quality Checklist for RESEARCH.md

Before generating RESEARCH.md, verify:

### Discovery Completeness
- [ ] Searched for similar components (by name, function, architecture)
- [ ] Identified all reusable utilities/helpers
- [ ] Found relevant test patterns
- [ ] Located integration points
- [ ] Analyzed conventions from actual code

### Specificity
- [ ] All references include `file:line` or `file:line-range`
- [ ] Patterns include concrete code examples
- [ ] Integration points list specific files/functions
- [ ] Test strategy references actual test files

### Actionability
- [ ] Execution strategy is step-by-step
- [ ] Each step references specific files to read/modify
- [ ] Clear which components to reuse vs create
- [ ] Test approach follows project conventions

### No Duplication
- [ ] References AI_PROMPT.md/TASK.md/PROMPT.md for existing context
- [ ] Only includes NEW discoveries from research
- [ ] Doesn't copy tech stack or conventions already documented

---

## 🎯 Success Criteria

A high-quality RESEARCH.md should enable the agent to:

1. ✅ **Reuse** existing components instead of creating duplicates
2. ✅ **Follow** established patterns for consistency
3. ✅ **Integrate** correctly with existing code
4. ✅ **Test** using project conventions
5. ✅ **Execute** efficiently with a clear strategy

**Impact Metrics:**
- **Code consistency:** 90%+ pattern adherence
- **Reuse rate:** 70%+ of utilities reused vs created
- **Integration success:** Zero breaking changes without migration
- **Test coverage:** Matches or exceeds project standards

---

**Remember:** RESEARCH.md is about **learning before doing**. The better the research, the better the implementation.
