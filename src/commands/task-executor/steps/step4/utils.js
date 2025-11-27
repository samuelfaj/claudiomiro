const fs = require('fs');
const path = require('path');

/**
 * Recursively finds all TASK.md files in a directory tree
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of TASK.md file paths
 */
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

/**
 * Validates the quality and completeness of a TODO.md file
 * @param {string} todoPath - Path to TODO.md file
 * @returns {Object} Validation result with valid flag, errors array, and context score
 */
const validateTodoQuality = (todoPath) => {
  if(!fs.existsSync(todoPath)){
    return { valid: false, errors: ['TODO.md was not created'] };
  }

  const content = fs.readFileSync(todoPath, 'utf8');
  const errors = [];

  // Check minimum length
  if(content.length < 500){
    errors.push('TODO.md is too short (< 500 chars) - likely missing context');
  }

  // Check for required sections
  const requiredSections = [
    'Fully implemented:',
    '## Context Reference',
    '## Implementation Plan',
    '## Verification',
    '## Acceptance Criteria',
    '## Impact Analysis',
    '## Follow-ups'
  ];

  for(const section of requiredSections){
    if(!content.includes(section)){
      errors.push(`Missing required section: ${section}`);
    }
  }

  // Check for context reference quality (new structure)
  const contextReferenceIndicators = [
    'AI_PROMPT.md',
    'TASK.md',
    'PROMPT.md'
  ];

  let contextScore = 0;
  for(const indicator of contextReferenceIndicators){
    if(content.includes(indicator)){
      contextScore++;
    }
  }

  if(contextScore < 3){
    errors.push(`Insufficient context references (${contextScore}/3 files) - Context Reference section appears incomplete`);
  }

  // Check for specific patterns (file paths with line numbers) - any file extension
  const hasFileReferences = content.match(/`[^`]+\.[a-zA-Z0-9]+:\d+-?\d*`/);
  if(!hasFileReferences){
    errors.push('No specific file references with line numbers found - context may be too vague');
  }

  // Check for implementation detail
  const implementationPlanMatch = content.match(/## Implementation Plan([\s\S]*?)(?=\n##|$)/);
  if(implementationPlanMatch){
    const planContent = implementationPlanMatch[1];
    const hasDetailedItems = planContent.includes('**What to do:**') &&
                            planContent.includes('**Context (read-only):**') &&
                            planContent.includes('**Touched (will modify/create):**');

    if(!hasDetailedItems){
      errors.push('Implementation Plan items missing required subsections');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    contextScore
  };
};

module.exports = {
  findTaskFiles,
  validateTodoQuality
};
