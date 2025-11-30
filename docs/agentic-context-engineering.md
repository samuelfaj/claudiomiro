# Agentic Context Engineering and Reflections in Claudiomiro

This guide describes how Claudiomiro assembles execution context and learns across iterations. Agentic Context Engineering builds precise prompts while the reflection pipeline extracts lessons that feed future tasks.

---

## Overview

- **Agentic Context Engineering** collects, compresses, and distributes only the most relevant information for every step (`src/shared/services/context-cache`). It tracks execution history, indexes the codebase, and saves tokens by trimming noise.
- **Reflections** review each run to capture actionable insights (`src/shared/services/reflection`, `src/commands/task-executor/steps/step5/reflection-hook.js`). The results are persisted and reused later.
- **Insights Service** is the shared memory for curated patterns and reflections (`src/shared/services/insights/insight-store.js`). Claudiomiro surfaces these insights automatically in future prompts.

Together they create a loop: task → execution → reflection → insights → optimized context → next task.

---

## Agentic Context Architecture

### Core building blocks
- `context-cache/` handles incremental cache, summaries, and invalidation (stored in `.claudiomiro/cache/context-cache.json`).
- `code-index/` maintains a semantic symbol index so prompts reference precise code instead of entire files.
- `local-llm/` (optional) powers local summarization and topic detection to cut 40–60% of token usage whenever a local model is available.
- `insights/` unifies curated patterns (global + project) and reflection history.

### Step-by-step data flow
1. **Step 4 – Generate TODO** (`src/commands/task-executor/steps/step4/generate-todo.js`)
   - Calls `buildOptimizedContextAsync`, which blends:
     - the cached `AI_PROMPT.md` summary,
     - completed tasks with files/decisions,
     - relevant symbols from the code index,
     - curated insights from previous runs.
   - The resulting prompt snippet keeps content short and lists only file references that the agent can open if needed.
2. **Step 5 – Execute Task** (`src/commands/task-executor/steps/step5/index.js`)
   - After executing the plan, Claudiomiro writes `CONTEXT.md` and invokes `markTaskCompleted` to refresh the incremental cache.
   - Execution metrics (attempts, errors, change size, complexity) drive the reflection trigger.
3. **Step 6 – Curate Insights** (`src/commands/task-executor/steps/step6/curate-insights.js`)
   - Aggregates patterns from TODO/CONTEXT/CODE_REVIEW/REFLECTION.
   - Persists the best entries with scope classification so they can guide future tasks automatically.

### Context tactics
- **Incremental cache**: only tasks marked as “Fully implemented: YES” contribute to the consolidated context. Changing `AI_PROMPT.md` invalidates the summary automatically.
- **LLM-assisted optimization**: when `CLAUDIOMIRO_LOCAL_LLM` is set, the local service scores relevance and produces targeted summaries per file.
- **Code index integration**: `buildConsolidatedContextAsync` includes high-signal symbols (functions, components, hooks) pulled via semantic search with Ollama, falling back to keyword lookup if needed.
- **Multi-repository awareness**: task scopes (e.g., `@scope backend`) ensure each summary and index query runs inside the correct repo, preventing cross-talk between projects.

---

## Reflection Pipeline

### Trigger logic
`shouldReflect` (in `reflection-hook.js`) checks heuristics before running the reflection loop:
- multiple attempts (`attempts >= 2`),
- repeated errors,
- large code diffs (`codeChangeSize > 500`),
- TODO marked as high complexity.

### Reflection execution
- `buildReflectionTrajectory` assembles a dossier with TODO, CONTEXT, RESEARCH, and additional notes.
- `Reflector` (`src/shared/services/reflection/reflector.js`) drives iterative reflection using `executeClaude`:
  1. Fills the template `prompts/reflect-on-trajectory.md` with task data, trajectory, and prior insights.
  2. Extracts structured insights via `insight-extractor`, falling back to pattern heuristics where necessary.
  3. Deduplicates, measures convergence (novelty, average confidence, actionable ratio), and tracks iteration history.
  4. Rewrites `REFLECTION.md` with the latest iteration content.

### Persistence and reuse
- `storeReflection` saves the iteration payload in `.claudiomiro/insights/reflections/<TASK>.json`, keeping a chronological record.
- Step 6 reloads the JSON (plus the raw markdown) to generate new curated insights.
- The insights service categorizes each entry, updates usage metrics, and exposes them through `getCuratedInsightsForTask`, which feeds right back into Step 4.

### Impact on future runs
- Reflection-derived action items (e.g., “add integration tests”) appear in the **CURATED INSIGHTS TO CONSIDER** section of subsequent TODOs.
- When a task reruns, the reflector seeds itself with the last known insights to avoid repeating the same suggestions.

---

## Customization and Best Practices
- Tune reflection heuristics inside `shouldReflect` to match the rigor your project needs.
- Keep `TODO.md` and `CONTEXT.md` aligned with the default headings; structured parsing depends on those markers.
- Configure `CLAUDIOMIRO_LOCAL_LLM` to unlock context optimization and topic classification for `RESEARCH.md`.
- When the code index feels stale, delete `./.claudiomiro/cache/code-index.json` (or run the CLI command that calls `CodeIndex.build(..., { forceRebuild: true })`) before the next task.
- Keep `AI_PROMPT.md` current; it’s the anchor for pattern detection and automatically refreshes the cache whenever it changes.

With these systems working together, Claudiomiro continuously learns from prior work, produces sharper prompts, and slashes token consumption without losing historical awareness.
