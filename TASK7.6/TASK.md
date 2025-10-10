@dependencies [TASK7.1, TASK7.2, TASK7.3, TASK7.4, TASK7.5]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK7.1, TASK7.2, TASK7.3, TASK7.4, TASK7.5
- **Reasoning:** Requires all step files to be converted AND indexed before updating imports across codebase
- **Assumptions:** Standard import patterns exist across the codebase
- **Blocks:** TASK9 (CLI conversion depends on updated imports)
- **Parallel with:** TASK8.5 (service import updates)
- **Risks:** Import resolution failures if TypeScript paths are incorrect

# Task: Update all step imports across codebase

## Summary
Update all imports of step modules across the codebase to use TypeScript import syntax.

## Scope
- Find all files that import step modules
- Update CommonJS require statements to ES6 import syntax
- Ensure proper TypeScript import paths
- Verify all imports work correctly
- Maintain backward compatibility

## Acceptance Criteria
- [ ] All files that use `require('./steps/stepX')` updated to `import { StepX } from './steps/stepX'`
- [ ] All existing tests pass after import updates
- [ ] Import resolution and type checking works
- [ ] No missing import updates
- [ ] Module resolution issues resolved
- [ ] Code follows clean code principles
- [ ] All existing functionality preserved