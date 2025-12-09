# Finishing Touches Inference

You have just implemented code for a task. Analyze what was done and infer
**obvious consequences that may have been forgotten**.

## Context

**Task:** {{TASK_DESCRIPTION}}

**Files modified:** {{MODIFIED_FILES}}

**Generated code:**
```
{{GENERATED_CODE}}
```

## Your Mission

Identify finishing touches that an experienced developer would expect.
Focus on **implicit requirements** that are obvious to humans but may be forgotten by AI.

### 1. UI State (Frontend)

| Action | Expected Consequence |
|--------|---------------------|
| CREATE | Table/list should reload automatically |
| DELETE | Redirect to list page, confirm before action |
| UPDATE | UI should reflect change without manual refresh |
| ASYNC | Show loading spinner during operation |
| SUCCESS/ERROR | Show toast notification with feedback |

### 2. Data Sync

| Action | Expected Consequence |
|--------|---------------------|
| Mutation | Invalidate related cache/queries |
| Related entity change | Update store/context |
| Paginated list mutation | Refetch or optimistic update |
| Batch operation | Handle partial failures |

### 3. State Constraints

| Scenario | Expected Validation |
|----------|---------------------|
| Sign out | Only if logged in |
| Delete parent | Check for children first |
| Update read-only | Block the operation |
| Concurrent edit | Handle conflicts |

### 4. Cleanup

| Resource | Expected Cleanup |
|----------|------------------|
| Open connection | Close on unmount/completion |
| Timer/interval | Cancel on unmount |
| Event listener | Remove on unmount |
| Temporary data | Clear after use |

### 5. Error Handling

| Scenario | Expected Handling |
|----------|-------------------|
| Network failure | Show retry option |
| Validation error | Show field-level feedback |
| Permission denied | Redirect or show message |
| Not found | Show 404 or redirect |

## Analysis Process

1. **Read the code** - Understand what was implemented
2. **Identify actions** - What CRUD/state operations exist?
3. **Check consequences** - For each action, is the obvious consequence implemented?
4. **List gaps** - What's missing?

## Output Format

Return a JSON object with the following structure:

```json
{
  "analysis": {
    "actionsFound": ["createRecord", "deleteRecord"],
    "codePatterns": ["uses React Query", "has form submission"]
  },
  "finishingTouches": [
    {
      "action": "createRecord()",
      "inference": "After creating record, reload the table listing",
      "category": "ui_state",
      "confidence": 0.95,
      "reason": "Form submits but no cache invalidation found",
      "suggestion": {
        "description": "Add cache invalidation after mutation",
        "code": "queryClient.invalidateQueries(['records'])",
        "file": "src/components/RecordForm.tsx",
        "afterLine": 45
      }
    },
    {
      "action": "deleteRecord()",
      "inference": "After deleting, redirect to list page",
      "category": "navigation",
      "confidence": 0.85,
      "reason": "Delete mutation exists but no navigation after success",
      "suggestion": {
        "description": "Add redirect after successful deletion",
        "code": "router.push('/records')",
        "file": "src/components/RecordDetail.tsx",
        "afterLine": 78
      }
    }
  ],
  "summary": {
    "total": 2,
    "highConfidence": 1,
    "categories": {
      "ui_state": 1,
      "navigation": 1,
      "data_sync": 0,
      "validation": 0,
      "cleanup": 0
    }
  }
}
```

## Confidence Levels

- **0.9-1.0 (HIGH)**: Obvious gap, should definitely be fixed
- **0.7-0.89 (MEDIUM)**: Likely gap, recommend review
- **0.5-0.69 (LOW)**: Possible gap, depends on context
- **< 0.5**: Skip, too uncertain

## Categories

| Category | Code | Description |
|----------|------|-------------|
| UI State | `ui_state` | Loading, toasts, badges, spinners |
| Navigation | `navigation` | Redirects, breadcrumbs, back button |
| Data Sync | `data_sync` | Cache, queries, store updates |
| Validation | `validation` | State constraints, permissions |
| Cleanup | `cleanup` | Resources, listeners, timers |
| Error Handling | `error_handling` | Retries, fallbacks, messages |

## Rules

1. **Be specific** - Point to exact files and lines
2. **Be actionable** - Provide code suggestions when possible
3. **Be confident** - Only flag things you're reasonably sure about
4. **Be concise** - Max 5 finishing touches per task
5. **Be practical** - Focus on user-facing consequences

## DO NOT

- Flag things that are clearly out of scope for this task
- Suggest major architectural changes
- Flag optional enhancements as required
- Include low-confidence items (< 0.5)
- Suggest changes to files not modified by this task
