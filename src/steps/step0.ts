import * as fs from 'fs';
import * as path from 'path';
import state from '../config/state';
import * as logger from '../../logger';
import { ClaudeExecutor, PromptReader, FileManager } from '../services/index';
import { Step1 } from './step1';

export interface Step0Options {
  sameBranch?: boolean;
  promptText?: string | null;
  mode?: 'auto' | 'hard';
}

export interface Step0Result {
  success: boolean;
  message?: string;
  error?: Error;
}

export class Step0 {
  /**
   * Execute step0 - Initialize task and create tasks structure
   * @param options Step0 configuration options
   * @returns Promise resolving to step execution result
   */
  static async execute(options: Step0Options = {}): Promise<Step0Result> {
    const { sameBranch = false, promptText = null } = options;

    try {
      const task = promptText || await PromptReader.getMultilineInput();
      const folder = (file: string) => path.join(state.claudiomiroFolder!, file);

      if (!task || task.trim().length < 10) {
        logger.error('Please provide more details (at least 10 characters)');
        process.exit(0);
      }

      logger.newline();
      logger.startSpinner('Initializing task...');

      FileManager.startFresh(true);

      // Ensure the claudiomiro folder exists before writing
      if (!fs.existsSync(state.claudiomiroFolder!)) {
        fs.mkdirSync(state.claudiomiroFolder!, { recursive: true });
      }

      fs.writeFileSync(folder('INITIAL_PROMPT.md'), task);

      const branchStep = sameBranch
        ? ''
        : '0 - Create a git branch for this task\n\n';

      const md = fs.readFileSync(path.join(__dirname, 'step0.md'), 'utf-8');
      const prompt = md.replace('{{TASK}}', task).replace(new RegExp(`{{claudiomiroFolder}}`, 'g'), `${state.claudiomiroFolder}`);

      await ClaudeExecutor.execute(branchStep + prompt);

      logger.stopSpinner();
      logger.success('Tasks created successfully');

      // Check if tasks were created, but only in non-test environment
      if (process.env.NODE_ENV !== 'test') {
        if(
          !fs.existsSync(path.join(state.claudiomiroFolder!, 'TASK0')) &&
          !fs.existsSync(path.join(state.claudiomiroFolder!, 'TASK1'))
        ){
          throw new Error('Error creating tasks');
        }
      }

      await Step1.execute();

      return {
        success: true,
        message: 'Tasks created successfully'
      };
    } catch (error) {
      logger.stopSpinner();

      return {
        success: false,
        message: 'Failed to create tasks',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

export default Step0;