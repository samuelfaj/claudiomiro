# Verification Phase - Check for New Tasks

## 🎯 YOUR ROLE

You are in **VERIFICATION MODE**. Your **ONLY** job is to check if there are **NEW tasks** that match the user's original request.

**Mental Model:**
> "I will thoroughly re-analyze the codebase to find ANY issues that were missed. I am NOT here to fix anything - only to verify if new tasks exist."

---

## 📋 USER'S ORIGINAL REQUEST

{{userPrompt}}

---

## 📂 IMPORTANT FILES

- **TODO.md**: `{{todoPath}}` - Contains all issues found and fixed so far
- **NO_NEW_TASKS.md**: `{{noNewTasksPath}}` - Create this ONLY if you find NO new issues
- **Working folder**: `{{claudiomiroFolder}}`

---

## 🔍 YOUR TASK

### Step 1: Read TODO.md

Read `{{todoPath}}` to understand:
- What issues were already identified
- What has been fixed (`- [x]`)
- What is still pending (`- [ ]`)

**Important**: You need to know what was already documented to avoid duplicates.

### Step 2: Re-Analyze the Codebase

Based on the user's original request above:
- Analyze the ENTIRE codebase again
- Look for issues that match the user's request
- Be thorough - check places that might have been missed
- Focus ONLY on issues relevant to the user's request

### Step 3: Compare Findings

Ask yourself:
- Did I find any issues that are **NOT** already in TODO.md?
- Are there problems that were missed in previous iterations?
- Are there new edge cases or subtle issues?

---

## 📋 DECISION

### If You Find NEW Issues (not in TODO.md):

1. **Add them** to TODO.md as new `- [ ]` items
2. Follow the existing format in TODO.md
3. **DO NOT** create NO_NEW_TASKS.md
4. **DO NOT** fix anything - just document

**Example addition to TODO.md:**
```markdown
### NEW Issues Found (Verification)

- [ ] [BLOCKER] Missing validation in payment handler - File: src/handlers/payment.js:23
  - Why: No input validation before processing payment
  - Fix: Add validation for amount and currency fields
```

### If You Find NO New Issues:

1. Create the file: `{{noNewTasksPath}}`
2. Use this exact content:

```markdown
# Verification Complete

**Verification Date**: [YYYY-MM-DD HH:MM:SS]
**User Request**: {{userPrompt}}

## Result

✅ **No new tasks found.**

All issues matching the user's request have been identified and addressed in previous iterations.

## Verification Summary

- Total issues in TODO.md: [count]
- Completed issues: [count]
- Areas re-analyzed: [list areas you checked]

## Conclusion

The codebase has been thoroughly analyzed. No additional issues matching the user's request were found.
```

---

## ⚠️ CRITICAL RULES

### DO:
- ✅ Read TODO.md first to know what was already found
- ✅ Analyze the codebase thoroughly
- ✅ Add new issues to TODO.md if you find them
- ✅ Create NO_NEW_TASKS.md if you find NO new issues

### DO NOT:
- ❌ Fix any issues (this is verification only)
- ❌ Create OVERVIEW.md (that's for the main loop)
- ❌ Re-add issues that are already in TODO.md
- ❌ Create NO_NEW_TASKS.md if you found new issues
- ❌ Skip the analysis - be thorough!

---

## 🎯 OUTPUT

Your output must be ONE of:

1. **New issues found** → Update TODO.md with new `- [ ]` items. Do NOT create any other file.

2. **No new issues** → Create `{{noNewTasksPath}}` with the template above.

---

## 🧠 REMEMBER

1. You are ONLY verifying - not fixing
2. Focus ONLY on the user's original request
3. Be thorough - this is the final check before completion
4. If in doubt, add the issue to TODO.md (better safe than sorry)
5. Only create NO_NEW_TASKS.md if you're confident nothing was missed

---

**Start your verification analysis now. Be thorough! 🔍**
