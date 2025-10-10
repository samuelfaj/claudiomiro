import fs from 'fs';
import logger from '../../logger';
import state from '../config/state';

export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: Error;
}

export interface FileManagerInterface {
  startFresh(createFolder?: boolean): FileOperationResult;
}

export class FileManager {
  /**
   * Cleans up previous files and optionally creates a fresh folder
   * @param createFolder Whether to create a new folder after cleanup
   * @returns FileOperationResult indicating success or failure
   */
  static startFresh(createFolder: boolean = false): FileOperationResult {
    try {
      logger.task('Cleaning up previous files...');
      logger.indent();

      if (fs.existsSync(state.claudiomiroFolder)) {
        fs.rmSync(state.claudiomiroFolder, { recursive: true });
        logger.success(`${state.claudiomiroFolder} removed\n`);
      }

      if (createFolder) {
        fs.mkdirSync(state.claudiomiroFolder);
      }

      logger.outdent();

      return {
        success: true,
        message: 'File cleanup completed successfully'
      };
    } catch (error) {
      logger.error('Failed to clean up files');
      return {
        success: false,
        error: error as Error,
        message: 'File cleanup failed'
      };
    }
  }
}

export default FileManager;