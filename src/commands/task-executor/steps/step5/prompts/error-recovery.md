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
| `implementation-strategy` | Missing phase items | Add items to phases array |
| `success-criteria` | Validation command failed | Fix the code, re-run validation |
| `review-checklist` | Missing checklist entries | Add questions to review-checklist.json |
| `completion` | Artifacts not verified | Run validations, mark verified=true |
| `pre-conditions` | Required file/method missing | Check if BLUEPRINT.md is correct |

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
