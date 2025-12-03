# Step5: Blocked by Code Review - Fix Issues

## 🚫 SITUATION

This is a **RETRY AFTER CODE REVIEW FAILURE**.

The code review (step6) found issues that MUST be fixed.

**Your goal:** Address ALL issues in `completion.blockedBy`.

---

## 📋 BLOCKING ISSUES

{{blockedByDetails}}

---

## 🔧 FIX STRATEGY

### Step 1: Read Code Review (DO FIRST)

**Check these files:**
1. `CODE_REVIEW.md` - Detailed analysis of what failed
2. `execution.json` → `completion.blockedBy` - List of issues
3. `errorHistory` - Timeline of failures

### Step 2: Address EACH Issue

For **EACH** item in `blockedBy`:

1. **Understand the issue:**
   - What code is wrong?
   - What file/line?
   - What should it be instead?

2. **Fix the issue:**
   - Make the code change
   - Track in artifacts array

3. **Verify the fix:**
   - Run related validation
   - Confirm issue is resolved

4. **Document the fix:**
```json
{
  "completion": {
    "summary": ["Fixed: <issue description>"]
  }
}
```

### Step 3: Clear blockedBy

After fixing ALL issues:

```json
{
  "completion": {
    "blockedBy": [],  // ⬅️ CLEAR this array
    "status": "pending_validation"
  }
}
```

### Step 4: Re-verify Everything

1. Run ALL success criteria from BLUEPRINT.md §3.2
2. Mark artifacts as verified=true
3. Complete any remaining phases

---

## 📊 EXAMPLE

**Before (blocked):**
```json
{
  "status": "in_progress",
  "completion": {
    "blockedBy": [
      "Missing validation for userId in handler.ext:45",
      "Wrong response status: expected 201, got 200 at handler.ext:88"
    ],
    "codeReviewPassed": false
  }
}
```

**Fix actions:**
1. Add userId validation at handler.ext:45
2. Change response status to 201 at handler.ext:88

**After (fixed):**
```json
{
  "status": "completed",
  "completion": {
    "blockedBy": [],  // Cleared
    "codeReviewPassed": true,
    "summary": [
      "Fixed: Added userId validation at line 45",
      "Fixed: Changed response status to 201 at line 88"
    ]
  },
  "artifacts": [{ "path": "handler.ext", "verified": true }]
}
```

---

## ⚠️ IMPORTANT RULES

### DO:
- ✅ Fix EVERY item in blockedBy (not just some)
- ✅ Read CODE_REVIEW.md for context
- ✅ Clear blockedBy array after fixing ALL issues
- ✅ Re-run validations after fixing

### DON'T:
- ❌ Skip any blockedBy item
- ❌ Assume issues are minor - FIX them
- ❌ Mark complete without clearing blockedBy
- ❌ Ignore CODE_REVIEW.md analysis

---

## ✅ SUCCESS CHECKLIST

After fixing:
- [ ] ALL blockedBy items addressed
- [ ] blockedBy array is empty []
- [ ] All artifacts verified=true
- [ ] Validations pass
- [ ] status="completed"

**If all checked → Code review issues fixed! 🎉**
