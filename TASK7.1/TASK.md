@dependencies [TASK4]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK4
- **Reasoning:** Requires TypeScript tooling to be installed before conversion
- **Assumptions:** step0.js file exists and follows standard patterns
- **Blocks:** TASK7.5, TASK7.6 (integration tasks)
- **Parallel with:** TASK5, TASK6, TASK7.2, TASK7.3, TASK7.4, TASK8.1, TASK8.2, TASK8.3, TASK8.4
- **Risks:** Complex step logic may require careful type definitions for parameters and return types

# Task: Convert step0.js to TypeScript

## Summary
Convert step0.js to TypeScript using static class pattern and proper type definitions.

## Scope
- Convert src/steps/step0.js to src/steps/step0.ts
- Implement Step0 static class with execute method
- Add comprehensive type definitions and interfaces
- Convert test file to TypeScript
- Ensure type safety and clean code practices

## Acceptance Criteria
- [ ] step0.js converted to step0.ts with proper extension
- [ ] Step0 static class implemented with execute method
- [ ] Proper type definitions for parameters: sameBranch?: boolean, promptText?: string | null, mode?: 'auto' | 'hard'
- [ ] Interface for step execution result
- [ ] Import types from dependencies (fs, path, logger, executeClaude, etc.)
- [ ] step0.test.js converted to step0.test.ts
- [ ] Unit tests for static class methods and parameter validation
- [ ] Type safety tests for mode parameter validation
- [ ] File operations and path resolution tests
- [ ] Prompt validation and error handling tests
- [ ] Mock integration tests for Claude execution
- [ ] Code follows clean code principles
- [ ] All existing functionality preserved