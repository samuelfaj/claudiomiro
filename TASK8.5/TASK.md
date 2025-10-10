@dependencies [TASK8.1, TASK8.2, TASK8.3, TASK8.4]

<!-- DEPENDENCY REASONING -->
## Dependency Analysis
- **Dependencies:** TASK8.1, TASK8.2, TASK8.3, TASK8.4
- **Reasoning:** Requires all service files to be converted before creating the service index
- **Assumptions:** All service files follow consistent naming and export patterns
- **Blocks:** TASK9 (CLI conversion depends on service imports)
- **Parallel with:** TASK7.6 (step import updates)
- **Risks:** Inconsistent service exports could break the index file

# Subtask: Service Index and Integration

## Summary
Create service index file and update imports across the codebase to integrate all converted TypeScript services.

## Files to Create/Update
- src/services/index.ts (new)
- Update imports in dependent files (steps, cli)

## Interfaces / Contracts
- Service exports, type re-exports, module declarations

## Acceptance Criteria
- [ ] Service index file created with proper TypeScript exports
- [ ] All dependent files updated to use TypeScript imports
- [ ] Integration tests pass
- [ ] Code builds cleanly
- [ ] Type safety maintained across service boundaries