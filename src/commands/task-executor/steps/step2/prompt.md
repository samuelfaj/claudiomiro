## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

## OBJECTIVE
Read the provided `{{claudiomiroFolder}}/AI_PROMPT.md` and **decompose it into a complete, lossless set of self-contained tasks** located under:

`{{claudiomiroFolder}}/TASK{number}/`

Each task must:
- Represent exactly one verifiable unit of work.
- Preserve the user's intent **without merging, skipping, or paraphrasing away detail**.
- **Inherit and propagate the rich context from AI_PROMPT.md** (environment, codebase, patterns).
- Be fully executable by an autonomous coding agent with no external clarification.

---

## 🔗 ALIGNMENT WITH STEP 1 (Context Inheritance)

The `AI_PROMPT.md` you're reading was created by step1 with a **context-first philosophy**.

**What step1 provides:**
- **📁 Environment & Codebase Context:** Tech stack, architecture, project structure, conventions
- **🧩 Related Code Context:** Concrete file references, code examples, patterns to follow
- **✅ Acceptance Criteria:** Explicit, testable requirements
- **⚙️ Implementation Guidance:** Layer structure, artifacts, constraints
- **5.1 Testing Guidance:** Minimal & relevant testing approach

**Your job (step0.2):**
You must **preserve and propagate** this rich context during decomposition. Each task should feel like it was written by someone who deeply understands the codebase, not someone who just read a feature request.

**Critical principle:**
> Context richness must INCREASE during decomposition, not decrease.

Each individual task should have MORE context than the original AI_PROMPT.md (because you'll include task-specific examples and references), while still maintaining the universal context that applies to all tasks.

---

## CORE PRINCIPLES

### 🚨 1. NO INFORMATION LOSS (Requirements + Context)
Every requirement, bullet, or implied behavior from `AI_PROMPT.md` must appear explicitly in **at least one BLUEPRINT.md**.

**Critical:** Every task must also preserve relevant context:
- **Environment context** (tech stack, architecture, patterns) must be propagated to ALL tasks
- **Related code context** (specific file references, examples) must be propagated to RELEVANT tasks
- **Constraints and conventions** must be consistently applied across all tasks

**Propagation rules:**
- Each user requirement = at least one corresponding task or subtask.
- Each task inherits the environmental context that makes it executable in isolation.
- If a requirement touches multiple areas, split it carefully into parallel or sequential units.
- Missing or merged requirements = **automatic failure**.
- Missing critical context = **automatic failure**.

You are not summarizing — you are **preserving structure AND context through decomposition**.

---

## Task Scope (Multi-Repository Projects)

When working with multi-repository projects (backend + frontend), every BLUEPRINT.md MUST include an `@scope` tag on the second line:

### Format
```markdown
@dependencies [TASK0, TASK1]
@scope backend
@difficulty medium

# BLUEPRINT: TASKX
...
```

### Valid Scopes

- **@scope backend** - Task modifies only backend repository code
  - API endpoints, database models, server logic
  - Backend tests, backend configuration

- **@scope frontend** - Task modifies only frontend repository code
  - UI components, frontend state, client logic
  - Frontend tests, frontend configuration

- **@scope integration** - Task requires both repositories OR verifies integration
  - API contract verification
  - End-to-end testing across both repos
  - Changes that require coordinated updates

### Scope Selection Guidelines

1. If a task ONLY touches backend files → `@scope backend`
2. If a task ONLY touches frontend files → `@scope frontend`
3. If a task touches BOTH or verifies their interaction → `@scope integration`
4. When in doubt, prefer `@scope integration`

**Note:** Missing @scope in multi-repo mode will cause task execution to fail.

---

## Task Difficulty (Model Selection)

Every BLUEPRINT.md MUST include a `@difficulty` tag to optimize AI model selection during task execution.

### Format
```markdown
@dependencies [TASK0, TASK1]
@scope backend
@difficulty medium
```

### Valid Difficulty Levels

- **@difficulty fast** - Simple task, straightforward implementation
  - Single file changes, <100 LOC
  - Well-defined patterns exist in codebase
  - No architectural decisions needed
  - Simple CRUD operations, config changes
  - Uses haiku model (cheapest, fastest)

- **@difficulty medium** - Moderate complexity (DEFAULT)
  - Multiple files, cross-module interaction
  - Some integration points
  - Following existing patterns with minor adaptations
  - Standard feature implementation
  - Uses sonnet model (balanced)

- **@difficulty hard** - Complex task, deep reasoning required
  - System-wide impact, multiple integration points
  - Architectural decisions needed
  - New patterns or significant refactoring
  - Complex business logic, edge cases
  - Significant uncertainty or unknowns
  - Uses opus model (most capable, expensive)

### Difficulty Selection Guidelines

1. **Start with complexity analysis from Phase B**
   - LOW complexity → `@difficulty fast`
   - MEDIUM complexity → `@difficulty medium`
   - HIGH complexity → `@difficulty hard`

2. **Consider these escalation factors:**
   - Multiple phases (>3) → escalate to medium or hard
   - Multiple artifacts (>5) → escalate to hard
   - Uncertainties present → escalate to hard
   - Integration across modules → at least medium

3. **When in doubt:**
   - For foundation/scaffold tasks (Layer 0) → `@difficulty medium`
   - For integration tasks (Layer Ω) → `@difficulty hard`
   - For parallel feature tasks → `@difficulty medium`
   - For simple config/setup → `@difficulty fast`

**Note:** The @difficulty tag directly impacts execution cost and speed. Use 'fast' when possible, 'hard' only when necessary.

---

## 🧠 DEEP REASONING & METHODOLOGY

### 1. Recursive Breakdown
- Identify all top-level goals from `AI_PROMPT.md`.
- For each goal, ask:
  > "Does this require reasoning, sequencing, or verification steps?"
   - If *yes*, expand into clear subtasks with their own reasoning context.
   - If *no*, keep it atomic — one task, one verification.

Tasks should reflect **logical cohesion**, not arbitrary granularity.

---

### 2. Layer Analysis (Parallelization)
Identify execution layers to allow maximum parallelism without breaking dependency order.

- **Layer 0:** Foundation — scaffolding, environment, initial config.
- **Layer 1+:** Parallelizable independent features or flows.
- **Layer N:** Integration, testing, or post-processing.
- **Final Ω:** Cohesion Validation — ensure the system is complete and correct as a whole.

Each task must clearly declare its layer and dependencies.

---

### 3. Automation-First Principle
Prefer **automated CLI or script-based actions** over manual edits.

✅ Automated actions
 e.g. `bunx prisma migrate dev`, `npm run build`, `bunx tsc --noEmit`

❌ Manual edits
 e.g. editing generated code, copy-pasting build files

If manual edits are unavoidable:
- Document **why** automation is unsafe or impossible.
- Make them the exception, not the rule.

This ensures reproducibility and consistent automation pipelines.

---

### 4. Independence Logic
Tasks are **independent** if:
- They modify distinct files, modules, or flows.
- Their outputs do not serve as inputs for one another.

Tasks are **dependent** if:
- One's output is required for another's input.
- One validates or extends another's behavior.

Always express dependencies explicitly.

---

### 5. Complexity Evaluation
Before splitting a goal, assess its intrinsic complexity:

- **Low:** Simple config, setup, or trivial feature → one task.
- **Medium:** One cohesive feature or API flow.
- **High:** Multi-flow system → decompose into coherent parallel tasks plus a final integration.

Granularity should scale with complexity — never too fragmented, never too broad.

---

### 6. Documentation Rules
Every `BLUEPRINT.md` must be self-contained and readable in isolation:
- Explain what, why, and how.
- Document assumptions, dependencies, acceptance criteria, and reasoning.
- Include review and validation checklists.
- **Propagate essential context from AI_PROMPT.md** so the task can be understood without reading other files.

Each task must make sense even if executed in parallel by an agent seeing the codebase for the first time.

**Context propagation strategy:**
- **Universal context** (tech stack, architecture, conventions) → Include in ALL tasks
- **Specific context** (related files, code examples) → Include only in RELEVANT tasks
- **Reference by location** (e.g., "Follow pattern in src/services/auth.ts:45-60") → Precise, not vague

---

### 7. Final Assembly Validation
Always create a **Final Ω Task** that:
- Depends on all others.
- Verifies all modules interact correctly.
- Ensures no requirement was forgotten.
- Confirms contracts, logs, tests, and flows align with system intent.

This is the **mandatory system-level validation** step.

---

## 🧠 MANDATORY PRE-DECOMPOSITION ANALYSIS

**CRITICAL:** You MUST complete this analysis BEFORE creating ANY BLUEPRINT.md files.

Create `{{claudiomiroFolder}}/DECOMPOSITION_ANALYSIS.json` to document your reasoning in JSON format.

This file captures your thought process and ensures decomposition is deliberate, not arbitrary.

**IMPORTANT:** The output MUST be valid JSON that can be parsed programmatically. Follow the JSON schema structure exactly.

### JSON Structure Overview

The DECOMPOSITION_ANALYSIS.json file MUST contain the following top-level keys:
```json
{
  "phaseA": { /* Requirements Extraction */ },
  "phaseB": { /* Complexity Analysis */ },
  "phaseC": { /* Dependency Analysis */ },
  "phaseD": { /* Decomposition Strategy */ },
  "phaseE": { /* Self-Critique */ },
  "phaseF": { /* Tree of Thought */ },
  "preBlueprintAnalysis": { /* Per-task analysis */ }
}
```

Each phase is detailed below with its expected structure.

---

### PHASE A: Requirements Extraction

From `AI_PROMPT.md`, extract ALL requirements in JSON format:

```json
{
  "phaseA": {
    "explicitRequirements": [
      {
        "id": "R1",
        "quote": "[verbatim text from AI_PROMPT.md]",
        "section": "§ Acceptance Criteria",
        "line": 45,
        "intent": "[What this requirement means]"
      },
      {
        "id": "R2",
        "quote": "[verbatim text]",
        "section": "§ Acceptance Criteria",
        "line": 47,
        "intent": "[True intent]"
      },
      {
        "id": "R3",
        "quote": "[verbatim text]",
        "section": "§ Implementation Guidance",
        "line": 62,
        "intent": "[Intent]"
      }
    ],
    "implicitRequirements": {
      "testing": {
        "required": true,
        "evidence": "[YES/NO + quote from AI_PROMPT.md]"
      },
      "documentation": {
        "required": false,
        "evidence": "[YES/NO + quote]"
      },
      "integration": {
        "required": true,
        "evidence": "[YES/NO + quote]"
      },
      "errorHandling": {
        "required": true,
        "evidence": "[YES/NO + quote]"
      },
      "edgeCases": {
        "required": true,
        "evidence": "[YES/NO + quote]"
      }
    },
    "totalRequirements": {
      "explicit": 3,
      "implicit": 4,
      "total": 7
    }
  }
}
```

**Checkpoint:** Every bullet in AI_PROMPT.md must appear in explicitRequirements array.

---

### PHASE B: Complexity Analysis

For EACH requirement, evaluate complexity:

```markdown
## Phase B: Complexity Analysis

| Req ID | Complexity | Reasoning | Evidence |
|--------|-----------|-----------|----------|
| R1 | LOW | Single file, <100 LOC, clear pattern exists | AI_PROMPT.md:§Environment shows existing pattern |
| R2 | MEDIUM | Multiple files, some integration needed | Cross-references 3 modules |
| R3 | HIGH | System-wide impact, many integration points | Requires changes to 5+ files |

### Complexity Scale:
- **LOW:** Single file, <100 LOC, well-defined pattern exists in codebase
- **MEDIUM:** Multiple files, cross-module interaction, some unknowns
- **HIGH:** System-wide impact, multiple integration points, significant uncertainty
```

---

### PHASE C: Dependency Analysis

For EACH requirement, identify dependencies:

```markdown
## Phase C: Dependency Analysis

### Dependency Matrix

| Req ID | Depends On | Why? | Can Parallelize? |
|--------|-----------|------|------------------|
| R1 | None (Layer 0) | Foundation setup | N/A |
| R2 | R1 | Needs R1's database schema | NO - sequential |
| R3 | R1 | Needs R1's types | NO - sequential |
| R4 | R1 | Independent feature | YES - parallel with R2, R3 |
| R5 | R2, R3 | Integration of R2 and R3 | NO - after both |
| R_Ω | All | Final validation | NO - depends on everything |

### Dependency Graph (Visual)

```
Layer 0: R1 (foundation)
         |
         v
Layer 1: R2  R3  R4 (parallel)
         |   |
         v   v
Layer 2: R5 (integration R2+R3)
         |
         v
Layer Ω: R_Ω (final validation)
```

### Maximum Parallelism Identified

- Layer 0: 1 task (foundation)
- Layer 1: 3 tasks (parallel)
- Layer 2: 1 task (integration)
- Layer Ω: 1 task (validation)
- **Total layers:** 4
```

---

### PHASE D: Decomposition Strategy

For EACH requirement, decide task granularity:

```markdown
## Phase D: Decomposition Strategy

### R1: [Requirement Description]
- **Keep atomic?** YES/NO
- **Reasoning:** [Why keep together OR why split]
- **Proposed tasks:** TASK0 OR [TASK0, TASK1]
- **Evidence:** [Quote from AI_PROMPT.md supporting this decision]

### R2: [Requirement Description]
- **Keep atomic?** YES/NO
- **Reasoning:** [Reasoning]
- **Proposed tasks:** [Task assignments]
- **Evidence:** [Evidence]

### Summary of Proposed Tasks

| Task | Covers Requirements | Layer | Dependencies |
|------|---------------------|-------|--------------|
| TASK0 | R1 | 0 | None |
| TASK1 | R2 | 1 | TASK0 |
| TASK2 | R3 | 1 | TASK0 |
| TASK3 | R4 | 1 | TASK0 |
| TASK4 | R5 | 2 | TASK1, TASK2 |
| TASKΩ | R_Ω | Ω | All |

**Total Tasks:** [N]
```

---

### PHASE E: Self-Critique

Before generating BLUEPRINTs, critique your decomposition:

```markdown
## Phase E: Self-Critique

### Quality Gates

- [ ] Every requirement from Phase A has at least one task
- [ ] No requirement is split unnecessarily (over-fragmentation check)
- [ ] No requirement is merged with unrelated concerns (under-decomposition check)
- [ ] Dependencies are minimal (no artificial sequencing)
- [ ] Parallelism is maximized (independent tasks in same layer)
- [ ] Final Ω validation task exists
- [ ] All tasks have clear acceptance criteria traceable to AI_PROMPT.md

### Red Flags (Revise if TRUE)

- [ ] Task with vague identity ("implement feature")
- [ ] Task combining unrelated requirements
- [ ] Missing integration/validation task
- [ ] Dependency cycle detected
- [ ] Task without clear success criteria
- [ ] Over-fragmentation (tasks with <50 LOC each)
- [ ] Under-decomposition (tasks with >500 LOC each)

### Revisions Made

[Document any changes made during self-critique]

### Final Decision

**Proceed with decomposition:** YES/NO

If NO → Iterate on Phases A-D until quality gates pass.
```

---

**CRITICAL:** Complete all 5 phases in `DECOMPOSITION_ANALYSIS.md` BEFORE creating any BLUEPRINT.md files.

This ensures deliberate, traceable, and high-quality decomposition.

---

## 🎯 PER-TASK REASONING REQUIREMENT

**CRITICAL:** For EACH task, you MUST document reasoning in `DECOMPOSITION_ANALYSIS.md` BEFORE creating its BLUEPRINT.md.

### Pre-BLUEPRINT Analysis (Required for Each Task)

Before generating `TASKX/BLUEPRINT.md`, add to `DECOMPOSITION_ANALYSIS.md`:

```markdown
## Pre-BLUEPRINT Analysis: TASKX

### 1. Why This Task Exists
- **Origin:** [Which requirement(s) from Phase A does this satisfy?]
- **Necessity:** [Why can't this be merged with another task?]
- **Evidence:** [Quote from AI_PROMPT.md justifying this task]

### 2. Scope Justification
- **IS (Explicit Boundaries):**
  - [Concrete item 1 this task WILL do]
  - [Concrete item 2 this task WILL do]
  - [File paths this task WILL touch]

- **IS NOT (Explicit Exclusions):**
  - [What this task will NOT do + which task handles it]
  - [Out of scope items with reasoning]

- **Scope Size Check:**
  - Estimated LOC: [LOW (<100) | MEDIUM (100-300) | HIGH (>300)]
  - If HIGH → Consider splitting. Justify if keeping as one task.

### 3. Dependency Reasoning
- **Depends on:** [TASK0, TASK1] or [None - Layer 0]
- **Why these dependencies?**
  - TASK0: [What TASK0 provides that this task needs]
  - TASK1: [What TASK1 provides that this task needs]
- **Can parallelize with:** [TASK2, TASK3] - [Why these are independent]
- **Blocks:** [TASK4, TASK5] - [What this task provides to them]

### 4. Success Criteria Traceability
| Criterion | Source | Testable? | Command | Manual Check |
|-----------|--------|-----------|---------|--------------|
| [Criterion 1] | AI_PROMPT.md:§Acceptance Criteria:L45 | AUTO | `grep "pattern" file.ext` | - |
| [Criterion 2] | AI_PROMPT.md:§Acceptance Criteria:L47 | MANUAL | - | Review Google Cloud Logs for errors |
| [Criterion 3] | AI_PROMPT.md:§Acceptance Criteria:L50 | AUTO | `test -f path/to/file.ext` | - |

**Column Definitions:**

**Testable? column values:**
- `AUTO` - Can be verified with automated shell command
- `MANUAL` - Requires human verification (logs in web console, database GUI, etc.)
- `BOTH` - Has both automated command AND manual verification step

**Command column (for AUTO/BOTH):**
- MUST contain EXECUTABLE shell commands
- DO NOT use human-readable descriptions

**Manual Check column (for MANUAL/BOTH):**
- Describe what the human reviewer should verify
- Be specific about where to look and what to check
- Can reference external systems (Google Cloud Console, database GUI, etc.)

---

**✅ VALID Examples:**

```markdown
| Check syntax | AI_PROMPT:L45 | AUTO | `php -l file.php` | - |
| No duplicates | AI_PROMPT:L47 | AUTO | `mysql -e "SELECT userId, COUNT(*) FROM table GROUP BY userId HAVING COUNT(*)>1"` | - |
| Logs show success | AI_PROMPT:L50 | MANUAL | - | Review Google Cloud Logs: search for "success" in project logs |
| Email sent correctly | AI_PROMPT:L52 | BOTH | `grep "Email sent" logs/app.log` | Check Postmark dashboard: verify email in sent items |
```

**❌ INVALID Examples:**

```markdown
| Check logs | AI_PROMPT:L45 | YES | Review logs for errors | - |
# ❌ "Review logs" is not a shell command - should be in Manual Check column

| Database check | AI_PROMPT:L47 | AUTO | Database query: SELECT ... | - |
# ❌ "Database query:" is not executable - use `mysql -e "..."`

| File exists | AI_PROMPT:L50 | MANUAL | Check that file exists | - |
# ❌ Should be AUTO with `test -f path/to/file.ext`
```

---

**Guidelines:**

**For AUTO testable criteria:**
- Use actual shell commands (grep, test, find, mysql, psql, etc.)
- Command must be executable and return exit code 0 on success
- Command should produce meaningful output for verification
- Examples: `grep "pattern" file`, `test -f path`, `npm test`, `php -l file.php`

**For MANUAL testable criteria:**
- Describe exactly what to verify and where
- Include specific search terms, filters, or query parameters
- Reference specific dashboards, consoles, or UIs
- Examples: "Review Google Cloud Logs: search for 'duplicate payment' in auto_pay logs"

**For BOTH testable criteria:**
- Provide automated command for quick verification
- Add manual step for thorough human review
- Useful when command checks partial aspect but human review needed for full verification

**Validation:** Every criterion MUST trace back to AI_PROMPT.md

### 5. Confidence & Risk Assessment
| Aspect | Confidence | Risk | Mitigation |
|--------|------------|------|------------|
| Requirements clarity | HIGH/MEDIUM/LOW | [Risk if LOW] | [How to handle] |
| Implementation path | HIGH/MEDIUM/LOW | [Risk if LOW] | [How to handle] |
| Dependencies exist | HIGH/MEDIUM/LOW | [Risk if LOW] | [How to handle] |
| Testing feasibility | HIGH/MEDIUM/LOW | [Risk if LOW] | [How to handle] |

**Decision:**
- If ANY confidence is LOW on critical aspect → Mark task as NEEDS_CLARIFICATION
- If ALL confidence is MEDIUM or HIGH → Proceed with BLUEPRINT generation

### 6. Guardrails Identification
Identify prohibitions for this specific task (inherited from AI_PROMPT.md + task-specific):

| Category | Guardrail | Reason | Source |
|----------|-----------|--------|--------|
| Scope | DO NOT touch [file/module] | [Why excluded] | AI_PROMPT.md:§Guardrails or task-specific |
| Architecture | DO NOT use [pattern] | [Why forbidden] | AI_PROMPT.md:§Guardrails or codebase convention |
| Quality | DO NOT [over-engineering trap] | [Why to avoid] | Task scope analysis |
| Security | NEVER [violation] | [Consequence] | AI_PROMPT.md:§Guardrails |

**Guardrail Validation:**
- [ ] All scope guardrails from AI_PROMPT.md propagated
- [ ] Task-specific guardrails identified (what this task must NOT do)
- [ ] Each guardrail has a clear reason (not just "don't")
- [ ] Security guardrails are explicit (NEVER, not just "avoid")
```

---

### Workflow Enforcement

**ONLY AFTER completing the Pre-BLUEPRINT Analysis for TASKX:**
1. ✅ Verify all 6 sections are completed
2. ✅ Verify no LOW confidence on critical aspects
3. ✅ Verify scope is reasonable (not too large, not too fragmented)
4. ✅ Verify dependencies are correctly identified
5. **THEN** → Generate `TASKX/BLUEPRINT.md`

**Anti-Pattern Detection:**
- ❌ BLUEPRINT created without Pre-BLUEPRINT Analysis → INVALID
- ❌ Vague scope ("implement feature") → REJECT, be specific
- ❌ Missing dependency reasoning → REJECT, explain why
- ❌ Criteria not traceable to AI_PROMPT.md → REJECT, add source
- ❌ LOW confidence ignored → REJECT, address risk first

---

## INJECTED CONTEXT

### Legacy System Context (Priority 0)
{{legacySystemContext}}

### Optimized Project Context (Priorities 1-3)
{{optimizedContext}}

---

## ⚙️ OUTPUT REQUIREMENTS

### `{{claudiomiroFolder}}/TASKX/BLUEPRINT.md`

```markdown
<!-- BLUEPRINT: Read-only after creation -->
@dependencies [Tasks]  // Task name MUST BE COMPLETE AND FOLLOW THE PATTERN "TASK{number}"
@scope [backend|frontend|integration]  // Only required for multi-repo projects
@difficulty [fast|medium|hard]  // Task complexity for model selection

# BLUEPRINT: TASKX

## 1. IDENTITY

### This Task IS:
- [Explicit scope item 1 - what this task WILL accomplish]
- [Explicit scope item 2 - specific functionality being implemented]
- [Explicit scope item 3 - files/modules being created or modified]

### This Task IS NOT:
- [Out of scope item 1 with reason why it's excluded]
- [Out of scope item 2 - clearly state what belongs to other tasks]

### Anti-Hallucination Anchors:
- [Condition] → [Action if unmet]
- Example: "If pattern not found in reference file → BLOCKED"
- Example: "If dependency function doesn't exist → Create issue, don't invent"

### 🚫 Guardrails (Prohibitions):
Explicit constraints inherited from AI_PROMPT.md + task-specific prohibitions.

**Scope Guardrails:**
- [ ] DO NOT [specific file/module this task must NOT touch + reason]
- [ ] DO NOT [feature that belongs to another task]

**Architecture Guardrails:**
- [ ] DO NOT [pattern to avoid + what to use instead]
- [ ] DO NOT [breaking change + why forbidden]

**Quality Guardrails:**
- [ ] DO NOT [over-engineering trap to avoid]
- [ ] DO NOT [unnecessary abstraction]

**Security Guardrails:**
- [ ] NEVER [security violation + consequence]
- [ ] DO NOT [unsafe practice + safe alternative]

## 2. CONTEXT CHAIN

### Priority 0 - LEGACY REFERENCE (If Available):
[Legacy system paths and files if configured, otherwise "None - no legacy systems configured"]

### Priority 1 - READ FIRST (Required):
- `../AI_PROMPT.md` - Full tech stack, architecture, coding conventions
- [Critical context files with line numbers specific to this task]

### Priority 2 - READ BEFORE CODING:
- [Pattern reference files with line:range]
- [Related implementation examples]

### Priority 3 - REFERENCE IF NEEDED:
- [Supporting files for edge cases]
- [Documentation or specs]

### Inherited From Dependencies:
- [Prior task contributions - what TASK0, TASK1 etc. provide]
- "None" if this is Layer 0 / no dependencies

## 3. EXECUTION CONTRACT

### 3.1 Pre-Conditions (VERIFY BEFORE ANY CODE):
| Check | Command | Expected |
|-------|---------|----------|
| Dependency exists | `test -f path/to/file` | File exists |
| Module available | `node -e "require('module')"` | No error |
| Tests pass | `npm test -- --testPathPattern="affected"` | Exit 0 |

**HARD STOP:** If ANY check fails → status: blocked

### 3.2 Success Criteria (VERIFY AFTER COMPLETE):

**MANDATORY FORMAT - 5 COLUMNS:**
| Criterion | Source | Testable? | Command | Manual Check |
|-----------|--------|-----------|---------|--------------|
| Tests pass | AI_PROMPT:§AC:L10 | AUTO | `npm test --testPathPattern="module" --silent` | - |
| No lint errors | AI_PROMPT:§AC:L12 | AUTO | `eslint path/to/files --quiet` | - |
| Feature works | AI_PROMPT:§AC:L15 | BOTH | `curl -s http://localhost/api/endpoint` | Verify response contains expected data |

**COLUMN RULES:**
- **Testable?** MUST be: `AUTO`, `MANUAL`, or `BOTH` (exactly these values)
- **Command** MUST be executable shell command (not description) or `-` for MANUAL
- **Manual Check** describes human verification steps or `-` for AUTO

### 3.3 Output Artifacts:
| Artifact | Type | Path | Verification |
|----------|------|------|--------------|
| [File name] | CREATE/MODIFY | [Full path] | `test -f path` |

## 4. IMPLEMENTATION STRATEGY

**MANDATORY FORMAT:**
- Use EXACTLY `### Phase N: Name` format (### + space + Phase + space + number + colon + space + name)
- Steps MUST be numbered (1., 2., 3.) not bullets (-)
- Each phase MUST end with `**Gate:** [criteria]`

### Phase 1: Preparation
1. Read required context files
2. Verify pre-conditions
3. Set up any required scaffolding

**Gate:** All pre-conditions verified, context understood

### Phase 2: Core Implementation
1. Detailed implementation step 1
2. Detailed implementation step 2
3. Follow pattern from file:line-range

**Gate:** Core functionality implemented, compiles without errors

### Phase 3: Testing
1. Write/update unit tests
2. Run affected tests only
3. Fix any failures

**Gate:** All affected tests pass

### Phase 4: Integration
1. Verify integration points
2. Check imports/exports work
3. Validate with dependent modules

**Gate:** Integration verified, no breaking changes

### Phase 5: Validation
1. Final success criteria check
2. Verify output artifacts exist
3. Mark task complete

## 5. UNCERTAINTY LOG

| ID | Topic | Assumption | Confidence | Evidence |
|----|-------|------------|------------|----------|
| U1 | [Topic] | [What we assume] | LOW/MEDIUM/HIGH | [Why we think this] |

### Stop Rule:
LOW confidence on critical decision → BLOCKED (do not proceed with guesses)

## 6. INTEGRATION IMPACT

### Files Modified:
| File | Modification | Who Imports | Impact |
|------|--------------|-------------|--------|
| [path] | [What changes] | [Importers] | [Effect] |

### Files Created:
| File | Imports From | Exports |
|------|--------------|---------|
| [path] | [Dependencies] | [Public API] |

### Breaking Changes:
[None or detailed description of what breaks and migration path]
```

🚨 CRITICAL BLUEPRINT RULES:
- First line must be `<!-- BLUEPRINT: Read-only after creation -->`
- Second line must be `@dependencies [...]`
- Third line is `@scope [...]` for multi-repo projects only
- `@difficulty [fast|medium|hard]` must follow @scope (or @dependencies if no @scope) - REQUIRED for model selection
- All 6 sections (IDENTITY, CONTEXT CHAIN, EXECUTION CONTRACT, IMPLEMENTATION STRATEGY, UNCERTAINTY LOG, INTEGRATION IMPACT) are REQUIRED
- IDENTITY section MUST include: IS, IS NOT, Anti-Hallucination Anchors, AND 🚫 Guardrails
- Guardrails MUST have at least one item per category (Scope, Architecture, Quality, Security)
- Context Chain must include legacy reference section (even if "None")
- Pre-conditions table must have at least one verifiable check
- Anti-hallucination anchors prevent the agent from inventing code
- Guardrails prevent scope creep, over-engineering, and security violations

---

🧩 EXAMPLES (Showing BLUEPRINT Pattern)

**Example 1: CRUD Flow - BLUEPRINT Structure**

AI_PROMPT.md contains:
```
📁 Environment & Codebase Context:
- Node.js Express API with TypeScript 5.x
- PostgreSQL with Prisma ORM
- Testing: Jest with supertest
- Structure: src/routes, src/services, src/models
- Convention: camelCase functions, async/await throughout
- Error handling: Custom AppError class from src/errors/AppError.ts

🧩 Related Code Context:
- Follow CRUD pattern from src/routes/users.ts:20-80
- Use validation approach from src/validators/userValidator.ts
- Service layer pattern: src/services/userService.ts
```

Decomposition into BLUEPRINTs:

**TASK0/BLUEPRINT.md** – Setup DB schema + base route structure (Layer 0)
```markdown
<!-- BLUEPRINT: Read-only after creation -->
@dependencies []
@difficulty medium

# BLUEPRINT: TASK0

## 1. IDENTITY
### This Task IS:
- Creating Prisma schema for products table
- Setting up base route file src/routes/products.ts
- Establishing service layer pattern for products

### This Task IS NOT:
- Implementing CRUD operations (TASK1-4)
- Integration testing (TASK5)

### Anti-Hallucination Anchors:
- If Prisma schema pattern differs from users model → Follow users model exactly
- If route structure unclear → Reference users.ts:1-15 for setup pattern

### 🚫 Guardrails:
**Scope:**
- [ ] DO NOT modify existing User model (only create Products)
- [ ] DO NOT implement CRUD endpoints (belongs to TASK1-4)

**Architecture:**
- [ ] DO NOT create new patterns (follow users.ts exactly)
- [ ] DO NOT add custom validators yet (belongs to TASK1)

**Quality:**
- [ ] DO NOT add optional fields "for future use"
- [ ] DO NOT create utility functions (use existing utils/)

**Security:**
- [ ] NEVER commit with hardcoded database credentials
```

**TASK1/BLUEPRINT.md** – Create endpoint (Layer 1, parallel)
```markdown
<!-- BLUEPRINT: Read-only after creation -->
@dependencies [TASK0]
@difficulty fast

# BLUEPRINT: TASK1

## 1. IDENTITY
### This Task IS:
- Implementing POST /api/products endpoint
- Adding input validation with productValidator
- Following create pattern from users.ts:20-35

### 🚫 Guardrails:
**Scope:**
- [ ] DO NOT implement GET/PUT/DELETE (belongs to TASK2-4)
- [ ] DO NOT modify TASK0's schema

**Security:**
- [ ] NEVER skip input validation
- [ ] DO NOT expose internal error details to client
```

---

🚫 ANTI-PATTERNS

**Decomposition Anti-patterns:**
❌ Splitting trivial atomic operations.
❌ Forgetting the final validation layer.
❌ Treating parallel tasks as sequential without cause.
❌ Merging distinct requirements into a single task.

**BLUEPRINT Anti-patterns:**
❌ **Missing sections:** Not including all 6 required sections
❌ **Vague identity:** "Implement the feature" instead of explicit scope
❌ **No anti-hallucination anchors:** Letting agent invent code without guards
❌ **Missing guardrails:** No explicit prohibitions leads to scope creep
❌ **Guardrails without reasons:** "DO NOT X" without explaining why
❌ **Empty pre-conditions:** Not verifying dependencies before coding
❌ **Copy-paste context:** Duplicating AI_PROMPT.md instead of referencing
❌ **Missing legacy reference:** Not including Priority 0 section

**Good Practices:**
✅ Decompose only when it increases clarity, autonomy, or testability.
✅ Each task should represent a single verifiable truth from the user's request.
✅ **Every BLUEPRINT is self-contained:** Agent reads AI_PROMPT.md + BLUEPRINT.md to have full context.
✅ **Anti-hallucination anchors prevent guessing:** Agent knows when to stop vs. proceed.
✅ **Guardrails prevent scope creep:** Agent knows what NOT to do with explicit reasons.
✅ **Pre-conditions are verifiable:** Commands that return pass/fail.
✅ **Legacy reference is explicit:** Agent knows if legacy systems exist.

---

## 📚 FEW-SHOT EXAMPLES: DECOMPOSITION ANALYSIS

### Example 1: ✅ GOOD Decomposition (Complete Reasoning)

**AI_PROMPT.md Request:**
```
Add user authentication with JWT tokens and password reset functionality.
```

**DECOMPOSITION_ANALYSIS.md (Excerpt):**
```markdown
## Phase A: Requirements Extraction

| Req ID | Exact Quote | Section | Intent |
|--------|-------------|---------|--------|
| R1 | "user authentication with JWT tokens" | §1:L3 | Implement JWT-based auth flow |
| R2 | "password reset functionality" | §1:L3 | Email-based password recovery |

## Phase D: Decomposition Strategy

### R1: JWT Authentication
- **Keep atomic?** NO - requires multiple components
- **Reasoning:** Auth flow needs: schema → service → routes → middleware. Each is testable independently.
- **Proposed tasks:** TASK0 (schema), TASK1 (auth service), TASK2 (routes), TASK3 (middleware)
- **Evidence:** AI_PROMPT.md:§Environment "Prisma ORM" → needs schema; "Express" → needs routes

### R2: Password Reset
- **Keep atomic?** NO - separate concern from auth
- **Reasoning:** Password reset is independent feature, can be built after basic auth
- **Proposed tasks:** TASK4 (email service), TASK5 (reset flow)
- **Evidence:** AI_PROMPT.md doesn't specify email provider → needs investigation

## Phase F: Tree of Thought

### F.1 Decomposition Alternatives

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A** | 6 tasks (schema→service→routes→middleware→email→reset) | Maximum parallelism, testable | More overhead |
| **B** | 3 tasks (auth-all→reset-all→integration) | Less overhead | Larger tasks, less parallel |
| **C** | 2 tasks (auth+reset combined, integration) | Minimal tasks | Too large, hard to test |

**Selected:** A
**Reasoning:** 6 tasks allows TASK1-3 to run in parallel after TASK0. TASK4-5 can run parallel to auth tasks.
**Evidence:** AI_PROMPT.md:§Environment "Jest tests" suggests testability is valued.

### F.3 Confidence Score
| Aspect | Score | Justification |
|--------|-------|---------------|
| Requirement coverage | 5 | Every requirement mapped to tasks |
| Task independence | 4 | TASK1-3 share TASK0 dependency only |
| Dependency correctness | 5 | Clear Layer 0→1→2 progression |

**Overall Confidence:** 4.7 / 5 → ✅ Proceed
```

**Why this is GOOD:**
- ✅ Every requirement traced with exact quotes
- ✅ Decomposition decisions have explicit reasoning
- ✅ Alternatives explored with pros/cons
- ✅ Evidence from AI_PROMPT.md supports choices
- ✅ Confidence score justifies proceeding

---

### Example 2: ❌ BAD Decomposition (Superficial Analysis)

**AI_PROMPT.md Request:**
```
Add user authentication with JWT tokens and password reset functionality.
```

**DECOMPOSITION_ANALYSIS.md (Superficial - REJECT):**
```markdown
## Phase A: Requirements

- R1: Add authentication
- R2: Add password reset

## Phase D: Strategy

TASK0: Implement authentication
TASK1: Implement password reset
TASK2: Test everything

## Phase F: Confidence

Looks good. Proceeding.
```

**Why this is BAD:**
- ❌ No exact quotes from AI_PROMPT.md
- ❌ No reasoning for task boundaries
- ❌ No alternatives considered
- ❌ No evidence supporting decisions
- ❌ Vague confidence without scores
- ❌ Tasks too large ("implement authentication" is not atomic)

**This decomposition would be REJECTED.**

---

### Example 3: ⚠️ EDGE CASE (Deceptively Simple Request)

**AI_PROMPT.md Request:**
```
Add a "last seen" timestamp to user profiles.
```

**Initial Reaction:** "This is simple - just one task!"

**DECOMPOSITION_ANALYSIS.md (Correct Analysis):**
```markdown
## Phase A: Requirements Extraction

| Req ID | Exact Quote | Intent | Hidden Complexity |
|--------|-------------|--------|-------------------|
| R1 | "last seen timestamp" | Track user activity | When to update? Every request? |
| R2 | "user profiles" | Display timestamp | Format? Timezone handling? |

### Implicit Requirements (Investigation Results)
- [ ] Performance: Updating timestamp on every request → database load
- [ ] Privacy: AI_PROMPT.md:§Acceptance Criteria:L12 "GDPR compliance" → need consent?
- [ ] UX: Real-time vs cached display?

## Phase B: Complexity Analysis

| Req ID | Complexity | Reasoning |
|--------|-----------|-----------|
| R1 | MEDIUM | Not just schema change - needs middleware hook |
| R2 | MEDIUM | Timezone conversion, formatting, privacy display |

**Initial assessment was WRONG.** This is NOT a single-task feature.

## Phase D: Decomposition Strategy

### R1: Last Seen Tracking
- **Keep atomic?** NO - discovered hidden complexity
- **Proposed tasks:**
  - TASK0: Schema migration (add lastSeenAt field)
  - TASK1: Middleware to update timestamp (with rate limiting)
  - TASK2: Profile API to expose timestamp (with privacy controls)

### Evidence of complexity:
- AI_PROMPT.md:§Environment mentions "high traffic" → rate limiting needed
- AI_PROMPT.md:§Acceptance Criteria:L12 "GDPR compliance" → privacy controls

## Phase F: Tree of Thought

### F.2 Self-Consistency Check

**Path 1 (Requirements-First):** 1 task (surface reading)
**Path 2 (Architecture-First):** 3 tasks (schema→middleware→API)
**Path 3 (Risk-First):** 3 tasks (identified performance + privacy risks)

**Divergence detected!** Path 1 differs from Path 2 and 3.

**Resolution:** Paths 2 and 3 agree. Path 1 was superficial.
**Decision:** 3 tasks is correct. Surface simplicity was deceptive.
```

**Why this EDGE CASE matters:**
- ⚠️ Simple-sounding requests often hide complexity
- ⚠️ "Just add a field" ignores middleware, privacy, performance
- ⚠️ Self-consistency check caught the superficial Path 1
- ⚠️ Implicit requirements revealed true scope

**Lesson:** Always investigate beyond the surface. Use the 3-path check to catch shallow analysis.

---

## 🌳 TREE OF THOUGHT: FINAL VALIDATION

**CRITICAL:** Before generating BLUEPRINTs, you MUST explore alternative decomposition strategies and validate your choices.

Add this section to `DECOMPOSITION_ANALYSIS.md` AFTER Phase E:

```markdown
## Phase F: Tree of Thought - Alternative Exploration

### F.1 Decomposition Alternatives

For EACH major decomposition decision, explore at least 2 alternatives:

#### Decision 1: [Task Grouping/Splitting]

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A (Current)** | [What you chose] | [Benefits] | [Drawbacks] |
| **B (Alternative)** | [Different grouping] | [Benefits] | [Drawbacks] |
| **C (Alternative)** | [Another option] | [Benefits] | [Drawbacks] |

**Selected:** [A/B/C]
**Reasoning:** [Why this approach is superior for THIS project]
**Evidence:** [Quote from AI_PROMPT.md supporting this choice]

#### Decision 2: [Layer Assignment]

| Approach | Layer Structure | Parallelism | Risk |
|----------|-----------------|-------------|------|
| **A (Current)** | [Your layers] | [X tasks parallel] | [Risk level] |
| **B (Alternative)** | [Different layers] | [Y tasks parallel] | [Risk level] |

**Selected:** [A/B]
**Reasoning:** [Why this layer structure is optimal]

#### Decision 3: [Dependency Strategy]

| Approach | Dependencies | Coupling | Flexibility |
|----------|--------------|----------|-------------|
| **A (Current)** | [Deps list] | [HIGH/LOW] | [HIGH/LOW] |
| **B (Alternative)** | [Alt deps] | [HIGH/LOW] | [HIGH/LOW] |

**Selected:** [A/B]
**Reasoning:** [Why these dependencies are correct]

---

### F.2 Self-Consistency Check

**Question:** Would a different analysis path lead to the same decomposition?

#### Path 1: Requirements-First Analysis
Starting from requirements, I would group tasks as:
[List task grouping from requirements perspective]

#### Path 2: Architecture-First Analysis
Starting from architecture, I would group tasks as:
[List task grouping from architecture perspective]

#### Path 3: Risk-First Analysis
Starting from highest risks, I would group tasks as:
[List task grouping from risk mitigation perspective]

**Convergence Check:**
| Path | Same Task Count? | Same Dependencies? | Same Layers? |
|------|------------------|-------------------|--------------|
| Requirements-First | YES/NO | YES/NO | YES/NO |
| Architecture-First | YES/NO | YES/NO | YES/NO |
| Risk-First | YES/NO | YES/NO | YES/NO |

**If divergence detected:**
- [ ] Analyze WHY paths diverge
- [ ] Determine which path best serves AI_PROMPT.md intent
- [ ] Document reasoning for chosen path
- [ ] Revise decomposition if necessary

---

### F.3 Decomposition Confidence Score

Rate your confidence in the final decomposition:

| Aspect | Score (1-5) | Justification |
|--------|-------------|---------------|
| Requirement coverage | [1-5] | [Why this score] |
| Task independence | [1-5] | [Why this score] |
| Dependency correctness | [1-5] | [Why this score] |
| Parallelism optimization | [1-5] | [Why this score] |
| Scope sizing | [1-5] | [Why this score] |

**Overall Confidence:** [Average] / 5

**Decision:**
- Score ≥ 4.0 → ✅ Proceed with BLUEPRINT generation
- Score 3.0-3.9 → ⚠️ Review weak areas before proceeding
- Score < 3.0 → ❌ STOP - Revise decomposition strategy
```

---

### Tree of Thought Enforcement

**ONLY AFTER completing Phase F:**
1. ✅ At least 2 alternatives explored for each major decision
2. ✅ Self-consistency check completed with 3 paths
3. ✅ Confidence score ≥ 4.0 (or weak areas addressed)
4. ✅ Divergences analyzed and resolved
5. **THEN** → Proceed to BLUEPRINT generation

**Red Flags (STOP if any are true):**
- ❌ Only one approach considered (no alternatives)
- ❌ Self-consistency paths not analyzed
- ❌ Confidence score < 3.0
- ❌ Unresolved divergence between analysis paths
- ❌ "Selected" without "Reasoning" or "Evidence"

---

## FINAL REQUIREMENT

Before finishing, perform these validations:

### ✅ Completeness Checklist
- [ ] Every requirement from AI_PROMPT.md is covered by at least one BLUEPRINT
- [ ] No requirements were merged, summarized, or skipped
- [ ] Final Ω validation task exists and depends on all other tasks

### ✅ BLUEPRINT Structure Checklist
- [ ] All BLUEPRINTs have read-only header comment
- [ ] All BLUEPRINTs have @dependencies declaration
- [ ] All BLUEPRINTs contain all 6 required sections
- [ ] IDENTITY section has IS, IS NOT, and Anti-Hallucination Anchors
- [ ] CONTEXT CHAIN includes Priority 0 (legacy) through Priority 3
- [ ] EXECUTION CONTRACT has pre-conditions, success criteria, and artifacts
- [ ] IMPLEMENTATION STRATEGY has 5 phases with gates
- [ ] UNCERTAINTY LOG has stop rule
- [ ] INTEGRATION IMPACT lists files modified and created

### ✅ Context Reference Checklist
- [ ] All tasks reference AI_PROMPT.md in Priority 1
- [ ] Legacy system context appears in Priority 0 (when configured)
- [ ] Task-specific context (files to touch, patterns to follow) is included
- [ ] References are precise (file:line-range), not vague
- [ ] No duplication of universal context from AI_PROMPT.md

### ✅ Structure Validation
- [ ] Dependencies are correctly declared using TASK{number} format
- [ ] Layer assignments allow maximum parallelism
- [ ] Pre-conditions are verifiable with actual commands

### ✅ FORMAT SELF-VALIDATION (MANDATORY)

Before saving EACH BLUEPRINT.md, verify these format rules:

**§3.2 Success Criteria:**
- [ ] Table has EXACTLY 5 columns: Criterion | Source | Testable? | Command | Manual Check
- [ ] "Testable?" column contains ONLY: `AUTO`, `MANUAL`, or `BOTH`
- [ ] "Command" column has REAL shell commands (not descriptions like "Check logs")
- [ ] "Command" column uses `-` for MANUAL-only criteria
- [ ] "Manual Check" column uses `-` for AUTO-only criteria

**§4 Implementation Strategy:**
- [ ] Each phase uses format: `### Phase N: Name` (with ### prefix)
- [ ] All steps are NUMBERED (1., 2., 3.) not bullets (-)
- [ ] Each phase ends with `**Gate:** [criteria]`
- [ ] Phase numbers are sequential (1, 2, 3, 4, 5)

**If ANY check fails → FIX before saving the BLUEPRINT.md**

### 📤 Output
Output all tasks as Markdown files inside {{claudiomiroFolder}}/TASK{number}/:
- Each directory contains: BLUEPRINT.md (single file)
- Files are numbered sequentially (TASK0, TASK1, TASK2, ...)
- Final validation task is named TASKΩ or last numbered task

## INPUT
{{claudiomiroFolder}}/AI_PROMPT.md

## OUTPUT
Multiple directories:
```
   {{claudiomiroFolder}}/TASK0/
      └── BLUEPRINT.md
   {{claudiomiroFolder}}/TASK1/
      └── BLUEPRINT.md
   {{claudiomiroFolder}}/TASK2/
      └── BLUEPRINT.md
   ...
   {{claudiomiroFolder}}/TASKΩ/
      └── BLUEPRINT.md
```
Each containing a single BLUEPRINT.md file with all 6 sections.

## PURPOSE
This process ensures 100% coverage of user intent, full reasoning traceability, anti-hallucination safeguards, and consistent modular execution by autonomous agents.
