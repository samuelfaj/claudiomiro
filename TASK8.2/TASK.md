@dependencies [TASK4]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK4
- **Reasoning:** Requires TypeScript tooling to be installed before conversion
- **Assumptions:** All AI executor files exist and follow consistent patterns
- **Blocks:** TASK8.5 (service index creation)
- **Parallel with:** TASK5, TASK6, TASK7.1, TASK7.2, TASK7.3, TASK7.4, TASK8.1, TASK8.3, TASK8.4
- **Risks:** Process spawning and stream handling may have complex type requirements

# Subtask: Convert AI Executors to TypeScript

## Summary
Convert all AI executor services (Claude, Codex, DeepSeek, Gemini) from JavaScript to TypeScript using static classes and proper type definitions.

## Files to Convert
- src/services/claude-executor.js
- src/services/codex-executor.js
- src/services/deep-seek-executor.js
- src/services/gemini-executor.js

## Interfaces / Contracts
- AIExecutorInterface, ExecutorConfig, ProcessResult, StreamHandler

## Acceptance Criteria
- [ ] All 4 executor files converted to TypeScript with proper extensions
- [ ] Proper type definitions and interfaces added
- [ ] Static classes implemented where appropriate
- [ ] Type safety maintained for process spawning and stream handling
- [ ] Comprehensive tests added for each executor
- [ ] Code follows clean code principles