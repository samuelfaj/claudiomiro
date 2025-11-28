## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

## SHELL COMMAND RULE (MANDATORY)

**CRITICAL: ALL shell commands SHOULD be executed via token-optimizer, with exceptions.**

### Default: Use token-optimizer
```bash
# ✅ CORRECT - Use token-optimizer for informational output:
claudiomiro --token-optimizer --command="npm test" --filter="return only failed tests with errors"
claudiomiro --token-optimizer --command="git status" --filter="return only changed files"
claudiomiro --token-optimizer --command="eslint src/" --filter="return only violations with file:line"
```

**Filter suggestions:**
- Tests: `--filter="return only failed tests with error messages"`
- Build: `--filter="return only errors and warnings"`
- Lint: `--filter="return only violations with file:line"`
- Git: `--filter="return only changed files summary"`
- General: `--filter="return only relevant output"`

### EXCEPTION: When NOT to use token-optimizer

**Execute commands DIRECTLY (without token-optimizer) when:**

1. **Deterministic output expected** - You need exact/structured output for programmatic decisions:
   ```bash
   npm pkg get version          # needs exact version string
   git rev-parse HEAD           # needs exact commit hash
   cat package.json | jq '.x'   # needs exact JSON value
   ```

2. **Precise diagnosis needed** - You need complete output for accurate debugging:
   ```bash
   npm test -- --verbose        # investigating specific failure
   ```

3. **Structured parsing** - Output will be parsed programmatically:
   ```bash
   git log --format="%H %s" -n 5
   npm ls --json
   ```

**Rule of thumb:** Use token-optimizer for verbose/diagnostic output.
Skip when you need exact values for decisions.

**Note:** Falls back to original output if CLAUDIOMIRO_LOCAL_LLM not configured.

## RESEARCH PHASE: Deep Context Analysis

You are about to execute the task at: {{todoPath}}

**OBJECTIVE:** Perform a thorough analysis to understand the task deeply before execution.

**CRITICAL:** Before proceeding, read the comprehensive research guide at:
{{researchGuidePath}}

This guide contains the complete methodology for:
- Finding similar implementations to learn from
- Identifying reusable components (don't reinvent the wheel!)
- Understanding codebase conventions
- Mapping integration points
- Discovering test patterns
- Assessing risks

### Your Research Steps:

1. **Read and Understand:**
   - Read {{todoPath}} completely
   - Read {{taskPath}} and {{promptPath}} if they exist
   - Understand the acceptance criteria and scope

2. **Find Similar Components (LEARN FROM EXISTING CODE):**
   - Search for similar implementations by functionality keywords
   - Search for files with similar naming patterns (e.g., *-service.ext, *-validator.ext)
   - Look in architectural layers (controllers/, services/, utils/, etc.)
   - Document SPECIFIC file:line references for patterns to follow
   - **Don't recreate what already exists!**

3. **Identify Reusable Components:**
   - Search for existing validation utilities
   - Search for existing error handling patterns
   - Search for existing data processing utilities
   - Search for existing authentication/authorization helpers
   - Search for existing configuration utilities
   - Search for existing logging utilities
   - Search for existing test utilities and mocks
   - For EACH found component, document: purpose, location, how to use

4. **Understand Codebase Conventions:**
   - File organization pattern (analyze existing similar files)
   - Naming conventions (files, classes, functions, constants)
   - Error handling pattern (find and document actual examples)
   - Testing patterns (structure, mocking, fixtures)
   - Import/export style (CommonJS vs ES Modules)
   - Documentation style (comments, JSDoc, etc.)

5. **Map Integration Points:**
   - Find ALL places where modified functions/classes/components are called
   - Use code search to locate all references to functions being edited
   - Verify parameter contracts match (types, order, required fields)
   - Check if return values are compatible with all callers
   - Verify API endpoints match backend expectations (method, path, payload structure)
   - Check if database schemas are aligned (field names, types, constraints)
   - List ALL files that import or reference the code being modified
   - Identify breaking changes and plan migration strategy
   - Verify external integrations (APIs, services, libraries)
   - Check environment variables and configuration dependencies

6. **Discover Test Strategy:**
   - Identify testing framework used in project
   - Find test file patterns and locations
   - Analyze test structure from existing tests
   - Understand mocking approach (location and patterns)
   - Find test data/fixture patterns
   - Check coverage expectations from config

7. **Assess Risks and Challenges:**
   - Identify potential technical risks with mitigation strategies
   - Assess overall complexity (Low/Medium/High)
   - Note missing information or ambiguities
   - Document external dependencies

8. **Create RESEARCH.md:**
   Write a focused research file at {{researchPath}} with ONLY NEW DISCOVERIES:

```markdown
# Research for {{task}}

## Context Reference
**For tech stack and conventions, see:**
- `{{aiPromptPath}}` - Universal context
- `{{taskPath}}` - Task-level context
- `{{promptPath}}` - Task-specific context

**This file contains ONLY new information discovered during research.**

## Task Understanding Summary
[1-2 sentence summary - reference TODO.md for full details]

## Files Discovered to Read/Modify
[ONLY files found during research NOT already in PROMPT.md]
- `path/to/file1.ext:lines` - [why relevant]
- `path/to/file2.ext:lines` - [why relevant]

## Code Patterns Found
[ONLY new patterns discovered during research]
- `path/to/example.ext:lines` - [Pattern description]

## Integration & Impact Analysis
### Functions/Classes/Components Being Modified:
- `functionName` in `path/to/file.ext:lines`
  - **Called by:** [list all files and line numbers]
  - **Parameter contract:** [signature]
  - **Impact:** [how changes affect callers]
  - **Breaking changes:** YES/NO - [explain]

### API/Database/External Integration:
[ONLY if applicable]
- **API endpoints affected:** [list]
- **Database schema changes:** [list]
- **External dependencies:** [list]

## Test Strategy Discovered
[ONLY new test patterns found]
- Test files: [locations]
- Test patterns: [approaches]

## Risks & Challenges Identified
[Things discovered during research]

## Execution Strategy Recommendation
[Based on research findings]
- Step 1: [specific action with file:line]
- Step 2: [specific action with file:line]
- Step 3: [specific action with file:line]
```

**RULES:**
- Reference existing context (AI_PROMPT.md, TASK.md, PROMPT.md) - don't duplicate
- Include ONLY new discoveries made during research
- Use file paths with line numbers when referencing code
- Don't modify any files yet - this is research only
- Focus on NEW information that helps execution
- CRITICAL: You MUST create the RESEARCH.md file
