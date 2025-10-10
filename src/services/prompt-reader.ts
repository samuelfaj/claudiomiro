import readline from 'readline';
import logger from '../../logger';

// Use require for chalk to avoid module resolution issues
const chalk = require('chalk');

export interface PromptReaderInterface {
  getMultilineInput(): Promise<string>;
}

export class PromptReader {
  /**
   * Reads multiline input from the user with proper formatting and handling
   * @returns Promise resolving to the user input string
   */
  static async getMultilineInput(): Promise<string> {
    return new Promise<string>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });

      const lines: string[] = [];
      let isFirstLine = true;

      console.log();
      console.log(chalk.bold.cyan('─────────────────────────────────────────────'));
      console.log(chalk.white('Describe what you need help with:'));
      console.log(chalk.bold.cyan('─────────────────────────────────────────────'));
      console.log(chalk.gray('✓ Write or paste your task description'));
      console.log(chalk.gray('✓ Paste code, URLs, or drag & drop file paths'));
      console.log(chalk.gray('✓ Press ENTER twice to submit'));
      console.log(chalk.gray('✓ Press Ctrl+C to cancel'));
      console.log(chalk.bold.cyan('─────────────────────────────────────────────'));
      console.log();
      process.stdout.write(chalk.cyan('🤖 > '));

      rl.on('line', (line: string) => {
        if (line.trim() === '' && lines.length > 0 && lines[lines.length - 1].trim() === '') {
          // Second consecutive empty line - finish input
          rl.close();
          const result = lines.slice(0, -1).join('\n').trim();
          resolve(result);
        } else {
          lines.push(line);
          if (!isFirstLine) {
            process.stdout.write(chalk.cyan('    '));
          }
          isFirstLine = false;
        }
      });

      rl.on('SIGINT', () => {
        rl.close();
        console.log();
        logger.error('Operation cancelled');
        process.exit(0);
      });
    });
  }
}

export default PromptReader;