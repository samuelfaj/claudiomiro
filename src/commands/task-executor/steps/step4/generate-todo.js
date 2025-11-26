const fs = require('fs');
const path = require('path');
const state = require('../../config/state');
const { executeClaude } = require('../../services/claude-executor');

/**
 * Generates a comprehensive TODO.md file for a task
 * This file contains detailed implementation instructions, context references,
 * acceptance criteria, and verification steps
 *
 * @param {string} task - Task identifier (e.g., 'TASK1', 'TASK2.1')
 * @returns {Promise} Result of Claude execution
 */
const generateTodo = async (task) => {
  const folder = (file) => path.join(state.claudiomiroFolder, task, file);

  const TODOtemplate = fs.readFileSync(path.join(__dirname, '../../templates', 'TODO.md'), 'utf-8');

  // Collect context files from previous tasks
  const contextFiles = [
    path.join(state.claudiomiroFolder, 'AI_PROMPT.md')
  ];

  const folders = fs.readdirSync(state.claudiomiroFolder)
    .filter(f => {
      const fullPath = path.join(state.claudiomiroFolder, f);
      return f.startsWith('TASK') && fs.statSync(fullPath).isDirectory();
    });

  for (const f of folders) {
    const taskPath = path.join(state.claudiomiroFolder, f);
    // Include TODO.md (if completed), CONTEXT.md, RESEARCH.md and other relevant .md files
    const filesToCheck = ['TODO.md', 'CONTEXT.md', 'RESEARCH.md', 'DECISIONS.md'];

    filesToCheck.forEach(file => {
      const filePath = path.join(taskPath, file);
      if (fs.existsSync(filePath)) {
        // For TODO.md, only include if task is completed
        if (file === 'TODO.md') {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.startsWith('Fully implemented: YES')) {
            contextFiles.push(filePath);
          }
        } else {
          contextFiles.push(filePath);
        }
      }
    });

    // Also include any other .md files (except the standard ones)
    const otherMdFiles = fs.readdirSync(taskPath)
      .filter(file => {
        return file.endsWith('.md') &&
          !['PROMPT.md', 'TASK.md', 'TODO.md', 'CODE_REVIEW.md'].includes(file) &&
          !file.startsWith('TODO.old.');
      });

    for (const mdFile of otherMdFiles) {
      contextFiles.push(path.join(taskPath, mdFile));
    }
  }

  const contextSection = contextFiles.length > 0
    ? `\n\n## RELATED CONTEXT FROM PREVIOUS TASKS:\nRead these files to understand patterns, decisions, and implementation details from previous tasks:\n${contextFiles.map(f => `- ${f}`).join('\n')}\n\n`
    : '';

  // Load prompt template
  let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-generate-todo.md'), 'utf-8');

  // Replace placeholders
  promptTemplate = promptTemplate
    .replace(/\{\{contextSection\}\}/g, contextSection)
    .replace(/\{\{taskMdPath\}\}/g, folder('TASK.md'))
    .replace(/\{\{promptMdPath\}\}/g, folder('PROMPT.md'))
    .replace(/\{\{todoMdPath\}\}/g, folder('TODO.md'))
    .replace(/\{\{aiPromptPath\}\}/g, path.join(state.claudiomiroFolder, 'AI_PROMPT.md'))
    .replace(/\{\{todoTemplate\}\}/g, TODOtemplate);

  return executeClaude(promptTemplate, task);
};

module.exports = { generateTodo };
