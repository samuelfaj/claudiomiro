# Step5: Error Recovery - Fix Previous Failures

## 🚨 SITUATION

This is a **RETRY AFTER ERRORS**. Previous execution(s) failed.

**Your goal:** FIX the specific errors, don't start from scratch.

---

## 📋 ERRORS TO FIX

{{errorDetails}}

---

## 🔧 RECOVERY STRATEGY

### Step 1: Analyze Errors (DO THIS FIRST)

**Read and understand each error:**

1. **Check `pendingFixes` array** - what validations failed
2. **Check `errorHistory`** - detailed error messages
3. **Check `completion.lastError`** - most recent error

**Common error types and fixes:**

| Error Type | Likely Cause | Fix |
|------------|--------------|-----|
| `implementation-strategy` | Missing phase items or phases not completed | See detailed fix below |
| `success-criteria` | Validation command failed | Fix the code, re-run validation |
| `review-checklist` | Missing checklist entries | Add questions to review-checklist.json |
| `completion` | Artifacts not verified | Run validations, mark verified=true |
| `pre-conditions` | Required file/method missing | Check if BLUEPRINT.md is correct |

### If pendingFixes includes 'implementation-strategy':

**CRITICAL: This is the most common validation failure. Follow these steps EXACTLY:**

**What the validator checks:**
1. Parses BLUEPRINT.md §4 looking for phases (`### Phase 1: Name`, `### Phase 2: Name`, etc.)
2. Checks that execution.json has matching phases with the SAME `id` numbers
3. Each phase must either have `status: "completed"` OR have >50% of items marked `completed: true`

**Recovery Protocol:**

1. **Read BLUEPRINT.md §4 Implementation Strategy:**
   - Find all phases: `### Phase 1: ...`, `### Phase 2: ...`, etc.
   - Note the phase NUMBER (1, 2, 3...) and NAME

2. **Read current execution.json:**
   - Check `phases` array - does it exist?
   - Check each phase has correct `id` (integer matching BLUEPRINT)
   - Check each phase has `items` array with completion status

3. **Fix execution.json phases to match BLUEPRINT.md:**

```json
{
  "phases": [
    {
      "id": 1,
      "name": "Preparation",
      "status": "completed",
      "items": [
        { "description": "Step from BLUEPRINT", "completed": true, "evidence": "Done" }
      ]
    },
    {
      "id": 2,
      "name": "Core Implementation",
      "status": "completed",
      "items": [
        { "description": "Step from BLUEPRINT", "completed": true, "evidence": "Done" }
      ]
    },
    {
      "id": 3,
      "name": "Testing",
      "status": "completed",
      "items": [
        { "description": "Step from BLUEPRINT", "completed": true, "evidence": "Done" }
      ]
    }
  ]
}
```

4. **CRITICAL RULES:**
   - `id` MUST be an integer (1, 2, 3) NOT a string
   - `id` MUST match the phase number in BLUEPRINT.md
   - Each phase MUST have at least one item in `items` array
   - Each item MUST have `"completed": true` (boolean, not string)
   - Phase `status` should be `"completed"` if all work is done

5. **Quick Fix Checklist:**
   - [ ] Does `phases` array exist in execution.json?
   - [ ] Does each phase `id` match BLUEPRINT.md phase numbers?
   - [ ] Does each phase have `items` array with at least one item?
   - [ ] Is each item marked `"completed": true`?
   - [ ] Is phase `status` set to `"completed"`?

**Example - If BLUEPRINT.md has:**
```markdown
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Read context files
2. Verify dependencies

### Phase 2: Core Implementation
1. Create the handler
2. Add validation
```

**Then execution.json MUST have:**
```json
{
  "phases": [
    {
      "id": 1,
      "name": "Preparation",
      "status": "completed",
      "items": [
        { "description": "Read context files", "completed": true },
        { "description": "Verify dependencies", "completed": true }
      ]
    },
    {
      "id": 2,
      "name": "Core Implementation",
      "status": "completed",
      "items": [
        { "description": "Create the handler", "completed": true },
        { "description": "Add validation", "completed": true }
      ]
    }
  ]
}
```

### If pendingFixes includes 'review-checklist':

**Recovery Protocol for Review Checklist:**

1. **Read existing files:**
   - `review-checklist.json` (check what items already exist)
   - `execution.json` (get list of artifacts)

2. **Identify artifacts WITHOUT review items:**
   - Compare artifacts array with checklist items
   - Note which files have no review questions

3. **For EACH artifact without items:**
   - Read the actual file
   - Identify functions/methods/changes made
   - Generate 2-5 specific review questions PER function/change
   - Append to `review-checklist.json` with proper v2 format

4. **v2 Format (REQUIRED):**
```json
{
  "id": "RC<N>",
  "file": "path/to/file.ext",
  "lines": [45, 78],
  "type": "created" | "modified",
  "description": "Question about specific lines - NO backticks or code",
  "reviewed": false,
  "category": "error-handling",
  "context": {
    "action": "What was done (e.g., Added validation for userId)",
    "why": "Why it was needed (e.g., Prevent SQL injection)"
  }
}
```

5. **CRITICAL RULES:**
   - MUST include `context.action` and `context.why`
   - MUST use file:line references (NO backticks/inline code)
   - MUST have non-empty `lines` array
   - Generate questions by function/method/logical change

### Step 2: Fix ONLY What Failed

**DO NOT restart from scratch!**

The execution.json already has progress. Focus on:
1. What specifically failed (from errorHistory)
2. What validation didn't pass (from pendingFixes)
3. Fix ONLY those issues

**Example: If `success-criteria` failed:**
```
Error: Success criteria validation failed: 1 criteria failed
- "grep -n 'newMethod' src/handler.ext" → No match found
```

**Fix:** Add the missing method to src/handler.ext, then continue.

### Step 3: Verify the Fix

After fixing:
1. Run the validation command that failed
2. Confirm it passes now
3. Update execution.json:

```json
{
  "pendingFixes": [],  // Clear after fixing
  "errorHistory": [...],  // Keep history for audit
  "status": "in_progress"
}
```

### Step 4: Continue Normal Execution

After fixing errors:
1. Continue from where you left off
2. Complete remaining phases
3. Run final validations
4. Set completion status

---

## ⚠️ IMPORTANT RULES

### DO:
- ✅ Read the error details carefully
- ✅ Focus on fixing the specific issue
- ✅ Preserve existing progress (phases, artifacts, items)
- ✅ Clear `pendingFixes` after fixing
- ✅ Continue from current state

### DON'T:
- ❌ Reset execution.json to pending
- ❌ Start phases from scratch
- ❌ Ignore the error details
- ❌ Mark things complete without fixing

---

## 📊 EXAMPLE RECOVERY

**Before (error state):**
```json
{
  "status": "in_progress",
  "attempts": 2,
  "pendingFixes": ["success-criteria"],
  "errorHistory": [
    { "message": "grep -n 'newQuery' src/handler.ext failed", "timestamp": "..." }
  ],
  "completion": { "lastError": "Success criteria validation failed" },
  "phases": [
    { "id": 1, "status": "completed" },
    { "id": 2, "status": "completed" }
  ],
  "artifacts": [{ "path": "src/handler.ext", "verified": false }]
}
```

**Fix action:** Add `newQuery` to src/handler.ext

**After (fixed):**
```json
{
  "status": "completed",
  "attempts": 3,
  "pendingFixes": [],  // Cleared
  "errorHistory": [...],  // Keep for audit
  "completion": { "status": "completed", "summary": ["Fixed: Added newQuery"] },
  "phases": [
    { "id": 1, "status": "completed" },
    { "id": 2, "status": "completed" }
  ],
  "artifacts": [{ "path": "src/handler.ext", "verified": true }]  // Now verified
}
```

---

## ✅ SUCCESS CHECKLIST

After fixing:
- [ ] Error is actually fixed (run validation to confirm)
- [ ] `pendingFixes` is empty
- [ ] All artifacts verified=true
- [ ] All phases completed
- [ ] status="completed"

**If all checked → Error recovered! 🎉**
