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

### Step 2: Re-Analyze AI_PROMPT.md

Perform a FRESH analysis checking:

**Context Completeness:**
- [ ] All tech stack components documented
- [ ] Project structure explained
- [ ] Existing patterns referenced with file:line
- [ ] Integration points identified
- [ ] Related code examples provided

**Requirement Coverage:**
- [ ] EVERY requirement from INITIAL_PROMPT.md is in AI_PROMPT.md
- [ ] All CLARIFICATION_ANSWERS.json responses are incorporated
- [ ] Acceptance criteria are measurable
- [ ] Edge cases are addressed
- [ ] Error scenarios are covered

**Clarity:**
- [ ] No ambiguous terms or phrases
- [ ] Technical terms are precise
- [ ] File references use file:line format
- [ ] Can be split into independent tasks

### Step 3: Compare Findings

Ask yourself:
- Did I find any gaps that are **NOT** already in the TODO file?
- Are there requirements from INITIAL_PROMPT.md still missing?
- Are there CLARIFICATION_ANSWERS.json responses not incorporated?
- Are there any ambiguities that were missed?

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
