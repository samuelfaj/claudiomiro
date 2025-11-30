# Implementation Plan: Generator-Reflector-Curator Pattern

## Overview

Add a **Generator-Reflector-Curator** pattern to Claudiomiro by enhancing existing steps (step4/step5/step6) with reflection capabilities and extending the context cache for insight persistence.

```
Query + Context Playbook → Generator (step4/5) → Trajectory (TODO.md/Code)
                                                      ↓
                                                 Reflector (new service)
                                                      ↓
                                                 Insights (REFLECTION.md)
                                                      ↓
                                                 Curator (enhanced step6)
                                                      ↓
                                Delta Context → Update context-cache.json
```

---

## Phase 0: Persistent Insights Folder (CRITICAL)

### Problem

Currently `.claudiomiro/` is **deleted entirely** when starting new tasks:
- `file-manager.js:startFresh()` uses `fs.rmSync(.claudiomiro, {recursive: true})`
- Called from `step0/index.js:78` (new task) and `cli.js:262` (`--fresh` flag)

### Solution

**Create persistent `.claudiomiro/insights/` folder** that survives cleanup.

### Files to Modify

**Modify:** `src/commands/task-executor/services/file-manager.js`

```javascript
const startFresh = (createFolder = false) => {
    logger.task('Cleaning up previous files...');
    logger.indent();

    if(fs.existsSync(state.claudiomiroFolder)){
        // PRESERVE insights folder
        const insightsFolder = path.join(state.claudiomiroFolder, 'insights');
        const hasInsights = fs.existsSync(insightsFolder);
        let insightsBackup = null;

        if (hasInsights) {
            // Backup insights before cleanup
            insightsBackup = path.join(os.tmpdir(), `claudiomiro-insights-${Date.now()}`);
            fs.cpSync(insightsFolder, insightsBackup, { recursive: true });
        }

        // Remove folder
        fs.rmSync(state.claudiomiroFolder, { recursive: true });
        logger.success(`${state.claudiomiroFolder} removed\n`);

        // Restore insights
        if (insightsBackup) {
            fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
            fs.cpSync(insightsBackup, insightsFolder, { recursive: true });
            fs.rmSync(insightsBackup, { recursive: true });
            logger.info(`Insights preserved in ${insightsFolder}`);
        }
    }

    if(createFolder && !fs.existsSync(state.claudiomiroFolder)){
        fs.mkdirSync(state.claudiomiroFolder);
    }

    logger.outdent();
};
```

**Create:** `src/commands/task-executor/services/file-manager.test.js`
- Test that insights folder is preserved during cleanup

---

## Phase 1: Insights Storage (NOT in context-cache.json)

### Files to Create/Modify

**Create:** `src/shared/services/insights/index.js`
- Main API for insights management
- Stores in `.claudiomiro/insights/` folder (persistent)

**Create:** `src/shared/services/insights/insight-store.js`

```javascript
// Two-tier insight management
const GLOBAL_PATH = path.join(os.homedir(), '.claudiomiro', 'insights', 'global-insights.json');
const getProjectPath = () => path.join(state.claudiomiroFolder, 'insights', 'project-insights.json');

// Loading (merges both tiers)
loadAllInsights()           // Returns merged global + project insights
loadGlobalInsights()        // Global only (~/.claudiomiro/insights/)
loadProjectInsights()       // Project only (.claudiomiro/insights/)

// Saving (auto-categorizes by scope)
addCuratedInsight(insight)  // Auto-detects global vs project scope
addGlobalInsight(insight)   // Force global
addProjectInsight(insight)  // Force project

// Retrieval
getCuratedInsightsForTask(taskDescription, options)  // Merges both, ranks by relevance
incrementInsightUsage(insightId, scope)              // Track usage

// Reflections (always project-level)
addReflection(task, reflection)  // Save to .claudiomiro/insights/reflections/
getTaskReflection(task)          // Load task reflection
```

**Create:** `src/shared/services/insights/insight-store.test.js`

### Folder Structure (Two-Tier System)

```
~/.claudiomiro/                  # 🌍 GLOBAL (user home)
└── insights/
    └── global-insights.json    # Universal learnings (all projects)

projeto/.claudiomiro/            # 📁 PROJECT (per-codebase)
├── insights/                    # ← PERSISTENT (survives cleanup)
│   ├── project-insights.json   # Project-specific learnings
│   └── reflections/            # Per-task reflections
│       ├── TASK1.json
│       └── TASK2.json
├── TASK1/                      # ← DELETED on new task
├── TASK2/
└── cache/
    └── context-cache.json      # ← DELETED on new task
```

### When to Save Global vs Project

| Tipo de Insight | Onde Salvar | Exemplo |
|-----------------|-------------|---------|
| **Universal** | `~/.claudiomiro/insights/` | "Always mock external services in tests" |
| **Framework** | `~/.claudiomiro/insights/` | "Use Jest's mockImplementation for async" |
| **Architecture** | `.claudiomiro/insights/` | "This project uses repository pattern" |
| **Project-specific** | `.claudiomiro/insights/` | "Auth tokens stored in Redis here" |

### Curator Decision Logic

```javascript
const categorizeInsightScope = (insight) => {
  // Global indicators
  const globalKeywords = [
    'always', 'never', 'best practice', 'anti-pattern',
    'testing', 'error handling', 'security', 'performance'
  ];

  // Project indicators
  const projectKeywords = [
    'this project', 'this codebase', 'here we',
    'specific', 'our implementation', 'custom'
  ];

  const isGlobal = globalKeywords.some(k =>
    insight.description.toLowerCase().includes(k)
  );

  const isProject = projectKeywords.some(k =>
    insight.description.toLowerCase().includes(k)
  );

  // Default to project if unclear, global if clearly universal
  if (isGlobal && !isProject) return 'global';
  return 'project';
};
```

### Insights Schema (insights.json)

```javascript
{
  version: "1.0.0",
  lastUpdated: "ISO",

  curatedInsights: {
    patterns: [{
      id: "uuid",
      insight: "Always mock external services in tests",
      learnedFrom: "TASK3",
      addedAt: "ISO",
      usageCount: 5,
      confidence: 0.9,
      category: "testing"
    }],
    antiPatterns: [...],
    projectSpecific: [...]
  }
}
```

### Reflection Schema (reflections/TASK1.json)

```javascript
{
  task: "TASK1",
  iterations: [{
    timestamp: "ISO",
    insights: [{ type, description, confidence, evidence, actionable, category }],
    triggeredBy: "quality-threshold|iteration-count|error-pattern"
  }],
  lastReflection: "ISO"
}
```

---

## Phase 2: Reflection Service

### Files to Create

**Create:** `src/shared/services/reflection/index.js`
- Export main API

**Create:** `src/shared/services/reflection/reflector.js`
- `Reflector` class with:
  - `reflect(task, context)` - Main reflection loop
  - `_generateReflection()` - Single reflection iteration
  - `_checkConvergence()` - Detect when insights stabilize
  - `_mergeInsights()` - Combine insights across iterations
  - `_qualityThresholdMet()` - Early exit condition

**Create:** `src/shared/services/reflection/reflector.test.js`

**Create:** `src/shared/services/reflection/insight-extractor.js`
- `extractInsights(content)` - Parse reflection output
- `categorizeInsight(insight)` - Assign category
- `deduplicateInsights(insights)` - Remove duplicates

**Create:** `src/shared/services/reflection/insight-extractor.test.js`

**Create:** `src/shared/services/reflection/prompts/reflect-on-trajectory.md`
- Prompt template for reflection generation

**Create:** `src/shared/services/reflection/fallbacks/pattern-matcher.js`
- Regex-based insight extraction (required fallback per CLAUDE.md)

**Create:** `src/shared/services/reflection/fallbacks/pattern-matcher.test.js`

### Reflection Logic

```javascript
class Reflector {
  async reflect(task, { trajectory, maxIterations = 3 }) {
    let insights = [];
    let iteration = 0;
    let converged = false;

    while (iteration < maxIterations && !converged) {
      iteration++;
      const newInsights = await this._generateReflection(task, trajectory, insights);
      converged = this._checkConvergence(insights, newInsights);
      insights = this._mergeInsights(insights, newInsights);

      if (this._qualityThresholdMet(insights)) break;
    }

    return { insights, iterations: iteration, converged };
  }
}
```

---

## Phase 3: Step 5 Integration (Generator + Reflection Hook)

### Files to Create/Modify

**Create:** `src/commands/task-executor/steps/step5/reflection-hook.js`
- `shouldReflect(task, context)` - Decision logic for when to reflect
- `createReflection(task, options)` - Trigger reflection service
- `storeReflection(task, result)` - Persist to cache

**Create:** `src/commands/task-executor/steps/step5/reflection-hook.test.js`

**Modify:** `src/commands/task-executor/steps/step5/index.js`
- Import reflection hook
- Call `shouldReflect()` after successful execution
- Call `createReflection()` when triggered
- Store reflection before `markTaskCompleted()`

### Reflection Triggers (User Decision)

**Execution Method**: Use Claude (main executor) via `executeClaude()` for full-power reflection.

**Trigger Conditions** (both enabled):
1. ✅ After failures (2+ attempts) - Learn from struggles
2. ✅ For complex tasks - Quality check on large changes

```javascript
const shouldReflect = async (task, { attempts, hasErrors, codeChangeSize, taskComplexity }) => {
  // TRIGGER 1: After 2+ attempts (learning from failures)
  if (attempts >= 2) return { should: true, trigger: 'iteration-count' };

  // TRIGGER 1b: After error recovery
  if (hasErrors && attempts > 1) return { should: true, trigger: 'error-pattern' };

  // TRIGGER 2: For complex tasks (large code changes or high complexity)
  if (codeChangeSize > 500 || taskComplexity === 'high') {
    return { should: true, trigger: 'quality-threshold' };
  }

  return { should: false };
};
```

---

## Phase 4: Step 4 Integration (Inject Curated Insights)

### Files to Modify

**Modify:** `src/commands/task-executor/steps/step4/generate-todo.js`
- Import `getCuratedInsightsForTask` from insight-manager
- Before building context, retrieve relevant insights
- Inject insights section into consolidated context

### Integration Point

```javascript
// In generate-todo.js, before executeClaude()
const relevantInsights = getCuratedInsightsForTask(
  state.claudiomiroFolder,
  taskDescription,
  { maxInsights: 5, minConfidence: 0.7 }
);

if (relevantInsights.length > 0) {
  const insightSection = formatInsightsSection(relevantInsights);
  consolidatedContext += insightSection;
}
```

---

## Phase 5: Step 6 Integration (Curator)

### Files to Create/Modify

**Create:** `src/commands/task-executor/steps/step6/curate-insights.js`
- `curateInsights(task, options)` - Extract and persist learnings
- `extractImplementationPatterns(todoPath, contextPath)` - Find patterns
- `categorizeInsights(insights)` - Organize by type

**Create:** `src/commands/task-executor/steps/step6/curate-insights.test.js`

**Modify:** `src/commands/task-executor/steps/step6/index.js`
- Import curate-insights
- After successful code review, call `curateInsights()`
- Persist delta context to cache

### Curator Logic

```javascript
const curateInsights = async (task, { review, reflection, todoPath }) => {
  const insights = [];

  // Extract from reflection (if available)
  if (reflection?.insights) {
    insights.push(...reflection.insights.filter(i => i.actionable && i.confidence > 0.7));
  }

  // Extract from implementation patterns
  const patterns = await extractImplementationPatterns(todoPath);
  insights.push(...patterns);

  // Persist to delta context
  for (const insight of categorizeInsights(insights)) {
    await addCuratedInsight(state.claudiomiroFolder, {
      ...insight,
      learnedFrom: task,
      addedAt: new Date().toISOString()
    });
  }
};
```

---

## Phase 6: Templates

### Files to Create

**Create:** `src/commands/task-executor/templates/REFLECTION.md`
- Template for reflection output structure

---

## Implementation Order

1. **Phase 1: Cache Schema** - Foundation for all other phases
2. **Phase 2: Reflection Service** - Core reflection logic
3. **Phase 3: Step 5 Integration** - Hook reflection into execution
4. **Phase 4: Step 4 Integration** - Inject insights into TODO generation
5. **Phase 5: Step 6 Integration** - Curator extracts learnings
6. **Phase 6: Templates** - Standardized output format

---

## Critical Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/commands/task-executor/services/file-manager.js` | **Modify** | Preserve insights on cleanup |
| `src/commands/task-executor/services/file-manager.test.js` | **Create** | Test insights preservation |
| `src/shared/services/insights/index.js` | **Create** | Main insights API |
| `src/shared/services/insights/insight-store.js` | **Create** | Insight CRUD in persistent folder |
| `src/shared/services/insights/insight-store.test.js` | **Create** | Tests |
| `src/shared/services/reflection/reflector.js` | **Create** | Core reflection logic |
| `src/shared/services/reflection/reflector.test.js` | **Create** | Tests |
| `src/shared/services/reflection/fallbacks/pattern-matcher.js` | **Create** | Fallback (no LLM) |
| `src/shared/services/reflection/fallbacks/pattern-matcher.test.js` | **Create** | Tests |
| `src/commands/task-executor/steps/step5/reflection-hook.js` | **Create** | Trigger logic |
| `src/commands/task-executor/steps/step5/reflection-hook.test.js` | **Create** | Tests |
| `src/commands/task-executor/steps/step5/index.js` | **Modify** | Add reflection hook |
| `src/commands/task-executor/steps/step4/generate-todo.js` | **Modify** | Inject insights |
| `src/commands/task-executor/steps/step6/curate-insights.js` | **Create** | Curator logic |
| `src/commands/task-executor/steps/step6/curate-insights.test.js` | **Create** | Tests |
| `src/commands/task-executor/steps/step6/index.js` | **Modify** | Add curator |

---

## Compliance Notes

- ✅ **SRP**: Each new file has single responsibility
- ✅ **Fallbacks**: Pattern-matcher.js provides non-LLM fallback
- ✅ **Tests**: Each `.js` file has corresponding `.test.js`
- ✅ **English**: All code/comments in English
- ✅ **Lowercase MD**: Template files in `templates/` use lowercase
- ✅ **Persistent**: Insights survive `.claudiomiro/` cleanup

---

## Estimated File Count

- **New files**: 14 (7 source + 7 test)
- **Modified files**: 4
- **Total**: 18 files

---

## Implementation Order (Updated)

1. **Phase 0: Persistent Insights** - Modify `startFresh()` to preserve `insights/`
2. **Phase 1: Insights Storage** - Create `src/shared/services/insights/`
3. **Phase 2: Reflection Service** - Create `src/shared/services/reflection/`
4. **Phase 3: Step 5 Integration** - Hook reflection into execution
5. **Phase 4: Step 4 Integration** - Inject insights into TODO generation
6. **Phase 5: Step 6 Integration** - Curator extracts learnings
7. **Phase 6: Templates** - REFLECTION.md template
