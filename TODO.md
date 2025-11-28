# Multi-Repository Support for Claudiomiro

## Summary

Add support for working with backend + frontend repositories simultaneously, with automatic git detection, parallel task execution, and integration verification.

## User Requirements

- **CLI**: `claudiomiro --backend=/path/backend --frontend=/path/frontend`
- **Git Detection**: Auto-detect if repos share same git or are separate
- **Tasks**: Hybrid - tasks can be specific to one repo OR affect both
- **Parallelism**: Independent backend/frontend tasks run in parallel
- **Integration**: Verify API contracts, types, and run E2E tests

---

## Stack Agnostic Principles

**This implementation MUST work with ANY technology stack:**

| Layer | Supported Examples |
|-------|-------------------|
| **Backend** | Django, Rails, Spring Boot, Go/Gin, Rust/Actix, Node.js, PHP/Laravel, .NET, FastAPI, etc. |
| **Frontend** | React, Vue, Angular, Svelte, Flutter, iOS/Swift, Android/Kotlin, HTMX, etc. |
| **API Style** | REST, GraphQL, gRPC, WebSockets, tRPC, etc. |
| **Types** | TypeScript, Python type hints, Go structs, Rust types, Java classes, etc. |
| **Tests** | Cypress, Playwright, Selenium, XCTest, Espresso, pytest, etc. |

**Key Principles:**
1. **No hardcoded patterns** - Claude detects framework patterns dynamically
2. **No file extension assumptions** - Works with `.py`, `.go`, `.rs`, `.java`, `.kt`, `.swift`, etc.
3. **No framework-specific parsing** - Raw code analysis via Claude
4. **Git commands are universal** - Work on any platform (Linux, macOS, Windows)
5. **Test detection is dynamic** - Discovers test framework from project files

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Create `src/shared/services/git-detector.js`

```javascript
const detectGitConfiguration = (backendPath, frontendPath) => {
    const backendGitRoot = findGitRoot(backendPath);
    const frontendGitRoot = findGitRoot(frontendPath);

    return backendGitRoot === frontendGitRoot
        ? { mode: 'monorepo', gitRoots: [backendGitRoot] }
        : { mode: 'separate', gitRoots: [backendGitRoot, frontendGitRoot] };
};
```

#### 1.2 Extend `src/shared/config/state.js`

Add multi-repo support while maintaining backward compatibility:

```javascript
// New properties
this._multiRepoEnabled = false;
this._repositories = new Map(); // { backend: path, frontend: path }
this._gitMode = null; // 'monorepo' | 'separate'

// New methods
setMultiRepo(backendPath, frontendPath, gitConfig) { ... }
getRepository(scope) { ... } // scope: 'backend' | 'frontend'
isMultiRepo() { return this._multiRepoEnabled; }
getGitMode() { return this._gitMode; }
```

#### 1.3 Update CLI in `src/commands/task-executor/cli.js`

Parse new flags:
```javascript
const backendArg = args.find(arg => arg.startsWith('--backend='));
const frontendArg = args.find(arg => arg.startsWith('--frontend='));

if (backendPath && frontendPath) {
    const gitConfig = detectGitConfiguration(backendPath, frontendPath);
    state.setMultiRepo(backendPath, frontendPath, gitConfig);
}
```

#### 1.4 Create `src/commands/task-executor/utils/scope-parser.js`

```javascript
const parseTaskScope = (taskMdContent) => {
    const match = taskMdContent.match(/^\s*@scope\s+(\w+)/mi);
    return match ? match[1].toLowerCase() : null; // 'backend' | 'frontend' | 'integration'
};
```

---

### Phase 2: Step Modifications

#### 2.1 Step 0 (`step0/index.js`)

- Create branches in both repos if separate git
- Save config to `.claudiomiro/multi-repo.json`

#### 2.2 Step 1 (`step1/index.js`)

- Include both repository structures in AI context
- Document multi-repo awareness in prompt

#### 2.3 Step 2 (`step2/prompt.md`)

Add `@scope` tag requirement:

```markdown
@dependencies [TASK0, TASK1]
@scope backend|frontend|integration

# Task: [Title]
```

Parallelization example:
```
TASK0 @scope backend   - Setup API      (no deps)
TASK1 @scope frontend  - Setup UI       (no deps)     ← Parallel with TASK0
TASK2 @scope backend   - User endpoint  (deps: TASK0)
TASK3 @scope frontend  - User form      (deps: TASK1) ← Parallel with TASK2
TASK4 @scope integration - Verify API   (deps: TASK2, TASK3)
```

#### 2.4 Step 5 (`step5/index.js`)

Execute in correct repository context:

```javascript
const scope = parseTaskScope(task);
const cwd = state.isMultiRepo()
    ? state.getRepository(scope)
    : state.folder;

await executeClaude(prompt, task, { cwd });
```

#### 2.5 Step 6 (`step6/index.js`)

Commit strategy based on git mode:

```javascript
if (gitMode === 'monorepo') {
    await smartCommit({ taskName: task }); // Unified commit
} else {
    // Separate commits per repo
    if (scope === 'backend' || scope === 'integration') {
        await smartCommit({ cwd: state.getRepository('backend') });
    }
    if (scope === 'frontend' || scope === 'integration') {
        await smartCommit({ cwd: state.getRepository('frontend') });
    }
}
```

#### 2.6 Step 8 (`step8/index.js`)

Create independent PRs for separate-git:

```javascript
if (gitMode === 'separate') {
    const backendPR = await createPR(state.getRepository('backend'));
    const frontendPR = await createPR(state.getRepository('frontend'));
    // Cross-reference PRs in descriptions
}
```

---

### Phase 3: Integration Verification

#### 3.1 Create `src/shared/services/integration-verifier.js`

**Detection Strategy**: 100% Claude analysis (stack-agnostic)

```javascript
class IntegrationVerifier {
    /**
     * STACK AGNOSTIC - Works with ANY backend/frontend combination:
     * - Backend: Django, Rails, Spring, Go, Rust, Node.js, PHP, .NET, etc.
     * - Frontend: React, Vue, Angular, Svelte, Flutter, iOS, Android, etc.
     *
     * Claude analyzes the actual code to find:
     * - Backend: Route/endpoint definitions (any framework pattern)
     * - Frontend: HTTP calls (any client library pattern)
     */
    async verifyAPIContracts() {
        // Get file trees (no tech assumptions)
        const backendFiles = await getRelevantFiles(this.backendPath);
        const frontendFiles = await getRelevantFiles(this.frontendPath);

        // Claude analyzes raw code - no framework assumptions
        const prompt = `
Analyze these two codebases and identify API integration issues:

## Backend (${this.backendPath})
${backendFiles}

## Frontend (${this.frontendPath})
${frontendFiles}

Find:
1. Backend endpoints/routes (ANY framework - detect the pattern)
2. Frontend HTTP calls (ANY library - detect the pattern)
3. Mismatches: endpoints called but not defined, or vice-versa
4. Type/schema inconsistencies if detectable

Return structured JSON with issues found.
`;
        return await executeClaude(prompt);
    }

    async verifyTypeConsistency() {
        // Claude analyzes type definitions (TS, Python types, Go structs, etc.)
        // No assumption about type system - Claude detects what's used
    }

    async runE2ETests() {
        // Detect test framework by analyzing project files
        // Run whatever E2E framework is present (or skip if none)
    }
}
```

#### 3.2 Integrate into Step 7 (`step7/index.js`)

**On Failure**: Criar task de fix automaticamente (não bloquear)

```javascript
if (state.isMultiRepo()) {
    const verifier = new IntegrationVerifier(backend, frontend);
    const result = await verifier.verify();

    if (!result.passed) {
        // Generate fix task instead of blocking
        const fixTask = await generateIntegrationFixTask(result.issues);
        logger.warn(`Integration issues found. Created ${fixTask} to fix.`);

        // Add fix task to DAG and continue execution
        await dagExecutor.addTask(fixTask, {
            scope: 'integration',
            deps: getAllCompletedTasks()
        });
    }
}
```

---

### Phase 4: DAG Executor Enhancement

#### 4.1 Update `src/commands/task-executor/services/dag-executor.js`

Scope-aware parallelism:

```javascript
// Backend and frontend tasks can run in parallel
// even when same-scope maxConcurrent is reached
getReadyTasks() {
    // Filter by scope-based concurrency limits
    // backend tasks: limited by backendConcurrent
    // frontend tasks: limited by frontendConcurrent
    // Both pools run independently → more parallelism
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/shared/services/git-detector.js` | Detect monorepo vs separate git |
| `src/shared/services/integration-verifier.js` | API/type/E2E verification |
| `src/commands/task-executor/utils/scope-parser.js` | Parse @scope from TASK.md |

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/config/state.js` | Add multi-repo properties/methods |
| `src/commands/task-executor/cli.js` | Parse --backend/--frontend flags |
| `src/commands/task-executor/steps/step0/index.js` | Multi-repo branch creation |
| `src/commands/task-executor/steps/step1/index.js` | Multi-repo context |
| `src/commands/task-executor/steps/step2/prompt.md` | @scope tag docs |
| `src/commands/task-executor/steps/step5/index.js` | Scope-aware cwd |
| `src/commands/task-executor/steps/step6/index.js` | Per-repo commits |
| `src/commands/task-executor/steps/step7/index.js` | Integration verification |
| `src/commands/task-executor/steps/step8/index.js` | Independent PRs |
| `src/commands/task-executor/services/dag-executor.js` | Scope-aware parallelism |
| `src/shared/executors/claude-executor.js` | Accept cwd option |
| `src/shared/services/git-commit.js` | Accept cwd option |

---

## Implementation Order

1. **Foundation**: git-detector.js → state.js → cli.js → scope-parser.js
2. **Steps**: step0 → step1 → step2/prompt.md → step5 → claude-executor.js
3. **Git Workflow**: git-commit.js → step6 → step8
4. **Integration**: integration-verifier.js → step7
5. **Parallelism**: dag-executor.js
6. **Tests**: Create tests for all new files

---

## Git Workflow Summary

### Monorepo (Same Git)
- Single branch: `feature/task-name`
- Unified commits per task
- Single PR at end

### Separate Git
- Branches in BOTH repos: `feature/task-name`
- Separate commits per repo
- Independent PRs with cross-references
