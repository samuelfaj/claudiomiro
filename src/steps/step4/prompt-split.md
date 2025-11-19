Carefully analyze the task located at: {{taskFolder}}
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
    {{taskFolder}}

  - Create numbered subtask folders (contiguous numbering):
    - {{taskFolder}}.1
    - {{taskFolder}}.2
    - {{taskFolder}}.3
    (Create only as many as are logically necessary. Do not create empty subtasks.)

  - You MUST update all TASK.md files inside {{claudiomiroFolder}} with the new dependencies and numbering.

### Required structure for EACH subtask
  You MUST create for each subtask:
  - TASK.md   → objective, scope, and acceptance criteria
  - PROMPT.md → the precise execution prompt for this subtask
  - TODO.md   → concrete, verifiable steps to complete the subtask

Example:
  {{taskFolder}}.1
    ├─ TASK.md
    ├─ PROMPT.md
    └─ TODO.md

CRITICAL: First line of EACH TASK.md MUST be the updated dependencies list:
`@dependencies [LIST]`

CRITICAL: If you split a task: You MUST update all TASK.md files inside {{claudiomiroFolder}} with the new dependencies and numbering.

### Dependency & coherence rules
- Each subtask must be independently executable and testable.
- Avoid artificial fragmentation (don't split trivial steps).

## 4) Quality bar
- Split only if it **reduces cycle time** or **reduces cognitive load** without harming cohesion.
- Keep naming, numbering, and dependencies consistent and minimal.
