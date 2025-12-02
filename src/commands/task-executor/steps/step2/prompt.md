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
| Criterion | Command |
|-----------|---------|
| Tests pass | `npm test -- --testPathPattern="module" --silent` |
| No lint errors | `eslint path/to/files --quiet` |
| Feature works | [Specific verification command] |

### 3.3 Output Artifacts:
| Artifact | Type | Path | Verification |
|----------|------|------|--------------|
| [File name] | CREATE/MODIFY | [Full path] | `test -f path` |

## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. [Read required context files]
2. [Verify pre-conditions]
3. [Set up any required scaffolding]

**Gate:** All pre-conditions verified, context understood

### Phase 2: Core Implementation
1. [Detailed implementation step 1]
2. [Detailed implementation step 2]
3. [Follow pattern from file:line-range]

**Gate:** Core functionality implemented, compiles without errors

### Phase 3: Testing
1. [Write/update unit tests]
2. [Run affected tests only]
3. [Fix any failures]

**Gate:** All affected tests pass

### Phase 4: Integration
1. [Verify integration points]
2. [Check imports/exports work]
3. [Validate with dependent modules]

**Gate:** Integration verified, no breaking changes

### Phase 5: Validation
1. [Final success criteria check]
2. [Verify output artifacts exist]
3. [Mark task complete]

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
- All 6 sections (IDENTITY, CONTEXT CHAIN, EXECUTION CONTRACT, IMPLEMENTATION STRATEGY, UNCERTAINTY LOG, INTEGRATION IMPACT) are REQUIRED
- Context Chain must include legacy reference section (even if "None")
- Pre-conditions table must have at least one verifiable check
- Anti-hallucination anchors prevent the agent from inventing code

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
```

**TASK1/BLUEPRINT.md** – Create endpoint (Layer 1, parallel)
```markdown
<!-- BLUEPRINT: Read-only after creation -->
@dependencies [TASK0]

# BLUEPRINT: TASK1

## 1. IDENTITY
### This Task IS:
- Implementing POST /api/products endpoint
- Adding input validation with productValidator
- Following create pattern from users.ts:20-35
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
❌ **Empty pre-conditions:** Not verifying dependencies before coding
❌ **Copy-paste context:** Duplicating AI_PROMPT.md instead of referencing
❌ **Missing legacy reference:** Not including Priority 0 section

**Good Practices:**
✅ Decompose only when it increases clarity, autonomy, or testability.
✅ Each task should represent a single verifiable truth from the user's request.
✅ **Every BLUEPRINT is self-contained:** Agent reads AI_PROMPT.md + BLUEPRINT.md to have full context.
✅ **Anti-hallucination anchors prevent guessing:** Agent knows when to stop vs. proceed.
✅ **Pre-conditions are verifiable:** Commands that return pass/fail.
✅ **Legacy reference is explicit:** Agent knows if legacy systems exist.

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
