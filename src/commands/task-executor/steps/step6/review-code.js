const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');

/**
 * Performs systematic code review of implemented task
 * Verifies completeness, correctness, testing, and adherence to requirements
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @returns {Promise} Result of Claude execution
 */
const reviewCode = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    if(fs.existsSync(folder('CODE_REVIEW.md'))){
      fs.rmSync(folder('CODE_REVIEW.md'));
    }

    if (fs.existsSync(folder('GITHUB_PR.md'))) {
      fs.rmSync(folder('GITHUB_PR.md'));
    }

    // Collect context files for comprehensive review
    const contextFiles = [
      path.join(state.claudiomiroFolder, 'AI_PROMPT.md'),
      path.join(state.claudiomiroFolder, 'INITIAL_PROMPT.md')
    ];

    // Add RESEARCH.md and CONTEXT.md if they exist for this task
    if(fs.existsSync(folder('RESEARCH.md'))){
      contextFiles.push(folder('RESEARCH.md'));
    }
    if(fs.existsSync(folder('CONTEXT.md'))){
      contextFiles.push(folder('CONTEXT.md'));
    }

    // Collect context from related tasks (dependencies)
    const listFolders = (dir) => {
      try {
        return fs.readdirSync(dir).filter(f => {
          try {
            return fs.statSync(path.join(dir, f)).isDirectory();
          } catch {
            return false;
          }
        });
      } catch {
        return [];
      }
    };

    const folders = listFolders(state.claudiomiroFolder).filter(f => f.startsWith('TASK'));
    for(const f of folders){
      if(f === task) continue; // Skip current task
      const taskPath = path.join(state.claudiomiroFolder, f);
      ['CONTEXT.md', 'RESEARCH.md'].forEach(file => {
        const filePath = path.join(taskPath, file);
        if(fs.existsSync(filePath) && !contextFiles.includes(filePath)){
          contextFiles.push(filePath);
        }
      });
    }

    const contextSection = contextFiles.length > 0
      ? `\n\n## 📚 CONTEXT FILES FOR COMPREHENSIVE REVIEW\nTo understand patterns, decisions, and system architecture, read these files:\n${contextFiles.map(f => `- ${f}`).join('\n')}\n\nThese provide:\n- Original requirements and user intent\n- Architectural decisions from previous tasks\n- Code patterns and conventions used\n- Integration points and contracts\n\n`
      : '';

    // Load prompt template
    let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt-review.md'), 'utf-8');

    // Build research section
    const researchSection = fs.existsSync(folder('RESEARCH.md'))
      ? `4. **${folder('RESEARCH.md')}** → Pre-implementation analysis and execution strategy`
      : '';

    // Replace placeholders
    promptTemplate = promptTemplate
      .replace(/\{\{contextSection\}\}/g, contextSection)
      .replace(/\{\{promptMdPath\}\}/g, folder('PROMPT.md'))
      .replace(/\{\{taskMdPath\}\}/g, folder('TASK.md'))
      .replace(/\{\{todoMdPath\}\}/g, folder('TODO.md'))
      .replace(/\{\{codeReviewMdPath\}\}/g, folder('CODE_REVIEW.md'))
      .replace(/\{\{researchMdPath\}\}/g, folder('RESEARCH.md'))
      .replace(/\{\{researchSection\}\}/g, researchSection);

    const execution = await executeClaude(promptTemplate, task);

    return execution;
};

module.exports = { reviewCode };
