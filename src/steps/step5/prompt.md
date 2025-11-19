OBJECTIVE:
Execute all actionable items in {{todoPath}} in parallel when possible.
Stop only when all items are [X] or BLOCKED/FAILED and the first line is "Fully implemented: YES".
{{researchSection}}
---

LOOP:
1. Read {{todoPath}}.
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

RULES:
- Don't run git add/commit/push.
- First line of {{todoPath}} MUST be "Fully implemented: YES" or "NO".
- CRITICAL: Update {{todoPath}} in real time as you're doing things.
- Multi-repo tasks are allowed.
- Only mark BLOCKED if you cannot do the item no matter how.
- Always prefer auto fixes (e.g., eslint --fix).

TESTS:
- Run only affected tests/linters/typechecks.
- If no tests exist → run static analysis only.
- Never run full-project checks.

FAILURES:
- On test failure → add "FAILED: test <module>" and retry loop.
- On logic/build failure → revert file and log "ROLLBACK: <reason>".
- On Claude execution timeout or failure → ensure TODO.md remains with "Fully implemented: NO"

STOP-DIFF:
- Do not rename TODO items or unrelated files.
- Keep diffs minimal and atomic.

STATE:
- Persist updates to {{todoPath}} and logs after each loop.

MCP:
- Use MCPs only for analysis/testing, never for file modification.
