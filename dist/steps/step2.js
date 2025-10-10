"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step2 = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const state_1 = __importDefault(require("../config/state"));
const claude_executor_1 = require("../services/claude-executor");
/**
 * Step2 - Task analysis and planning step
 */
class Step2 {
    /**
     * Recursively find all TASK.md files in a directory
     */
    static findTaskFiles(dir) {
        const results = [];
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                results.push(...Step2.findTaskFiles(fullPath));
            }
            else if (item === 'TASK.md') {
                results.push(fullPath);
            }
        }
        return results;
    }
    /**
     * Step 2.1 - Analyze task and create TODO.md
     */
    static async step2_1(task) {
        const folder = (file) => path.join(state_1.default.claudiomiroFolder, task, file);
        return claude_executor_1.ClaudeExecutor.execute(`
    ## Your Task

    1) Read ${folder('PROMPT.md')} and ${folder('TASK.md')}.
    2) Read previous TODO.md files under ${state_1.default.claudiomiroFolder} **only for directly related modules** to ensure consistency and avoid duplication.
    - Do NOT reimplement prior work, change their scope, or alter their acceptance criteria.
    3) Map how this task integrates with adjacent tasks (previous and next): inputs, outputs, contracts, and sequencing.
    4) Identify implementation steps and locate all relevant code artifacts (files, functions, types, schemas). Capture dependencies, references, and side effects required for a complete delivery.
    5) Group work by **feature unit** (implementation + tests together). Do not split "create function" and "test function" into separate items.
    6) Write ${folder('TODO.md')} using the agreed structure:
    - Use **Context (read-only)** vs **Touched (will modify/create)** sections per item.
    - Include Interfaces/Contracts, Tests, Migrations/Data, Observability, Security & Permissions, Performance, Commands, Risks & Mitigations.
    7) Use the codebase knowledge source **<rename "context7" to the actual provider>** if additional patterns are needed (coding style, error handling, tracing).
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
    /**
     * Step 2.2 - Evaluate task complexity and potentially split into subtasks
     */
    static async step2_2(task) {
        const folder = (file) => path.join(state_1.default.claudiomiroFolder, task, file);
        // Skip splitting for tasks with dots in name (already subtasks)
        if (typeof task === 'string' && task.includes('.')) {
            return;
        }
        // Skip if already processed
        if (fs.existsSync(folder('split.txt'))) {
            return;
        }
        const execution = await claude_executor_1.ClaudeExecutor.execute(`Carefully analyze the task located at: ${path.join(state_1.default.claudiomiroFolder, task)}
1. Evaluate complexity and parallelism
	•	If this task can be divided into independent and asynchronous subtasks, perform this division in a logical and cohesive manner.
	•	Each subtask should represent a clear functional unit, with a well-defined beginning and end.

## Split Decision (only if it truly helps)
- If this task is **small, straightforward, or fast to implement**, **do NOT split**. Keep it as a single unit.
- Split **only** when it enables **meaningful parallelism** or clarifies complex, interdependent work.

If you choose **NOT** to split:
- Make **no** changes to the folder structure.

## 2) When splitting is justified
  If you determine splitting is beneficial:
  - Delete the original folder:
    ${path.join(state_1.default.claudiomiroFolder, task)}

  - Create numbered subtask folders (contiguous numbering):
    - ${path.join(state_1.default.claudiomiroFolder, task)}.1
    - ${path.join(state_1.default.claudiomiroFolder, task)}.2
    - ${path.join(state_1.default.claudiomiroFolder, task)}.3
    (Create only as many as are logically necessary. Do not create empty subtasks.)

### Required structure for EACH subtask
  You MUST create for each subtask:
  - TASK.md   → objective, scope, and acceptance criteria
  - PROMPT.md → the precise execution prompt for this subtask
  - TODO.md   → concrete, verifiable steps to complete the subtask

Example:
  ${path.join(state_1.default.claudiomiroFolder, task + '.1')}
    ├─ TASK.md
    ├─ PROMPT.md
    └─ TODO.md

### Dependency & coherence rules
- Each subtask must be independently executable and testable.
- Avoid artificial fragmentation (don't split trivial steps).

## 4) Quality bar
- Split only if it **reduces cycle time** or **reduces cognitive load** without harming cohesion.
- Keep naming, numbering, and dependencies consistent and minimal.
    `, task);
        // Check if subtasks were created
        if (fs.existsSync(`${path.join(state_1.default.claudiomiroFolder, task)}.0`) ||
            fs.existsSync(`${path.join(state_1.default.claudiomiroFolder, task)}.1`)) {
            // Delete original folder if subtasks exist
            if (fs.existsSync(`${path.join(state_1.default.claudiomiroFolder, task)}`)) {
                fs.rmSync(`${path.join(state_1.default.claudiomiroFolder, task)}`);
            }
            // Clean up @dependencies from all task files
            const taskFiles = Step2.findTaskFiles(state_1.default.claudiomiroFolder);
            for (const taskFile of taskFiles) {
                const content = fs.readFileSync(taskFile, 'utf8');
                const lines = content.split('\n');
                const filteredLines = lines.filter(line => !line.trim().startsWith('@dependencies'));
                fs.writeFileSync(taskFile, filteredLines.join('\n'), 'utf8');
            }
        }
        else {
            // Mark as processed
            fs.writeFileSync(folder('split.txt'), '1');
        }
        return execution;
    }
    /**
     * Main step2 execution method
     */
    static async execute(task) {
        await Step2.step2_1(task);
        return Step2.step2_2(task);
    }
}
exports.Step2 = Step2;
//# sourceMappingURL=step2.js.map