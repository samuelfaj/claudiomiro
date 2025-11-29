# Multi-Repository Mode

Multi-repository mode allows Claudiomiro to work across separate backend and frontend codebases simultaneously, coordinating tasks, commits, and integration verification.

## Quick Start

```bash
claudiomiro --backend=./api --frontend=./web --prompt="Add user authentication with JWT"
```

## How It Works

### 1. Git Configuration Detection

When you provide `--backend` and `--frontend` paths, Claudiomiro automatically detects the git configuration:

| Mode | Description |
|------|-------------|
| **Monorepo** | Both paths are in the same git repository |
| **Separate** | Each path is in its own git repository |

```bash
# Monorepo example (same .git root)
claudiomiro --backend=./packages/api --frontend=./packages/web

# Separate repos example (different .git roots)
claudiomiro --backend=../my-api --frontend=../my-frontend
```

### 2. Task Decomposition with Scopes

In multi-repo mode, each generated task includes a `@scope` tag in its `TASK.md`:

```markdown
@scope backend
@dependencies []

## Task: Implement JWT Token Generation

Create the JWT token generation service in the backend...
```

### 3. Scope-Aware Execution

Tasks are executed in the correct repository based on their scope:

| Scope | Working Directory |
|-------|-------------------|
| `backend` | Path provided via `--backend` |
| `frontend` | Path provided via `--frontend` |
| `integration` | Backend path (for cross-repo verification) |

## Scope Tags

### @scope backend

Tasks that modify only backend code:
- API endpoints
- Database models
- Server-side logic
- Backend tests

### @scope frontend

Tasks that modify only frontend code:
- UI components
- Client-side state
- API client calls
- Frontend tests

### @scope integration

Tasks that require coordination between both codebases:
- API contract verification
- End-to-end testing setup
- Shared type definitions
- Documentation spanning both projects

## Configuration Persistence

Multi-repo settings are saved to `.claudiomiro/multi-repo.json`:

```json
{
  "enabled": true,
  "mode": "separate",
  "repositories": {
    "backend": "/absolute/path/to/api",
    "frontend": "/absolute/path/to/web"
  },
  "gitRoots": [
    "/absolute/path/to/api",
    "/absolute/path/to/web"
  ]
}
```

This allows you to use `--continue` after answering clarification questions:

```bash
# Initial run (may pause for clarification)
claudiomiro --backend=./api --frontend=./web --prompt="Add auth"

# After answering CLARIFICATION_QUESTIONS.json
claudiomiro --continue
```

## Integration Verification

During Step 7 (Critical Bug Sweep), Claudiomiro performs integration analysis between the codebases:

### What It Checks

1. **Endpoint URL Mismatches**
   - Frontend calling endpoints that don't exist in backend
   - Typos in API paths

2. **Request Payload Mismatches**
   - Frontend sending different data structure than backend expects
   - Missing required fields

3. **Response Format Mismatches**
   - Frontend expecting different response structure
   - Type mismatches

4. **HTTP Method Inconsistencies**
   - Frontend using GET where backend expects POST
   - Method mismatches

5. **Authentication Requirements**
   - Endpoints requiring auth that frontend doesn't provide
   - Missing authorization headers

### Verification Output

Issues found are reported in `BUGS.md`:

```markdown
## Integration Issues

### Endpoint Mismatch
- **Type**: endpoint_mismatch
- **Backend**: src/routes/users.js
- **Frontend**: src/api/userService.ts
- **Description**: Frontend calls `/api/users/profile` but backend defines `/api/user/profile`
```

## Branch Management

### Monorepo Mode

In monorepo mode, a single branch is created:

```bash
# Creates: feature/claudiomiro-add-authentication
git checkout -b feature/claudiomiro-add-authentication
```

### Separate Repos Mode

In separate repos mode, branches are created in both repositories with the same name:

```bash
# In backend repo:
git checkout -b feature/claudiomiro-add-authentication

# In frontend repo:
git checkout -b feature/claudiomiro-add-authentication
```

## Examples

### Full-Stack Feature

```bash
claudiomiro \
  --backend=./api \
  --frontend=./web \
  --prompt="Add user profile page with avatar upload"
```

This will:
1. Create backend tasks for file upload endpoint and user profile API
2. Create frontend tasks for profile page UI and avatar upload component
3. Create integration tasks for API contract verification
4. Execute tasks in parallel where possible
5. Verify integration between codebases
6. Commit changes to both repositories

### API Migration

```bash
claudiomiro \
  --backend=./api \
  --frontend=./web \
  --prompt="Migrate /users endpoint to /api/v2/users with pagination"
```

### Shared Types

```bash
claudiomiro \
  --backend=./api \
  --frontend=./web \
  --prompt="Add TypeScript types for the Order entity and ensure both codebases use the same contract"
```

## Output Structure

```
.claudiomiro/
├── multi-repo.json              # Multi-repo configuration
├── AI_PROMPT.md                 # Generated prompt
├── CLARIFICATION_QUESTIONS.json # Questions (if any)
├── CLARIFICATION_ANSWERS.json   # User answers (if any)
├── CRITICAL_REVIEW_PASSED.md    # Integration verification passed
├── BUGS.md                      # Integration issues found
├── done.txt                     # Completion marker
├── TASK1/
│   ├── TASK.md                 # @scope backend
│   ├── TODO.md
│   ├── RESEARCH.md
│   ├── CONTEXT.md
│   └── CODE_REVIEW.md
├── TASK2/
│   ├── TASK.md                 # @scope frontend
│   └── ...
└── TASK3/
    ├── TASK.md                 # @scope integration
    └── ...
```

## Limitations

1. **Two Repositories Maximum**: Currently supports exactly two repositories (backend + frontend)
2. **Git Required**: Both paths must be inside git repositories
3. **Scope Required**: In multi-repo mode, every task must have a `@scope` tag

## Troubleshooting

### "Both paths must be inside git repositories"

Ensure both `--backend` and `--frontend` paths are inside initialized git repositories:

```bash
cd ./api && git status
cd ./web && git status
```

### "@scope tag is required in multi-repo mode"

If a task is missing the `@scope` tag, add it manually to the `TASK.md` file:

```markdown
@scope backend
@dependencies []

... rest of task description
```

### Integration verification fails

Check `BUGS.md` for specific issues and fix them manually, then re-run:

```bash
claudiomiro --steps=7,8
```

## Related Documentation

- [Task Executor Command](./commands/task-executor.md)
- [Basic Usage Guide](./basic-usage.md)
