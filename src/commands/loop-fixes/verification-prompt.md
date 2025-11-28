# Verification Phase - Check for New Tasks

## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

## 🎯 YOUR ROLE

You are in **VERIFICATION MODE**. Your **ONLY** job is to check if there are **NEW tasks** that match the user's original request.

**Mental Model:**
> "I will thoroughly re-analyze the codebase to find ANY issues that were missed. I am NOT here to fix anything - only to verify if new tasks exist."

---

## 📋 USER'S ORIGINAL REQUEST

{{userPrompt}}

---

## 📂 IMPORTANT FILES

- **BUGS.md**: `{{bugsPath}}` - Contains all issues found and fixed so far
- **CRITICAL_REVIEW_PASSED.md**: `{{passedPath}}` - Create this ONLY if you find NO new issues
- **Working folder**: `{{claudiomiroFolder}}`

---

## 🔍 YOUR TASK

### Step 1: Read BUGS.md

Read `{{bugsPath}}` to understand:
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
- Did I find any issues that are **NOT** already in BUGS.md?
- Are there problems that were missed in previous iterations?
- Are there new edge cases or subtle issues?

---

## 📋 DECISION

### If You Find NEW Issues (not in BUGS.md):

1. **Add them** to BUGS.md as new `- [ ]` items
2. Follow the existing format in BUGS.md
3. **DO NOT** create CRITICAL_REVIEW_PASSED.md
4. **DO NOT** fix anything - just document

**Example addition to BUGS.md:**
```markdown
### NEW Issues Found (Verification)

- [ ] [BLOCKER] Missing validation in payment handler - File: src/handlers/payment.js:23
  - Why: No input validation before processing payment
  - Fix: Add validation for amount and currency fields
```

### If You Find NO New Issues:

1. Create the file: `{{passedPath}}`
2. Use this exact content:

```markdown
# Critical Review Passed

**Verification Date**: [YYYY-MM-DD HH:MM:SS]
**User Request**: {{userPrompt}}

## Result

✅ **No new tasks found.**

All issues matching the user's request have been identified and addressed in previous iterations.

## Verification Summary

- Total issues in BUGS.md: [count]
- Completed issues: [count]
- Areas re-analyzed: [list areas you checked]

## Conclusion

The codebase has been thoroughly analyzed. No additional issues matching the user's request were found.
```

---

## ⚠️ CRITICAL RULES

### DO:
- ✅ Read BUGS.md first to know what was already found
- ✅ Analyze the codebase thoroughly
- ✅ Add new issues to BUGS.md if you find them
- ✅ Create CRITICAL_REVIEW_PASSED.md if you find NO new issues

### DO NOT:
- ❌ Fix any issues (this is verification only)
- ❌ Create CRITICAL_REVIEW_OVERVIEW.md (that's for the main loop)
- ❌ Re-add issues that are already in BUGS.md
- ❌ Create CRITICAL_REVIEW_PASSED.md if you found new issues
- ❌ Skip the analysis - be thorough!

---

## 🎯 OUTPUT

Your output must be ONE of:

1. **New issues found** → Update BUGS.md with new `- [ ]` items. Do NOT create any other file.

2. **No new issues** → Create `{{passedPath}}` with the template above.

---

## 🧠 REMEMBER

1. You are ONLY verifying - not fixing
2. Focus ONLY on the user's original request
3. Be thorough - this is the final check before completion
4. If in doubt, add the issue to BUGS.md (better safe than sorry)
5. Only create CRITICAL_REVIEW_PASSED.md if you're confident nothing was missed

---

**Start your verification analysis now. Be thorough! 🔍**
