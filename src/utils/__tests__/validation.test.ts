import { Validation } from '../validation';
import fs from 'fs';
import path from 'path';

describe('Validation', () => {
  describe('isFullyImplemented', () => {
    it('should return true when file contains "Fully implemented: YES" in first 10 lines', () => {
      const testFile = path.join(__dirname, 'test-todo.md');
      const content = `Fully implemented: YES

## Implementation Plan
- [ ] Task 1
- [ ] Task 2`;

      fs.writeFileSync(testFile, content);

      try {
        expect(Validation.isFullyImplemented(testFile)).toBe(true);
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should return false when file does not contain "Fully implemented: YES"', () => {
      const testFile = path.join(__dirname, 'test-todo.md');
      const content = `Fully implemented: NO

## Implementation Plan
- [ ] Task 1
- [ ] Task 2`;

      fs.writeFileSync(testFile, content);

      try {
        expect(Validation.isFullyImplemented(testFile)).toBe(false);
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should return false when "Fully implemented: YES" is inside a task', () => {
      const testFile = path.join(__dirname, 'test-todo.md');
      const content = `Fully implemented: NO

## Implementation Plan
- [ ] Fully implemented: YES
- [ ] Task 2`;

      fs.writeFileSync(testFile, content);

      try {
        expect(Validation.isFullyImplemented(testFile)).toBe(false);
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should handle file not found gracefully', () => {
      expect(() => {
        Validation.isFullyImplemented('/nonexistent/file.md');
      }).toThrow();
    });
  });

  describe('hasApprovedCodeReview', () => {
    it('should return true when file contains "approved" in status section', () => {
      const testFile = path.join(__dirname, 'test-review.md');
      const content = `# Code Review

## Status
Approved by team lead

## Comments
Looks good!`;

      fs.writeFileSync(testFile, content);

      try {
        expect(Validation.hasApprovedCodeReview(testFile)).toBe(true);
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should return false when file does not contain status section', () => {
      const testFile = path.join(__dirname, 'test-review.md');
      const content = `# Code Review

## Comments
Looks good!`;

      fs.writeFileSync(testFile, content);

      try {
        expect(Validation.hasApprovedCodeReview(testFile)).toBe(false);
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should return false when file does not exist', () => {
      expect(Validation.hasApprovedCodeReview('/nonexistent/file.md')).toBe(false);
    });

    it('should return false when status section does not contain "approved"', () => {
      const testFile = path.join(__dirname, 'test-review.md');
      const content = `# Code Review

## Status
Needs changes

## Comments
Please fix these issues.`;

      fs.writeFileSync(testFile, content);

      try {
        expect(Validation.hasApprovedCodeReview(testFile)).toBe(false);
      } finally {
        fs.unlinkSync(testFile);
      }
    });
  });

  // Type safety tests
  describe('Type safety', () => {
    it('should have proper parameter types', () => {
      // This test verifies TypeScript type checking at compile time
      // Create a temporary test file
      const testFile = '/tmp/test-type-safety.md';
      const fs = require('fs');
      fs.writeFileSync(testFile, 'Test content');

      try {
        // These should compile without type errors
        const result1: boolean = Validation.isFullyImplemented(testFile);
        const result2: boolean = Validation.hasApprovedCodeReview(testFile);

        expect(typeof result1).toBe('boolean');
        expect(typeof result2).toBe('boolean');
      } finally {
        // Clean up
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });
});