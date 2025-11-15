## OBJECTIVE
Read the provided `{{claudiomiroFolder}}/AI_PROMPT.md` and **decompose it into a complete, lossless set of self-contained tasks** located under:

`{{claudiomiroFolder}}/TASK{number}/`

Each task must:
- Represent exactly one verifiable unit of work.
- Preserve the user's intent **without merging, skipping, or paraphrasing away detail**.
- **Inherit and propagate the rich context from AI_PROMPT.md** (environment, codebase, patterns).
- Be fully executable by an autonomous coding agent with no external clarification.

---

## 🔗 ALIGNMENT WITH STEP 0.1 (Context Inheritance)

The `AI_PROMPT.md` you're reading was created by step0.1 with a **context-first philosophy**.

**What step0.1 provides:**
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

## Environment Context (from AI_PROMPT.md)
**CRITICAL: Propagate essential context so this task is executable in isolation**

### Tech Stack & Architecture
[Copy relevant parts from AI_PROMPT.md section "📁 Environment & Codebase Context"]
- Language, framework, version
- Key directories structure
- Architecture pattern
- Build/test tools

### Project Conventions
[Copy relevant conventions from AI_PROMPT.md]
- Naming conventions
- Code style patterns
- Testing approach
- Error handling patterns

## Related Code (Specific to this task)
[Copy ONLY relevant examples from AI_PROMPT.md section "🧩 Related Code Context"]
- Reference files: path/to/file.ext:line-range
- Patterns to follow: Specific examples from codebase
- Files to modify/extend: Exact locations

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
🚨 CRITICAL: Environment Context section must be populated from AI_PROMPT.md

### B) `{{claudiomiroFolder}}/TASKX/PROMPT.md`
```markdown
## PROMPT
Refined AI prompt for execution.

## COMPLEXITY
Low / Medium / High

## ENVIRONMENT CONTEXT
**Propagated from AI_PROMPT.md - Essential for execution in isolation**

### Tech Stack
[Copy from AI_PROMPT.md "📁 Environment & Codebase Context"]
- Language: [e.g., TypeScript 5.x]
- Framework: [e.g., Express 4.x]
- Database: [e.g., PostgreSQL with Prisma ORM]
- Testing: [e.g., Jest]
- Build: [e.g., npm/bun]

### Project Structure
[Copy relevant parts from AI_PROMPT.md]
- src/routes - API routes
- src/services - Business logic
- src/models - Data models
- tests/ - Test files

### Coding Conventions
[Copy from AI_PROMPT.md]
- Naming: camelCase for functions, PascalCase for classes
- Error handling: [specific pattern used in project]
- Testing: [approach, mocking strategy]
- File organization: [pattern used]

## RELATED FILES / SOURCES
[Copy ONLY task-relevant references from AI_PROMPT.md "🧩 Related Code Context"]
- Reference pattern: src/services/userService.ts:45-60
- Follow approach: src/validators/authValidator.ts
- Integrate with: src/webhooks/handler.ts

## CONTEXT FILES / SOURCES
[Additional context specific to this task]

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

🧩 EXAMPLES (Showing Context Propagation)

**Example 1: CRUD Flow with Context**

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
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** users.ts pattern, Prisma schema examples

- TASK2 – Create endpoint (Layer 1, parallel)
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** users.ts:20-35 (create pattern), userValidator.ts

- TASK3 – Read endpoint (Layer 1, parallel)
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** users.ts:36-50 (read pattern)

- TASK4 – Update endpoint (Layer 1, parallel)
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** users.ts:51-65 (update pattern), userValidator.ts

- TASK5 – Delete endpoint (Layer 1, parallel)
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** users.ts:66-80 (delete pattern)

- TASK6 – Integration validation (Layer 2)
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** All integration test patterns

- TASK7 – Final Ω assembly verification
  - **Environment Context:** Full tech stack + all conventions
  - **Related Code:** All CRUD endpoints for cross-validation

**Example 2: Multi-step Form with Specific Context**

AI_PROMPT.md contains:
```
📁 Environment & Codebase Context:
- React 18 with TypeScript
- State management: Zustand
- Forms: React Hook Form + Zod validation
- Structure: src/components, src/stores, src/schemas
- Convention: PascalCase components, hooks prefix "use"
- Validation: Centralized schemas in src/schemas/

🧩 Related Code Context:
- Follow multi-step pattern from src/components/OnboardingFlow/
- Use form hook pattern from src/hooks/useFormStep.ts
- Store pattern: src/stores/formStore.ts
```

Decomposition:
- TASK1 – Base layout & form setup (Layer 0)
  - **Environment Context:** React + all conventions
  - **Related Code:** OnboardingFlow/ structure, formStore.ts pattern

- TASK2 – Step 1 component (Layer 1, parallel)
  - **Environment Context:** React + all conventions
  - **Related Code:** OnboardingFlow/Step1.tsx pattern, useFormStep.ts

- TASK3 – Step 2 component (Layer 1, parallel)
  - **Environment Context:** React + all conventions
  - **Related Code:** OnboardingFlow/Step2.tsx pattern, useFormStep.ts

- TASK4 – Step 3 component (Layer 1, parallel)
  - **Environment Context:** React + all conventions
  - **Related Code:** OnboardingFlow/Step3.tsx pattern, useFormStep.ts

- TASK5 – Autosave + navigation (Layer 2)
  - **Environment Context:** React + all conventions
  - **Related Code:** formStore.ts autosave logic, navigation patterns

- TASK6 – System wiring validation (Layer N)
  - **Environment Context:** React + all conventions
  - **Related Code:** Integration test patterns

- TASK7 – Final Ω (end-to-end validation)
  - **Environment Context:** React + all conventions
  - **Related Code:** All components for cross-validation

**Key Pattern:**
- **Universal context** (tech stack, architecture, conventions) → EVERY task
- **Specific context** (file references, code examples) → ONLY relevant tasks
- **References are precise** (file:line-range), not vague ("follow best practices")

----

🚫 ANTI-PATTERNS

**Decomposition Anti-patterns:**
❌ Splitting trivial atomic operations.
❌ Forgetting the final validation layer.
❌ Treating parallel tasks as sequential without cause.
❌ Merging distinct requirements into a single task.

**Context Propagation Anti-patterns:**
❌ **Vague references:** "Follow best practices" instead of "Follow pattern in src/auth.ts:45-60"
❌ **Missing environment:** Task doesn't include tech stack/conventions (agent has no context)
❌ **Copy-paste overload:** Including ALL context in every task (bloat, noise)
❌ **Lost context:** Specific code examples from AI_PROMPT.md not propagated to relevant tasks
❌ **Assumed knowledge:** "Use the standard approach" (which standard? show me!)
❌ **Generic guidance:** "Handle errors properly" instead of "Use AppError pattern from src/errors/AppError.ts"

**Good Practices:**
✅ Decompose only when it increases clarity, autonomy, or testability.
✅ Each task should represent a single verifiable truth from the user's request.
✅ **Every task is self-contained:** Agent can execute without reading other files.
✅ **Context is precise:** Exact file paths, line ranges, concrete examples.
✅ **Context is selective:** Universal context everywhere, specific context only where relevant.
✅ **References are actionable:** Agent knows exactly what file to open and what pattern to follow.

⸻

## FINAL REQUIREMENT

Before finishing, perform these validations:

### ✅ Completeness Checklist
- [ ] Every requirement from AI_PROMPT.md is covered by at least one task
- [ ] No requirements were merged, summarized, or skipped
- [ ] Final Ω validation task exists and depends on all other tasks

### ✅ Context Propagation Checklist
- [ ] **Environment context** (tech stack, architecture, conventions) is present in ALL tasks
- [ ] **Specific code references** from AI_PROMPT.md are propagated to RELEVANT tasks
- [ ] References are precise (file:line-range), not vague ("follow best practices")
- [ ] Each task can be understood in isolation without reading AI_PROMPT.md or other tasks
- [ ] No generic guidance like "handle errors properly" - all guidance is concrete and actionable

### ✅ Structure Validation
- [ ] All tasks follow the TASK.md template with Environment Context section
- [ ] All prompts follow the PROMPT.md template with ENVIRONMENT CONTEXT section
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