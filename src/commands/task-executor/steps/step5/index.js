const fs = require('fs');
const path = require('path');
const state = require('../../../../shared/config/state');
const { executeClaude } = require('../../../../shared/executors/claude-executor');
const { generateResearchFile } = require('./generate-research');
const { generateContextFile } = require('./generate-context');
const {
    buildConsolidatedContextAsync,
    markTaskCompleted,
    getContextFilePaths,
} = require('../../../../shared/services/context-cache');

/**
 * Step 5: Task Execution
 *
 * Executes the actual implementation of a task by:
 * 1. Generating RESEARCH.md with codebase analysis (first run or after failures)
 * 2. Building context from previous tasks and research
 * 3. Executing the task using TODO.md as the implementation guide
 * 4. Generating CONTEXT.md to document what was done
 * 5. Tracking execution attempts and handling re-research after multiple failures
 *
 * This is the core implementation step where actual code changes happen.
 */

const _listFolders = (dir) => {
    return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory());
};

const step5 = async (task) => {
    const folder = (file) => path.join(state.claudiomiroFolder, task, file);
    const logger = require('../../../../shared/utils/logger');

    // Check if we need to re-research due to multiple failures
    let needsReResearch = false;
    if(fs.existsSync(folder('info.json'))){
        const info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        // Re-research if: 3+ attempts AND last attempt failed
        if(info.attempts >= 3 && info.lastError){
            needsReResearch = true;
            logger.warning(`Task has failed ${info.attempts} times. Re-analyzing approach...`);
            // Remove old RESEARCH.md to force new analysis
            if(fs.existsSync(folder('RESEARCH.md'))){
                fs.renameSync(folder('RESEARCH.md'), folder('RESEARCH.old.md'));
            }
        }
    }

    // PHASE 1: Research and context gathering (only on first run or after multiple failures)
    await generateResearchFile(task);

    if(fs.existsSync(folder('CODE_REVIEW.md'))){
        fs.rmSync(folder('CODE_REVIEW.md'));
    }

    // Read task description for code-index symbol search
    const taskMdPath = folder('TASK.md');
    const taskDescription = fs.existsSync(taskMdPath)
        ? fs.readFileSync(taskMdPath, 'utf-8').substring(0, 500)
        : task;

    // Use incremental context collection instead of reading all files
    // This significantly reduces token consumption by:
    // 1. Using cached AI_PROMPT summary instead of full file
    // 2. Only including new context since last processed task
    // 3. Using consolidated summaries instead of full file paths
    // 4. Adding relevant code symbols from code-index (if available)

    const consolidatedContext = await buildConsolidatedContextAsync(
        state.claudiomiroFolder,
        task,
        state.folder,
        taskDescription,
    );

    // Get minimal context file paths for reference (not full content)
    const contextFilePaths = getContextFilePaths(state.claudiomiroFolder, task, {
        includeContext: true,
        includeResearch: false, // Current task's RESEARCH.md is added separately
        includeTodo: false,
        onlyCompleted: true,
    });

    // Add current task's RESEARCH.md if exists
    if(fs.existsSync(folder('RESEARCH.md'))){
        contextFilePaths.push(folder('RESEARCH.md'));
    }

    // Update TODO.md with consolidated context (much smaller than listing all files)
    if(fs.existsSync(folder('TODO.md'))){
        let todo = fs.readFileSync(folder('TODO.md'), 'utf8');

        if(!todo.includes('## CONSOLIDATED CONTEXT:')){
        // Add consolidated context summary instead of file list
            const contextSection = `\n\n## CONSOLIDATED CONTEXT:
${consolidatedContext}

## REFERENCE FILES (read if more detail needed):
${contextFilePaths.map(f => `- ${f}`).join('\n')}
\n`;
            todo += contextSection;
            fs.writeFileSync(folder('TODO.md'), todo, 'utf8');
        }
    }

    if(fs.existsSync(folder('info.json'))){
        let info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        info.attempts += 1;
        info.lastError = null;
        info.lastRun = new Date().toISOString();
        info.reResearched = needsReResearch || info.reResearched || false;

        // Track execution history
        if(!info.history) info.history = [];
        info.history.push({
            timestamp: new Date().toISOString(),
            attempt: info.attempts,
            reResearched: needsReResearch,
        });

        fs.writeFileSync(folder('info.json'), JSON.stringify(info, null, 2), 'utf8');
    }else{
        let info = {
            firstRun: new Date().toISOString(),
            lastRun: new Date().toISOString(),
            attempts: 1,
            lastError: null,
            reResearched: false,
            history: [{
                timestamp: new Date().toISOString(),
                attempt: 1,
                reResearched: false,
            }],
        };
        fs.writeFileSync(folder('info.json'), JSON.stringify(info, null, 2), 'utf8');
    }

    // Insert into prompt.md or task.md the generated md files from other tasks.

    try {
        // Build execution context
        const researchSection = fs.existsSync(folder('RESEARCH.md'))
            ? `\n## RESEARCH CONTEXT:\nBEFORE starting, read ${folder('RESEARCH.md')} completely. It contains:\n- Files you need to read/modify\n- Code patterns to follow\n- Integration points\n- Test strategy\n- Potential challenges\n- Execution strategy\n\nThis research was done specifically for this task. Follow the execution strategy outlined there.\n\n---\n`
            : '';

        // Load prompt template
        let promptTemplate = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');

        // Replace placeholders
        promptTemplate = promptTemplate
            .replace(/\{\{todoPath\}\}/g, folder('TODO.md'))
            .replace(/\{\{researchSection\}\}/g, researchSection);

        const result = await executeClaude(promptTemplate, task);

        // Generate CONTEXT.md after successful execution
        await generateContextFile(task);

        // Mark task as completed in cache for incremental context tracking
        markTaskCompleted(state.claudiomiroFolder, task);

        return result;
    } catch (error) {

        let info = JSON.parse(fs.readFileSync(folder('info.json'), 'utf8'));
        info.lastError = {
            message: error.message,
            timestamp: new Date().toISOString(),
            attempt: info.attempts,
        };

        // Add to error history
        if(!info.errorHistory) info.errorHistory = [];
        info.errorHistory.push({
            timestamp: new Date().toISOString(),
            attempt: info.attempts,
            message: error.message,
            stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : null,
        });

        fs.writeFileSync(folder('info.json'), JSON.stringify(info, null, 2), 'utf8');

        // If executeClaude fails, ensure TODO.md is marked as not fully implemented
        if (fs.existsSync(folder('TODO.md'))) {
            let todo = fs.readFileSync(folder('TODO.md'), 'utf8');
            const lines = todo.split('\n');

            // Update the first line to be "Fully implemented: NO" if it exists
            if (lines.length > 0) {
                lines[0] = 'Fully implemented: NO';
                todo = lines.join('\n');
                fs.writeFileSync(folder('TODO.md'), todo, 'utf8');
            }
        }

        // Re-throw the error so the dag-executor can handle it
        throw error;
    }
};

module.exports = { step5 };
