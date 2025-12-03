# Verification Phase - Check for NEW Refinement Gaps

## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q)

---

## YOUR ROLE

You are in **VERIFICATION MODE**. Your **ONLY** job is to check if there are **NEW gaps** in AI_PROMPT.md that were missed during refinement.

**Mental Model:**
> "I will thoroughly re-analyze AI_PROMPT.md against the original requirements to find ANY gaps that were missed. I am NOT here to process anything - only to verify if new gaps exist."

---

## CONTEXT FILES

- `{{claudiomiroFolder}}/AI_PROMPT.md` - The refined AI_PROMPT
- `{{claudiomiroFolder}}/INITIAL_PROMPT.md` - Original user request (source of truth)
- `{{claudiomiroFolder}}/CLARIFICATION_ANSWERS.json` - User's answers (if exists)

---

## IMPORTANT FILES

- **Refinement TODO**: `{{todoPath}}` - Contains all refinements found and processed
- **Verification file**: `{{passedPath}}` - Create this ONLY if you find NO new gaps
- **Working folder**: `{{claudiomiroFolder}}`

---

## YOUR TASK

### Step 1: Read Refinement TODO File

Read `{{todoPath}}` to understand:
- What gaps were already identified
- What has been processed (`- [x]`)
- What is still pending (`- [ ]`)

**Important**: Know what was already documented to avoid duplicates.

### Step 2: Multi-Path Verification (Self-Consistency)

**CRITICAL:** To ensure thorough verification, analyze AI_PROMPT.md using THREE different approaches. This prevents single-perspective blind spots.

---

#### 🔍 APPROACH A: Bottom-Up Requirement Tracing

**Method:** Start from INITIAL_PROMPT.md, trace each requirement to AI_PROMPT.md

For EACH line/bullet in INITIAL_PROMPT.md:

| Line | Requirement (Quote) | Found in AI_PROMPT.md? | Location | Status |
|------|---------------------|------------------------|----------|--------|
| 1 | "[exact text]" | YES/NO | § Section, line X | ✅/❌ |
| 2 | "[exact text]" | YES/NO | § Section, line Y | ✅/❌ |

**Repeat for CLARIFICATION_ANSWERS.json:**

| Question | Answer | Incorporated in AI_PROMPT.md? | Where? |
|----------|--------|-------------------------------|--------|
| [Question 1] | [Answer] | YES/NO | § Section |

**Gap Detection:**
- If Status = ❌ → **NEW GAP FOUND (Approach A)**
- If Answer not incorporated → **NEW GAP FOUND (Approach A)**

---

#### 🔍 APPROACH B: Top-Down Context Completeness

**Method:** Start from AI_PROMPT.md sections, verify each has concrete content

| Section | Has Content? | Has file:line refs? | Sufficient Detail? | Status |
|---------|--------------|---------------------|-------------------|--------|
| § Purpose | YES/NO | YES/NO | YES/NO | ✅/❌ |
| § Environment | YES/NO | YES/NO | YES/NO | ✅/❌ |
| § Related Code | YES/NO | YES/NO | YES/NO | ✅/❌ |
| § Acceptance Criteria | YES/NO | N/A | YES/NO | ✅/❌ |
| § Implementation Guidance | YES/NO | YES/NO | YES/NO | ✅/❌ |
| § Reasoning Boundaries | YES/NO | N/A | YES/NO | ✅/❌ |

**Context Depth Check:**
- [ ] Tech stack has versions? (e.g., "Node.js 18+", not just "Node.js")
- [ ] Project structure has directory purposes? (e.g., "src/routes/ - Express route handlers")
- [ ] Patterns have line ranges? (e.g., "src/services/userService.ts:20-45")
- [ ] Integration points have concrete file references?

**Gap Detection:**
- If Status = ❌ → **NEW GAP FOUND (Approach B)**
- If any depth check fails → **NEW GAP FOUND (Approach B)**

---

#### 🔍 APPROACH C: Acceptance Criteria Audit

**Method:** Verify each acceptance criterion is specific, testable, and complete

| Criterion | Specific? | Testable? | Edge Case? | Error Case? | Status |
|-----------|-----------|-----------|------------|-------------|--------|
| "[Criterion 1]" | YES/NO | YES/NO | YES/NO | YES/NO | ✅/❌ |
| "[Criterion 2]" | YES/NO | YES/NO | YES/NO | YES/NO | ✅/❌ |

**Specificity Check:**
- ✅ "Returns 400 for email without @ character"
- ❌ "Validates email format" (too vague)

**Testability Check:**
- ✅ "Response time < 500ms for 95th percentile"
- ❌ "Should be fast" (not measurable)

**Gap Detection:**
- If Status = ❌ → **NEW GAP FOUND (Approach C)**
- If criterion is vague → **NEW GAP FOUND (Approach C)**

---

### Step 3: Cross-Validate Findings

**Consolidate gaps found by each approach:**

| Gap Description | Found by A? | Found by B? | Found by C? | Confidence |
|-----------------|-------------|-------------|-------------|------------|
| [Gap 1] | ✅ | ✅ | ❌ | HIGH |
| [Gap 2] | ✅ | ❌ | ❌ | MEDIUM |
| [Gap 3] | ❌ | ❌ | ✅ | LOW - Verify! |

**Confidence Levels:**
- **HIGH (Found by 2-3 approaches):** DEFINITELY a gap → Add to TODO
- **MEDIUM (Found by 1 approach, verifiable):** LIKELY a gap → Add to TODO
- **LOW (Found by 1 approach, uncertain):** POSSIBLE false positive → Verify before adding

**For LOW confidence gaps:**
1. Re-read the source files (INITIAL_PROMPT.md, AI_PROMPT.md)
2. Verify the gap is real (not just different wording)
3. If still uncertain → Add with "LOW confidence" note

---

### Step 4: Final Gap List

**Compile all verified gaps (not already in TODO):**

```markdown
## New Gaps Found (Verification Phase)

### HIGH Confidence (Found by multiple approaches)
- [ ] [Category] Gap description
  - **Detected by:** Approach A + Approach B
  - **Evidence:** [specific quote or reference]
  - **Location in AI_PROMPT.md:** Missing from § Section
  - **Confidence:** HIGH

### MEDIUM Confidence (Found by single approach, verified)
- [ ] [Category] Gap description
  - **Detected by:** Approach A only
  - **Evidence:** [specific quote or reference]
  - **Verification:** Confirmed by re-reading source
  - **Confidence:** MEDIUM

### LOW Confidence (Review before adding)
- [ ] [Category] Possible gap
  - **Detected by:** Approach C only
  - **Note:** May be covered differently, needs review
  - **Confidence:** LOW
```

**Action:**
- HIGH/MEDIUM → Add to TODO file
- LOW → Add with note, or investigate further before adding

---

## DECISION

### If You Find NEW Gaps (not in TODO file):

1. **Add them** to the TODO file as new `- [ ]` items
2. Follow the existing format in the TODO file
3. **DO NOT** create the verification file
4. **DO NOT** process anything - just document

**Example addition to TODO file:**
```markdown
### NEW Gaps Found (Verification)

- [ ] [COVERAGE] Missing error handling requirement
  - Evidence: INITIAL_PROMPT mentions "handle network errors" but AI_PROMPT lacks this
  - Action: Add network error handling requirements section

- [ ] [CONTEXT] Missing API client pattern reference
  - Evidence: No example of existing API client usage
  - Action: Find and reference existing API client in codebase
```

### If You Find NO New Gaps:

1. Create the file: `{{passedPath}}`
2. Use this content:

```markdown
# AI_PROMPT.md Refinement Passed

**Verification Date**: [YYYY-MM-DD HH:MM:SS]

## Result

All refinement checks passed. The AI_PROMPT.md is ready for task decomposition.

## Verification Summary

- Total refinements in TODO: [count]
- Completed refinements: [count]
- Areas re-analyzed:
  - Context completeness
  - Requirement coverage
  - Clarity and precision

## Checks Performed

- [x] All INITIAL_PROMPT.md requirements are in AI_PROMPT.md
- [x] All CLARIFICATION_ANSWERS.json responses are incorporated
- [x] No ambiguous terms remain
- [x] Tech stack and patterns are documented
- [x] File references are precise (file:line format)
- [x] Ready for task decomposition

## Conclusion

The AI_PROMPT.md has been thoroughly refined and verified. No additional gaps were found.
```

---

## CRITICAL RULES

### DO:
- Read the TODO file first to know what was already found
- Read AI_PROMPT.md, INITIAL_PROMPT.md, and CLARIFICATION_ANSWERS.json
- Analyze thoroughly against all three verification categories
- Add new gaps to the TODO file if you find them
- Create the verification file if you find NO new gaps

### DO NOT:
- Process any gaps (this is verification only)
- Create the overview file (that's for the refinement loop)
- Re-add gaps that are already in the TODO file
- Create the verification file if you found new gaps
- Skip the analysis - be thorough!

---

## OUTPUT

Your output must be ONE of:

1. **New gaps found** → Update the TODO file with new `- [ ]` items. Do NOT create any other file.

2. **No new gaps** → Create `{{passedPath}}` with the template above.

---

## REMEMBER

1. You are ONLY verifying - not processing
2. Check INITIAL_PROMPT.md thoroughly - every requirement must be covered
3. Check CLARIFICATION_ANSWERS.json - every answer must be incorporated
4. Be thorough - this is the final check before decomposition
5. If in doubt, add the gap to the TODO file (better safe than sorry)
6. Only create the verification file if you're confident AI_PROMPT.md is complete

---

**Start your verification analysis now. Be thorough!**
