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
exports.Step3 = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const state_1 = __importDefault(require("../config/state"));
const claude_executor_1 = require("../services/claude-executor");
/**
 * Step3 - Execution loop with dependency and safety checks
 */
class Step3 {
    /**
     * Execute step3 - Run execution loop for task dependencies and safety
     * @param task - Task name to execute
     * @returns Promise resolving to execution result
     */
    static async execute(task) {
        const folder = (file) => path.join(state_1.default.claudiomiroFolder, task, file);
        if (fs.existsSync(folder('CODE_REVIEW.md'))) {
            fs.rmSync(folder('CODE_REVIEW.md'));
        }
        // Insert into prompt.md or task.md the generated md files from other tasks.
        return claude_executor_1.ClaudeExecutor.execute(`PHASE: EXECUTION LOOP (DEPENDENCY + SAFETY)

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
exports.Step3 = Step3;
exports.default = Step3;
//# sourceMappingURL=step3.js.map