@dependencies [TASK4]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK4
- **Reasoning:** Requires TypeScript tooling to be installed before conversion
- **Assumptions:** Prompt reader and file manager files exist
- **Blocks:** TASK8.5 (service index creation)
- **Parallel with:** TASK5, TASK6, TASK7.1, TASK7.2, TASK7.3, TASK7.4, TASK8.1, TASK8.2, TASK8.3
- **Risks:** File operations and prompt reading may have complex type requirements

# Subtask: Convert Core Services to TypeScript

## Summary
Convert core utility services (Prompt Reader, File Manager) from JavaScript to TypeScript using static classes and proper type definitions.

## Files to Convert
- src/services/prompt-reader.js
- src/services/file-manager.js

## Interfaces / Contracts
- FileManagerInterface, PromptReaderInterface, FileOperationResult

## Acceptance Criteria
- [ ] Both core service files converted to TypeScript with proper extensions
- [ ] Proper type definitions and interfaces added
- [ ] Static classes implemented where appropriate
- [ ] Type safety maintained for file operations and prompt reading
- [ ] Comprehensive tests added for each service
- [ ] Code follows clean code principles