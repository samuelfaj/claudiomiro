# Step5: First Execution - Fresh Start

## 🎯 SITUATION

This is a **FIRST EXECUTION** - no previous errors, no blockers.

**Your goal:** Execute the task from scratch following BLUEPRINT.md.

---

## 📋 EXECUTION FLOW

### Step 0: Initialize Review Checklist

**IMMEDIATELY** create `{{taskFolder}}/review-checklist.json`:
```json
{
  "$schema": "review-checklist-schema-v2",
  "task": "<TASKID>",
  "generated": "<current_timestamp>",
  "items": []
}
```

This file will be appended to after EVERY file modification. Each time you create/modify a file, IMMEDIATELY add review items to this checklist.

---

### Step 1: Read & Understand (5 min)

**DO NOW:**
1. Read BLUEPRINT.md completely (sections 1-6)
2. Read execution.json current state
3. Read all Priority 1 context files from §2
4. Read all Priority 2 context files from §2

**After reading, update execution.json:**
```json
{
  "status": "in_progress",
  "currentPhase": { "id": 1, "name": "<first phase>", "lastAction": "Started reading context" }
}
```

### Step 2: Verify Pre-Conditions

**CRITICAL:** Run ALL pre-condition checks from BLUEPRINT.md §3.1.

For each pre-condition:
1. Run the command
2. Verify output matches expected
3. If FAIL → set status="blocked" and STOP

**If all pass:**
```json
{
  "status": "in_progress",
  "currentPhase": { "lastAction": "Pre-conditions verified" }
}
```

### Step 3: Execute Phases

For EACH phase in BLUEPRINT.md §4:

1. **Start phase:**
```json
{
  "currentPhase": { "id": <N>, "name": "<phase>", "lastAction": "Started" },
  "phases": [{ "id": <N>, "name": "<phase>", "status": "in_progress", "items": [] }]
}
```

2. **Create items for each step in the phase:**
```json
{
  "phases": [{
    "items": [
      { "description": "<step from BLUEPRINT>", "source": "§4 Phase N Step M", "completed": false }
    ]
  }]
}
```

3. **Execute each step, track artifacts:**
```json
{
  "artifacts": [{ "type": "modified", "path": "path/to/file.ext", "verified": false }]
}
```

4. **Mark items completed with evidence:**
```json
{
  "items": [{ "description": "...", "completed": true, "evidence": "Done at line X" }]
}
```

5. **Complete phase:**
```json
{
  "phases": [{ "id": <N>, "status": "completed" }]
}
```

### Step 4: Validate

Run ALL success criteria from BLUEPRINT.md §3.2:
1. Execute each validation command
2. If pass → mark artifact verified=true
3. If fail → fix and re-test

```json
{
  "artifacts": [{ "path": "...", "verified": true }]
}
```

### Step 5: Cleanup & Complete

1. Remove debug logs
2. Format code
3. Remove dead code
4. Update cleanup flags:

```json
{
  "beyondTheBasics": {
    "cleanup": { "debugLogsRemoved": true, "formattingConsistent": true, "deadCodeRemoved": true }
  }
}
```

5. Set completion:

```json
{
  "status": "completed",
  "completion": { "status": "completed", "summary": ["<what was done>"] }
}
```

---

## ✅ SUCCESS CHECKLIST

Before marking complete:
- [ ] All phases have status="completed"
- [ ] All phase items have completed=true
- [ ] All artifacts have verified=true
- [ ] All cleanup flags are true
- [ ] status="completed"
- [ ] completion.status="completed"

**If all checked → Task complete! 🎉**
