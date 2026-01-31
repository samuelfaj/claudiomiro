# Step5: MINIMAL Strategy Mode

## SITUATION

You are now in **MINIMAL STRATEGY MODE**. Both ORIGINAL and SIMPLIFIED strategies failed.

**Strategy History:** ORIGINAL (failed) -> SIMPLIFIED (failed) -> MINIMAL (current)

**What this means:** Implement the ABSOLUTE MINIMUM viable solution. This is the last resort before task splitting.

---

## MINIMAL STRATEGY RULES

### CRITICAL: Do the BARE MINIMUM

1. **ONE Feature Only**
   - Implement ONLY the single most important function
   - Skip ALL secondary functionality
   - If task has 5 features, implement 1

2. **Stub Everything Else**
   - Other functions: stub with `// TODO: Implement later`
   - Other tests: skip entirely
   - Other files: don't touch unless absolutely necessary

3. **No Quality Requirements**
   - NO lint compliance
   - NO error handling (let it crash)
   - NO documentation
   - NO optimization
   - NO edge cases

4. **Block Non-Essential Criteria**
   - Mark non-essential criteria as "blocked" with reason
   - Focus ONLY on the ONE criterion that proves basic functionality

---

## ACTION PLAN

### Step 1: Identify THE ONE THING

Read BLUEPRINT.md and identify:
- What is the SINGLE most important function?
- What is the MINIMUM that would count as "progress"?
- What can be completely ignored?

**Example:**
- Task: "Create user authentication system"
- MINIMAL: "Create login function that returns true/false"
- SKIP: Registration, password reset, tokens, sessions, etc.

### Step 2: Implement THE ONE THING

1. Create/modify the MINIMUM files needed
2. Implement the SINGLE most important function
3. Add ONE test that proves it exists
4. Done.

### Step 3: Block All Other Criteria

In execution.json, mark criteria as blocked:

```json
{
  "successCriteria": [
    {
      "criterion": "Login function works",
      "passed": true,
      "validation": "Login returns true for valid credentials"
    },
    {
      "criterion": "Password reset works",
      "passed": false,
      "blocked": true,
      "blockedReason": "Deferred - MINIMAL strategy: focus on core login only",
      "workaround": "Manual password reset via database"
    }
  ]
}
```

### Step 4: Document Minimal Completion

Add to execution.json:

```json
{
  "minimalCompletion": {
    "enabledAt": "ISO_DATE",
    "reason": "Previous strategies failed",
    "implemented": "Login function basic implementation",
    "deferred": [
      "Registration",
      "Password reset",
      "Token management",
      "Full test coverage"
    ]
  }
}
```

---

## SUCCESS CRITERIA (MINIMAL)

**Minimum for completion (ONE requirement):**
- [ ] The ONE most important feature exists and doesn't crash

**Everything else:** BLOCKED with documentation

---

## BLOCKING CRITERIA

When blocking criteria, use this format:

```json
{
  "criterion": "[Original criterion]",
  "passed": false,
  "blocked": true,
  "blockedReason": "MINIMAL strategy: [specific reason]",
  "workaround": "[Manual workaround if any]",
  "severity": "deferred"
}
```

**Acceptable blocking reasons:**
- "MINIMAL strategy: Not in core scope"
- "MINIMAL strategy: Requires additional dependencies"
- "MINIMAL strategy: Complex feature deferred for split"
- "MINIMAL strategy: Secondary functionality"

---

## EXAMPLE

**ORIGINAL scope (failed):**
```
- Create complete authentication system
- User registration with email verification
- Login with password hashing
- Password reset flow
- JWT token management
- Session handling
- 15 test cases
- Full documentation
```

**SIMPLIFIED scope (failed):**
```
- Create login and registration
- Basic password hashing
- 5 test cases
```

**MINIMAL scope (current):**
```
- Create login function that returns boolean
- ONE test that calls login
- Everything else: BLOCKED
```

---

## IMPORTANT

- **This is the LAST RESORT before splitting**
- If MINIMAL fails, the task MUST be split into subtasks
- DO NOT try to do more than THE ONE THING
- DO NOT feel bad about blocking criteria - this is expected
- DOCUMENT everything that was blocked

**Goal:** Demonstrate ANY progress, however small, to prove the task is feasible.

If even MINIMAL cannot be achieved:
→ Task has fundamental blockers
→ Recommend SPLIT strategy with detailed split points
