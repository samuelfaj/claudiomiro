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
Every requirement, bullet, or implied behavior from `AI_PROMPT.md` must appear explicitly in **at least one TASK.md**.

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

## 🧠 DEEP REASONING & METHODOLOGY

### 1. Recursive Breakdown
- Identify all top-level goals from `AI_PROMPT.md`.
- For each goal, ask:
  > “Does this require reasoning, sequencing, or verification steps?”
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
- One’s output is required for another’s input.
- One validates or extends another’s behavior.

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
Every `TASK.md` must be self-contained and readable in isolation:
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

## ⚙️ OUTPUT REQUIREMENTS

### A) `{{claudiomiroFolder}}/TASKX/TASK.md`
```markdown
@dependencies [Tasks]  // Task name MUST BE COMPLETE AND FOLLOW THE PATTERN "TASK{number}"
# Task: [Concise title]

## Summary
Explain clearly what must be done and why. Focus on reasoning and context.

## Context Reference
**For complete environment context, see:**
- `../AI_PROMPT.md` - Contains full tech stack, architecture, coding conventions, and related code patterns

**Task-Specific Context:**
[Include ONLY context unique to this specific task - what makes THIS task different]
- Specific files this task will modify/create: [list with line ranges]
- Specific patterns this task must follow: [reference with file:line-range]
- Task-specific constraints or considerations: [unique to this task]

## Complexity
Low / Medium / High

## Dependencies
Depends on: [Tasks]  // Task name MUST BE COMPLETE AND FOLLOW THE PATTERN "TASK{number}"
Blocks: [Tasks] // Task name MUST BE COMPLETE AND FOLLOW THE PATTERN "TASK{number}"
Parallel with: [Tasks] // Task name MUST BE COMPLETE AND FOLLOW THE PATTERN "TASK{number}"

## Detailed Steps
1. [Detailed steps if needed]

## Acceptance Criteria
- [ ] Clear, testable result #1
- [ ] ...

## Code Review Checklist
- [ ] Clear naming, no dead code.
- [ ] Errors handled consistently.
- [ ] Follows project conventions (see Environment Context above).
- [ ] ...

## Reasoning Trace
Explain design logic and trade-offs.
```

🚨 CRITICAL: First line must be @dependencies [...]
🚨 CRITICAL: Context Reference section must point to AI_PROMPT.md (don't duplicate content)

### B) `{{claudiomiroFolder}}/TASKX/PROMPT.md`
```markdown
## PROMPT
Refined AI prompt for execution.

## COMPLEXITY
Low / Medium / High

## CONTEXT REFERENCE
**For complete environment context, read:**
- `{{claudiomiroFolder}}/AI_PROMPT.md` - Contains full tech stack, architecture, project structure, coding conventions, and related code patterns

**You MUST read AI_PROMPT.md before executing this task to understand the environment.**

## TASK-SPECIFIC CONTEXT
[Include ONLY information unique to this specific task]

### Files This Task Will Touch
- [Exact files to create/modify with line ranges if applicable]

### Patterns to Follow
- [Specific code patterns with file:line-range references]
- [Only patterns directly relevant to this task]

### Integration Points
- [How this task integrates with other parts of the system]
- [Dependencies on other tasks or modules]

## EXTRA DOCUMENTATION
[...]

## LAYER
0 / 1 / 2 / N

## PARALLELIZATION
Parallel with: [Tasks]

## CONSTRAINTS
- IMPORTANT: Do not perform any git commit or git push.
- Prefer CLI or script-based actions over manual edits
- Automate everything possible (installation, configuration, generation)
- Manual edits only when automation is impossible — must be justified
- Must include automated validation ONLY FOR CHANGED FILES (unit, smoke, or functional tests)
- Never include global tests or checks.
- No manual steps or external deployment needed
- Multi-repo / multi-directory support is fully supported (not a blocker)
- **Follow conventions from ENVIRONMENT CONTEXT above** - consistency is critical
```

-----

🧩 EXAMPLES (Showing Context Reference Pattern)

**Example 1: CRUD Flow - Context References**

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

Decomposition:
- TASK1 – Setup DB schema + base route structure (Layer 0)
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Will create schema.prisma and src/routes/products.ts base

- TASK2 – Create endpoint (Layer 1, parallel)
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Follow create pattern from users.ts:20-35, use userValidator.ts pattern

- TASK3 – Read endpoint (Layer 1, parallel)
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Follow read pattern from users.ts:36-50

- TASK4 – Update endpoint (Layer 1, parallel)
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Follow update pattern from users.ts:51-65

- TASK5 – Delete endpoint (Layer 1, parallel)
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Follow delete pattern from users.ts:66-80

- TASK6 – Integration validation (Layer 2)
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Test all CRUD endpoints together with integration test patterns

- TASK7 – Final Ω assembly verification
  - **Context Reference:** See ../AI_PROMPT.md for tech stack and conventions
  - **Task-Specific:** Cross-validate all endpoints for consistency

**Key Pattern:**
- **Universal context** (tech stack, architecture, conventions) → Referenced from AI_PROMPT.md (NOT copied)
- **Task-specific context** (which files to touch, which patterns to follow) → Included in each task
- **References are precise** (file:line-range), not vague ("follow best practices")
- **No duplication** - context lives in ONE place (AI_PROMPT.md)

----

🚫 ANTI-PATTERNS

**Decomposition Anti-patterns:**
❌ Splitting trivial atomic operations.
❌ Forgetting the final validation layer.
❌ Treating parallel tasks as sequential without cause.
❌ Merging distinct requirements into a single task.

**Context Propagation Anti-patterns:**
❌ **Vague references:** "Follow best practices" instead of "Follow pattern in src/auth.ts:45-60"
❌ **Missing context reference:** Task doesn't point to AI_PROMPT.md (agent has no way to find context)
❌ **Copy-paste duplication:** Copying tech stack/conventions from AI_PROMPT.md to every task (bloat, noise, maintenance burden)
❌ **Lost task-specific context:** Not specifying which files THIS task will touch
❌ **Assumed knowledge:** "Use the standard approach" (which standard? show me!)
❌ **Generic guidance:** "Handle errors properly" instead of "Use AppError pattern from src/errors/AppError.ts"

**Good Practices:**
✅ Decompose only when it increases clarity, autonomy, or testability.
✅ Each task should represent a single verifiable truth from the user's request.
✅ **Every task is self-contained:** Agent reads AI_PROMPT.md + TASK.md to have full context.
✅ **Context is not duplicated:** Universal context lives in AI_PROMPT.md (single source of truth).
✅ **Task-specific context is included:** Which files to touch, which patterns to follow for THIS task.
✅ **References are actionable:** Agent knows to read AI_PROMPT.md, then knows exactly what to do.

⸻

## FINAL REQUIREMENT

Before finishing, perform these validations:

### ✅ Completeness Checklist
- [ ] Every requirement from AI_PROMPT.md is covered by at least one task
- [ ] No requirements were merged, summarized, or skipped
- [ ] Final Ω validation task exists and depends on all other tasks

### ✅ Context Reference Checklist (NO DUPLICATION)
- [ ] **All tasks reference AI_PROMPT.md** for universal context (tech stack, architecture, conventions)
- [ ] **No tasks duplicate** the environment context from AI_PROMPT.md (reference, don't copy)
- [ ] **Task-specific context** (files to touch, patterns to follow) is included in each relevant task
- [ ] References are precise (file:line-range), not vague ("follow best practices")
- [ ] Each task can be understood by reading AI_PROMPT.md + TASK.md (no other dependencies)
- [ ] No generic guidance like "handle errors properly" - all guidance is concrete and actionable

### ✅ Structure Validation
- [ ] All tasks follow the TASK.md template with Context Reference section (pointing to AI_PROMPT.md)
- [ ] All prompts follow the PROMPT.md template with CONTEXT REFERENCE section (pointing to AI_PROMPT.md)
- [ ] Dependencies are correctly declared using TASK{number} format
- [ ] Layer assignments allow maximum parallelism
- [ ] All tasks include acceptance criteria and code review checklists

### 📤 Output
Output all tasks as Markdown files inside {{claudiomiroFolder}}/TASK{number}/:
- Each directory contains: TASK.md + PROMPT.md
- Files are numbered sequentially (TASK0, TASK1, TASK2, ...)
- Final validation task is named TASKΩ or last numbered task

## INPUT
{{claudiomiroFolder}}/AI_PROMPT.md

## OUTPUT
Multiple directories:
```
   {{claudiomiroFolder}}/TASK1/
   {{claudiomiroFolder}}/TASK2/
   ...
   {{claudiomiroFolder}}/TASKΩ/
```
Each containing:
	- TASK.md
	- PROMPT.md

## PURPOSE
This process ensures 100% coverage of user intent, full reasoning traceability, and consistent modular execution by autonomous agents.