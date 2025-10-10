import * as fs from 'fs';

export class Validation {
  /**
   * Checks if a TODO file is fully implemented
   * @param file - Path to the TODO file
   * @returns true if the file contains "Fully implemented: YES" in the first 10 lines
   */
  static isFullyImplemented(file: string): boolean {
    const todo = fs.readFileSync(file, 'utf-8');
    const lines = todo.split('\n').slice(0, 10); // Check first 10 lines

    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();
      // Check if line is exactly "fully implemented: yes" (not inside a task)
      if (trimmedLine === 'fully implemented: yes' || trimmedLine.startsWith('fully implemented: yes')) {
        // Make sure it's not part of a task (doesn't start with - [ ])
        if (!line.trim().startsWith('-')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a file has an approved code review status
   * @param file - Path to the file to check
   * @returns true if the file contains "approved" in the status section
   */
  static hasApprovedCodeReview(file: string): boolean {
    if (!fs.existsSync(file)) {
      return false;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const statusIndex = lines.findIndex(line => line.trim().toLowerCase() === '## status');

    if (statusIndex === -1) {
      return false;
    }

    for (let i = statusIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const value = line.trim();
      if (value === '') {
        continue;
      }

      return value.toLowerCase().includes('approved');
    }

    return false;
  }
}