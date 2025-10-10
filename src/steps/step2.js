const fs = require('fs');
const path = require('path');
const state = require('../config/state');
const { executeClaude } = require('../services/claude-executor');

const findTaskFiles = (dir) => {
  const results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findTaskFiles(fullPath));
    } else if (item === 'TASK.md') {
      results.push(fullPath);
    }
  }

  return results;
};

const step2_1 = (task) => {
  const folder = (file) => path.join(state.claudiomiroFolder, task, file);

  return executeClaude(`
    ## Your Task

    1) Read ${folder('PROMPT.md')} and ${folder('TASK.md')}.
    2) Read previous TODO.md files under ${state.claudiomiroFolder} **only for directly related modules** to ensure consistency and avoid duplication.
    - Do NOT reimplement prior work, change their scope, or alter their acceptance criteria.
    3) Map how this task integrates with adjacent tasks (previous and next): inputs, outputs, contracts, and sequencing.
    4) Identify implementation steps and locate all relevant code artifacts (files, functions, types, schemas). Capture dependencies, references, and side effects required for a complete delivery.
    5) Group work by **feature unit** (implementation + tests together). Do not split “create function” and “test function” into separate items.
    6) Write ${folder('TODO.md')} using the agreed structure:
    - Use **Context (read-only)** vs **Touched (will modify/create)** sections per item.
    - Include Interfaces/Contracts, Tests, Migrations/Data, Observability, Security & Permissions, Performance, Commands, Risks & Mitigations.
    7) Use the codebase knowledge source **<rename “context7” to the actual provider>** if additional patterns are needed (coding style, error handling, tracing).
    8) Any gap or ambiguity → add a **Follow-ups** section at the end (do not silently change scope).

    **IMPORTANT: quality over quantity.** Prefer 3–6 well-defined items over many tiny steps.

    ## Testing Guideline

    **Focus:** Prove correctness of implemented behavior with the minimum effective set of tests.

    Rules:
    - First line of ${folder('TODO.md')} MUST be: \`Fully implemented: NO\`
    - Only add actions an AI agent can perform deterministically and idempotently.
    - Do NOT run any git commands.
    - Cross-repository work is allowed; different repositories are NOT blockers.
    - If the repository supports tests, you MUST create them (unit/integration/e2e as appropriate).
    - If tests are not supported, specify **hypothetical test cases** and expected assertions.
    - Prefer fast, deterministic tests with clear arrange/act/assert and seed data where needed.
    ---

    ## TODO.md Structure

    \`\`\`
    Fully implemented: NO

    ## Implementation Plan

    - [ ] **Item X — [Consolidated action]**
    - **Context (read-only):** [files/dirs/docs to read]
    - **Touched (will modify/create):** [files/modules]
    - **Interfaces / Contracts:** [APIs/events/schemas/types]
    - **Tests:** [type + key scenarios/edge cases]
    - **Migrations / Data:** [DDL/backfill/ordering]
    - **Observability:** [logs/metrics/traces/alerts]
    - **Security & Permissions:** [authN/Z, PII, rate limits]
    - **Performance:** [targets/limits/complexity]
    - **Commands:** [local/CI commands to run]
    - **Risks & Mitigations:** [risk → mitigation]

    - [ ] **Item X — [Consolidated action]**
    - **Context (read-only):** [files/dirs/docs to read]
    - **Touched (will modify/create):** [files/modules]
    - **Interfaces / Contracts:** [APIs/events/schemas/types]
    - **Tests:** [type + key scenarios/edge cases]
    - **Migrations / Data:** [DDL/backfill/ordering]
    - **Observability:** [logs/metrics/traces/alerts]
    - **Security & Permissions:** [authN/Z, PII, rate limits]
    - **Performance:** [targets/limits/complexity]
    - **Commands:** [local/CI commands to run]
    - **Risks & Mitigations:** [risk → mitigation]

    [...]

    ## Verification (global)
    - [ ] All automated tests pass (unit/integration/e2e)
    - [ ] Code builds cleanly (local + CI)
    - [ ] Manual QA script executed and green (steps + expected results)
    - [ ] Feature meets **Acceptance Criteria**
    - [ ] Dashboards/alerts configured and healthy
    - [ ] Rollout/rollback path validated (flag/canary)
    - [ ] Documentation updated (README/ADR/changelog)

    ## Acceptance Criteria
    - [ ] [Measurable criterion #1]
    - [ ] [Measurable criterion #2]
    - [ ] [Measurable criterion #3]

    ## Impact Analysis
    - **Directly impacted:** [files/modules/functions]
    - **Indirectly impacted:** [consumers/contracts/jobs/caches/infra]
    \`\`\`

    `, task);
}

const step2_2 = async (task) => {
  const folder = (file) => path.join(state.claudiomiroFolder, task, file);

  if (typeof task === 'string' && task.includes('.')) {
    return;
  }

  if(fs.existsSync(folder('split.txt'))){
    return;
  }

   const execution = await executeClaude(`Carefully analyze the task located at: ${path.join(state.claudiomiroFolder, task)}

## 1) Split Decision (only if it truly helps)
  - If this task is **small, straightforward, or fast to implement**, **do NOT split**. Keep it as a single unit.
  - Split **only** when it enables **meaningful parallelism** or clarifies complex, interdependent work.
  - Practical heuristics to avoid splitting:
    - Estimated effort < ~30 minutes, or
    - < ~50 lines of changes, or
    - No clear, independent work streams.

If you choose **NOT** to split:
  - Make **no** changes to the folder structure.


## 2) When splitting is justified
  If you determine splitting is beneficial:
  - Delete the original folder:
    ${path.join(state.claudiomiroFolder, task)}

  - Create numbered subtask folders (contiguous numbering):
    - ${path.join(state.claudiomiroFolder, task)}.1
    - ${path.join(state.claudiomiroFolder, task)}.2
    - ${path.join(state.claudiomiroFolder, task)}.3
    (Create only as many as are logically necessary. Do not create empty subtasks.)

### Required structure for EACH subtask
  You MUST create for each subtask:
  - TASK.md   → objective, scope, and acceptance criteria
  - PROMPT.md → the precise execution prompt for this subtask
  - TODO.md   → concrete, verifiable steps to complete the subtask

Example:
  ${path.join(state.claudiomiroFolder, task + '.1')}
    ├─ TASK.md
    ├─ PROMPT.md
    └─ TODO.md

### Dependency & coherence rules
- Each subtask must be independently executable and testable.
- Avoid artificial fragmentation (don’t split trivial steps).

## 4) Quality bar
- Split only if it **reduces cycle time** or **reduces cognitive load** without harming cohesion.
- Keep naming, numbering, and dependencies consistent and minimal.
    `, task);

    if(
      fs.existsSync(`${path.join(state.claudiomiroFolder, task)}.0`) ||
      fs.existsSync(`${path.join(state.claudiomiroFolder, task)}.1`)
    ){
      if(fs.existsSync(`${path.join(state.claudiomiroFolder, task)}`)){
        fs.rmSync(`${path.join(state.claudiomiroFolder, task)}`);
      }

      const taskFiles = findTaskFiles(state.claudiomiroFolder);

      for (const taskFile of taskFiles) {
        const content = fs.readFileSync(taskFile, 'utf8');
        const lines = content.split('\n');
        const filteredLines = lines.filter(line => !line.trim().startsWith('@dependencies'));
        fs.writeFileSync(taskFile, filteredLines.join('\n'), 'utf8');
      }

    }else{
      fs.writeFileSync(folder('split.txt'), '1');
    }

    return execution;
}


const step2 = async (task) => {
  await step2_1(task);
  return step2_2(task);
};

module.exports = { step2 };
