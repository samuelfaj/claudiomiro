import * as fs from 'fs';
import * as path from 'path';
import state from '../config/state';
import { ClaudeExecutor } from '../services/claude-executor';

/**
 * Step3 - Execution loop with dependency and safety checks
 */
export class Step3 {
  /**
   * Execute step3 - Run execution loop for task dependencies and safety
   * @param task - Task name to execute
   * @returns Promise resolving to execution result
   */
  static async execute(task: string): Promise<void> {
    const folder = (file: string): string => path.join(state.claudiomiroFolder!, task, file);

    if (fs.existsSync(folder('CODE_REVIEW.md'))) {
      fs.rmSync(folder('CODE_REVIEW.md'));
    }

    // Insert into prompt.md or task.md the generated md files from other tasks.

    return ClaudeExecutor.execute(`PHASE: EXECUTION LOOP (DEPENDENCY + SAFETY)

      RULES:
      - Never run git add/commit/push.
      - ${folder('TODO.md')} must exist and start with "Fully implemented: YES" or "NO".
      - Multi-repo tasks are allowed.
      - Only mark BLOCKED if external/manual dependency.

---

OBJECTIVE:
Execute all actionable items in ${folder('TODO.md')} in parallel when possible.
Stop only when all items are [X] or BLOCKED/FAILED and the first line is "Fully implemented: YES".

---

LOOP:
1. Read ${folder('TODO.md')}.
2. If malformed or unreadable → ERROR.
3. For each unchecked item:
   a. Skip if "BLOCKED:" → log reason.
   b. Try execution.
   c. If success → mark [X].
   d. If fail → add "FAILED: <reason>".
4. After all processed:
   - Run targeted tests ONLY on modified paths (unit, lint, type)
      - NEVER run full-project.
   - If all pass → set "Fully implemented: YES".
   - Else → revert to "NO" and reopen failed items.

TESTS:
- Run only affected tests/linters/typechecks.
- If no tests exist → run static analysis only.
- Never run full-project checks.

FAILURES:
- On test failure → add "FAILED: test <module>" and retry loop.
- On logic/build failure → revert file and log "ROLLBACK: <reason>".

STOP-DIFF:
- Do not rename TODO items or unrelated files.
- Keep diffs minimal and atomic.

STATE:
- Persist updates to ${folder('TODO.md')} and logs after each loop.

MCP:
- Use MCPs only for analysis/testing, never for file modification.
    `, task);
  }
}

export default Step3;