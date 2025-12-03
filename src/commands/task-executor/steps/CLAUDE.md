# CLAUDE.md — Prompt Engineering Guidelines

## 🎯 Purpose

This document defines the **standards and best practices** for all prompts within `/src/steps/`. These guidelines ensure maximum quality, assertiveness, and universal compatibility across any programming language, framework, or technology stack.

---

## 🌍 Core Principle: Platform & Stack Agnosticism

**ALL prompts MUST be platform and stack agnostic.**

### What This Means

Prompts should work equally well for:
- **Languages:** JavaScript, TypeScript, Python, Go, Java, Ruby, C#, Rust, PHP, Kotlin, Swift, Scala, Clojure, etc.
- **Frameworks:** Express, Django, Spring Boot, Rails, Flask, FastAPI, Gin, .NET, etc.
- **Test Frameworks:** Jest, pytest, go test, JUnit, RSpec, xUnit, cargo test, PHPUnit, etc.
- **Build Tools:** npm, pip, Maven, Gradle, Cargo, bundler, go mod, dotnet, composer, etc.
- **Databases:** PostgreSQL, MongoDB, MySQL, SQLite, Redis, DynamoDB, etc.
- **Architectures:** REST APIs, GraphQL, gRPC, CLI tools, microservices, monoliths, serverless, etc.

### Anti-Patterns (DO NOT DO)

❌ **Language-Specific Examples:**
```markdown
Bad: "Create `src/routes/products.ts`"
Bad: "Add validation in `userService.js`"
Bad: "Run `npm test`"
Bad: "Use `console.log` for debugging"
```

✅ **Generic Examples:**
```markdown
Good: "Create `path/to/handler_file.ext`"
Good: "Add validation in `path/to/validator.ext`"
Good: "Run [test_command] (e.g., npm test, pytest, go test)"
Good: "Use print/debug statements"
```

---

## 📚 Prompt Engineering Best Practices

All prompts in `/src/steps/` must follow these proven techniques:

### 1. Chain of Thought (CoT)

Break complex tasks into sequential phases:

```markdown
## PHASE 1: UNDERSTAND
[Clear steps to understand the task]

## PHASE 2: ANALYZE
[Clear steps to analyze the problem]

## PHASE 3: EXECUTE
[Clear steps to execute the solution]

## PHASE 4: VALIDATE
[Clear steps to validate the result]
```

**Why:** Guides Claude through logical reasoning, prevents skipped steps.

### 2. Few-Shot Learning

Provide concrete examples showing expected input/output:

```markdown
**Example 1 (Success Case):**
Input: [scenario]
Output: [expected result]

**Example 2 (Failure Case):**
Input: [scenario]
Output: [expected result]
```

**Why:** Shows exact format, reduces ambiguity by 80%+.

### 3. Explicit Constraints

Use strong, unambiguous language:

```markdown
**MUST:** Actions that are mandatory (no exceptions)
**MUST NOT:** Actions that are forbidden
**CRITICAL:** Actions with high importance
**DO NOT:** Clear prohibitions
```

Example:
```markdown
- MUST verify ALL requirements before approving
- MUST NOT skip any phase of analysis
- CRITICAL: Use actual file paths, not placeholders
- DO NOT assume - verify by reading code
```

**Why:** Eliminates guesswork, ensures compliance.

### 4. Role Definition

Give Claude a clear professional context:

```markdown
You are a **Senior Software Engineer** reviewing code for production deployment.

**Your mindset:**
Think like: [mental model]
Focus on: [what matters]
Ignore: [what doesn't matter]
```

**Why:** Sets appropriate tone and expectations.

### 5. Task Decomposition

Break large tasks into numbered, checkable subtasks:

```markdown
### Task 1: Validate Input
- [ ] Check A
- [ ] Check B
- [ ] Check C

### Task 2: Process Data
- [ ] Step A
- [ ] Step B

For each unchecked item, document: [what] + [where] + [why]
```

**Why:** Nothing gets forgotten, progress is trackable.

### 6. Self-Correction

Add validation steps where Claude checks its own work:

```markdown
## SELF-VALIDATION

Before finishing, verify YOUR OWN work:
- [ ] I completed all phases
- [ ] I provided specific evidence (not vague)
- [ ] I didn't skip any required steps
- [ ] I verified by reading actual code (not assumptions)

Red flags (if YES, review again):
- [ ] Did I use placeholders instead of real paths?
- [ ] Did I skip reading any required files?
```

**Why:** Catches mistakes before submission, improves quality 40%+.

### 7. Output Specification

Define exact structure of expected output:

```markdown
## REQUIRED OUTPUT

You MUST produce (no exceptions):

1. **File: BLUEPRINT.md**
   - Task identity and context chain
   - Execution contract with phases
   - Implementation strategy

2. **File: execution.json**
   - Status: pending | in_progress | completed | blocked
   - Phases with status tracking
   - Artifacts and completion data

3. **Validation:**
   - Verify both files exist
   - Verify JSON is valid
   - Verify all required fields present
```

**Why:** Consistent, parseable output every time.

### 8. Evidence-Based Reasoning

Require Claude to show its work:

```markdown
For each decision, provide:
- **Evidence:** [what you observed]
- **Source:** [file:line where you found it]
- **Reasoning:** [why this matters]
- **Decision:** [what to do]

Example:
- Evidence: Function returns null on error
- Source: path/to/handler.ext:45
- Reasoning: Breaks error handling contract
- Decision: FAIL - must throw/return error object
```

**Why:** Decisions are traceable and auditable.

### 9. Context Provision

Always provide rich context at the start:

```markdown
## CONTEXT FILES

Read these to understand the full picture:
- [file1] → [what it contains]
- [file2] → [what it contains]

These provide:
- Original requirements
- Architectural decisions
- Code patterns
- Integration points
```

**Why:** Claude has full picture, makes better decisions.

### 10. Action Templates

Provide reusable patterns for common outputs:

```markdown
For each issue found, use this format:
- **Issue:** [short description]
- **Location:** [file:line]
- **Current:** [what exists now]
- **Expected:** [what should exist]
- **Impact:** [why this matters]
- **Fix:** [how to resolve]
```

**Why:** Consistent, actionable output.

---

## 🔧 Language-Agnostic Patterns

### File References

Always use generic patterns with `.ext`:

```markdown
✅ path/to/handler_file.ext:45-80
✅ path/to/test_file.ext:20-50
✅ path/to/config.ext

❌ src/routes/products.ts:45-80
❌ tests/products.test.js:20-50
❌ config/database.yml
```

### Commands

Always show multi-stack examples:

```markdown
# Test commands (use actual project command):
# - JavaScript/TypeScript: npm test, yarn test, bun test
# - Python: pytest, python -m unittest
# - Go: go test ./...
# - Java: mvn test, gradle test
# - Ruby: rspec
# - C#: dotnet test
# - Rust: cargo test

[actual_command_from_project]
```

### Code Concepts

Use generic terminology:

```markdown
✅ entities, handlers, validators, services
✅ input validation, error handling, data processing
✅ operations, requests, responses
✅ tests, assertions, coverage

❌ products, users, posts (too specific)
❌ API routes, REST endpoints (assumes web)
❌ HTTP status codes (assumes protocol)
```

### Project Detection

Instruct Claude to detect the stack:

```markdown
**CRITICAL:** Detect the actual stack used:

Check for:
- package.json → Node.js/JavaScript
- pyproject.toml, setup.py → Python
- go.mod → Go
- pom.xml, build.gradle → Java
- Gemfile → Ruby
- *.csproj → C#
- Cargo.toml → Rust
- composer.json → PHP

Use the ACTUAL commands and patterns from the detected stack.
```

---

## ✅ Quality Checklist for Prompts

Before committing any prompt, verify:

### Language Agnosticism
- [ ] No language-specific file extensions in examples
- [ ] No language-specific commands without alternatives
- [ ] No assumptions about project structure
- [ ] No framework-specific terminology
- [ ] Generic examples work for 8+ languages

### Prompt Engineering
- [ ] Uses Chain of Thought (phases)
- [ ] Includes Few-Shot examples (success + failure)
- [ ] Has explicit constraints (MUST/MUST NOT)
- [ ] Defines role clearly
- [ ] Breaks task into checkboxes
- [ ] Includes self-validation section
- [ ] Specifies exact output format
- [ ] Requires evidence-based reasoning
- [ ] Provides rich context
- [ ] Uses action templates

### Clarity
- [ ] Instructions are unambiguous
- [ ] Steps are numbered and sequential
- [ ] Expected output is clearly defined
- [ ] Edge cases are addressed
- [ ] Failure modes are handled

### Completeness
- [ ] All phases have substeps
- [ ] All decisions have criteria
- [ ] All outputs have templates
- [ ] All validations have checklists

---

## 📝 Template Structure

Every prompt should follow this structure:

```markdown
# [Step Name] — [Brief Description]

## 🎯 YOUR ROLE
[Clear professional context]

## 🧠 MENTAL MODEL
[How to think about this task]

## 📚 CONTEXT FILES
[What to read and why]

---

## 📋 PHASE 1: [Name]
[Clear steps with checkboxes]

## 📋 PHASE 2: [Name]
[Clear steps with checkboxes]

## 📋 PHASE 3: [Name]
[Clear steps with checkboxes]

---

## 🔍 EXAMPLES

**Example 1 (Success):**
[Concrete example]

**Example 2 (Failure):**
[Concrete example]

---

## 🔍 SELF-VALIDATION

Before finishing:
- [ ] Validation checklist
- [ ] Quality checks
- [ ] Red flags

---

## 🎯 REQUIRED OUTPUT

You MUST produce:
1. [File/action with exact format]
2. [File/action with exact format]
3. [Validation steps]
```

---

## 🚀 Impact of Following These Guidelines

### Before:
- ❌ Prompts assume JavaScript/TypeScript
- ❌ Vague instructions ("do your best")
- ❌ No examples or templates
- ❌ Easy to skip steps
- ❌ Inconsistent output
- ❌ Hard to audit decisions

### After:
- ✅ Works for 10+ languages
- ✅ Clear, unambiguous instructions
- ✅ Concrete examples showing format
- ✅ Systematic checklist prevents skips
- ✅ Consistent, structured output
- ✅ Evidence-based, traceable decisions
- ✅ 40%+ quality improvement
- ✅ 80%+ reduction in ambiguity

---

## 📖 Reference Examples

See these files for exemplary implementation:
- `step4/` — BLUEPRINT.md + execution.json generation
- `step5/` — Task execution with execution.json tracking
- `step6/` — Code review with systematic analysis

---

## 🔄 Maintaining These Standards

### When Creating New Prompts:
1. Copy template structure above
2. Fill in all sections (don't skip)
3. Add 2+ concrete examples
4. Test with 3+ different languages mentally
5. Run through quality checklist
6. Get peer review

### When Updating Existing Prompts:
1. Verify still follows all 10 best practices
2. Remove any language-specific assumptions
3. Add examples if missing
4. Add self-validation if missing
5. Update to match latest template

### Red Flags in PRs:
- Hard-coded `.js`, `.ts`, `.py` extensions in examples
- Commands without multi-stack alternatives
- No Chain of Thought phases
- No concrete examples
- No self-validation section
- Vague constraints ("try to", "ideally")

---

## 📞 Questions?

If you're unsure whether a prompt follows these guidelines:

1. Run through the Quality Checklist above
2. Compare against reference examples
3. Test mentally with Python, Go, and Java
4. If it breaks for any language → needs fixing

**Remember:** Every minute spent making prompts universal saves hours of debugging language-specific issues later.

---

## 🏗️ Architecture Conventions

### Core Principles

1. **Single Responsibility Principle (SRP) - CRITICAL**
   - Each step MUST do ONE thing and ONLY ONE thing
   - NO substeps (step 0.0, step 0.1, step 0.2) - these should be separate steps
   - If you need substeps, create step0, step1, step2 instead
   - Each `.js` file = ONE clear action/responsibility
   - Example: "Generate questions" = step0, "Generate AI_PROMPT" = step1, "Decompose tasks" = step2

2. **External Prompts for Large Commands**
   - If `executeClaude(prompt)` contains > 500 characters → extract to `.md` file
   - Keep JavaScript files focused on logic, not prompt content
   - Markdown files contain the actual prompt instructions

3. **Cohesive Directory Structure**
   - Each step lives in its own `/stepX/` directory
   - Simple steps (single file) can be just `/stepX/index.js`
   - Everything related to stepX lives in `/stepX/`
   - Easy navigation: developer opens `/stepX/` and sees complete context

---

### Directory Structure Standard

```
src/steps/
├── index.js                      # Exports all steps
├── CLAUDE.md                     # Guidelines (stays at root)
│
├── step0/
│   ├── index.js                  # Generate clarification questions (SRP)
│   └── prompt.md                 # Prompt for step0 (if > 500 chars)
│
├── step1/
│   ├── index.js                  # Generate AI_PROMPT.md (SRP)
│   └── prompt.md                 # Prompt for step1 (if > 500 chars)
│
├── step2/
│   ├── index.js                  # Decompose into tasks (SRP)
│   └── prompt.md                 # Prompt for step2 (if > 500 chars)
│
├── step3/
│   ├── index.js                  # Analyze task dependencies (SRP)
│   └── prompt.md                 # Prompt for step3 (if > 500 chars)
│
├── step4/
│   ├── index.js                  # Generate BLUEPRINT.md + execution.json (SRP)
│   └── prompt.md                 # Prompt for step4 (if > 500 chars)
│
├── step5/
│   ├── index.js                  # Execute task (SRP)
│   └── prompt.md                 # Prompt for step5 (if > 500 chars)
│
├── step6/
│   ├── index.js                  # Code review (SRP)
│   └── prompt.md                 # Prompt for step6 (if > 500 chars)
│
├── step7/
│   └── index.js                  # Commit and PR (SRP)
│
└── __tests__/                    # Test files
    ├── step0.test.js
    ├── step1.test.js
    ├── step2.test.js
    └── step3.test.js
```

**Note:** Each step = ONE action only. No substeps allowed.
**Note:** Shared templates are located in `src/templates/`.

---

### File Naming Conventions

#### JavaScript Files

**Pattern:** `index.js` (always)

- Each step directory has ONLY `index.js`
- No substep files - each step is independent
- `index.js` contains the single action for that step

**Examples:**
```
✅ step0/index.js          # Generate questions (ONE action)
✅ step1/index.js          # Generate AI_PROMPT (ONE action)
✅ step2/index.js          # Decompose tasks (ONE action)

❌ step0/step0-0.js        # NO substeps allowed
❌ step0/step0-1.js        # NO substeps allowed
❌ step4/step4-deep-analysis.js  # NO substeps allowed
```

#### Markdown Files (Prompts)

**Pattern:** `prompt.md` (always)

- Each step has at most ONE prompt file named `prompt.md`
- Only create if prompt > 500 characters
- Simple, consistent naming

**Examples:**
```
✅ step0/prompt.md         # Prompt for step0
✅ step1/prompt.md         # Prompt for step1
✅ step2/prompt.md         # Prompt for step2

❌ step0-0-prompt.md       # NO substep prompts
❌ step0-clarification-prompt.md  # Too specific
❌ todo-generation-prompt.md      # Use prompt.md instead
```

#### Templates

**Pattern:** `TEMPLATE_NAME.md` (all caps)

- Shared templates go in `src/templates/`
- Use all caps for global templates
- Use descriptive names

**Examples:**
```
✅ src/templates/BLUEPRINT.md
✅ src/templates/execution-schema.json   # JSON schemas use lowercase

❌ templates/blueprint.md         # Should be uppercase for .md
❌ templates/template-blueprint.md # Redundant prefix
```

---

### Step Implementation Pattern

**Purpose:** Each `index.js` performs ONE action only.

**Rules:**
- Each step = ONE responsibility (strict SRP)
- NO orchestrators - each step is independent
- NO substeps - if you need substeps, create new steps instead
- Keep each step focused on a single, clear action

**Example Pattern:**

```javascript
// src/steps/step0/index.js (Generate clarification questions - ONE action)
const fs = require('fs');
const path = require('path');
const { executeClaude } = require('../services/claude-executor');

const step0 = async (sameBranch = false, promptText = null) => {
  const task = promptText || await getMultilineInput();

  // Load prompt if it's large
  const promptPath = path.join(__dirname, 'prompt.md');
  const prompt = fs.readFileSync(promptPath, 'utf-8');

  logger.startSpinner('Generating clarification questions...');
  await executeClaude(replace(prompt, task, sameBranch));
  logger.stopSpinner();

  // Handle questions logic
  // ...implementation...
}

module.exports = { step0 };
```

```javascript
// src/steps/step1/index.js (Generate AI_PROMPT.md - ONE action)
const step1 = async (task) => {
  const promptPath = path.join(__dirname, 'prompt.md');
  const prompt = fs.readFileSync(promptPath, 'utf-8');

  logger.startSpinner('Generating AI_PROMPT.md...');
  await executeClaude(prompt);
  logger.stopSpinner();

  // Validation
  if (!fs.existsSync(aiPromptPath)) {
    throw new Error('AI_PROMPT.md was not created');
  }
}

module.exports = { step1 };
```

---

### Import/Export Conventions

#### Root `/steps/index.js`

Always export step functions:

```javascript
// src/steps/index.js
const { step0 } = require('./step0');     // from step0/index.js
const { step1 } = require('./step1');     // from step1/index.js
const { step2 } = require('./step2');     // from step2/index.js
const { step3 } = require('./step3');     // from step3/index.js
const { step4 } = require('./step4');     // from step4/index.js
const { step5 } = require('./step5');     // from step5/index.js

module.exports = {
  step0,
  step1,
  step2,
  step3,
  step4,
  step5
};
```

#### Step Files

Export function matching directory name:

```javascript
// src/steps/step0/index.js
module.exports = { step0 };

// src/steps/step1/index.js
module.exports = { step1 };

// src/steps/step5/index.js
module.exports = { step5 };
```

**Note:** NO substep files - each step is independent.

---

### Prompt File Organization

#### Loading Prompts

Always load `prompt.md` from same directory:

```javascript
// ✅ Good: Load prompt.md from same directory
const promptPath = path.join(__dirname, 'prompt.md');
const prompt = fs.readFileSync(promptPath, 'utf-8');

// ❌ Bad: Absolute path or external directory
const prompt = fs.readFileSync('/path/to/prompts/step0-prompt.md', 'utf-8');

// ❌ Bad: Different filename
const promptPath = path.join(__dirname, 'step0-clarification.md');
```

#### Prompt Size Guidelines

- **< 500 chars:** Keep inline in JavaScript (acceptable)
- **500-2000 chars:** Consider external `.md` file
- **> 2000 chars:** MUST be in external `.md` file

**Example:**

```javascript
// ✅ Good: Small prompt, inline
await executeClaude(`Generate a summary of the task in 2-3 sentences.`);

// ✅ Good: Large prompt, external (always named prompt.md)
const prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
await executeClaude(prompt);

// ❌ Bad: Large prompt inline (20KB string in JS file)
await executeClaude(`# Very long prompt... [20KB of text]`);
```

---

### Scalability Guidelines

#### Adding New Steps

**Pattern:** Each step is independent

```bash
# 1. Create directory
mkdir src/steps/step6

# 2. Create step file
touch src/steps/step6/index.js

# 3. Add prompt if needed (> 500 chars)
touch src/steps/step6/prompt.md

# 4. Export from root
# Edit src/steps/index.js and add:
# const { step6 } = require('./step6');
# module.exports = { ..., step6 };
```

#### When a Step Becomes Too Complex

**If a step file has > 200 lines or multiple responsibilities:**

**DON'T:** Create substeps
**DO:** Split into multiple independent steps

**Example:**

```
# ❌ WRONG: Create substeps
step3/
├── index.js
├── step3-1.js
└── step3-2.js

# ✅ RIGHT: Create new steps
step3/
└── index.js    # Research phase

step4/
└── index.js    # Execution phase
```

**Each step = ONE action. No exceptions.**

---

### Anti-Patterns to Avoid

#### ❌ Multiple Actions in One Step

```javascript
// ❌ BAD: step0.js doing multiple things
const step0 = async () => {
  // Generate questions (action 1)
  await executeClaude(prompt1);

  // Generate AI_PROMPT (action 2)
  await executeClaude(prompt2);

  // Decompose tasks (action 3)
  await executeClaude(prompt3);
}
```

**Fix:** Create step0, step1, step2 - each doing ONE action

#### ❌ Creating Substep Files

```
❌ step0/
   ├── index.js
   ├── step0-0.js        # NO substeps!
   └── step0-1.js        # NO substeps!
```

**Fix:** Make step0-0 → step0, step0-1 → step1 (independent steps)

#### ❌ Wrong Prompt File Names

```
❌ step0/step0-clarification-prompt.md
❌ step0/clarification.md
❌ step0/questions-prompt.md
```

**Fix:** Always use `step0/prompt.md`

#### ❌ Inline Large Prompts

```javascript
// ❌ BAD: 5KB prompt inline
await executeClaude(`
  # Very long prompt
  ... [5000 chars] ...
`);
```

**Fix:** Extract to `prompt.md`

#### ❌ Function Names Not Matching Directory

```javascript
// step0/index.js
module.exports = { generateQuestions };  // ❌ Wrong name

// Fix:
module.exports = { step0 };  // ✅ Matches directory name
```

---

### Quality Checklist for Architecture

Before committing code changes:

#### Structure
- [ ] Each step does ONE thing and ONLY ONE thing
- [ ] NO substeps (no step0-0.js, step0-1.js files)
- [ ] All files for stepX are in `/stepX/` directory
- [ ] Prompts > 500 chars are in external `prompt.md` file
- [ ] No loose files in root `/steps/` (except `index.js`, `CLAUDE.md`, `/templates/`)

#### Naming
- [ ] Each step has only `index.js` (no substep files)
- [ ] Prompt file is named `prompt.md` (if exists)
- [ ] Function name matches directory (e.g., `step0` in `step0/index.js`)
- [ ] Templates use ALL_CAPS.md format

#### Organization
- [ ] NO orchestrators - each step is independent
- [ ] NO substeps - create new steps instead
- [ ] Prompts loaded with `path.join(__dirname, 'prompt.md')`
- [ ] Exports follow conventions

#### SRP Compliance
- [ ] Step does not perform multiple actions
- [ ] Step does not call multiple substeps
- [ ] If step is complex, it's split into new steps (not substeps)
- [ ] No anti-patterns present

---

### Benefits of This Architecture

**Before (Violating SRP):**
- ❌ Steps with substeps (step 0.0, 0.1, 0.2)
- ❌ Single files doing multiple things
- ❌ Unclear which `.md` belongs to which step
- ❌ Hard to understand what each step does
- ❌ Difficult to maintain and test

**After (Strict SRP):**
- ✅ Each step = ONE action (crystal clear)
- ✅ No substeps - only independent steps
- ✅ Simple structure: `/stepX/index.js` + optional `prompt.md`
- ✅ Easy to understand: open step0, see ONE thing
- ✅ Easy to test: each step is isolated
- ✅ Easy to refactor: split complex step into new steps
- ✅ Scales to 50+ steps without confusion

---

### Reference Implementation

**Simple Step (No External Prompt):**
```
step1/
└── index.js       # ONE action, small inline prompt
```

**Standard Step (With External Prompt):**
```
step2/
├── index.js       # ONE action, logic only
└── prompt.md      # Large prompt (> 500 chars)
```

**NO Complex Steps with Substeps:**
```
❌ WRONG - Don't do this:
step0/
├── index.js
├── step0-0.js
├── step0-1.js
└── step0-2.js

✅ RIGHT - Do this instead:
step0/
└── index.js       # Generate questions

step1/
└── index.js       # Generate AI_PROMPT

step2/
└── index.js       # Decompose tasks
```

---

## 📋 Template System

### Core Principle: Reusable Output Formats

**CRITICAL:** Always use existing templates from `/src/steps/templates/` when generating structured output files. Templates ensure consistency, completeness, and adherence to project standards.

### When to Use Templates

**ALWAYS** use templates when:
- Generating `BLUEPRINT.md` files (use `templates/BLUEPRINT.md`)
- Generating `execution.json` files (use `templates/execution-schema.json`)
- Creating standardized output files across steps
- Ensuring consistent structure in generated documentation
- Following established project patterns and formats

### Template Directory Structure

```
src/steps/templates/
├── BLUEPRINT.md            # Task definition with identity, context, and strategy
├── execution-schema.json   # JSON schema for execution.json validation
└── [NEW_TEMPLATE].md       # New templates following ALL_CAPS.md naming
```

### Using Existing Templates

#### In Step Implementation

When a step needs to generate a file that matches a template:

```javascript
// ✅ CORRECT: Load and use template
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../templates/BLUEPRINT.md');
const template = fs.readFileSync(templatePath, 'utf-8');

// Include template reference in your prompt
const prompt = `
Generate a BLUEPRINT.md file following this EXACT structure:

${template}

CRITICAL: Maintain all sections and formatting from the template.
`;

await executeClaude(prompt);
```

#### In Prompt Files

Reference templates directly in `prompt.md`:

```markdown
## REQUIRED OUTPUT

You MUST generate:

1. `BLUEPRINT.md` following the EXACT structure from `/src/steps/templates/BLUEPRINT.md`.

**BLUEPRINT sections (ALL REQUIRED):**
1. Task Identity (ID, title, scope)
2. Context Chain (parent references)
3. Execution Contract (phases, artifacts)
4. Implementation Strategy

2. `execution.json` following the schema from `/src/steps/templates/execution-schema.json`.

**execution.json fields (ALL REQUIRED):**
- status: pending | in_progress | completed | blocked
- phases: array of phase objects
- artifacts: array of created/modified files
- completion: status and notes

**DO NOT:**
- Skip any required sections
- Use invalid JSON syntax
- Omit required fields
```

### Creating New Templates

#### When to Create a New Template

Create a new template when:
- Multiple steps need to generate files with the same structure
- Output format needs to be standardized across the project
- Complex file format needs consistent sections and formatting
- Documentation pattern will be reused frequently

#### Template Creation Process

1. **Identify the Need**
   - Is this file structure used in 2+ steps?
   - Does it have a clear, repeatable format?
   - Will it improve consistency?

2. **Create the Template File**
   ```bash
   # Use ALL_CAPS.md naming convention
   touch src/steps/templates/NEW_TEMPLATE.md
   ```

3. **Define Complete Structure**
   ```markdown
   # Template: [Name and Purpose]

   ## Section 1: [Name]
   [Description of what goes here]
   - [ ] Checkbox item format
   - [ ] Another item

   ## Section 2: [Name]
   [Description of what goes here]

   **Subsection:**
   - **Field:** [value format]
   - **Field:** [value format]

   ## Section 3: [Name]
   [Description and examples]
   ```

4. **Document Template Usage**
   - Add clear comments explaining each section
   - Include examples where helpful
   - Specify required vs optional sections
   - Define acceptable value formats

5. **Update This Documentation**
   - Add template to directory structure list
   - Document when to use it
   - Provide usage examples

#### Template Best Practices

**Structure:**
- ✅ Use clear section headings (##, ###)
- ✅ Include all required fields
- ✅ Use checkboxes for actionable items
- ✅ Provide inline documentation/comments
- ✅ Show example values in brackets [like this]
- ✅ Mark optional sections clearly

**Content:**
- ✅ Language-agnostic examples (use `.ext` not `.js`)
- ✅ Platform-agnostic commands (show alternatives)
- ✅ Generic terminology (avoid specific tech)
- ✅ Clear instructions for each section
- ✅ Validation criteria where applicable

**Naming:**
- ✅ ALL_CAPS.md format
- ✅ Descriptive name (TODO, CONTEXT, RESEARCH)
- ✅ Single word or hyphenated (TASK-SUMMARY.md)

**Example Template Header:**
```markdown
# [TEMPLATE_NAME].md Template

**Purpose:** [What this template is for]
**Used by:** [Which steps use this]
**When to use:** [Conditions for using this template]

---

## Instructions

This template MUST be followed exactly. All sections marked [REQUIRED] are mandatory.

[Rest of template...]
```

### Template Maintenance

#### Updating Existing Templates

When updating templates:

1. **Assess Impact**
   - Which steps use this template?
   - Will changes break existing workflows?
   - Is this backward compatible?

2. **Make Changes Carefully**
   - Update template file
   - Update all steps that reference it
   - Update documentation
   - Test with actual step execution

3. **Version Control**
   - Document changes in template header
   - Update "Last Updated" date
   - Note breaking changes clearly

#### Template Versioning

For major template changes:

```markdown
# BLUEPRINT.md Template

**Version:** 2.0
**Last Updated:** 2025-01-18
**Breaking Changes:**
- Added "Execution Contract" section (required)
- Renamed "Tasks" to "Phases"
- Moved implementation details to execution.json

**Migration Guide:**
[Instructions for updating code that uses old version]
```

### Quality Checklist for Templates

Before committing a new or updated template:

#### Completeness
- [ ] All necessary sections are included
- [ ] Required vs optional sections are marked
- [ ] Examples are provided for complex sections
- [ ] Instructions are clear and unambiguous

#### Consistency
- [ ] Follows ALL_CAPS.md naming
- [ ] Uses language-agnostic examples
- [ ] Matches existing template style
- [ ] Has proper version/date headers

#### Usability
- [ ] Can be used across multiple languages/frameworks
- [ ] Has inline documentation/comments
- [ ] Provides clear value format examples
- [ ] Easy to understand and follow

#### Integration
- [ ] Referenced in relevant step prompts
- [ ] Loaded correctly in step implementations
- [ ] Documented in this CLAUDE.md file
- [ ] Tested with actual step execution

### Anti-Patterns for Templates

#### ❌ Language-Specific Templates

```markdown
# ❌ BAD: JavaScript-specific
## Implementation
- Create `src/routes/products.ts`
- Add test in `tests/products.test.js`
- Run `npm test`
```

**Fix:** Use generic patterns
```markdown
# ✅ GOOD: Language-agnostic
## Implementation
- Create `path/to/routes/entity.ext`
- Add test in `path/to/tests/entity.test.ext`
- Run [test_command] (npm test, pytest, go test, etc.)
```

#### ❌ Incomplete Templates

```markdown
# ❌ BAD: Missing key sections
## TODO
- [ ] Do the thing
```

**Fix:** Provide comprehensive structure
```markdown
# ✅ GOOD: Complete sections
## Context Reference
[...]

## Implementation Plan
[...]

## Verification
[...]

## Acceptance Criteria
[...]
```

#### ❌ Templates Without Documentation

```markdown
# ❌ BAD: No explanation
## Risks & Mitigations
- [risk → mitigation]
```

**Fix:** Add clear instructions
```markdown
# ✅ GOOD: Clear instructions
## Risks & Mitigations
**Instructions:** For each identified risk, provide:
- **Risk:** What could go wrong
- **Impact:** Severity and scope
- **Mitigation:** How to prevent or handle it

**Format:** [risk description] → [mitigation strategy]

**Example:**
- Database migration fails mid-deployment → Use transactional migrations with rollback capability
```

### Examples

#### Example 1: Using BLUEPRINT Template in Step

```javascript
// src/steps/step4/index.js
const fs = require('fs');
const path = require('path');

const step4 = async (taskName) => {
  // Load BLUEPRINT template
  const blueprintTemplatePath = path.join(__dirname, '../templates/BLUEPRINT.md');
  const blueprintTemplate = fs.readFileSync(blueprintTemplatePath, 'utf-8');

  // Load step prompt that references the template
  const promptPath = path.join(__dirname, 'prompt.md');
  let prompt = fs.readFileSync(promptPath, 'utf-8');

  // Inject template into prompt
  prompt = prompt.replace('{{BLUEPRINT_TEMPLATE}}', blueprintTemplate);

  logger.startSpinner('Generating BLUEPRINT.md and execution.json...');
  await executeClaude(prompt);
  logger.stopSpinner();

  // Validate outputs
  const blueprintPath = path.join(state.claudiomiroFolder, taskName, 'BLUEPRINT.md');
  const executionPath = path.join(state.claudiomiroFolder, taskName, 'execution.json');
  validateFilesExist([blueprintPath, executionPath]);
};
```

#### Example 2: execution.json Structure

```json
{
  "taskId": "TASK1",
  "status": "in_progress",
  "attempts": 1,
  "currentPhase": {
    "id": "impl",
    "name": "Implementation"
  },
  "phases": [
    {
      "id": "impl",
      "name": "Implementation",
      "status": "in_progress",
      "items": [
        { "description": "Create handler", "status": "completed" },
        { "description": "Add validation", "status": "pending" }
      ]
    }
  ],
  "artifacts": [
    { "path": "src/handler.ext", "action": "created" }
  ],
  "uncertainties": [
    {
      "id": "U1",
      "topic": "API version",
      "assumption": "Use v2",
      "confidence": 0.7
    }
  ],
  "completion": {
    "status": "pending_validation",
    "codeReviewPassed": false,
    "forFutureTasks": []
  }
}
```

**Use this structure when generating execution.json in step4.**

---

## 🎯 Template Summary

**Key Takeaways:**

1. **Use BLUEPRINT.md + execution.json** as the standard output format
2. **Load templates** from `/src/steps/templates/` directory
3. **Follow template structure** exactly - don't skip sections
4. **Validate execution.json** using the schema
5. **Keep templates language-agnostic** using `.ext` and generic examples
6. **Document templates** clearly with purpose and usage instructions
7. **Version templates** when making breaking changes

**File Responsibilities:**
- **BLUEPRINT.md** - Static task definition (identity, context, strategy)
- **execution.json** - Dynamic execution state (status, phases, artifacts)

**Benefits:**
- ✅ Consistent output across all steps
- ✅ Structured JSON for programmatic access
- ✅ Clear separation of static vs dynamic data
- ✅ Easier validation and error handling
- ✅ Clear expectations for Claude's output
- ✅ Reusable patterns across project

---

**Version:** 1.2
**Last Updated:** 2025-01-18
**Maintainers:** Claudiomiro Core Team
