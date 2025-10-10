@dependencies []

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** None
- **Reasoning:** Independent file deletion operation. No conflicts with other tasks as it only removes test files.
- **Assumptions:** Test files exist in standard locations (test/, tests/, __tests__/, *.test.js, *.spec.js)
- **Blocks:** TASK3 (source file listing should be done after test removal for accurate inventory)
- **Parallel with:** TASK1, TASK4
- **Risks:** Could accidentally delete non-test files if patterns are too broad

# Task: Remove All Existing Tests

## Summary
Remove all existing test files from the repository to start fresh with TypeScript-compatible tests.

## Complexity
Low

## Dependencies
TASK1 (Git branch)

## Steps
1. Find and delete all test files in the repository
2. Verify no test files remain

## Acceptance Criteria
- [ ] All test files removed from repository
- [ ] No test-related files remain

## Reasoning Trace
Removing existing tests ensures we start with a clean slate for TypeScript migration and prevents conflicts between old JavaScript tests and new TypeScript tests.