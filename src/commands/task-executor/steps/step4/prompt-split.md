## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

---

## OBJECTIVE

Analyze whether the task at `{{taskFolder}}` can be split into subtasks that the **FAST model (Haiku)** can execute with **100% certainty**.

**CRITICAL RULE:** Only split if ALL subtasks can use FAST. If ANY subtask requires medium/hard model, keep the task intact.

**Purpose:** Cost optimization through intelligent model selection, not parallelization.

---

## PHASE 1: Pattern Analysis

Read the BLUEPRINT.md at `{{taskFolder}}` and analyze:

### 1.1 Identify Known Patterns
Search the codebase for similar implementations:
- Does this task follow an existing pattern in the project?
- Are there reference files that demonstrate the expected approach?
- Is the scope clearly defined with specific files to modify?

### 1.2 Complexity Assessment
For each logical part of the task, evaluate:

| Part | Description | Files | Complexity |
|------|-------------|-------|------------|
| 1 | [what it does] | [files] | LOW/MEDIUM/HIGH |
| 2 | [what it does] | [files] | LOW/MEDIUM/HIGH |

**Complexity Criteria:**
- **LOW:** Single file, <100 LOC, follows existing pattern exactly
- **MEDIUM:** 2-3 files, some adaptation of existing pattern needed
- **HIGH:** Multiple files, new pattern required, architectural decisions

---

## PHASE 2: FAST Viability Check

For EACH part identified in Phase 1, verify ALL criteria:

### Positive Criteria (MUST have at least ONE)
- [ ] **Simple CRUD** - Create/Read/Update/Delete following existing project pattern
- [ ] **Simple unit tests** - Tests following existing describe/test/expect pattern
- [ ] **Configuration change** - Modification in config files with clear structure
- [ ] **Localized rename/refactor** - Rename variable/function in limited scope
- [ ] **Add field/property** - Following existing model structure
- [ ] **Trivial fix** - Typo correction, obvious bug fix, clear solution

### Negative Criteria (MUST NOT have ANY)
- [ ] **Architectural decisions** - Needs to choose between approaches
- [ ] **Multiple integrations** - Touches 3+ modules that communicate with each other
- [ ] **Complex business logic** - Rules with many edge cases
- [ ] **Uncertainties** - BLUEPRINT shows LOW confidence in any aspect
- [ ] **New pattern creation** - Something not following existing codebase patterns
- [ ] **External service integration** - API calls, webhooks, third-party services

### Viability Decision

```
IF all parts have:
  - At least ONE positive criterion ✅
  - ZERO negative criteria ✅
THEN → FAST VIABLE (proceed to split)

IF any part has:
  - Any negative criterion ❌
  - OR no positive criteria ❌
THEN → NOT FAST VIABLE (keep intact)
```

---

## PHASE 3: Action

### Option A: FAST is Viable for ALL Parts → SPLIT

If you determined FAST is viable for ALL parts:

1. **Delete the original folder:**
   ```
   {{taskFolder}}
   ```

2. **Create numbered subtask folders:**
   - `{{taskFolder}}.1`
   - `{{taskFolder}}.2`
   - `{{taskFolder}}.3`
   (Create only as many as needed)

3. **For EACH subtask, create BLUEPRINT.md with:**

   **CRITICAL - First lines MUST be:**
   ```markdown
   @dependencies [LIST]
   @difficulty fast
   ```

   The `@difficulty fast` tag is MANDATORY for all subtasks created by this split.

4. **Update all BLUEPRINT.md files** in `{{claudiomiroFolder}}` with new dependencies and numbering.

### Required Structure for Each Subtask

```
{{taskFolder}}.1/
  └─ BLUEPRINT.md
     - First line: @dependencies [...]
     - Second line: @difficulty fast
     - Task identity and scope
     - Implementation strategy following existing pattern
```

### Option B: NOT FAST Viable → KEEP INTACT

If ANY part failed the viability check:

1. **Make NO changes** to the folder structure
2. **Do NOT create subtask folders**
3. The original task will be executed with its original @difficulty tag by step5

---

## DECISION EXAMPLES

### Example 1: SPLIT ✅
**Task:** "Add `lastLogin` field to User model and display in profile"

**Analysis:**
| Part | Description | Positive | Negative |
|------|-------------|----------|----------|
| 1 | Add field to User model | Add field/property ✅ | None |
| 2 | Update profile component | Simple CRUD (display) ✅ | None |

**Decision:** Split into 2 subtasks, both with `@difficulty fast`

---

### Example 2: KEEP INTACT ❌
**Task:** "Implement caching system for products API"

**Analysis:**
| Part | Description | Positive | Negative |
|------|-------------|----------|----------|
| 1 | Choose cache strategy | None | Architectural decision ❌ |
| 2 | Implement invalidation | None | Complex logic ❌ |

**Decision:** Keep intact (step5 will use medium/hard based on original @difficulty)

---

### Example 3: KEEP INTACT ❌
**Task:** "Add email validation and send notification"

**Analysis:**
| Part | Description | Positive | Negative |
|------|-------------|----------|----------|
| 1 | Email validation | Simple validation ✅ | None |
| 2 | Send notification | None | External service ❌ |

**Decision:** Keep intact (Part 2 is not FAST-viable, so entire task stays intact)

---

## QUALITY RULES

### Conservatism Over Optimism
- **When in doubt, DO NOT split**
- It's better to use medium/hard model on a simple task than to use FAST on a complex task
- Only split when you have **100% certainty** that FAST will succeed

### Dependency Rules
- Each subtask must be independently executable
- Update dependencies in ALL affected BLUEPRINT.md files in `{{claudiomiroFolder}}`
- Subtask numbering must be contiguous (.1, .2, .3 - no gaps)

### Scope Rules
- Each subtask should touch 1-2 files maximum
- No subtask should require architectural decisions
- All subtasks must follow existing patterns (no new pattern creation)
