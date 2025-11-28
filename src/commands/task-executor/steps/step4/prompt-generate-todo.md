# TODO.md Generation Task — Deep Context Analysis Required

## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

## 🎯 OBJECTIVE
Create a comprehensive, executable TODO.md file that an autonomous agent can follow WITHOUT external clarification.

Your TODO.md MUST be:
- **Self-contained**: Contains ALL context needed (tech stack, patterns, file locations)
- **Precise**: Exact file paths, line numbers, concrete examples
- **Actionable**: Step-by-step instructions with clear verification
- **Context-rich**: Propagates environment, conventions, and codebase patterns

---

## 📚 CONSOLIDATED CONTEXT (Token-Optimized)

The section below contains a **pre-built summary** of the project environment extracted from previous tasks. Use this summary as your PRIMARY source of context - it contains the essential information you need.

**IMPORTANT: Token Optimization Strategy**
- ✅ **USE the summary below FIRST** - it has tech stack, architecture, and conventions already extracted
- ✅ **Reference files are listed** - read them ONLY if you need more specific details
- ❌ **DO NOT re-read AI_PROMPT.md entirely** - the summary already has the key information
- ❌ **DO NOT iterate all previous task folders** - completed task context is already summarized

{{contextSection}}
---

## 📋 PRE-EXECUTION PHASE: Deep Analysis (DO THIS FIRST)

Before writing TODO.md, perform thorough analysis:

### 1️⃣ UNDERSTAND THE TASK COMPLETELY
- Read `{{taskMdPath}}` — understand scope, acceptance criteria, dependencies
- Read `{{promptMdPath}}` — extract environment context, tech stack, conventions
- Read related TODO.md files from dependencies (listed in @dependencies)
- **CRITICAL: Detect the actual language/stack from the project:**
  - Look at file extensions (.py, .js, .go, .java, .rb, .cs, .php, .rs, etc.)
  - Check package files (package.json, requirements.txt, go.mod, pom.xml, Gemfile, etc.)
  - Identify the testing framework actually used in the project
  - Find the build/run commands used in existing scripts or CI config
- **Extract and note:**
  - Tech stack (ACTUAL languages, frameworks, versions found in the project)
  - Project structure (ACTUAL directories found in the codebase)
  - Coding conventions (ACTUAL naming, patterns, error handling used in the code)
  - Testing approach (ACTUAL framework, mocking strategy found in tests)
  - Related files with exact paths and line ranges from the ACTUAL codebase

### 2️⃣ EXPLORE THE CODEBASE
- **Find similar implementations** in the codebase to understand patterns
- **Identify all files** that need to be read, modified, or created
- **Locate related functions, classes, modules** with exact paths
- **Find existing tests** to understand testing patterns
- **Discover integration points** with other parts of the system
- **Note:** Use grep, find, or code search to locate relevant code

### 3️⃣ MAP INTEGRATION POINTS
- Identify **upstream dependencies**: What do previous tasks provide?
- Identify **downstream consumers**: What will future tasks need?
- Define **contracts**: APIs, types, schemas, events
- Document **data flow**: Input → Processing → Output

### 4️⃣ ASSESS COMPLEXITY & RISKS
- Evaluate complexity: Low / Medium / High
- Identify potential challenges or blockers
- Note areas requiring special attention
- Document assumptions and constraints

---

## ✍️ WRITING PHASE: Create TODO.md

After completing analysis, write `{{todoMdPath}}` following this structure:

### MANDATORY SECTIONS:

#### 1. Status Line (FIRST LINE)
```
Fully implemented: NO
```

#### 2. Context Reference (NO DUPLICATION)
```markdown
## Context Reference

**For complete environment context, read these files in order:**
1. `{{aiPromptPath}}` - Universal context (tech stack, architecture, conventions)
2. `{{taskMdPath}}` - Task-level context (what this task is about)
3. `{{promptMdPath}}` - Task-specific context (files to touch, patterns to follow)

**You MUST read these files before implementing to understand:**
- Tech stack and framework versions
- Project structure and architecture
- Coding conventions and patterns
- Related code examples with file:line references
- Integration points and dependencies

**DO NOT duplicate this context below - it's already in the files above.**
```

#### 3. Implementation Plan (3-6 HIGH-QUALITY ITEMS)

Each item MUST include ALL subsections:

```markdown
## Implementation Plan

- [ ] **Item 1 — [Feature Unit: Implementation + Tests]**
  - **What to do:**
    [DETAILED, STEP-BY-STEP instructions based on the actual project]
    Example structure (adapt to your language/framework):
    1. Create/modify `path/to/main/file.ext` following pattern from `path/to/reference.ext:20-80`
    2. Implement core functionality (see reference_file.ext:45-60 for pattern)
    3. Add validation/input handling (follow validation_file.ext:12-35 pattern)
    4. Create supporting modules/classes if needed
    5. Write tests in `path/to/test_file.ext` (follow existing_test.ext:10-50 pattern)

  - **Context (read-only):**
    [EXACT file paths to read for patterns/context - use actual project files]
    - `path/to/similar_implementation.ext:20-80` — [Pattern description]
    - `path/to/validation_example.ext:12-35` — [Validation pattern used]
    - `path/to/module_structure.ext:45-60` — [Architecture pattern]
    - `path/to/test_example.ext:10-50` — [Test setup pattern]

  - **Touched (will modify/create):**
    [EXACT files to create or modify - use actual paths]
    - CREATE: `path/to/new_file.ext`
    - MODIFY: `path/to/existing_file.ext` — [What to change] (line ~45)
    - CREATE: `path/to/test_file.ext`
    [List ALL files that will be touched]

  - **Interfaces / Contracts:**
    [APIs, types, schemas, events, function signatures - whatever applies]
    - Export/public interface definitions
    - API contracts (REST, GraphQL, gRPC, CLI args)
    - Data schemas (SQL, JSON Schema, Protobuf, etc.)
    - Event signatures (if event-driven)

  - **Tests:**
    [Specific test scenarios - be precise to the testing framework used]
    Type: [unit/integration/e2e] tests with [framework name]
    - Happy path: [Specific successful scenario]
    - Edge case: [Boundary condition]
    - Edge case: [Empty/null/zero case]
    - Failure: [Expected error scenario]

  - **Migrations / Data:**
    [If applicable - database, config, state migrations]
    - Database: [SQL migration, ORM command, or N/A]
    - Config: [New env vars, config files]
    - State: [Data backfill needs]
    [Or: "N/A - No data changes"]

  - **Observability:**
    [Logging, metrics, tracing - whatever is used in the project]
    - Add logging at key points (entry, error, success)
    - Metrics to track (if applicable)
    - Trace spans (if distributed tracing is used)
    [Or: "N/A - No observability requirements"]

  - **Security & Permissions:**
    [Auth, authorization, PII, rate limits, input sanitization]
    - Authentication/authorization requirements
    - PII handling (anonymize, encrypt, avoid logging)
    - Rate limiting if public-facing
    - Input validation and sanitization
    [Or: "N/A - No security concerns"]

  - **Performance:**
    [Targets, limits, complexity, resource usage]
    - Performance targets (latency, throughput)
    - Resource limits (memory, CPU, connections)
    - Algorithmic complexity considerations
    - Optimization strategies (caching, indexes, batching)
    [Or: "N/A - No performance requirements"]

  - **Commands:**
    [Exact commands to run - adapt to the actual project's tooling]
    ```bash
    # Development (adapt to actual project)
    [npm run dev / python main.py / go run . / dotnet run / etc.]

    # Tests (ONLY affected paths - USE QUIET FLAGS)
    [npm test path --silent / pytest path -q --tb=line / go test -json ./path / mvn test -q / etc.]

    # Lint/Format (ONLY changed files - USE QUIET FLAGS)
    [eslint --fix path --quiet / black path --quiet / gofmt / rubocop --format simple / etc.]

    # Type/Compile check (USE MINIMAL OUTPUT)
    [tsc --noEmit --pretty false / mypy path --no-error-summary / go build / javac / etc.]
    ```

  - **Risks & Mitigations:**
    [Specific risks and how to handle them]
    - **Risk:** [Specific technical risk]
      **Mitigation:** [Concrete mitigation strategy]
    - **Risk:** [Another risk]
      **Mitigation:** [Another mitigation]
    [Or: "No significant risks identified"]

[... 2-5 more items following same structure]
```

**QUALITY OVER QUANTITY:** Prefer 3-6 comprehensive items over 10+ shallow steps.

#### 4. Verification (Global)
```markdown
## Verification (global)
- [ ] Run targeted tests ONLY for changed code (USE QUIET/SILENT FLAGS):
      ```bash
      # Examples - use actual project commands with QUIET flags:
      [test_command] path/to/changed/files --silent
      # npm test path --silent / pytest path -q --tb=line / go test -json ./path / mvn test -q

      [lint_command] path/to/changed/files --quiet
      # eslint --fix path --quiet / black path --quiet / gofmt -w path / rubocop --format simple

      [type_or_compile_check] (if applicable)
      # tsc --noEmit --pretty false / mypy path --no-error-summary / go build
      ```
      **CRITICAL:** Do not run full-project checks. Use quiet/silent flags to minimize output.
- [ ] All acceptance criteria met (see below)
- [ ] Code follows conventions from AI_PROMPT.md and PROMPT.md
- [ ] Integration points properly implemented (contracts match dependencies)
- [ ] Performance targets met (measure with actual data if specified)
- [ ] Security requirements satisfied (if specified)
```

#### 5. Acceptance Criteria
```markdown
## Acceptance Criteria
[From TASK.md - copy acceptance criteria and make them measurable and specific]
Examples (adapt to actual task requirements):
- [ ] [Feature] works as specified in [measurable way]
- [ ] [Validation/error handling] properly rejects [invalid inputs]
- [ ] All tests pass ([X] test cases covering [scenarios])
- [ ] Code coverage for changed code: [target]% or all critical paths covered
- [ ] Follows patterns from [reference_file.ext:lines]
- [ ] [Compilation/type checking] passes without errors (if applicable)
- [ ] [Performance target] met: [metric] < [threshold] (if applicable)
```

#### 6. Impact Analysis
```markdown
## Impact Analysis
- **Directly impacted:**
  [List all files directly modified or created]
  - `path/to/file1.ext` (new/modified)
  - `path/to/file2.ext:line` (specific change)
  - `path/to/file3.ext` (configuration/registration)

- **Indirectly impacted:**
  [List downstream effects]
  - Future tasks depending on this functionality
  - Documentation that may need updates
  - Configuration or deployment changes
  - Database schema or state changes
  - API contracts or public interfaces
```

#### 7. Follow-ups
```markdown
## Follow-ups
[List ambiguities or missing information - DO NOT guess or assume]
- None identified (or list specific ambiguities)
```

---

## 🎯 CRITICAL SUCCESS FACTORS

1. **No Context Duplication:** Context Reference section points to AI_PROMPT.md/TASK.md/PROMPT.md (NO copying)
2. **Precision:** All file paths include line ranges, no vague "follow best practices"
3. **Completeness:** Every TODO item has ALL subsections filled (no skipping)
4. **Actionability:** Agent reads context files, then executes without asking questions
5. **Traceability:** Clear connection between AI_PROMPT.md → TASK.md → TODO.md → actual code

---

## 🚫 ANTI-PATTERNS TO AVOID

❌ **Vague references:** "Follow best practices" → ✅ "Follow pattern in path/to/file.ext:45-60"
❌ **Duplicating context:** Copying tech stack from AI_PROMPT.md → ✅ Reference AI_PROMPT.md (read, don't copy)
❌ **Generic guidance:** "Handle errors properly" → ✅ "Use [ErrorClass] from path/to/errors.ext:10"
❌ **Generic frameworks:** "Use Jest/pytest/etc" → ✅ Use the ACTUAL testing framework from the project
❌ **Incomplete items:** Only 3 of 10 subsections → ✅ ALL subsections filled (or marked N/A with reason)
❌ **Shallow steps:** "Create API" → ✅ Detailed step-by-step with exact files and patterns
❌ **No verification:** Missing test commands → ✅ Exact commands matching project's tooling
❌ **Language assumptions:** Assuming JS/TS when project is Python/Go/Java/etc → ✅ Detect and use actual language
❌ **Wrong file extensions:** Using .ts when project uses .py/.go/.java → ✅ Use correct extensions from codebase

---

## 📝 FINAL CHECKLIST

Before finishing, validate:
- [ ] Context Reference section points to AI_PROMPT.md, TASK.md, PROMPT.md (NO duplication)
- [ ] Each Implementation Plan item has ALL subsections filled
- [ ] All file references include exact paths (and line ranges where relevant)
- [ ] Commands are copy-paste ready
- [ ] Tests are specific with clear scenarios
- [ ] Acceptance criteria are measurable
- [ ] No ambiguities remain (or listed in Follow-ups)
- [ ] Quality over quantity: 3-6 comprehensive items, not 10+ shallow ones

---

**REMEMBER:** This TODO.md will be read by an autonomous agent. If YOU wouldn't know what to do with vague instructions, the agent won't either. Be specific, be precise, be complete.

**IMPORTANT: quality over quantity.** Prefer 3–6 well-defined items over many tiny steps. Each item must represent a self-contained deliverable (feature + test).

---

### Rules
- First line of `{{todoMdPath}}` = `Fully implemented: NO`
- All actions deterministic, idempotent, and local.
- Never run `git add/commit/push`.
- Fix seeds/timezones → no flaky tests.

## Testing Guideline (Diff-Driven and Minimal)

**Purpose:** Confirm your code works — using the fewest tests that fully prove correctness.
**Never:** chase global coverage or test untouched code.

### Scope
- Test only modified code and directly affected interfaces.
- Build a **Diff Test Plan**:
  - List changed files/symbols.
  - For each: 1 happy path + 1–2 edge cases + 1 predictable failure (if relevant).
- Skip untouched code unless a contract changed or a reproducible bug exists.
- Testing speed or benchmarks: only if explicitly required.
- Mock all external boundaries (network, DB, FS, UUID, clock, env).

### Types
- **Unit tests:** default.
- **Integration tests:** only if modules must interact for correctness.
- **E2E tests:** only if explicitly required.
- **Any other type of test:** only if explicitly required.
- **No framework:** describe hypothetical test cases (title + arrange/act/assert + expected result).

### Coverage
- Target 100% coverage for changed lines only.
- If impossible (e.g., defensive I/O branch), explain in `{{todoMdPath}}`.

### Execution
- Run tests only for affected paths or tags.
- Use clear **arrange / act / assert** pattern.
- Respect project test runner:
  - JS/TS example: `vitest run --changed` or `npm test -- -t "<name>"`

### Stop Rules
- Stop testing when:
  - All Diff Test Plan items pass twice consistently.
  - Per-diff coverage = 100%.
  - No unrelated failures remain.
- Log unrelated failures as *Known Out-of-Scope* in `{{todoMdPath}}`.

### Definition of Done
- [ ] Diff Test Plan exists in `{{todoMdPath}}`
- [ ] All new/affected tests pass twice locally
- [ ] Per-diff coverage = 100% (or justified gap noted)
- [ ] Only boundary mocks used, no I/O or sleeps
- [ ] Within runtime budget
- [ ] Short summary (3–5 lines) of what was tested and why

Then set first line to `Fully implemented: YES`.

**Mantra:** *Prove changed behavior with the minimum sufficient evidence — nothing more.*

---

## TODO.md Structure

```
{{todoTemplate}}
```
