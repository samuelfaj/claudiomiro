# Step5: SIMPLIFIED Strategy Mode

## SITUATION

You are now in **SIMPLIFIED STRATEGY MODE**. Previous attempts with the ORIGINAL strategy failed repeatedly.

**Strategy History:** ORIGINAL (failed) -> SIMPLIFIED (current)

**What this means:** Focus ONLY on CORE functionality. Skip ALL non-essential requirements.

---

## SIMPLIFIED STRATEGY RULES

### What CHANGES:

1. **Reduced Scope**
   - Implement ONLY the primary function/feature
   - Skip secondary features, nice-to-haves, edge cases
   - Focus on the "happy path" only

2. **Deferred Quality**
   - Skip lint/formatting fixes (defer to later)
   - Skip comprehensive error handling (basic only)
   - Skip performance optimizations
   - Skip documentation updates

3. **Minimal Testing**
   - Create basic tests only (1-2 per function)
   - Skip edge case tests
   - Skip integration tests
   - Focus on: "does the main function work?"

### What STAYS THE SAME:

1. **Core Requirements**
   - The PRIMARY function MUST work
   - Basic input validation (prevent crashes)
   - Must not break existing functionality

2. **Artifact Tracking**
   - Still track all files in execution.json
   - Still mark phases as completed
   - Still validate success criteria (simplified)

---

## ACTION PLAN

### Step 1: Identify CORE vs NON-CORE

Read BLUEPRINT.md and categorize:

**CORE (MUST DO):**
- Primary feature/function requested
- Files that MUST be created/modified
- Basic tests proving it works

**NON-CORE (SKIP FOR NOW):**
- Edge cases
- Error handling beyond basics
- Lint/format compliance
- Documentation
- Performance optimization
- Secondary features

### Step 2: Implement CORE Only

Focus execution on:
1. Create/modify the minimum files needed
2. Implement the primary function
3. Add 1-2 basic tests
4. Verify it works (basic happy path)

### Step 3: Mark DEFERRED Items

In execution.json, add deferred items:

```json
{
  "deferredItems": [
    { "item": "Lint compliance", "reason": "Deferred to simplified strategy" },
    { "item": "Edge case handling", "reason": "Deferred to simplified strategy" }
  ]
}
```

### Step 4: Complete with Simplified Criteria

Update execution.json:
- Mark CORE phases as completed
- Mark NON-CORE criteria as "deferred" (not failed)
- Set status to "completed" if core functionality works

---

## SUCCESS CRITERIA (SIMPLIFIED)

**Minimum for completion:**
- [ ] Primary feature implemented and working
- [ ] Basic test proving it works
- [ ] No crashes on valid input
- [ ] Does not break existing functionality

**Explicitly SKIPPED:**
- [ ] Lint/format compliance
- [ ] Edge case handling
- [ ] Performance optimization
- [ ] Comprehensive documentation
- [ ] Full test coverage

---

## EXAMPLE

**ORIGINAL scope (failed):**
- Create data handler with full validation
- Add 10 tests covering all edge cases
- Update documentation
- Add logging
- Fix all lint issues
- Handle all error scenarios

**SIMPLIFIED scope (new):**
- Create data handler (basic validation only)
- Add 1-2 tests for happy path
- SKIP: documentation, logging, lint, edge cases

---

## IMPORTANT

- **DO NOT** try to do everything
- **DO** focus on making the core feature work
- **DO** defer non-essential items
- **DO** document what was deferred
- **DO** complete successfully with reduced scope

If core functionality cannot be achieved even with simplified scope:
→ This indicates fundamental blockers that need escalation to MINIMAL strategy
