import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import logger from '../../logger';
import state from '../config/state';
import { DeepSeekLogger } from './deep-seek-logger';
import ParallelStateManager from './parallel-state-manager';

interface ExecutorConfig {
  cwd: string | null;
  stdio: ('ignore' | 'pipe')[];
}

const overwriteBlock = (lines: number): void => {
  // Move o cursor para cima N linhas e limpa cada uma
  process.stdout.write(`\x1b[${lines}A`);
  for (let i = 0; i < lines; i++) {
    process.stdout.write('\x1b[2K'); // limpa linha
    process.stdout.write('\x1b[1B'); // desce uma linha
  }
  // Volta para o topo do bloco
  process.stdout.write(`\x1b[${lines}A`);
};

const runDeepSeek = (text: string, taskName: string | null = null): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stateManager = taskName ? ParallelStateManager.getInstance() : null;
    const suppressStreamingLogs = Boolean(taskName) && stateManager && typeof stateManager.isUIRendererActive === 'function' && stateManager.isUIRendererActive();

    if(!text){
      throw new Error('no prompt');
    }

    // Create temporary file for the prompt
    const tmpFile = path.join(os.tmpdir(), `claudiomiro-codex-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, text, 'utf-8');

    // Use sh to execute command with cat substitution
    const command = `deepseek --dangerously-skip-permissions -p "$(cat '${tmpFile}')" --output-format stream-json --verbose`;

    logger.stopSpinner();
    logger.command(command);
    logger.separator();
    logger.newline();

    const deepSeek: ChildProcess = spawn('sh', ['-c', command], {
      cwd: state.folder || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    } as ExecutorConfig);

    const logFilePath = path.join(state.claudiomiroFolder || '/tmp', 'log.txt');
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    // Log separator with timestamp
    const timestamp = new Date().toISOString();
    logStream.write(`\n\n${'='.repeat(80)}\n`);
    logStream.write(`[${timestamp}] DeepSeek execution started\n`);
    logStream.write(`${'='.repeat(80)}\n\n`);

    let buffer = '';
    let overwriteBlockLines = 0;

    // Captura stdout e processa JSON streaming
    deepSeek.stdout!.on('data', (data: Buffer) => {
      const output = data.toString();
      // Adiciona ao buffer
      buffer += output;

      // Processa linhas completas
      const lines = buffer.split('\n');

      // A última linha pode estar incompleta, então mantém no buffer
      buffer = lines.pop() || '';

      const log = (text: string): void => {
        // Sobrescreve o bloco anterior se existir
        if (!suppressStreamingLogs && overwriteBlockLines > 0){
          overwriteBlock(overwriteBlockLines);
        }

        const max = process.stdout.columns || 80;
        let lineCount = 0;

        if (suppressStreamingLogs) {
          overwriteBlockLines = 0;
          return;
        }

        // Imprime cabeçalho
        console.log(`💬 DeepSeek:`);
        lineCount++;

        // Processa e imprime o texto linha por linha
        const lines = text.split("\n");
        for(const line of lines){
          if(line.length > max){
            // Quebra linha longa em múltiplas linhas
            for(let i = 0; i < line.length; i += max){
              console.log(line.substring(i, i + max));
              lineCount++;
            }
          }else{
            console.log(line);
            lineCount++;
          }
        }

        // Atualiza contador para próximo overwrite
        overwriteBlockLines = lineCount;
      };

      for (const line of lines) {
        const text = DeepSeekLogger.processMessage(line);
        if(text){
          log(text);
          // Update state manager with DeepSeek message if taskName provided
          if (stateManager && taskName) {
            stateManager.updateClaudeMessage(taskName, text);
          }
        }
      }

      // Log to file
      logStream.write(output);
    });

    // Captura stderr
    deepSeek.stderr!.on('data', (data: Buffer) => {
      const output = data.toString();
      // process.stderr.write(output);
      logStream.write('[STDERR] ' + output);
    });

    // Quando o processo terminar
    deepSeek.on('close', (code: number | null) => {
      // Clean up temporary file
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (err: any) {
        logger.error(`Failed to cleanup temp file: ${err.message}`);
      }

      logger.newline();
      logger.newline();

      logStream.write(`\n\n[${new Date().toISOString()}] DeepSeek execution completed with code ${code}\n`);
      logStream.end();

      logger.newline();
      logger.separator();

      if (code !== 0) {
        logger.error(`DeepSeek exited with code ${code}`);
        reject(new Error(`DeepSeek exited with code ${code}`));
      } else {
        logger.success('DeepSeek execution completed');
        resolve();
      }
    });

    // Tratamento de erro
    deepSeek.on('error', (error: Error) => {
      // Clean up temporary file on error
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (err: any) {
        logger.error(`Failed to cleanup temp file: ${err.message}`);
      }

      logStream.write(`\n\nERROR: ${error.message}\n`);
      logStream.end();
      logger.error(`Failed to execute DeepSeek: ${error.message}`);
      reject(error);
    });
  });
};

export class DeepSeekExecutor {
  /**
   * Execute DeepSeek with the given text
   * @param text The text to execute with DeepSeek
   * @param taskName Optional task name for parallel execution
   * @returns Promise resolving when execution completes
   */
  static async execute(text: string, taskName: string | null = null): Promise<void> {
    return runDeepSeek(text, taskName);
  }
};

const executeDeepSeek = runDeepSeek;

export { executeDeepSeek };