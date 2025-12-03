# Step5: Blocked Execution - Pre-Condition Failure

## 🛑 SITUATION

Execution is **BLOCKED**. A pre-condition check failed.

**Status:** `status: "blocked"`

**Your goal:** Diagnose why execution is blocked and determine next steps.

---

## 📋 BLOCKING REASON

{{blockReason}}

---

## 🔍 DIAGNOSIS STEPS

### Step 1: Understand the Block

Read execution.json carefully:

```json
{
  "status": "blocked",
  "completion": {
    "status": "blocked",
    "summary": ["Pre-condition failed: <reason>"],
    "deviations": ["Expected: X, Got: Y"]
  }
}
```

### Step 2: Check Pre-Conditions

Look at BLUEPRINT.md §3.1 Pre-Conditions table:

| Check | Command | Expected |
|-------|---------|----------|
| File exists | `test -f path/file.ext` | exit 0 |
| Method exists | `grep 'methodName' file.ext` | match found |

**Why did it fail?**
- File doesn't exist?
- Method signature changed?
- Wrong file path in BLUEPRINT.md?
- Environment issue?

### Step 3: Determine Action

**Option A: The issue is fixable**
- Missing file can be created
- Wrong path can be corrected
- Fix the issue and retry

**Option B: BLUEPRINT.md is incorrect**
- File mentioned doesn't exist
- Method signature is different
- The task specification is wrong

**Option C: External dependency issue**
- Database not available
- API endpoint down
- Environment not configured

---

## 📊 ACTIONS BY SCENARIO

### Scenario 1: Fixable Issue

If you CAN fix the pre-condition:

1. Make the necessary fix
2. Run the pre-condition check again
3. If passes, update execution.json:

```json
{
  "status": "in_progress",  // ⬅️ Change from "blocked"
  "phases": [{ "preConditions": [{ "passed": true }] }]
}
```

4. Continue with normal execution

### Scenario 2: BLUEPRINT.md is Wrong

If the BLUEPRINT.md has incorrect information:

1. Document the issue clearly:

```json
{
  "status": "blocked",
  "completion": {
    "status": "blocked",
    "summary": ["BLUEPRINT.md error: <description>"],
    "deviations": ["Expected file at X, but it doesn't exist"],
    "forFutureTasks": ["Verify BLUEPRINT.md before execution"]
  }
}
```

2. **STOP** - Task cannot proceed without correct spec

### Scenario 3: External Dependency

If blocked by external factor:

```json
{
  "status": "blocked",
  "completion": {
    "status": "blocked",
    "summary": ["External dependency unavailable: <description>"],
    "forFutureTasks": ["Retry when <dependency> is available"]
  }
}
```

---

## ⚠️ IMPORTANT

### If You Can Fix It:
- ✅ Fix the issue
- ✅ Verify pre-condition passes
- ✅ Change status to "in_progress"
- ✅ Continue execution

### If You Cannot Fix It:
- ❌ DO NOT proceed with implementation
- ❌ DO NOT mark as completed
- ✅ Leave status as "blocked"
- ✅ Document clearly why

---

## 📋 COMMON PRE-CONDITION FAILURES

| Failure | Likely Cause | Action |
|---------|--------------|--------|
| "File not found" | Wrong path in BLUEPRINT | Verify correct path |
| "Method not found" | Signature changed | Check current code |
| "Command failed" | Missing tool | Install tool or skip |
| "Permission denied" | Access issue | Check permissions |
| "Connection refused" | Service down | Retry later |

---

## ✅ SUCCESS CHECKLIST

To unblock:
- [ ] Identified why pre-condition failed
- [ ] Fixed the issue (if possible)
- [ ] Re-ran pre-condition check
- [ ] Pre-condition now passes
- [ ] Changed status from "blocked" to "in_progress"

**If cannot fix:**
- [ ] Documented the blocking reason clearly
- [ ] Left status as "blocked"
- [ ] Added to forFutureTasks what needs to change

**Either way, the situation is clear! ✓**
