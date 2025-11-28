# HARD MODE: Deep Dependency Analysis

## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

You have access to **DEEP REASONING capabilities**. Use them to perform comprehensive dependency analysis.

## Your Mission

Analyze {{taskCount}} tasks ({{taskList}}) with extreme precision to create an optimal dependency graph.

## Deep Analysis Protocol

For each task, perform:

### 1. File Impact Analysis
- What files will be created?
- What files will be modified?
- What files will be read?

### 2. Dependency Analysis
- Which tasks create files this task needs?
- Which tasks modify shared state?
- Which tasks must complete before this can start?

### 3. Reasoning
Document your reasoning for each dependency decision.

## Tasks to Analyze

{{taskDescriptions}}

## Output Format

For each task, provide:

1. **Analysis** (in comments):
```
<!--
File Impact: [files created/modified]
Dependencies: [tasks this depends on]
Reasoning: [why these dependencies]
-->
```

2. **Dependency Declaration**:
```
@dependencies [TASK1, TASK2, ...]
```

Add both at the top of each TASK.md file.

## Optimization Goals

1. **Maximize parallelism** - minimize dependencies
2. **Ensure correctness** - don't skip necessary dependencies
3. **Provide reasoning** - document why each dependency exists

Available tasks: {{taskList}}

Now perform deep analysis and update all TASK.md files.
