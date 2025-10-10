import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import state from '../config/state';
import { ClaudeExecutor } from '../services/index';
import * as logger from '../../logger';

/**
 * Step5 - GitHub PR generation and commit step
 */
export class Step5 {
  /**
   * Execute git commit with optional push
   * @param text - Commit message
   * @param shouldPush - Whether to push to remote
   * @returns Promise resolving when commit completes
   */
  private static gitCommit(text: string, shouldPush: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const escapedText = text.replace(/"/g, '\\"');
      const gitProcess = spawn('sh', ['-c', `git add . && git commit -m "${escapedText}" ${shouldPush ? ` && git push` : ''}`], {
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        logger.info(text);
      });

      gitProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logger.info(text);
      });

      gitProcess.on('close', (code) => {
        if (code !== 0) {
          const errorMessage = `Git command failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`;
          reject(new Error(errorMessage));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Execute step5 - Generate GitHub PR and commit changes
   * @param tasks - Array of task names
   * @param shouldPush - Whether to push to remote (default: true)
   * @returns Promise resolving when step completes
   */
  static async execute(tasks: string[], shouldPush: boolean = true): Promise<void> {
    const PRS: string[] = [];

    for (const task of tasks) {
      const folder = (file: string): string => path.join(state.claudiomiroFolder!, task, file);
      PRS.push(folder('CODE_REVIEW.md'));
    }

    await ClaudeExecutor.execute(`Read "${PRS.join('" , "')}" and generate a 3 phrase resume of what was done and save in ${path.join(state.claudiomiroFolder!, 'resume.txt')}`);

    if (!fs.existsSync(path.join(state.claudiomiroFolder!, 'resume.txt'))) {
      throw new Error('resume.txt not found');
    }

    const resume = fs.readFileSync(path.join(state.claudiomiroFolder!, 'resume.txt'), 'utf-8');

    const noLimit = process.argv.includes('--no-limit');
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const maxAttemptsPerTask = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
    const limit = noLimit ? Infinity : maxAttemptsPerTask;

    let i = 0;
    while (i < limit) {
      try {
        await Step5.gitCommit(resume, shouldPush);
        logger.info(`✅ Claudiomiro has been successfully executed. Check out: ${state.claudiomiroFolder}`);
        process.exit(0);
      } catch (e) {
        await ClaudeExecutor.execute(`fix error ${(e as Error).message}`);
      }

      i++;
    }

    throw new Error(`Maximum attempts (${maxAttemptsPerTask}) reached for tasks: ${tasks.join(', ')}`);
  }
}

export default Step5;