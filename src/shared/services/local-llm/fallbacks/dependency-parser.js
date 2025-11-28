/**
 * Fallback Dependency Parser
 * Regex-based dependency extraction when LLM is not available
 */

/**
 * Parse explicit @dependencies declarations from task content
 * @param {string} content - Task content (TASK.md or similar)
 * @returns {string[]}
 */
function parseDependencies(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Pattern 1: @dependencies [TASK1, TASK2] or @dependencies TASK1, TASK2
  const dependencyPattern = /@dependencies\s*\[?([^\]\n]*)\]?/i;
  const match = content.match(dependencyPattern);

  if (match && match[1]) {
    const depsString = match[1].trim();

    // Skip "none" or empty
    if (!depsString || /^none$/i.test(depsString)) {
      return [];
    }

    // Parse comma-separated task names
    const deps = depsString
      .split(/[,\s]+/)
      .map(d => d.trim())
      .filter(d => d && /^TASK\d+/i.test(d));

    return deps;
  }

  return [];
}

/**
 * Parse dependencies from "Depends on:" style declarations
 * @param {string} content - Task content
 * @returns {string[]}
 */
function parseDependsOn(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Pattern: "Depends on: TASK1, TASK2" or "Dependencies: ..."
  const patterns = [
    /depends?\s+on\s*:\s*([^\n]+)/i,
    /dependencies\s*:\s*([^\n]+)/i,
    /requires?\s*:\s*([^\n]+)/i,
    /after\s*:\s*([^\n]+)/i,
    /blocked\s+by\s*:\s*([^\n]+)/i
  ];

  const deps = [];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const taskRefs = match[1].match(/TASK\d+(?:\.\d+)?/gi) || [];
      deps.push(...taskRefs);
    }
  }

  return [...new Set(deps)];
}

/**
 * Extract task references from content
 * @param {string} content - Content to search
 * @returns {string[]}
 */
function extractTaskReferences(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Find all TASK references
  const taskPattern = /TASK\d+(?:\.\d+)?/gi;
  const matches = content.match(taskPattern) || [];

  return [...new Set(matches)];
}

/**
 * Infer dependencies from file references
 * @param {string} content - Task content
 * @param {Object<string, string[]>} taskFileMap - Map of task -> files it modifies
 * @returns {string[]}
 */
function inferFileDependencies(content, taskFileMap) {
  if (!content || typeof content !== 'string' || !taskFileMap) {
    return [];
  }

  const deps = [];

  // Extract file references from this task
  const filePattern = /`([^`]+\.(js|ts|jsx|tsx|py|java|go|rb|php|cs|cpp|c|h|json|yaml|yml|md))`/gi;
  const fileMatches = content.match(filePattern) || [];
  const files = fileMatches.map(f => f.replace(/`/g, ''));

  // Find tasks that modify the same files
  for (const [taskName, taskFiles] of Object.entries(taskFileMap)) {
    for (const file of files) {
      if (taskFiles.some(tf => tf.includes(file) || file.includes(tf))) {
        deps.push(taskName);
        break;
      }
    }
  }

  return [...new Set(deps)];
}

/**
 * Get all dependencies (explicit and inferred)
 * @param {string} content - Task content
 * @param {Object} options - Options for parsing
 * @returns {{explicit: string[], inferred: string[], all: string[]}}
 */
function getAllDependencies(content, options = {}) {
  const explicit = [
    ...parseDependencies(content),
    ...parseDependsOn(content)
  ];

  let inferred = [];

  if (options.taskFileMap) {
    inferred = inferFileDependencies(content, options.taskFileMap);
    // Remove explicit deps from inferred
    inferred = inferred.filter(d => !explicit.includes(d));
  }

  const all = [...new Set([...explicit, ...inferred])];

  return { explicit, inferred, all };
}

/**
 * Validate dependency graph for cycles
 * @param {Object<string, string[]>} graph - Task -> dependencies map
 * @returns {{valid: boolean, cycles: string[][]}}
 */
function validateDependencyGraph(graph) {
  const cycles = [];
  const visited = new Set();
  const recStack = new Set();

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);

    const deps = graph[node] || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep, [...path, dep])) {
          return true;
        }
      } else if (recStack.has(dep)) {
        // Found cycle
        const cycleStart = path.indexOf(dep);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        } else {
          cycles.push([...path, dep]);
        }
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return {
    valid: cycles.length === 0,
    cycles
  };
}

/**
 * Get topological order of tasks
 * @param {Object<string, string[]>} graph - Task -> dependencies map
 * @returns {string[]|null} - Ordered tasks or null if cycle exists
 */
function getTopologicalOrder(graph) {
  const validation = validateDependencyGraph(graph);
  if (!validation.valid) {
    return null;
  }

  const inDegree = {};
  const queue = [];
  const result = [];

  // Initialize in-degrees
  for (const node of Object.keys(graph)) {
    inDegree[node] = 0;
  }

  // Calculate in-degrees
  for (const [node, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!(dep in inDegree)) {
        inDegree[dep] = 0;
      }
    }
  }

  for (const deps of Object.values(graph)) {
    for (const dep of deps) {
      inDegree[dep] = (inDegree[dep] || 0) + 1;
    }
  }

  // Find nodes with no incoming edges
  for (const [node, degree] of Object.entries(inDegree)) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);

    const deps = graph[node] || [];
    for (const dep of deps) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) {
        queue.push(dep);
      }
    }
  }

  return result.reverse();
}

module.exports = {
  parseDependencies,
  parseDependsOn,
  extractTaskReferences,
  inferFileDependencies,
  getAllDependencies,
  validateDependencyGraph,
  getTopologicalOrder
};
