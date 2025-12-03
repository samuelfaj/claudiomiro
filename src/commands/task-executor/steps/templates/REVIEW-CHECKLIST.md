# review-checklist.json - Documentation

## Purpose

`review-checklist.json` provides a **real-time, structured list of review questions** for every artifact (file) created or modified during task execution. This file ensures comprehensive code review in Step 6 by capturing specific concerns as they arise during implementation.

## When to Generate

**CRITICAL:** `review-checklist.json` MUST be updated **in real-time** during Step 5 (Task Execution).

- ✅ **Immediately after** creating a new file
- ✅ **Immediately after** modifying an existing file
- ✅ **Before moving to the next implementation step**

**DO NOT** wait until the end of execution to generate the checklist. Questions should be added as implementation progresses.

## Structure

```json
{
  "task": "TASK0",
  "generatedAt": "2025-12-02T23:45:12.000Z",
  "items": [
    {
      "artifact": "path/to/file.ext",
      "type": "created | modified | deleted",
      "questions": [
        {
          "category": "compatibility | completeness | error-handling | edge-cases | data-integrity | security | performance | maintainability | testing | documentation",
          "question": "Specific, actionable review question?",
          "why": "Why this question matters for correctness/safety"
        }
      ]
    }
  ]
}
```

## Fields

### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | string | Yes | Task identifier (e.g., "TASK0", "TASK1") |
| `generatedAt` | string | Yes | ISO 8601 timestamp of generation |
| `items` | array | Yes | Array of checklist items (one per artifact) |

### Item Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `artifact` | string | Yes | Relative path to the file (e.g., "src/handler.ext") |
| `type` | string | Yes | Type of change: "created", "modified", or "deleted" |
| `questions` | array | Yes | Array of review questions for this artifact |

### Question Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | Yes | Question category (see Categories below) |
| `question` | string | Yes | Specific, actionable question for reviewer |
| `why` | string | Yes | Explanation of why this question matters |

## Categories

Use these standardized categories for consistency:

| Category | When to Use | Example Question |
|----------|-------------|------------------|
| **compatibility** | Breaking changes, API contracts | "Does the new method signature match the old one?" |
| **completeness** | Missing functionality, partial implementation | "Does the handler cover all required operations?" |
| **error-handling** | Error cases, exceptions, failures | "Are all error paths properly handled?" |
| **edge-cases** | Boundary conditions, null/empty inputs | "What happens if the input array is empty?" |
| **data-integrity** | Data transformation, validation | "Does the migration preserve all required fields?" |
| **security** | Authentication, authorization, injection | "Is user input sanitized before the query?" |
| **performance** | Efficiency, scalability concerns | "Will this loop scale with 10,000+ records?" |
| **maintainability** | Code clarity, documentation | "Are complex algorithms documented clearly?" |
| **testing** | Test coverage, assertions | "Do tests cover the error scenarios?" |
| **documentation** | Comments, README updates | "Are the new parameters documented?" |

## Best Practices

### Writing Questions

**✅ GOOD Questions (Specific, Actionable):**
- "Does the new `recurringBillingData` query return the same structure as `ledgerLineData`?"
- "Are all paths in the switch statement covered by tests?"
- "What happens if the API returns a 500 error during this call?"

**❌ BAD Questions (Vague, Non-Actionable):**
- "Is this code good?"
- "Does it work correctly?"
- "Should we refactor this?"

### Generating Questions

When adding a checklist item, ask yourself:

1. **What could go wrong** with this change?
2. **What assumptions** did I make?
3. **What edge cases** exist?
4. **What dependencies** could break?
5. **What validation** is needed?

### Number of Questions

- **Simple files (< 50 lines):** 2-3 questions
- **Standard files (50-200 lines):** 3-5 questions
- **Complex files (> 200 lines):** 5-8 questions
- **Critical files (auth, payment, data migration):** 6-10 questions

**Rule:** Better to have more specific questions than too few vague ones.

## Examples

### Example 1: Handler Modification

```json
{
  "artifact": "src/handlers/autopay.ext",
  "type": "modified",
  "questions": [
    {
      "category": "compatibility",
      "question": "Does the new `recurringBillingData` query return the same structure as the old `ledgerLineData` query?",
      "why": "Ensures downstream code expecting specific fields doesn't break"
    },
    {
      "category": "data-integrity",
      "question": "Does the calculation loop aggregate tuition correctly for all billing types?",
      "why": "Prevents incorrect financial calculations"
    },
    {
      "category": "error-handling",
      "question": "What happens if `recurringBillingData` returns an empty array?",
      "why": "Ensures graceful handling of no-data scenarios"
    }
  ]
}
```

### Example 2: New Validator

```json
{
  "artifact": "src/validators/input-validator.ext",
  "type": "created",
  "questions": [
    {
      "category": "completeness",
      "question": "Does the validator check all required fields mentioned in the BLUEPRINT?",
      "why": "Ensures no required field is missed"
    },
    {
      "category": "edge-cases",
      "question": "How does the validator handle null, undefined, empty string, and whitespace-only inputs?",
      "why": "Prevents invalid data from passing validation"
    },
    {
      "category": "error-handling",
      "question": "Do validation errors include the field name and reason for failure?",
      "why": "Makes debugging easier for consumers"
    }
  ]
}
```

### Example 3: Test File

```json
{
  "artifact": "tests/handlers/autopay.test.ext",
  "type": "created",
  "questions": [
    {
      "category": "testing",
      "question": "Do tests cover the success case, error case, and edge case (empty data)?",
      "why": "Ensures comprehensive test coverage"
    },
    {
      "category": "testing",
      "question": "Are all assertions clear about what they're validating?",
      "why": "Makes test failures easy to diagnose"
    },
    {
      "category": "completeness",
      "question": "Are mocks properly configured to simulate real behavior?",
      "why": "Prevents false positives from overly permissive mocks"
    }
  ]
}
```

## Validation Rules

The `validateReviewChecklist()` function enforces:

1. ✅ **File must exist** if artifacts exist
2. ✅ **Valid JSON format**
3. ✅ **All artifacts have checklist entries** (except deleted files)
4. ✅ **Every entry has questions array**
5. ✅ **Questions array is not empty**

**Failure Mode:** If validation fails, Step 5 is **blocked** and must re-execute.

## Integration with Step 5

### In prompt.md (Step 2.4)

```markdown
### Step 2.4: Update Review Checklist (CRITICAL - Real-Time)

**MANDATORY:** For EVERY file you create/modify, immediately add review questions to `review-checklist.json`.

[... detailed instructions ...]
```

### In index.js (Layer 5)

```javascript
// Layer 5: Validate Review Checklist
const { validateReviewChecklist } = require('./validate-review-checklist');
const checklistValidation = await validateReviewChecklist(task, { claudiomiroFolder });

if (!checklistValidation.valid) {
    throw new Error(`Review checklist validation failed: ${checklistValidation.missing.length} artifacts missing checklist entries`);
}
```

## Common Mistakes to Avoid

### ❌ Waiting Until the End

**Wrong:** Generate checklist after all implementation is complete

**Right:** Update checklist immediately after each file change

### ❌ Vague Questions

**Wrong:** "Is this code correct?"

**Right:** "Does the error handler log the stack trace for debugging?"

### ❌ Missing "Why"

**Wrong:** `{ "question": "Does it validate input?" }`

**Right:** `{ "question": "Does it validate input?", "why": "Prevents SQL injection attacks" }`

### ❌ Skipping Deleted Files

**Correct:** Deleted files don't need checklist entries (they're skipped during validation)

### ❌ Wrong Categories

**Wrong:** Using custom categories like "general", "misc", "other"

**Right:** Use only the 10 standard categories listed above

## Quality Checklist

Before completing Step 5, verify:

- [ ] `review-checklist.json` exists
- [ ] JSON is valid (no syntax errors)
- [ ] Every created/modified artifact has a checklist entry
- [ ] Every entry has 2+ questions
- [ ] Questions are specific and actionable
- [ ] Every question has a "why" explanation
- [ ] Categories are from the standard list
- [ ] File paths are correct and relative

## Benefits

1. ✅ **Prevents missed reviews** - All concerns captured during implementation
2. ✅ **Context-rich questions** - Written when details are fresh in mind
3. ✅ **Structured format** - Easy for automated code review in Step 6
4. ✅ **Traceability** - Clear link between artifacts and review concerns
5. ✅ **Quality gates** - Validation blocks completion if checklist incomplete

---

**Version:** 1.0
**Last Updated:** 2025-12-02
**Used By:** Step 5 (Task Execution), Step 6 (Code Review)
