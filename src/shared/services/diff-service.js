const fs = require('fs');
const path = require('path');
const diffApplier = require('../utils/diff-applier');

/**
 * DiffService - Service for processing and applying diffs from LLM output
 *
 * Token Optimization: Instead of LLM outputting entire file contents,
 * use unified diffs to reduce token consumption by 80-95%.
 */
class DiffService {
  constructor(rootPath = process.cwd()) {
    this.rootPath = rootPath;
    this.appliedDiffs = [];
    this.failedDiffs = [];
  }

  /**
   * Process LLM output and apply any diffs found
   * @param {string} llmOutput - Raw output from LLM
   * @param {Object} options - Processing options
   * @returns {Object} Result with applied and failed diffs
   */
  processOutput(llmOutput, options = {}) {
    const { dryRun = false, backup = true } = options;

    this.appliedDiffs = [];
    this.failedDiffs = [];

    // Extract diffs from output
    const diffs = diffApplier.extractDiffsFromOutput(llmOutput);

    if (diffs.length === 0) {
      return {
        success: true,
        message: 'No diffs found in output',
        applied: [],
        failed: []
      };
    }

    // Process each diff
    for (const diff of diffs) {
      const result = this.processSingleDiff(diff, { dryRun, backup });

      if (result.success) {
        this.appliedDiffs.push(result);
      } else {
        this.failedDiffs.push(result);
      }
    }

    return {
      success: this.failedDiffs.length === 0,
      message: this.getResultMessage(),
      applied: this.appliedDiffs,
      failed: this.failedDiffs
    };
  }

  /**
   * Process a single diff string
   * @param {string} diffString - Unified diff string
   * @param {Object} options - Processing options
   * @returns {Object} Result of diff application
   */
  processSingleDiff(diffString, options = {}) {
    const { dryRun = false, backup = true } = options;

    // Validate the diff
    const validation = diffApplier.validateDiff(diffString);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid diff: ${validation.errors.join(', ')}`,
        diff: diffString.substring(0, 200)
      };
    }

    // Parse the diff to get file info
    const parsed = diffApplier.parseDiff(diffString);
    if (!parsed || parsed.length === 0) {
      return {
        success: false,
        error: 'Failed to parse diff',
        diff: diffString.substring(0, 200)
      };
    }

    const results = [];

    // Apply each file patch
    for (const patch of parsed) {
      const filePath = this.resolveFilePath(patch);
      if (!filePath) {
        results.push({
          success: false,
          error: 'Could not determine file path from diff',
          patch: patch
        });
        continue;
      }

      const fullPath = path.join(this.rootPath, filePath);
      const isNewFile = patch.oldFileName === '/dev/null';

      if (dryRun) {
        results.push({
          success: true,
          file: filePath,
          dryRun: true,
          isNewFile
        });
        continue;
      }

      try {
        // Handle new file creation
        if (isNewFile) {
          const content = diffApplier.createNewFileFromPatch(patch);
          const dir = path.dirname(fullPath);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(fullPath, content);
          results.push({
            success: true,
            file: filePath,
            isNewFile: true
          });
          continue;
        }

        // Handle existing file modification
        if (!fs.existsSync(fullPath)) {
          results.push({
            success: false,
            error: `File not found: ${filePath}`,
            file: filePath
          });
          continue;
        }

        // Create backup if requested
        if (backup) {
          const backupPath = `${fullPath}.backup`;
          fs.copyFileSync(fullPath, backupPath);
        }

        // Read current content
        const currentContent = fs.readFileSync(fullPath, 'utf-8');

        // Reconstruct patch string for this specific file
        const patchString = diffApplier.reconstructPatchString(patch);

        // Apply the patch
        const applyResult = diffApplier.applyPatch(currentContent, patchString);

        if (applyResult.success) {
          fs.writeFileSync(fullPath, applyResult.content);
          results.push({
            success: true,
            file: filePath,
            isNewFile: false
          });
        } else {
          results.push({
            success: false,
            error: applyResult.error,
            file: filePath
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          file: filePath
        });
      }
    }

    // Aggregate results
    const allSuccess = results.every(r => r.success);
    const files = results.map(r => r.file).filter(Boolean);

    return {
      success: allSuccess,
      files,
      results,
      error: allSuccess ? null : results.filter(r => !r.success).map(r => r.error).join('; ')
    };
  }

  /**
   * Resolve file path from parsed patch
   * @param {Object} patch - Parsed patch object
   * @returns {string|null} File path or null
   */
  resolveFilePath(patch) {
    // Try new file name first (for modifications and new files)
    if (patch.newFileName && patch.newFileName !== '/dev/null') {
      return diffApplier.extractFilePath(patch.newFileName);
    }

    // Fall back to old file name (for deletions)
    if (patch.oldFileName && patch.oldFileName !== '/dev/null') {
      return diffApplier.extractFilePath(patch.oldFileName);
    }

    return null;
  }

  /**
   * Get result message
   * @returns {string} Summary message
   */
  getResultMessage() {
    const appliedCount = this.appliedDiffs.length;
    const failedCount = this.failedDiffs.length;

    if (failedCount === 0) {
      return `Successfully applied ${appliedCount} diff(s)`;
    }

    return `Applied ${appliedCount} diff(s), ${failedCount} failed`;
  }

  /**
   * Rollback applied diffs by restoring backups
   * @returns {Object} Rollback result
   */
  rollback() {
    const rolledBack = [];
    const errors = [];

    for (const applied of this.appliedDiffs) {
      if (!applied.files) continue;

      for (const file of applied.files) {
        const fullPath = path.join(this.rootPath, file);
        const backupPath = `${fullPath}.backup`;

        try {
          if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, fullPath);
            fs.unlinkSync(backupPath);
            rolledBack.push(file);
          }
        } catch (error) {
          errors.push({ file, error: error.message });
        }
      }
    }

    return {
      success: errors.length === 0,
      rolledBack,
      errors
    };
  }

  /**
   * Clean up backup files
   */
  cleanupBackups() {
    for (const applied of this.appliedDiffs) {
      if (!applied.files) continue;

      for (const file of applied.files) {
        const backupPath = path.join(this.rootPath, `${file}.backup`);
        try {
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }
}

// Singleton instance
const diffService = new DiffService();

module.exports = {
  DiffService,
  diffService,
  processOutput: (output, options) => diffService.processOutput(output, options),
  processSingleDiff: (diff, options) => diffService.processSingleDiff(diff, options)
};
