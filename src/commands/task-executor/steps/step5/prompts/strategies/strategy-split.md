# Step5: SPLIT Strategy Mode

## SITUATION

You are now in **SPLIT STRATEGY MODE**. All previous strategies failed (ORIGINAL, SIMPLIFIED, MINIMAL).

**Strategy History:** ORIGINAL (failed) -> SIMPLIFIED (failed) -> MINIMAL (failed) -> SPLIT (current)

**What this means:** The task is TOO COMPLEX to complete as a single unit. Your job is to ANALYZE and SUGGEST how to split it.

---

## SPLIT STRATEGY RULES

### DO NOT Implement Anything

This is an ANALYSIS phase, not an implementation phase.

1. **Analyze** the current execution state
2. **Identify** logical split points
3. **Generate** split plan in execution.json
4. **Document** what each subtask should do

---

## ACTION PLAN

### Step 1: Analyze Why Previous Strategies Failed

Read execution.json and identify:

**Check errorHistory:**
- What errors repeated?
- What phase(s) kept failing?
- What patterns indicate the core problem?

**Check phases:**
- Which phases completed?
- Which phases are stuck?
- Where is the complexity concentrated?

### Step 2: Identify Split Points

Good split points are:

1. **Phase Boundaries**
   - If Phase 1-2 completed, Phase 3+ failed
   - Split: Subtask 1 = Phase 1-2 (preserve), Subtask 2 = Phase 3+

2. **File Boundaries**
   - Different files = different subtasks
   - Example: Subtask 1 = backend, Subtask 2 = frontend

3. **Feature Boundaries**
   - Each feature becomes its own subtask
   - Example: Task "Auth system" -> Subtask 1 = Login, Subtask 2 = Registration

4. **Dependency Boundaries**
   - Core functionality first, dependent features after
   - Subtask 2 depends on Subtask 1

### Step 3: Generate Split Plan

Update execution.json with split recommendation:

```json
{
  "status": "split_recommended",
  "splitAnalysis": {
    "reason": "Task too complex for single execution",
    "failurePattern": "Phase 3 keeps failing due to [reason]",
    "suggestedSplits": [
      {
        "subtaskId": "TASKNAME.1",
        "name": "Core Implementation",
        "description": "Implement the basic [feature] functionality",
        "phases": ["Phase 1", "Phase 2"],
        "files": ["path/to/file1.ext", "path/to/file2.ext"],
        "dependsOn": null,
        "estimatedComplexity": "low"
      },
      {
        "subtaskId": "TASKNAME.2",
        "name": "Extended Features",
        "description": "Add [secondary features] to core implementation",
        "phases": ["Phase 3"],
        "files": ["path/to/file3.ext"],
        "dependsOn": "TASKNAME.1",
        "estimatedComplexity": "medium"
      },
      {
        "subtaskId": "TASKNAME.3",
        "name": "Testing and Polish",
        "description": "Add comprehensive tests and documentation",
        "phases": ["Phase 4", "Phase 5"],
        "files": ["path/to/test.ext"],
        "dependsOn": "TASKNAME.2",
        "estimatedComplexity": "low"
      }
    ],
    "preservedProgress": {
      "completedPhases": ["Phase 1"],
      "completedArtifacts": ["path/to/file1.ext"],
      "note": "Progress from Phase 1 will be preserved in subtasks"
    }
  }
}
```

### Step 4: Document Split Rationale

For each suggested subtask, explain:

1. **Why this boundary?**
   - What makes this a logical split point?
   - What complexity does this isolate?

2. **What's included?**
   - Which phases/items belong to this subtask?
   - Which files will be touched?

3. **Dependencies?**
   - Does this subtask depend on another?
   - What must be completed first?

---

## SPLIT PATTERNS

### Pattern 1: Sequential Phases

**When:** Phases are sequential and independent
**Split:** Each phase becomes a subtask

```
Original: Phase 1 -> Phase 2 -> Phase 3
Split:
- Subtask 1: Phase 1 (no deps)
- Subtask 2: Phase 2 (deps: Subtask 1)
- Subtask 3: Phase 3 (deps: Subtask 2)
```

### Pattern 2: Feature Isolation

**When:** Task has multiple distinct features
**Split:** Each feature becomes a subtask

```
Original: Authentication system (login + registration + password reset)
Split:
- Subtask 1: Login
- Subtask 2: Registration (deps: Subtask 1)
- Subtask 3: Password Reset (deps: Subtask 1)
```

### Pattern 3: Layer Isolation

**When:** Task spans multiple layers
**Split:** Each layer becomes a subtask

```
Original: Full-stack feature
Split:
- Subtask 1: Database/model layer
- Subtask 2: Backend/API layer (deps: Subtask 1)
- Subtask 3: Frontend/UI layer (deps: Subtask 2)
```

### Pattern 4: Progress Preservation

**When:** Some phases completed, others stuck
**Split:** Preserve completed work, split remaining

```
Original: 5 phases, Phase 1-2 done, Phase 3-5 stuck
Split:
- Subtask 1: Complete (Phase 1-2 preserved)
- Subtask 2: Phase 3 (deps: Subtask 1)
- Subtask 3: Phase 4-5 (deps: Subtask 2)
```

---

## OUTPUT REQUIREMENTS

Update execution.json with:

1. `status`: `"split_recommended"`
2. `splitAnalysis`: Complete split plan (see format above)
3. `splitReason`: Why split is necessary
4. `suggestedSplits`: Array of subtask definitions

**DO NOT:**
- Create actual subtask folders/files (DAG executor will do this)
- Implement any code
- Modify any source files
- Continue execution

**DO:**
- Analyze thoroughly
- Provide clear split recommendations
- Document dependencies
- Preserve progress information

---

## SUCCESS CRITERIA (SPLIT)

**Minimum for split recommendation:**
- [ ] Clear analysis of why previous strategies failed
- [ ] 2+ subtasks identified with logical boundaries
- [ ] Dependencies between subtasks documented
- [ ] Progress preservation documented
- [ ] execution.json updated with split plan

---

## EXAMPLE

**Original Task:** "Implement user authentication with OAuth"

**After analysis, split into:**

```json
{
  "suggestedSplits": [
    {
      "subtaskId": "AUTH.1",
      "name": "Basic Authentication",
      "description": "Create login/logout with session management",
      "dependsOn": null
    },
    {
      "subtaskId": "AUTH.2",
      "name": "User Registration",
      "description": "Add user registration with validation",
      "dependsOn": "AUTH.1"
    },
    {
      "subtaskId": "AUTH.3",
      "name": "OAuth Integration",
      "description": "Add Google/GitHub OAuth providers",
      "dependsOn": "AUTH.1"
    },
    {
      "subtaskId": "AUTH.4",
      "name": "Password Management",
      "description": "Add password reset and change functionality",
      "dependsOn": "AUTH.2"
    }
  ]
}
```

---

## IMPORTANT

- **SPLIT is ALWAYS PREFERABLE to FAILURE**
- Small, successful subtasks > One large, failed task
- DAG executor will handle subtask creation automatically
- Your job is ONLY to analyze and recommend split points
