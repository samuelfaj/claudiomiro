const Diff = require('diff');

/**
 * DiffApplier - Utility for parsing and applying unified diff patches
 *
 * This utility enables token-efficient code editing by allowing LLMs to output
 * patches in unified diff format instead of entire files.
 *
 * Savings: ~60-90% reduction in output tokens
 */
class DiffApplier {
  /**
   * Parse a unified diff string into structured hunks
   * @param {string} diffString - The unified diff content
   * @returns {Array<Object>} Array of parsed diff objects
   */
  parseDiff(diffString) {
    return Diff.parsePatch(diffString);
  }

  /**
   * Apply a unified diff patch to original content
   * @param {string} originalContent - The original file content
   * @param {string} patchString - The unified diff patch
   * @param {Object} options - Options for applying the patch
   * @param {boolean} options.fuzzFactor - Number of lines to allow for fuzzy matching (default: 2)
   * @returns {Object} Result object with success status and patched content or error
   */
  applyPatch(originalContent, patchString, options = {}) {
    const { fuzzFactor = 2 } = options;

    try {
      // Handle empty patch
      if (!patchString || patchString.trim() === '') {
        return {
          success: true,
          content: originalContent,
          warning: 'Empty patch provided, returning original content'
        };
      }

      // Try to apply the patch
      const result = Diff.applyPatch(originalContent, patchString, {
        fuzzFactor
      });

      // applyPatch returns false if it fails
      if (result === false) {
        return {
          success: false,
          error: 'Failed to apply patch - context mismatch',
          originalContent,
          patchString
        };
      }

      return {
        success: true,
        content: result
      };
    } catch (error) {
      return {
        success: false,
        error: `Patch application error: ${error.message}`,
        originalContent,
        patchString
      };
    }
  }

  /**
   * Apply multiple patches from a multi-file diff
   * @param {Map<string, string>} fileContents - Map of file paths to their contents
   * @param {string} multiDiffString - Multi-file unified diff string
   * @returns {Object} Result with patched files and any errors
   */
  applyMultiFilePatch(fileContents, multiDiffString) {
    const patches = this.parseDiff(multiDiffString);
    const results = {
      success: true,
      files: new Map(),
      errors: []
    };

    for (const patch of patches) {
      // Get the file path from the patch (prefer newFileName, fallback to oldFileName)
      const filePath = this.extractFilePath(patch.newFileName || patch.oldFileName);

      if (!filePath) {
        results.errors.push({
          error: 'Could not determine file path from patch',
          patch
        });
        results.success = false;
        continue;
      }

      const originalContent = fileContents.get(filePath);

      if (originalContent === undefined) {
        // New file creation
        if (patch.hunks && patch.hunks.length > 0) {
          const newContent = this.createNewFileFromPatch(patch);
          results.files.set(filePath, {
            success: true,
            content: newContent,
            isNew: true
          });
        } else {
          results.errors.push({
            error: `File not found and patch has no content: ${filePath}`,
            filePath
          });
          results.success = false;
        }
        continue;
      }

      // Create a single-file patch string
      const singlePatchString = this.reconstructPatchString(patch);
      const patchResult = this.applyPatch(originalContent, singlePatchString);

      results.files.set(filePath, patchResult);

      if (!patchResult.success) {
        results.success = false;
        results.errors.push({
          error: patchResult.error,
          filePath
        });
      }
    }

    return results;
  }

  /**
   * Extract file path from diff header, removing a/ or b/ prefixes
   * @param {string} diffPath - Path from diff header
   * @returns {string} Clean file path
   */
  extractFilePath(diffPath) {
    if (!diffPath) return null;

    // Remove common diff prefixes (a/, b/)
    return diffPath.replace(/^[ab]\//, '');
  }

  /**
   * Reconstruct a patch string from a parsed patch object
   * @param {Object} patch - Parsed patch object
   * @returns {string} Unified diff string
   */
  reconstructPatchString(patch) {
    let result = '';

    if (patch.oldFileName) {
      result += `--- ${patch.oldFileName}\n`;
    }
    if (patch.newFileName) {
      result += `+++ ${patch.newFileName}\n`;
    }

    for (const hunk of patch.hunks || []) {
      result += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;

      for (const line of hunk.lines) {
        result += line + '\n';
      }
    }

    return result;
  }

  /**
   * Create new file content from a patch (for new file additions)
   * @param {Object} patch - Parsed patch object
   * @returns {string} File content
   */
  createNewFileFromPatch(patch) {
    const lines = [];

    for (const hunk of patch.hunks || []) {
      for (const line of hunk.lines) {
        // Only include added lines (starting with +) but remove the prefix
        if (line.startsWith('+')) {
          lines.push(line.substring(1));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract all diff blocks from LLM output
   * Handles various formats: ```diff, ```patch, or raw diff content
   * @param {string} llmOutput - Raw output from LLM
   * @returns {Array<string>} Array of diff strings found
   */
  extractDiffsFromOutput(llmOutput) {
    const diffs = [];

    // Pattern to match ```diff or ```patch code blocks
    const codeBlockPattern = /```(?:diff|patch)\s*\n([\s\S]*?)```/gi;

    let match;
    while ((match = codeBlockPattern.exec(llmOutput)) !== null) {
      const diffContent = match[1].trim();
      if (diffContent) {
        diffs.push(diffContent);
      }
    }

    // If no code blocks found, try to find raw diff content
    if (diffs.length === 0) {
      const rawDiffPattern = /^(---\s+.*\n\+\+\+\s+.*\n@@[\s\S]*?)(?=\n---\s+|\n```|$)/gm;

      while ((match = rawDiffPattern.exec(llmOutput)) !== null) {
        const diffContent = match[1].trim();
        if (diffContent) {
          diffs.push(diffContent);
        }
      }
    }

    return diffs;
  }

  /**
   * Validate if a string is a valid unified diff
   * @param {string} diffString - String to validate
   * @returns {Object} Validation result with isValid and details
   */
  validateDiff(diffString) {
    const result = {
      isValid: false,
      hasHeader: false,
      hasHunks: false,
      fileCount: 0,
      errors: []
    };

    if (!diffString || typeof diffString !== 'string') {
      result.errors.push('Diff string is empty or not a string');
      return result;
    }

    // Check for file headers
    const headerPattern = /^---\s+.+\n\+\+\+\s+.+/m;
    result.hasHeader = headerPattern.test(diffString);

    if (!result.hasHeader) {
      result.errors.push('Missing diff header (--- and +++ lines)');
    }

    // Check for hunks
    const hunkPattern = /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m;
    result.hasHunks = hunkPattern.test(diffString);

    if (!result.hasHunks) {
      result.errors.push('Missing hunk headers (@@ ... @@)');
    }

    // Try to parse the diff
    try {
      const patches = this.parseDiff(diffString);
      result.fileCount = patches.length;

      if (patches.length === 0) {
        result.errors.push('No patches could be parsed from the diff');
      }
    } catch (error) {
      result.errors.push(`Parse error: ${error.message}`);
    }

    result.isValid = result.hasHeader && result.hasHunks && result.errors.length === 0;

    return result;
  }

  /**
   * Create a unified diff from two strings
   * @param {string} oldContent - Original content
   * @param {string} newContent - Modified content
   * @param {string} fileName - File name for the diff header
   * @returns {string} Unified diff string
   */
  createDiff(oldContent, newContent, fileName = 'file') {
    return Diff.createTwoFilesPatch(
      `a/${fileName}`,
      `b/${fileName}`,
      oldContent,
      newContent,
      '',
      '',
      { context: 3 }
    );
  }
}

// Export singleton instance
const diffApplier = new DiffApplier();

module.exports = diffApplier;
module.exports.DiffApplier = DiffApplier;
