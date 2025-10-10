import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import logger from '../../logger';
import state from '../config/state';
import { CodexLogger } from './codex-logger';
import ParallelStateManager from './parallel-state-manager';


const overwriteBlock = (lines: number): void => {
  process.stdout.write(`\x1b[${lines}A`);
  for (let i = 0; i < lines; i++) {
    process.stdout.write('\x1b[2K');
    process.stdout.write('\x1b[1B');
  }
  process.stdout.write(`\x1b[${lines}A`);
};

const runCodex = (text: string, taskName: string | null = null): Promise<void> => {
  return executeCodex(text, taskName);
};

const executeCodex = (text: string, taskName: string | null = null): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stateManager = taskName ? ParallelStateManager.getInstance() : null;
    const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();
    const tmpFile = path.join(os.tmpdir(), `claudiomiro-codex-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, text, 'utf-8');

    const command = `codex exec --json --full-auto --sandbox danger-full-access "$(cat '${tmpFile}')"`;

    logger.stopSpinner();
    logger.command('codex exec --json --full-auto --sandbox danger-full-access ...');
    logger.separator();
    logger.newline();

    const codex = spawn('sh', ['-c', command], {
      cwd: state.folder,
      stdio: ['ignore', 'pipe', 'pipe'] as const
    });

    const logFilePath = path.join(state.claudiomiroFolder, 'codex-log.txt');
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    const timestamp = new Date().toISOString();
    logStream.write(`\n\n${'='.repeat(80)}\n`);
    logStream.write(`[${timestamp}] Codex execution started\n`);
    logStream.write(`${'='.repeat(80)}\n\n`);

    let buffer = '';
    let overwriteBlockLines = 0;

    const logMessage = (content: string) => {
      if (!suppressStreamingLogs && overwriteBlockLines > 0) {
        overwriteBlock(overwriteBlockLines);
      }

      const max = process.stdout.columns || 80;
      let lineCount = 0;

      if (suppressStreamingLogs) {
        overwriteBlockLines = 0;
        return;
      }

      console.log('💬 Codex:');
      lineCount++;

      const segments = content.split('\n');
      for (const segment of segments) {
        if (segment.length > max) {
          for (let i = 0; i < segment.length; i += max) {
            console.log(segment.substring(i, i + max));
            lineCount++;
          }
        } else {
          console.log(segment);
          lineCount++;
        }
      }

      overwriteBlockLines = lineCount;
    };

    codex.stdout.on('data', (data: Buffer) => {
      const output = data.toString();

      buffer += output;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const formatted = CodexLogger.processEvent(line);
        if (formatted) {
          logMessage(formatted);
          if (stateManager && taskName) {
            stateManager.updateClaudeMessage(taskName, formatted);
          }
        }
      }

      logStream.write(output);
    });

    codex.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      logStream.write('[STDERR] ' + output);
    });

    codex.on('close', (code: number | null) => {
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (error: any) {
        logger.error(`Failed to cleanup temp file: ${error.message}`);
      }

      logger.newline();
      logger.newline();

      logStream.write(`\n\n[${new Date().toISOString()}] Codex execution completed with code ${code}\n`);
      logStream.end();

      logger.newline();
      logger.separator();

      if (code !== 0) {
        logger.error(`Codex exited with code ${code}`);
        reject(new Error(`Codex exited with code ${code}`));
      } else {
        logger.success('Codex execution completed');
        resolve();
      }
    });

    codex.on('error', (error: Error) => {
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (cleanupError: any) {
        logger.error(`Failed to cleanup temp file: ${cleanupError.message}`);
      }

      logStream.write(`\n\nERROR: ${error.message}\n`);
      logStream.end();
      logger.error(`Failed to execute Codex: ${error.message}`);
      reject(error);
    });
  });
};

export class CodexExecutor {
  /**
   * Execute Codex with the given text
   * @param text The text to execute with Codex
   * @returns Promise resolving when execution completes
   */
  static async execute(text: string): Promise<void> {
    return runCodex(text);
  }
};

export { executeCodex };