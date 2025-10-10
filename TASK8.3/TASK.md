@dependencies [TASK4]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK4
- **Reasoning:** Requires TypeScript tooling to be installed before conversion
- **Assumptions:** All AI logger files exist and follow consistent patterns
- **Blocks:** TASK8.5 (service index creation)
- **Parallel with:** TASK5, TASK6, TASK7.1, TASK7.2, TASK7.3, TASK7.4, TASK8.1, TASK8.2, TASK8.4
- **Risks:** Message parsing and event formatting may have complex type requirements

# Subtask: Convert AI Loggers and Message Processors to TypeScript

## Summary
Convert all AI logger services (Claude, Codex, DeepSeek, Gemini) from JavaScript to TypeScript using static classes and proper type definitions.

## Files to Convert
- src/services/claude-logger.js
- src/services/codex-logger.js
- src/services/deep-seek-logger.js
- src/services/gemini-logger.js

## Interfaces / Contracts
- LoggerInterface, MessageProcessor, EventFormatter, LogItem

## Acceptance Criteria
- [ ] All 4 logger files converted to TypeScript with proper extensions
- [ ] Proper type definitions and interfaces added
- [ ] Static classes implemented where appropriate
- [ ] Type safety maintained for message parsing and event formatting
- [ ] Comprehensive tests added for each logger
- [ ] Code follows clean code principles