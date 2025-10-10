@dependencies [TASK4]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK4
- **Reasoning:** Requires TypeScript tooling to be installed before conversion
- **Assumptions:** step1.js file exists and follows standard patterns
- **Blocks:** TASK7.5, TASK7.6 (integration tasks)
- **Parallel with:** TASK5, TASK6, TASK7.1, TASK7.3, TASK7.4, TASK8.1, TASK8.2, TASK8.3, TASK8.4
- **Risks:** Task dependency analysis logic may have complex type requirements

# Task: Convert step1.js to TypeScript

## Summary
Convert step1.js to TypeScript using static class pattern and proper type definitions.

## Scope
- Convert src/steps/step1.js to src/steps/step1.ts
- Implement Step1 static class with execute method
- Add comprehensive type definitions and interfaces
- Convert test file to TypeScript
- Ensure type safety and clean code practices

## Acceptance Criteria
- [ ] step1.js converted to step1.ts with proper extension
- [ ] Step1 static class implemented with execute method
- [ ] Proper type definitions for mode parameter: mode?: 'auto' | 'hard'
- [ ] Interface for task analysis result
- [ ] Type definitions for task content structure
- [ ] Import types from dependencies
- [ ] step1.test.js converted to step1.test.ts
- [ ] Unit tests for static class methods and mode handling
- [ ] Type safety tests for file system operations
- [ ] Task dependency analysis tests
- [ ] Prompt generation tests for both modes
- [ ] Error handling and edge case tests
- [ ] Code follows clean code principles
- [ ] All existing functionality preserved