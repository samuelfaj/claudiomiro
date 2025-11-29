const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');

/**
 * Generates CONTEXT.md file after successful task completion
 * Creates a lightweight summary that references other files for details
 *
 * @param {string} task - Task identifier (e.g., 'TASK1')
 * @returns {Promise<void>}
 */
const generateContextFile = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);

    // Only generate CONTEXT.md if task is fully implemented
    if (!fs.existsSync(folder('TODO.md'))) {
        return;
    }

    const todoContent = fs.readFileSync(folder('TODO.md'), 'utf8');
    if (!todoContent.startsWith('Fully implemented: YES')) {
        return;
    }

    // Collect information for CONTEXT.md
    const _taskMd = fs.existsSync(folder('TASK.md')) ? fs.readFileSync(folder('TASK.md'), 'utf8') : '';

    // Extract modified files from TODO.md
    const modifiedFiles = [];
    const todoLines = todoContent.split('\n');
    for (const line of todoLines) {
    // Look for file paths in TODO items
        const fileMatch = line.match(/`([^`]+\.(js|ts|jsx|tsx|py|java|go|rb|php|cs|cpp|c|h|json|yaml|yml|md))`/g);
        if (fileMatch) {
            fileMatch.forEach(match => {
                const file = match.replace(/`/g, '');
                if (!modifiedFiles.includes(file)) {
                    modifiedFiles.push(file);
                }
            });
        }
    }

    // Extract key decisions from TODO.md by looking for implementation notes
    const keyDecisions = [];
    let inDecisionsSection = false;
    for (const line of todoLines) {
        if (line.includes('## Key Decisions') || line.includes('## Notes') || line.includes('## Implementation')) {
            inDecisionsSection = true;
            continue;
        }
        if (line.startsWith('## ') && inDecisionsSection) {
            inDecisionsSection = false;
        }
        if (inDecisionsSection && line.trim() && !line.startsWith('#')) {
            keyDecisions.push(line.trim());
        }
    }

    // Read RESEARCH.md to include execution strategy context
    let _researchSummary = 'No research file available';
    if (fs.existsSync(folder('RESEARCH.md'))) {
        const researchContent = fs.readFileSync(folder('RESEARCH.md'), 'utf8');
        const strategyMatch = researchContent.match(/## Execution Strategy\n([\s\S]*?)(?=\n##|\n```|$)/);
        if (strategyMatch) {
            _researchSummary = strategyMatch[1].trim().split('\n').slice(0, 5).join('\n');
        }
    }

    // Load CONTEXT.md template
    let contextTemplate = fs.readFileSync(path.join(__dirname, '../../templates/context.md'), 'utf-8');

    // Prepare data for template
    const attempts = fs.existsSync(folder('info.json'))
        ? JSON.parse(fs.readFileSync(folder('info.json'), 'utf8')).attempts
        : 1;

    const modifiedFilesList = modifiedFiles.length > 0
        ? modifiedFiles.map(f => `- \`${f}\``).join('\n')
        : '- No files modified';

    const quickNotesBase = keyDecisions.length > 0
        ? keyDecisions.slice(0, 3).map(d => `- ${d}`).join('\n')
        : '- All details in TODO.md';

    const quickNotes = quickNotesBase + (keyDecisions.length > 3 ? '\n...(see TODO.md for complete details)' : '');

    const timestamp = new Date().toISOString();

    // Replace placeholders in template
    const contextContent = contextTemplate
        .replace(/\{\{task\}\}/g, task)
        .replace(/\{\{attempts\}\}/g, attempts)
        .replace(/\{\{modifiedFilesCount\}\}/g, modifiedFiles.length)
        .replace(/\{\{modifiedFilesList\}\}/g, modifiedFilesList)
        .replace(/\{\{quickNotes\}\}/g, quickNotes)
        .replace(/\{\{timestamp\}\}/g, timestamp);

    fs.writeFileSync(folder('CONTEXT.md'), contextContent, 'utf8');
};

module.exports = { generateContextFile };
